from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd
from google.api_core.exceptions import NotFound
from google.cloud import bigquery

from geospatial.geo_utils import (
    PROJECT_ID,
    create_bigquery_client,
    create_nominatim_geocoder,
    current_timestamp,
    geocode_location,
    print_geo_summary,
    query_to_dataframe,
    upload_dataframe,
)


TABLE_NAME = "PlayerBirthplace"
STAGE_TABLE_NAME = "PlayerBirthplace_Stage"

TARGET_TABLE = (
    f"{PROJECT_ID}.Geo.{TABLE_NAME}"
)

STAGE_TABLE = (
    f"{PROJECT_ID}.Geo.{STAGE_TABLE_NAME}"
)

BATCH_SIZE = 50
REFRESH_MONTHS = 6


SCHEMA = [
    bigquery.SchemaField("playerId", "INTEGER"),
    bigquery.SchemaField("player_name", "STRING"),
    bigquery.SchemaField("birth_city", "STRING"),
    bigquery.SchemaField("birth_state", "STRING"),
    bigquery.SchemaField("birth_country", "STRING"),
    bigquery.SchemaField("query", "STRING"),
    bigquery.SchemaField("latitude", "FLOAT"),
    bigquery.SchemaField("longitude", "FLOAT"),
    bigquery.SchemaField("matched_address", "STRING"),
    bigquery.SchemaField("geography_wkt", "STRING"),
    bigquery.SchemaField("geocode_status", "STRING"),
    bigquery.SchemaField("last_updated", "TIMESTAMP"),
]


def table_exists(
    client: bigquery.Client,
    table_id: str,
) -> bool:
    try:
        client.get_table(table_id)
        return True
    except NotFound:
        return False


def create_target_table(
    client: bigquery.Client,
) -> None:
    if table_exists(
        client,
        TARGET_TABLE,
    ):
        return

    table = bigquery.Table(
        TARGET_TABLE,
        schema=SCHEMA,
    )

    client.create_table(
        table
    )

    print(
        f"Created {TARGET_TABLE}"
    )


def load_players(
    client: bigquery.Client,
) -> pd.DataFrame:
    query = f"""
    WITH landing AS (
        SELECT
            playerId,
            CONCAT(
                firstName,
                ' ',
                lastName
            ) AS player_name,
            birthCity AS birth_city,
            birthCountry AS birth_country
        FROM `{PROJECT_ID}.Player.PlayerLanding`
        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY playerId
            ORDER BY RunDate DESC
        ) = 1
    ),

    nhl_detail AS (
        SELECT
            playerID,
            birth_state
        FROM `{PROJECT_ID}.Player.PlayerDetail_NHLAPI`
        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY playerID
            ORDER BY RunDate DESC
        ) = 1
    )

    SELECT
        l.playerId,
        l.player_name,
        l.birth_city,
        d.birth_state,
        l.birth_country
    FROM landing l
    LEFT JOIN nhl_detail d
        ON l.playerId = d.playerID
    WHERE l.birth_city IS NOT NULL
      AND l.birth_country IS NOT NULL
    ORDER BY l.player_name
    """

    dataframe = query_to_dataframe(
        client,
        query,
    )

    if dataframe.empty:
        raise RuntimeError(
            "No player birthplaces returned."
        )

    return dataframe


def load_players_to_refresh(
    client: bigquery.Client,
    players: pd.DataFrame,
) -> pd.DataFrame:
    if not table_exists(
        client,
        TARGET_TABLE,
    ):
        print(
            "PlayerBirthplace does not exist yet. "
            "All players will be geocoded."
        )

        return players.copy()

    query = f"""
    SELECT
        playerId,
        last_updated
    FROM `{TARGET_TABLE}`
    WHERE last_updated >=
        TIMESTAMP_SUB(
            CURRENT_TIMESTAMP(),
            INTERVAL {REFRESH_MONTHS * 30} DAY
        )
    """

    current = query_to_dataframe(
        client,
        query,
    )

    if current.empty:
        print(
            "No players have been refreshed "
            f"within {REFRESH_MONTHS} months."
        )

        return players.copy()

    current_ids = set(
        current[
            "playerId"
        ].astype(int)
    )

    refresh = players[
        ~players[
            "playerId"
        ].astype(int).isin(
            current_ids
        )
    ].copy()

    return refresh


def geocode_batch(
    dataframe: pd.DataFrame,
    geocode,
    start_number: int,
    total_players: int,
) -> pd.DataFrame:
    rows = []

    for offset, (_, row) in enumerate(
        dataframe.iterrows()
    ):
        player_number = (
            start_number + offset
        )

        print(
            f"[{player_number}/{total_players}] "
            f"{row['player_name']} - "
            f"{row['birth_city']}"
        )

        try:
            result = geocode_location(
                geocode=geocode,
                city=row["birth_city"],
                state_province=row["birth_state"],
                country=row["birth_country"],
            )

        except Exception as error:
            print(
                f"Geocoding failed for "
                f"{row['player_name']}: "
                f"{error}"
            )

            result = {
                "query": None,
                "latitude": None,
                "longitude": None,
                "matched_address": None,
                "geography_wkt": None,
                "geocode_status": "ERROR",
            }

        rows.append(
            {
                "playerId": int(
                    row["playerId"]
                ),
                "player_name": row[
                    "player_name"
                ],
                "birth_city": row[
                    "birth_city"
                ],
                "birth_state": row[
                    "birth_state"
                ],
                "birth_country": row[
                    "birth_country"
                ],
                "query": result[
                    "query"
                ],
                "latitude": result[
                    "latitude"
                ],
                "longitude": result[
                    "longitude"
                ],
                "matched_address": result[
                    "matched_address"
                ],
                "geography_wkt": result[
                    "geography_wkt"
                ],
                "geocode_status": result[
                    "geocode_status"
                ],
                "last_updated": current_timestamp(),
            }
        )

    return pd.DataFrame(
        rows
    )


def merge_batch(
    client: bigquery.Client,
    dataframe: pd.DataFrame,
) -> None:
    upload_dataframe(
        client=client,
        dataframe=dataframe,
        table_name=STAGE_TABLE_NAME,
        schema=SCHEMA,
        write_disposition=(
            bigquery.WriteDisposition.WRITE_TRUNCATE
        ),
    )

    merge_query = f"""
    MERGE `{TARGET_TABLE}` AS target
    USING `{STAGE_TABLE}` AS source
        ON target.playerId = source.playerId

    WHEN MATCHED THEN
        UPDATE SET
            player_name = source.player_name,
            birth_city = source.birth_city,
            birth_state = source.birth_state,
            birth_country = source.birth_country,
            query = source.query,
            latitude = source.latitude,
            longitude = source.longitude,
            matched_address = source.matched_address,
            geography_wkt = source.geography_wkt,
            geocode_status = source.geocode_status,
            last_updated = source.last_updated

    WHEN NOT MATCHED THEN
        INSERT (
            playerId,
            player_name,
            birth_city,
            birth_state,
            birth_country,
            query,
            latitude,
            longitude,
            matched_address,
            geography_wkt,
            geocode_status,
            last_updated
        )
        VALUES (
            source.playerId,
            source.player_name,
            source.birth_city,
            source.birth_state,
            source.birth_country,
            source.query,
            source.latitude,
            source.longitude,
            source.matched_address,
            source.geography_wkt,
            source.geocode_status,
            source.last_updated
        )
    """

    client.query(
        merge_query
    ).result()

    print(
        f"Merged {len(dataframe)} rows "
        f"into {TARGET_TABLE}"
    )


def main():
    client = create_bigquery_client()

    create_target_table(
        client
    )

    players = load_players(
        client
    )

    print(
        f"{len(players)} total players loaded."
    )

    players_to_refresh = (
        load_players_to_refresh(
            client,
            players,
        )
    )

    total_refresh = len(
        players_to_refresh
    )

    print(
        f"{total_refresh} players require refresh."
    )

    if total_refresh == 0:
        print(
            "Nothing to refresh."
        )
        return

    geocode = (
        create_nominatim_geocoder()
    )

    for batch_start in range(
        0,
        total_refresh,
        BATCH_SIZE,
    ):
        batch_end = min(
            batch_start + BATCH_SIZE,
            total_refresh,
        )

        print(
            "\n"
            f"Processing batch "
            f"{batch_start + 1}-"
            f"{batch_end}"
        )

        player_batch = (
            players_to_refresh.iloc[
                batch_start:batch_end
            ]
        )

        results = geocode_batch(
            dataframe=player_batch,
            geocode=geocode,
            start_number=(
                batch_start + 1
            ),
            total_players=total_refresh,
        )

        print_geo_summary(
            results
        )

        merge_batch(
            client=client,
            dataframe=results,
        )

    print(
        "\nPlayer birthplace refresh complete."
    )


if __name__ == "__main__":
    main()