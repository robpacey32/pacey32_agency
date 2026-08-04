"""
Build the expanded NHL schedule travel table.

Purpose
-------
1. Find the latest season in the NHL schedule view.
2. Read regular-season games for that season.
3. Read the authoritative team list and city reference data.
4. Join team locations in pandas.
5. Expand each NHL game into:
       - one row from the home team's perspective
       - one row from the away team's perspective
6. Assign each team's games a chronological game number.
7. Validate the result.
8. Replace the BigQuery destination table.

Designed to run locally or from GitHub Actions.
"""

from __future__ import annotations

import os
from typing import Any

import pandas as pd
from google.cloud import bigquery


# ============================================================
# CONFIGURATION
# ============================================================

PROJECT_ID = os.getenv(
    "GCP_PROJECT",
    "pacey32-agency",
)

SCHEDULE_TABLE = os.getenv(
    "SCHEDULE_TABLE",
    "nhl-pacey32-github.NHL_Views.Schedule",
)

TEAM_TABLE = os.getenv(
    "TEAM_TABLE",
    "pacey32-agency.Team.TeamList",
)

CITY_REFERENCE_TABLE = os.getenv(
    "CITY_REFERENCE_TABLE",
    "pacey32-agency.City.CityReference",
)

DESTINATION_TABLE = os.getenv(
    "DESTINATION_TABLE",
    "pacey32-agency.Team.Travel_1_ScheduleExpanded",
)

REGULAR_SEASON_GAME_TYPE = int(
    os.getenv(
        "REGULAR_SEASON_GAME_TYPE",
        "2",
    )
)

EXPECTED_TEAM_COUNT = int(
    os.getenv(
        "EXPECTED_TEAM_COUNT",
        "32",
    )
)

EXPECTED_GAMES_PER_TEAM = int(
    os.getenv(
        "EXPECTED_GAMES_PER_TEAM",
        "82",
    )
)

STRICT_GAME_COUNT_VALIDATION = os.getenv(
    "STRICT_GAME_COUNT_VALIDATION",
    "true",
).strip().lower() in {
    "1",
    "true",
    "yes",
    "y",
}


# ============================================================
# OUTPUT SCHEMA
# ============================================================

OUTPUT_COLUMNS = [
    "season",
    "game_id",
    "game_date",
    "game_datetime",
    "game_state",
    "game_schedule_state",
    "game_type",
    "neutral_site",
    "is_home",
    "is_away",
    "team_id",
    "team_abbrev",
    "team_name",
    "opponent_team_id",
    "opponent_team_abbrev",
    "opponent_team_name",
    "game_city",
    "game_state_province",
    "game_country",
    "game_latitude",
    "game_longitude",
    "game_geography",
    "team_home_city",
    "team_home_state_province",
    "team_home_country",
    "team_home_latitude",
    "team_home_longitude",
    "team_home_geography",
    "team_game_number",
]

BQ_SCHEMA = [
    bigquery.SchemaField("season", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("game_id", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("game_date", "DATE", mode="REQUIRED"),
    bigquery.SchemaField(
        "game_datetime",
        "TIMESTAMP",
        mode="REQUIRED",
    ),
    bigquery.SchemaField("game_state", "STRING"),
    bigquery.SchemaField("game_schedule_state", "STRING"),
    bigquery.SchemaField("game_type", "INTEGER"),
    bigquery.SchemaField("neutral_site", "BOOLEAN"),
    bigquery.SchemaField("is_home", "BOOLEAN", mode="REQUIRED"),
    bigquery.SchemaField("is_away", "BOOLEAN", mode="REQUIRED"),
    bigquery.SchemaField("team_id", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("team_abbrev", "STRING"),
    bigquery.SchemaField("team_name", "STRING"),
    bigquery.SchemaField(
        "opponent_team_id",
        "INTEGER",
        mode="REQUIRED",
    ),
    bigquery.SchemaField("opponent_team_abbrev", "STRING"),
    bigquery.SchemaField("opponent_team_name", "STRING"),
    bigquery.SchemaField("game_city", "STRING"),
    bigquery.SchemaField("game_state_province", "STRING"),
    bigquery.SchemaField("game_country", "STRING"),
    bigquery.SchemaField("game_latitude", "FLOAT"),
    bigquery.SchemaField("game_longitude", "FLOAT"),
    bigquery.SchemaField("game_geography", "GEOGRAPHY"),
    bigquery.SchemaField("team_home_city", "STRING"),
    bigquery.SchemaField(
        "team_home_state_province",
        "STRING",
    ),
    bigquery.SchemaField("team_home_country", "STRING"),
    bigquery.SchemaField("team_home_latitude", "FLOAT"),
    bigquery.SchemaField("team_home_longitude", "FLOAT"),
    bigquery.SchemaField("team_home_geography", "GEOGRAPHY"),
    bigquery.SchemaField(
        "team_game_number",
        "INTEGER",
        mode="REQUIRED",
    ),
]


# ============================================================
# CLIENT
# ============================================================

BQ = bigquery.Client(project=PROJECT_ID)


# ============================================================
# BIGQUERY HELPERS
# ============================================================

def query_to_dataframe(
    query: str,
) -> pd.DataFrame:
    """
    Run a BigQuery query and construct a DataFrame from rows.

    This avoids depending on db-dtypes through to_dataframe().
    """
    rows = [
        dict(row.items())
        for row in BQ.query(query).result()
    ]

    return pd.DataFrame(rows)


def get_latest_season() -> int:
    """Return the maximum season available in the schedule."""
    query = f"""
    SELECT
        MAX(season) AS season
    FROM `{SCHEDULE_TABLE}`
    """

    result = query_to_dataframe(query)

    if result.empty:
        raise RuntimeError(
            f"No seasons were found in {SCHEDULE_TABLE}."
        )

    season = result.iloc[0]["season"]

    if pd.isna(season):
        raise RuntimeError(
            f"MAX(season) returned NULL for {SCHEDULE_TABLE}."
        )

    return int(season)


# ============================================================
# STEP 1: READ SOURCE DATA
# ============================================================

def get_schedule(
    season: int,
) -> pd.DataFrame:
    """Read the latest regular-season schedule."""
    query = f"""
    SELECT
        season,
        game_id,
        game_type,
        game_date,
        start_time_utc,
        game_state,
        game_schedule_state,
        neutral_site,
        home_team_id,
        home_team_abbrev,
        home_team_name,
        away_team_id,
        away_team_abbrev,
        away_team_name
    FROM `{SCHEDULE_TABLE}`
    WHERE season = {season}
      AND game_type = {REGULAR_SEASON_GAME_TYPE}
    ORDER BY
        game_date,
        start_time_utc,
        game_id
    """

    schedule_df = query_to_dataframe(query)

    if schedule_df.empty:
        raise RuntimeError(
            f"No regular-season games were found for {season}."
        )

    schedule_df["game_id"] = pd.to_numeric(
        schedule_df["game_id"],
        errors="raise",
    ).astype("int64")

    schedule_df["season"] = pd.to_numeric(
        schedule_df["season"],
        errors="raise",
    ).astype("int64")

    schedule_df["home_team_id"] = pd.to_numeric(
        schedule_df["home_team_id"],
        errors="raise",
    ).astype("int64")

    schedule_df["away_team_id"] = pd.to_numeric(
        schedule_df["away_team_id"],
        errors="raise",
    ).astype("int64")

    schedule_df["game_type"] = pd.to_numeric(
        schedule_df["game_type"],
        errors="raise",
    ).astype("int64")

    schedule_df["game_date"] = pd.to_datetime(
        schedule_df["game_date"],
        errors="raise",
    ).dt.date

    schedule_df["start_time_utc"] = pd.to_datetime(
        schedule_df["start_time_utc"],
        utc=True,
        errors="raise",
    )

    schedule_df["neutral_site"] = (
        schedule_df["neutral_site"]
        .fillna(False)
        .astype(bool)
    )

    return schedule_df


def get_team_list() -> pd.DataFrame:
    """Read the authoritative team reference table."""
    query = f"""
    SELECT
        id,
        fullName,
        tricode,
        venue,
        venueLocation
    FROM `{TEAM_TABLE}`
    WHERE id IS NOT NULL
    ORDER BY id
    """

    team_df = query_to_dataframe(query)

    if team_df.empty:
        raise RuntimeError(
            f"No teams were found in {TEAM_TABLE}."
        )

    team_df["id"] = pd.to_numeric(
        team_df["id"],
        errors="raise",
    ).astype("int64")

    return team_df


def get_city_reference() -> pd.DataFrame:
    """Read successful city-reference records."""
    query = f"""
    SELECT
        city_name,
        state_province,
        country,
        latitude,
        longitude,
        ST_ASTEXT(geography) AS geography
    FROM `{CITY_REFERENCE_TABLE}`
    WHERE geocode_status = 'FOUND'
    ORDER BY city_name
    """

    city_df = query_to_dataframe(query)

    if city_df.empty:
        raise RuntimeError(
            f"No successful cities were found in "
            f"{CITY_REFERENCE_TABLE}."
        )

    city_df["latitude"] = pd.to_numeric(
        city_df["latitude"],
        errors="coerce",
    )

    city_df["longitude"] = pd.to_numeric(
        city_df["longitude"],
        errors="coerce",
    )

    return city_df


# ============================================================
# STEP 2: BUILD TEAM LOCATION LOOKUP
# ============================================================

def build_team_locations(
    team_df: pd.DataFrame,
    city_df: pd.DataFrame,
) -> pd.DataFrame:
    """Join each team to its authoritative city coordinates."""
    if team_df["id"].duplicated().any():
        duplicates = team_df[
            team_df["id"].duplicated(
                keep=False
            )
        ]

        raise ValueError(
            "Duplicate team IDs found:\n"
            + duplicates.to_string(index=False)
        )

    if city_df["city_name"].duplicated().any():
        duplicates = city_df[
            city_df["city_name"].duplicated(
                keep=False
            )
        ]

        raise ValueError(
            "Duplicate CityReference names found:\n"
            + duplicates.to_string(index=False)
        )

    team_locations_df = team_df.merge(
        city_df,
        how="left",
        left_on="venueLocation",
        right_on="city_name",
        validate="many_to_one",
    )

    team_locations_df = (
        team_locations_df
        .rename(
            columns={
                "id": "team_id",
            }
        )
        [
            [
                "team_id",
                "fullName",
                "tricode",
                "venue",
                "venueLocation",
                "state_province",
                "country",
                "latitude",
                "longitude",
                "geography",
            ]
        ]
        .sort_values("team_id")
        .reset_index(drop=True)
    )

    return team_locations_df


# ============================================================
# STEP 3: EXPAND HOME AND AWAY PERSPECTIVES
# ============================================================

def build_home_games(
    schedule_df: pd.DataFrame,
    team_locations_df: pd.DataFrame,
) -> pd.DataFrame:
    """Build one row per game from the home-team perspective."""
    home_locations = team_locations_df.add_prefix(
        "home_"
    )

    merged = schedule_df.merge(
        home_locations,
        how="left",
        left_on="home_team_id",
        right_on="home_team_id",
        validate="many_to_one",
    )

    return pd.DataFrame({
        "season": merged["season"],
        "game_id": merged["game_id"],
        "game_date": merged["game_date"],
        "game_datetime": merged["start_time_utc"],
        "game_state": merged["game_state"],
        "game_schedule_state": (
            merged["game_schedule_state"]
        ),
        "game_type": merged["game_type"],
        "neutral_site": merged["neutral_site"],
        "is_home": True,
        "is_away": False,
        "team_id": merged["home_team_id"],
        "team_abbrev": merged["home_team_abbrev"],
        "team_name": merged["home_team_name"],
        "opponent_team_id": merged["away_team_id"],
        "opponent_team_abbrev": (
            merged["away_team_abbrev"]
        ),
        "opponent_team_name": (
            merged["away_team_name"]
        ),
        "game_city": merged["home_venueLocation"],
        "game_state_province": (
            merged["home_state_province"]
        ),
        "game_country": merged["home_country"],
        "game_latitude": merged["home_latitude"],
        "game_longitude": merged["home_longitude"],
        "game_geography": merged["home_geography"],
        "team_home_city": (
            merged["home_venueLocation"]
        ),
        "team_home_state_province": (
            merged["home_state_province"]
        ),
        "team_home_country": merged["home_country"],
        "team_home_latitude": (
            merged["home_latitude"]
        ),
        "team_home_longitude": (
            merged["home_longitude"]
        ),
        "team_home_geography": (
            merged["home_geography"]
        ),
    })


def build_away_games(
    schedule_df: pd.DataFrame,
    team_locations_df: pd.DataFrame,
) -> pd.DataFrame:
    """Build one row per game from the away-team perspective."""
    home_locations = team_locations_df.add_prefix(
        "home_"
    )

    away_locations = team_locations_df.add_prefix(
        "away_"
    )

    merged = (
        schedule_df
        .merge(
            home_locations,
            how="left",
            left_on="home_team_id",
            right_on="home_team_id",
            validate="many_to_one",
        )
        .merge(
            away_locations,
            how="left",
            left_on="away_team_id",
            right_on="away_team_id",
            validate="many_to_one",
        )
    )

    return pd.DataFrame({
        "season": merged["season"],
        "game_id": merged["game_id"],
        "game_date": merged["game_date"],
        "game_datetime": merged["start_time_utc"],
        "game_state": merged["game_state"],
        "game_schedule_state": (
            merged["game_schedule_state"]
        ),
        "game_type": merged["game_type"],
        "neutral_site": merged["neutral_site"],
        "is_home": False,
        "is_away": True,
        "team_id": merged["away_team_id"],
        "team_abbrev": merged["away_team_abbrev"],
        "team_name": merged["away_team_name"],
        "opponent_team_id": merged["home_team_id"],
        "opponent_team_abbrev": (
            merged["home_team_abbrev"]
        ),
        "opponent_team_name": (
            merged["home_team_name"]
        ),
        "game_city": merged["home_venueLocation"],
        "game_state_province": (
            merged["home_state_province"]
        ),
        "game_country": merged["home_country"],
        "game_latitude": merged["home_latitude"],
        "game_longitude": merged["home_longitude"],
        "game_geography": merged["home_geography"],
        "team_home_city": (
            merged["away_venueLocation"]
        ),
        "team_home_state_province": (
            merged["away_state_province"]
        ),
        "team_home_country": merged["away_country"],
        "team_home_latitude": (
            merged["away_latitude"]
        ),
        "team_home_longitude": (
            merged["away_longitude"]
        ),
        "team_home_geography": (
            merged["away_geography"]
        ),
    })


def build_schedule_expanded(
    schedule_df: pd.DataFrame,
    team_locations_df: pd.DataFrame,
) -> pd.DataFrame:
    """Build the final one-row-per-team-per-game dataset."""
    home_games_df = build_home_games(
        schedule_df,
        team_locations_df,
    )

    away_games_df = build_away_games(
        schedule_df,
        team_locations_df,
    )

    result = pd.concat(
        [
            home_games_df,
            away_games_df,
        ],
        ignore_index=True,
    )

    result = result.sort_values(
        [
            "season",
            "team_id",
            "game_date",
            "game_datetime",
            "game_id",
        ]
    ).reset_index(drop=True)

    result["team_game_number"] = (
        result
        .groupby(
            [
                "season",
                "team_id",
            ],
            sort=False,
        )
        .cumcount()
        .add(1)
        .astype("int64")
    )

    return result[OUTPUT_COLUMNS]


# ============================================================
# STEP 4: VALIDATE
# ============================================================

def validate_team_locations(
    team_locations_df: pd.DataFrame,
) -> None:
    """Validate the authoritative team-location lookup."""
    if len(team_locations_df) != EXPECTED_TEAM_COUNT:
        raise ValueError(
            f"Expected {EXPECTED_TEAM_COUNT} teams, "
            f"but found {len(team_locations_df)}."
        )

    if (
        team_locations_df["team_id"]
        .nunique()
        != EXPECTED_TEAM_COUNT
    ):
        raise ValueError(
            "The team-location lookup does not contain "
            f"{EXPECTED_TEAM_COUNT} unique team IDs."
        )

    required_columns = [
        "team_id",
        "venueLocation",
        "state_province",
        "country",
        "latitude",
        "longitude",
        "geography",
    ]

    failures = team_locations_df[
        team_locations_df[
            required_columns
        ].isna().any(axis=1)
    ]

    if not failures.empty:
        raise ValueError(
            "Teams with incomplete location data:\n"
            + failures.to_string(index=False)
        )

    print(
        f"Team-location validation passed for "
        f"{len(team_locations_df)} teams."
    )


def validate_schedule_expanded(
    result_df: pd.DataFrame,
    schedule_df: pd.DataFrame,
) -> None:
    """Validate the expanded schedule before loading."""
    expected_rows = len(schedule_df) * 2

    if len(result_df) != expected_rows:
        raise ValueError(
            f"Expected {expected_rows} expanded rows, "
            f"but created {len(result_df)}."
        )

    duplicate_keys = result_df[
        result_df.duplicated(
            subset=[
                "season",
                "game_id",
                "team_id",
            ],
            keep=False,
        )
    ]

    if not duplicate_keys.empty:
        raise ValueError(
            "Duplicate team/game rows found:\n"
            + duplicate_keys[
                [
                    "season",
                    "game_id",
                    "team_id",
                    "team_abbrev",
                ]
            ].to_string(index=False)
        )

    invalid_home_away = result_df[
        result_df["is_home"]
        == result_df["is_away"]
    ]

    if not invalid_home_away.empty:
        raise ValueError(
            "Rows must be either home or away, "
            "but not both or neither."
        )

    required_location_columns = [
        "game_city",
        "game_state_province",
        "game_country",
        "game_latitude",
        "game_longitude",
        "game_geography",
        "team_home_city",
        "team_home_state_province",
        "team_home_country",
        "team_home_latitude",
        "team_home_longitude",
        "team_home_geography",
    ]

    missing_locations = result_df[
        result_df[
            required_location_columns
        ].isna().any(axis=1)
    ]

    if not missing_locations.empty:
        raise ValueError(
            "Expanded schedule rows with missing location data:\n"
            + missing_locations[
                [
                    "game_id",
                    "game_date",
                    "team_id",
                    "team_abbrev",
                    "opponent_team_abbrev",
                    "game_city",
                    "team_home_city",
                ]
            ].to_string(index=False)
        )

    games_per_team = (
        result_df
        .groupby(
            [
                "season",
                "team_id",
                "team_abbrev",
            ]
        )
        .size()
        .reset_index(
            name="games"
        )
    )

    if STRICT_GAME_COUNT_VALIDATION:
        invalid_game_counts = games_per_team[
            games_per_team["games"]
            != EXPECTED_GAMES_PER_TEAM
        ]

        if not invalid_game_counts.empty:
            raise ValueError(
                "Unexpected regular-season game counts:\n"
                + invalid_game_counts.to_string(
                    index=False
                )
            )

    team_game_number_check = (
        result_df
        .groupby(
            [
                "season",
                "team_id",
            ]
        )["team_game_number"]
        .agg(["min", "max", "count"])
        .reset_index()
    )

    invalid_numbering = team_game_number_check[
        (team_game_number_check["min"] != 1)
        | (
            team_game_number_check["max"]
            != team_game_number_check["count"]
        )
    ]

    if not invalid_numbering.empty:
        raise ValueError(
            "Invalid team game numbering:\n"
            + invalid_numbering.to_string(
                index=False
            )
        )

    print(
        f"Expanded schedule validation passed for "
        f"{len(result_df)} rows."
    )


# ============================================================
# STEP 5: PREPARE AND LOAD
# ============================================================

def prepare_for_bigquery(
    result_df: pd.DataFrame,
) -> pd.DataFrame:
    """Apply stable data types before loading."""
    prepared = result_df.copy()

    integer_columns = [
        "season",
        "game_id",
        "game_type",
        "team_id",
        "opponent_team_id",
        "team_game_number",
    ]

    for column in integer_columns:
        prepared[column] = pd.to_numeric(
            prepared[column],
            errors="raise",
        ).astype("int64")

    float_columns = [
        "game_latitude",
        "game_longitude",
        "team_home_latitude",
        "team_home_longitude",
    ]

    for column in float_columns:
        prepared[column] = pd.to_numeric(
            prepared[column],
            errors="coerce",
        )

    boolean_columns = [
        "neutral_site",
        "is_home",
        "is_away",
    ]

    for column in boolean_columns:
        prepared[column] = (
            prepared[column]
            .fillna(False)
            .astype(bool)
        )

    prepared["game_date"] = pd.to_datetime(
        prepared["game_date"],
        errors="raise",
    ).dt.date

    prepared["game_datetime"] = pd.to_datetime(
        prepared["game_datetime"],
        utc=True,
        errors="raise",
    )

    return prepared[OUTPUT_COLUMNS]


def load_to_bigquery(
    result_df: pd.DataFrame,
) -> None:
    """Replace the destination table with the latest output."""
    prepared_df = prepare_for_bigquery(
        result_df
    )

    job_config = bigquery.LoadJobConfig(
        schema=BQ_SCHEMA,
        write_disposition=(
            bigquery.WriteDisposition.WRITE_TRUNCATE
        ),
        create_disposition=(
            bigquery.CreateDisposition.CREATE_IF_NEEDED
        ),
    )

    load_job = BQ.load_table_from_dataframe(
        prepared_df,
        DESTINATION_TABLE,
        job_config=job_config,
    )

    load_job.result()

    print(
        f"Loaded {len(prepared_df)} rows into "
        f"{DESTINATION_TABLE}."
    )


# ============================================================
# DIAGNOSTICS
# ============================================================

def print_summary(
    result_df: pd.DataFrame,
) -> None:
    """Print compact output diagnostics."""
    summary = (
        result_df
        .groupby(
            [
                "team_id",
                "team_abbrev",
            ]
        )
        .agg(
            games=(
                "game_id",
                "count",
            ),
            home_games=(
                "is_home",
                "sum",
            ),
            away_games=(
                "is_away",
                "sum",
            ),
            first_game=(
                "game_date",
                "min",
            ),
            last_game=(
                "game_date",
                "max",
            ),
        )
        .reset_index()
        .sort_values("team_id")
    )

    print("\nTeam schedule summary:")
    print(
        summary.to_string(
            index=False
        )
    )


# ============================================================
# MAIN
# ============================================================

def main() -> None:
    """Run the complete schedule-expansion pipeline."""
    print(
        "Starting Travel_1_ScheduleExpanded pipeline."
    )

    print(
        f"Schedule source: {SCHEDULE_TABLE}"
    )
    print(
        f"Team source: {TEAM_TABLE}"
    )
    print(
        f"City source: {CITY_REFERENCE_TABLE}"
    )
    print(
        f"Destination: {DESTINATION_TABLE}"
    )

    latest_season = get_latest_season()

    print(
        f"\nLatest season: {latest_season}"
    )

    print("\nReading schedule...")
    schedule_df = get_schedule(
        latest_season
    )

    print(
        f"Read {len(schedule_df)} regular-season games."
    )

    print("\nReading team list...")
    team_df = get_team_list()

    print(
        f"Read {len(team_df)} teams."
    )

    print("\nReading city reference...")
    city_df = get_city_reference()

    print(
        f"Read {len(city_df)} successful cities."
    )

    print("\nBuilding team-location lookup...")
    team_locations_df = build_team_locations(
        team_df,
        city_df,
    )

    validate_team_locations(
        team_locations_df
    )

    print("\nBuilding expanded schedule...")
    result_df = build_schedule_expanded(
        schedule_df,
        team_locations_df,
    )

    validate_schedule_expanded(
        result_df,
        schedule_df,
    )

    print_summary(
        result_df
    )

    print("\nLoading output...")
    load_to_bigquery(
        result_df
    )

    print(
        "\nTravel_1_ScheduleExpanded pipeline "
        "completed successfully."
    )


if __name__ == "__main__":
    main()
