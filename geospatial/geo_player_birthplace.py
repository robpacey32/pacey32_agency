from __future__ import annotations

import pandas as pd
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
    validate_coordinates,
    validate_unique,
)


TABLE_NAME = "PlayerBirthplace"


SCHEMA = [
    bigquery.SchemaField(
        "playerId",
        "INTEGER",
    ),
    bigquery.SchemaField(
        "player_name",
        "STRING",
    ),
    bigquery.SchemaField(
        "birth_city",
        "STRING",
    ),
    bigquery.SchemaField(
        "birth_state",
        "STRING",
    ),
    bigquery.SchemaField(
        "birth_country",
        "STRING",
    ),
    bigquery.SchemaField(
        "query",
        "STRING",
    ),
    bigquery.SchemaField(
        "latitude",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "longitude",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "matched_address",
        "STRING",
    ),
    bigquery.SchemaField(
        "geography_wkt",
        "STRING",
    ),
    bigquery.SchemaField(
        "geocode_status",
        "STRING",
    ),
    bigquery.SchemaField(
        "last_updated",
        "TIMESTAMP",
    ),
]


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


def geocode_players(
    dataframe: pd.DataFrame,
) -> pd.DataFrame:
    geocode = create_nominatim_geocoder()

    rows = []

    for index, row in dataframe.iterrows():
        print(
            f"[{index + 1}/{len(dataframe)}] "
            f"{row['player_name']} - "
            f"{row['birth_city']}"
        )

        result = geocode_location(
            geocode=geocode,
            city=row["birth_city"],
            state_province=row["birth_state"],
            country=row["birth_country"],
        )

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


def main():
    client = create_bigquery_client()

    players = load_players(
        client
    )

    print(
        f"{len(players)} players loaded."
    )

    results = geocode_players(
        players
    )

    validate_unique(
        results,
        ["playerId"],
        "player birthplace",
    )

    validate_coordinates(
        results,
        allow_missing=True,
    )

    print_geo_summary(
        results
    )

    upload_dataframe(
        client=client,
        dataframe=results,
        table_name=TABLE_NAME,
        schema=SCHEMA,
    )


if __name__ == "__main__":
    main()