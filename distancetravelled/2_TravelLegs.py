"""
Build individual NHL team travel legs.

Purpose
-------
1. Read Travel_1_ScheduleExpanded from BigQuery.
2. Process each team's schedule chronologically.
3. Create one row for every travel leg.
4. Assume consecutive away games no more than two calendar days
   apart form one road trip.
5. Assume the team returns home when consecutive away games are
   more than two calendar days apart.
6. Add explicit return-home legs:
       - before a later away game after a long gap
       - before a home game
       - after the final away game of the season
7. Calculate straight-line distance in kilometres and miles.
8. Replace Travel_2_Legs in BigQuery.

Designed to run locally or from GitHub Actions.
"""

from __future__ import annotations

import math
import os
from typing import Any, Optional

import pandas as pd
from google.cloud import bigquery


# ============================================================
# CONFIGURATION
# ============================================================

PROJECT_ID = os.getenv(
    "GCP_PROJECT",
    "pacey32-agency",
)

SOURCE_TABLE = os.getenv(
    "SOURCE_TABLE",
    "pacey32-agency.Team.Travel_1_ScheduleExpanded",
)

DESTINATION_TABLE = os.getenv(
    "DESTINATION_TABLE",
    "pacey32-agency.Team.Travel_2_Legs",
)

# Friday to Sunday:
# DATE_DIFF = 2, so remain on the road.
#
# Friday to Monday:
# DATE_DIFF = 3, so return home.
MAX_ROAD_TRIP_GAP_DAYS = int(
    os.getenv(
        "MAX_ROAD_TRIP_GAP_DAYS",
        "2",
    )
)

MILES_PER_KM = 0.621371192237334

EARTH_RADIUS_KM = 6371.0088


# ============================================================
# OUTPUT COLUMNS
# ============================================================

OUTPUT_COLUMNS = [
    "season",
    "team_id",
    "team_abbrev",
    "team_name",
    "leg_sequence",
    "leg_type",
    "game_id",
    "game_date",
    "game_datetime",
    "team_game_number",
    "opponent_team_id",
    "opponent_team_abbrev",
    "opponent_team_name",
    "is_home",
    "is_away",
    "neutral_site",
    "previous_game_id",
    "previous_game_date",
    "previous_game_datetime",
    "previous_is_home",
    "previous_is_away",
    "next_game_id",
    "next_game_date",
    "next_game_datetime",
    "next_is_home",
    "next_is_away",
    "days_since_previous_game",
    "days_until_next_game",
    "road_trip_id",
    "travel_from_city",
    "travel_from_state_province",
    "travel_from_country",
    "travel_from_latitude",
    "travel_from_longitude",
    "travel_from_geography",
    "travel_to_city",
    "travel_to_state_province",
    "travel_to_country",
    "travel_to_latitude",
    "travel_to_longitude",
    "travel_to_geography",
    "travel_reason",
    "travel_km",
    "travel_miles",
    "involves_travel",
    "team_home_city",
    "team_home_state_province",
    "team_home_country",
    "team_home_latitude",
    "team_home_longitude",
    "team_home_geography",
]


BQ_SCHEMA = [
    bigquery.SchemaField("season", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("team_id", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("team_abbrev", "STRING"),
    bigquery.SchemaField("team_name", "STRING"),
    bigquery.SchemaField(
        "leg_sequence",
        "INTEGER",
        mode="REQUIRED",
    ),
    bigquery.SchemaField(
        "leg_type",
        "STRING",
        mode="REQUIRED",
    ),
    bigquery.SchemaField("game_id", "INTEGER"),
    bigquery.SchemaField("game_date", "DATE"),
    bigquery.SchemaField("game_datetime", "TIMESTAMP"),
    bigquery.SchemaField("team_game_number", "INTEGER"),
    bigquery.SchemaField("opponent_team_id", "INTEGER"),
    bigquery.SchemaField("opponent_team_abbrev", "STRING"),
    bigquery.SchemaField("opponent_team_name", "STRING"),
    bigquery.SchemaField("is_home", "BOOLEAN"),
    bigquery.SchemaField("is_away", "BOOLEAN"),
    bigquery.SchemaField("neutral_site", "BOOLEAN"),
    bigquery.SchemaField("previous_game_id", "INTEGER"),
    bigquery.SchemaField("previous_game_date", "DATE"),
    bigquery.SchemaField(
        "previous_game_datetime",
        "TIMESTAMP",
    ),
    bigquery.SchemaField("previous_is_home", "BOOLEAN"),
    bigquery.SchemaField("previous_is_away", "BOOLEAN"),
    bigquery.SchemaField("next_game_id", "INTEGER"),
    bigquery.SchemaField("next_game_date", "DATE"),
    bigquery.SchemaField("next_game_datetime", "TIMESTAMP"),
    bigquery.SchemaField("next_is_home", "BOOLEAN"),
    bigquery.SchemaField("next_is_away", "BOOLEAN"),
    bigquery.SchemaField(
        "days_since_previous_game",
        "INTEGER",
    ),
    bigquery.SchemaField(
        "days_until_next_game",
        "INTEGER",
    ),
    bigquery.SchemaField("road_trip_id", "INTEGER"),
    bigquery.SchemaField("travel_from_city", "STRING"),
    bigquery.SchemaField(
        "travel_from_state_province",
        "STRING",
    ),
    bigquery.SchemaField("travel_from_country", "STRING"),
    bigquery.SchemaField(
        "travel_from_latitude",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "travel_from_longitude",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "travel_from_geography",
        "GEOGRAPHY",
    ),
    bigquery.SchemaField("travel_to_city", "STRING"),
    bigquery.SchemaField(
        "travel_to_state_province",
        "STRING",
    ),
    bigquery.SchemaField("travel_to_country", "STRING"),
    bigquery.SchemaField("travel_to_latitude", "FLOAT"),
    bigquery.SchemaField("travel_to_longitude", "FLOAT"),
    bigquery.SchemaField(
        "travel_to_geography",
        "GEOGRAPHY",
    ),
    bigquery.SchemaField(
        "travel_reason",
        "STRING",
        mode="REQUIRED",
    ),
    bigquery.SchemaField("travel_km", "FLOAT"),
    bigquery.SchemaField("travel_miles", "FLOAT"),
    bigquery.SchemaField("involves_travel", "BOOLEAN"),
    bigquery.SchemaField("team_home_city", "STRING"),
    bigquery.SchemaField(
        "team_home_state_province",
        "STRING",
    ),
    bigquery.SchemaField("team_home_country", "STRING"),
    bigquery.SchemaField(
        "team_home_latitude",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "team_home_longitude",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "team_home_geography",
        "GEOGRAPHY",
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

    This avoids depending on BigQuery's DataFrame conversion
    helpers and db-dtypes.
    """
    rows = [
        dict(row.items())
        for row in BQ.query(query).result()
    ]

    return pd.DataFrame(rows)


# ============================================================
# DISTANCE HELPERS
# ============================================================

def haversine_km(
    latitude_1: object,
    longitude_1: object,
    latitude_2: object,
    longitude_2: object,
) -> Optional[float]:
    """
    Calculate great-circle distance using the Haversine formula.
    """
    coordinates = [
        latitude_1,
        longitude_1,
        latitude_2,
        longitude_2,
    ]

    if any(pd.isna(value) for value in coordinates):
        return None

    lat1 = math.radians(float(latitude_1))
    lon1 = math.radians(float(longitude_1))
    lat2 = math.radians(float(latitude_2))
    lon2 = math.radians(float(longitude_2))

    delta_latitude = lat2 - lat1
    delta_longitude = lon2 - lon1

    haversine_value = (
        math.sin(delta_latitude / 2) ** 2
        + math.cos(lat1)
        * math.cos(lat2)
        * math.sin(delta_longitude / 2) ** 2
    )

    angular_distance = 2 * math.atan2(
        math.sqrt(haversine_value),
        math.sqrt(1 - haversine_value),
    )

    return EARTH_RADIUS_KM * angular_distance


def point_wkt(
    latitude: object,
    longitude: object,
) -> Optional[str]:
    """Return a WKT point string for BigQuery GEOGRAPHY."""
    if pd.isna(latitude) or pd.isna(longitude):
        return None

    return (
        f"POINT("
        f"{float(longitude)} "
        f"{float(latitude)}"
        f")"
    )


def days_between(
    earlier_date: object,
    later_date: object,
) -> Optional[int]:
    """Return calendar-day difference between two dates."""
    if pd.isna(earlier_date) or pd.isna(later_date):
        return None

    earlier = pd.Timestamp(earlier_date).date()
    later = pd.Timestamp(later_date).date()

    return (later - earlier).days


def nullable_value(
    value: Any,
) -> Any:
    """Convert pandas missing values to ordinary None."""
    if value is None:
        return None

    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    return value


# ============================================================
# STEP 1: READ SOURCE
# ============================================================

def get_schedule_expanded() -> pd.DataFrame:
    """Read the expanded schedule from BigQuery."""
    query = f"""
    SELECT
        season,
        game_id,
        game_date,
        game_datetime,
        game_state,
        game_schedule_state,
        game_type,
        neutral_site,
        is_home,
        is_away,
        team_id,
        team_abbrev,
        team_name,
        opponent_team_id,
        opponent_team_abbrev,
        opponent_team_name,
        game_city,
        game_state_province,
        game_country,
        game_latitude,
        game_longitude,
        ST_ASTEXT(game_geography) AS game_geography,
        team_home_city,
        team_home_state_province,
        team_home_country,
        team_home_latitude,
        team_home_longitude,
        ST_ASTEXT(
            team_home_geography
        ) AS team_home_geography,
        team_game_number
    FROM `{SOURCE_TABLE}`
    ORDER BY
        season,
        team_id,
        team_game_number
    """

    result = query_to_dataframe(query)

    if result.empty:
        raise RuntimeError(
            f"No rows were found in {SOURCE_TABLE}."
        )

    integer_columns = [
        "season",
        "game_id",
        "game_type",
        "team_id",
        "opponent_team_id",
        "team_game_number",
    ]

    for column in integer_columns:
        result[column] = pd.to_numeric(
            result[column],
            errors="raise",
        ).astype("int64")

    result["game_date"] = pd.to_datetime(
        result["game_date"],
        errors="raise",
    ).dt.date

    result["game_datetime"] = pd.to_datetime(
        result["game_datetime"],
        utc=True,
        errors="raise",
    )

    boolean_columns = [
        "neutral_site",
        "is_home",
        "is_away",
    ]

    for column in boolean_columns:
        result[column] = (
            result[column]
            .fillna(False)
            .astype(bool)
        )

    coordinate_columns = [
        "game_latitude",
        "game_longitude",
        "team_home_latitude",
        "team_home_longitude",
    ]

    for column in coordinate_columns:
        result[column] = pd.to_numeric(
            result[column],
            errors="coerce",
        )

    result = result.sort_values(
        [
            "season",
            "team_id",
            "team_game_number",
        ]
    ).reset_index(drop=True)

    return result


# ============================================================
# LOCATION HELPERS
# ============================================================

def game_location(
    game: pd.Series,
) -> dict[str, Any]:
    """Return the game's location fields."""
    return {
        "city": nullable_value(game["game_city"]),
        "state_province": nullable_value(
            game["game_state_province"]
        ),
        "country": nullable_value(
            game["game_country"]
        ),
        "latitude": nullable_value(
            game["game_latitude"]
        ),
        "longitude": nullable_value(
            game["game_longitude"]
        ),
        "geography": nullable_value(
            game["game_geography"]
        ),
    }


def home_location(
    game: pd.Series,
) -> dict[str, Any]:
    """Return the team's home-location fields."""
    return {
        "city": nullable_value(
            game["team_home_city"]
        ),
        "state_province": nullable_value(
            game["team_home_state_province"]
        ),
        "country": nullable_value(
            game["team_home_country"]
        ),
        "latitude": nullable_value(
            game["team_home_latitude"]
        ),
        "longitude": nullable_value(
            game["team_home_longitude"]
        ),
        "geography": nullable_value(
            game["team_home_geography"]
        ),
    }


# ============================================================
# LEG BUILDER
# ============================================================

def build_leg(
    *,
    game: pd.Series,
    previous_game: Optional[pd.Series],
    next_game: Optional[pd.Series],
    leg_sequence: int,
    leg_type: str,
    road_trip_id: Optional[int],
    travel_from: dict[str, Any],
    travel_to: dict[str, Any],
    travel_reason: str,
    days_since_previous_game: Optional[int],
    days_until_next_game: Optional[int],
    is_home: Optional[bool] = None,
    is_away: Optional[bool] = None,
) -> dict[str, Any]:
    """Build one output travel-leg row."""
    travel_km = haversine_km(
        travel_from["latitude"],
        travel_from["longitude"],
        travel_to["latitude"],
        travel_to["longitude"],
    )

    travel_miles = (
        travel_km * MILES_PER_KM
        if travel_km is not None
        else None
    )

    return {
        "season": int(game["season"]),
        "team_id": int(game["team_id"]),
        "team_abbrev": nullable_value(
            game["team_abbrev"]
        ),
        "team_name": nullable_value(
            game["team_name"]
        ),
        "leg_sequence": int(leg_sequence),
        "leg_type": leg_type,
        "game_id": int(game["game_id"]),
        "game_date": game["game_date"],
        "game_datetime": game["game_datetime"],
        "team_game_number": int(
            game["team_game_number"]
        ),
        "opponent_team_id": int(
            game["opponent_team_id"]
        ),
        "opponent_team_abbrev": nullable_value(
            game["opponent_team_abbrev"]
        ),
        "opponent_team_name": nullable_value(
            game["opponent_team_name"]
        ),
        "is_home": (
            bool(game["is_home"])
            if is_home is None
            else bool(is_home)
        ),
        "is_away": (
            bool(game["is_away"])
            if is_away is None
            else bool(is_away)
        ),
        "neutral_site": bool(
            game["neutral_site"]
        ),
        "previous_game_id": (
            int(previous_game["game_id"])
            if previous_game is not None
            else None
        ),
        "previous_game_date": (
            previous_game["game_date"]
            if previous_game is not None
            else None
        ),
        "previous_game_datetime": (
            previous_game["game_datetime"]
            if previous_game is not None
            else None
        ),
        "previous_is_home": (
            bool(previous_game["is_home"])
            if previous_game is not None
            else None
        ),
        "previous_is_away": (
            bool(previous_game["is_away"])
            if previous_game is not None
            else None
        ),
        "next_game_id": (
            int(next_game["game_id"])
            if next_game is not None
            else None
        ),
        "next_game_date": (
            next_game["game_date"]
            if next_game is not None
            else None
        ),
        "next_game_datetime": (
            next_game["game_datetime"]
            if next_game is not None
            else None
        ),
        "next_is_home": (
            bool(next_game["is_home"])
            if next_game is not None
            else None
        ),
        "next_is_away": (
            bool(next_game["is_away"])
            if next_game is not None
            else None
        ),
        "days_since_previous_game": (
            days_since_previous_game
        ),
        "days_until_next_game": (
            days_until_next_game
        ),
        "road_trip_id": road_trip_id,
        "travel_from_city": travel_from["city"],
        "travel_from_state_province": (
            travel_from["state_province"]
        ),
        "travel_from_country": (
            travel_from["country"]
        ),
        "travel_from_latitude": (
            travel_from["latitude"]
        ),
        "travel_from_longitude": (
            travel_from["longitude"]
        ),
        "travel_from_geography": (
            travel_from["geography"]
        ),
        "travel_to_city": travel_to["city"],
        "travel_to_state_province": (
            travel_to["state_province"]
        ),
        "travel_to_country": travel_to["country"],
        "travel_to_latitude": travel_to["latitude"],
        "travel_to_longitude": (
            travel_to["longitude"]
        ),
        "travel_to_geography": (
            travel_to["geography"]
        ),
        "travel_reason": travel_reason,
        "travel_km": travel_km,
        "travel_miles": travel_miles,
        "involves_travel": (
            travel_km is not None
            and travel_km > 0.001
        ),
        "team_home_city": nullable_value(
            game["team_home_city"]
        ),
        "team_home_state_province": (
            nullable_value(
                game[
                    "team_home_state_province"
                ]
            )
        ),
        "team_home_country": nullable_value(
            game["team_home_country"]
        ),
        "team_home_latitude": nullable_value(
            game["team_home_latitude"]
        ),
        "team_home_longitude": nullable_value(
            game["team_home_longitude"]
        ),
        "team_home_geography": nullable_value(
            game["team_home_geography"]
        ),
    }


# ============================================================
# STEP 2: PROCESS ONE TEAM
# ============================================================

def build_team_travel_legs(
    team_schedule: pd.DataFrame,
) -> list[dict[str, Any]]:
    """Create all travel legs for one team and season."""
    team_schedule = (
        team_schedule
        .sort_values("team_game_number")
        .reset_index(drop=True)
    )

    legs: list[dict[str, Any]] = []

    road_trip_counter = 0
    active_road_trip_id: Optional[int] = None

    for index in range(len(team_schedule)):
        game = team_schedule.iloc[index]

        previous_game = (
            team_schedule.iloc[index - 1]
            if index > 0
            else None
        )

        next_game = (
            team_schedule.iloc[index + 1]
            if index + 1 < len(team_schedule)
            else None
        )

        days_since_previous = (
            days_between(
                previous_game["game_date"],
                game["game_date"],
            )
            if previous_game is not None
            else None
        )

        days_until_next = (
            days_between(
                game["game_date"],
                next_game["game_date"],
            )
            if next_game is not None
            else None
        )

        current_game_location = game_location(game)
        current_home_location = home_location(game)

        base_sequence = (
            int(game["team_game_number"]) * 10
        )

        # ----------------------------------------------------
        # FIRST GAME OF SEASON
        # ----------------------------------------------------

        if previous_game is None:
            if bool(game["is_away"]):
                road_trip_counter += 1
                active_road_trip_id = (
                    road_trip_counter
                )

                travel_reason = (
                    "SEASON_START_TO_AWAY_GAME"
                )

                leg_road_trip_id = (
                    active_road_trip_id
                )

            else:
                travel_reason = "SEASON_START_HOME"
                leg_road_trip_id = None

            legs.append(
                build_leg(
                    game=game,
                    previous_game=None,
                    next_game=next_game,
                    leg_sequence=base_sequence,
                    leg_type="GAME_ARRIVAL",
                    road_trip_id=leg_road_trip_id,
                    travel_from=current_home_location,
                    travel_to=current_game_location,
                    travel_reason=travel_reason,
                    days_since_previous_game=None,
                    days_until_next_game=(
                        days_until_next
                    ),
                )
            )

            continue

        # ----------------------------------------------------
        # HOME GAME
        # ----------------------------------------------------

        if bool(game["is_home"]):
            if bool(previous_game["is_away"]):
                travel_from = game_location(
                    previous_game
                )

                travel_reason = (
                    "RETURN_HOME_FOR_HOME_GAME"
                )

                leg_road_trip_id = (
                    active_road_trip_id
                )

            else:
                travel_from = current_home_location
                travel_reason = "REMAINED_HOME"
                leg_road_trip_id = None

            legs.append(
                build_leg(
                    game=game,
                    previous_game=previous_game,
                    next_game=next_game,
                    leg_sequence=base_sequence,
                    leg_type="GAME_ARRIVAL",
                    road_trip_id=leg_road_trip_id,
                    travel_from=travel_from,
                    travel_to=current_home_location,
                    travel_reason=travel_reason,
                    days_since_previous_game=(
                        days_since_previous
                    ),
                    days_until_next_game=(
                        days_until_next
                    ),
                )
            )

            active_road_trip_id = None

            continue

        # ----------------------------------------------------
        # AWAY GAME AFTER HOME GAME
        # ----------------------------------------------------

        if bool(previous_game["is_home"]):
            road_trip_counter += 1
            active_road_trip_id = road_trip_counter

            legs.append(
                build_leg(
                    game=game,
                    previous_game=previous_game,
                    next_game=next_game,
                    leg_sequence=base_sequence,
                    leg_type="GAME_ARRIVAL",
                    road_trip_id=active_road_trip_id,
                    travel_from=current_home_location,
                    travel_to=current_game_location,
                    travel_reason="HOME_TO_AWAY_GAME",
                    days_since_previous_game=(
                        days_since_previous
                    ),
                    days_until_next_game=(
                        days_until_next
                    ),
                )
            )

            continue

        # ----------------------------------------------------
        # AWAY GAME AFTER AWAY GAME:
        # STAYED ON ROAD
        # ----------------------------------------------------

        if (
            days_since_previous is not None
            and days_since_previous
            <= MAX_ROAD_TRIP_GAP_DAYS
        ):
            if active_road_trip_id is None:
                road_trip_counter += 1
                active_road_trip_id = (
                    road_trip_counter
                )

            legs.append(
                build_leg(
                    game=game,
                    previous_game=previous_game,
                    next_game=next_game,
                    leg_sequence=base_sequence,
                    leg_type="GAME_ARRIVAL",
                    road_trip_id=active_road_trip_id,
                    travel_from=game_location(
                        previous_game
                    ),
                    travel_to=current_game_location,
                    travel_reason=(
                        "AWAY_TO_AWAY_STAYED_ON_ROAD"
                    ),
                    days_since_previous_game=(
                        days_since_previous
                    ),
                    days_until_next_game=(
                        days_until_next
                    ),
                )
            )

            continue

        # ----------------------------------------------------
        # AWAY GAME AFTER AWAY GAME:
        # RETURNED HOME DURING LONG GAP
        # ----------------------------------------------------

        previous_home_location = home_location(
            previous_game
        )

        previous_return_sequence = (
            int(previous_game["team_game_number"])
            * 10
            + 5
        )

        legs.append(
            build_leg(
                game=previous_game,
                previous_game=(
                    team_schedule.iloc[index - 2]
                    if index > 1
                    else None
                ),
                next_game=game,
                leg_sequence=(
                    previous_return_sequence
                ),
                leg_type="RETURN_HOME",
                road_trip_id=active_road_trip_id,
                travel_from=game_location(
                    previous_game
                ),
                travel_to=previous_home_location,
                travel_reason=(
                    "RETURN_HOME_BETWEEN_AWAY_GAMES"
                ),
                days_since_previous_game=0,
                days_until_next_game=(
                    days_since_previous
                ),
                is_home=False,
                is_away=False,
            )
        )

        road_trip_counter += 1
        active_road_trip_id = road_trip_counter

        legs.append(
            build_leg(
                game=game,
                previous_game=previous_game,
                next_game=next_game,
                leg_sequence=base_sequence,
                leg_type="GAME_ARRIVAL",
                road_trip_id=active_road_trip_id,
                travel_from=current_home_location,
                travel_to=current_game_location,
                travel_reason=(
                    "HOME_TO_AWAY_AFTER_RETURN_HOME"
                ),
                days_since_previous_game=(
                    days_since_previous
                ),
                days_until_next_game=(
                    days_until_next
                ),
            )
        )

    # --------------------------------------------------------
    # FINAL RETURN HOME
    # --------------------------------------------------------

    final_game = team_schedule.iloc[-1]

    if bool(final_game["is_away"]):
        final_previous_game = (
            team_schedule.iloc[-2]
            if len(team_schedule) > 1
            else None
        )

        legs.append(
            build_leg(
                game=final_game,
                previous_game=final_previous_game,
                next_game=None,
                leg_sequence=(
                    int(
                        final_game[
                            "team_game_number"
                        ]
                    )
                    * 10
                    + 5
                ),
                leg_type="RETURN_HOME",
                road_trip_id=active_road_trip_id,
                travel_from=game_location(
                    final_game
                ),
                travel_to=home_location(
                    final_game
                ),
                travel_reason=(
                    "FINAL_AWAY_GAME_RETURN_HOME"
                ),
                days_since_previous_game=0,
                days_until_next_game=None,
                is_home=False,
                is_away=False,
            )
        )

    return legs


# ============================================================
# STEP 3: BUILD ALL TEAMS
# ============================================================

def build_all_travel_legs(
    schedule_df: pd.DataFrame,
) -> pd.DataFrame:
    """Build travel legs for every team and season."""
    all_legs: list[dict[str, Any]] = []

    grouped = schedule_df.groupby(
        [
            "season",
            "team_id",
        ],
        sort=True,
    )

    group_count = grouped.ngroups

    for position, (
        (season, team_id),
        team_schedule,
    ) in enumerate(grouped, start=1):
        team_abbrev = (
            team_schedule[
                "team_abbrev"
            ].iloc[0]
        )

        print(
            f"Processing {position}/{group_count}: "
            f"{team_abbrev} ({season})"
        )

        team_legs = build_team_travel_legs(
            team_schedule
        )

        all_legs.extend(team_legs)

    result = pd.DataFrame(all_legs)

    if result.empty:
        raise RuntimeError(
            "No travel legs were generated."
        )

    result = result.sort_values(
        [
            "season",
            "team_id",
            "leg_sequence",
        ]
    ).reset_index(drop=True)

    return result[OUTPUT_COLUMNS]


# ============================================================
# STEP 4: VALIDATE
# ============================================================

def validate_travel_legs(
    legs_df: pd.DataFrame,
    schedule_df: pd.DataFrame,
) -> None:
    """Validate the generated travel-leg dataset."""
    game_arrivals = legs_df[
        legs_df["leg_type"] == "GAME_ARRIVAL"
    ]

    if len(game_arrivals) != len(schedule_df):
        raise ValueError(
            f"Expected {len(schedule_df)} GAME_ARRIVAL "
            f"rows, but created {len(game_arrivals)}."
        )

    duplicate_arrivals = game_arrivals[
        game_arrivals.duplicated(
            subset=[
                "season",
                "team_id",
                "game_id",
            ],
            keep=False,
        )
    ]

    if not duplicate_arrivals.empty:
        raise ValueError(
            "Duplicate game-arrival rows found:\n"
            + duplicate_arrivals[
                [
                    "season",
                    "team_abbrev",
                    "game_id",
                    "leg_sequence",
                ]
            ].to_string(index=False)
        )

    duplicate_sequences = legs_df[
        legs_df.duplicated(
            subset=[
                "season",
                "team_id",
                "leg_sequence",
            ],
            keep=False,
        )
    ]

    if not duplicate_sequences.empty:
        raise ValueError(
            "Duplicate leg sequences found:\n"
            + duplicate_sequences[
                [
                    "season",
                    "team_abbrev",
                    "leg_sequence",
                    "leg_type",
                ]
            ].to_string(index=False)
        )

    missing_locations = legs_df[
        legs_df[
            [
                "travel_from_city",
                "travel_from_latitude",
                "travel_from_longitude",
                "travel_to_city",
                "travel_to_latitude",
                "travel_to_longitude",
            ]
        ].isna().any(axis=1)
    ]

    if not missing_locations.empty:
        raise ValueError(
            "Travel legs with missing locations:\n"
            + missing_locations[
                [
                    "team_abbrev",
                    "leg_sequence",
                    "leg_type",
                    "game_id",
                    "travel_from_city",
                    "travel_to_city",
                ]
            ].to_string(index=False)
        )

    missing_distance = legs_df[
        legs_df["travel_km"].isna()
    ]

    if not missing_distance.empty:
        raise ValueError(
            "Travel legs with missing distance:\n"
            + missing_distance[
                [
                    "team_abbrev",
                    "leg_sequence",
                    "travel_from_city",
                    "travel_to_city",
                ]
            ].to_string(index=False)
        )

    negative_distance = legs_df[
        legs_df["travel_km"] < 0
    ]

    if not negative_distance.empty:
        raise ValueError(
            "Negative travel distances found."
        )

    return_home_legs = legs_df[
        legs_df["leg_type"] == "RETURN_HOME"
    ]

    incorrect_return_destinations = (
        return_home_legs[
            return_home_legs["travel_to_city"]
            != return_home_legs["team_home_city"]
        ]
    )

    if not incorrect_return_destinations.empty:
        raise ValueError(
            "Return-home legs do not end at the "
            "team's home city:\n"
            + incorrect_return_destinations[
                [
                    "team_abbrev",
                    "travel_from_city",
                    "travel_to_city",
                    "team_home_city",
                ]
            ].to_string(index=False)
        )

    print(
        f"Travel-leg validation passed for "
        f"{len(legs_df)} rows."
    )


# ============================================================
# STEP 5: PREPARE FOR BIGQUERY
# ============================================================

def prepare_for_bigquery(
    legs_df: pd.DataFrame,
) -> pd.DataFrame:
    """Apply stable pandas types before loading."""
    prepared = legs_df.copy()

    integer_columns = [
        "season",
        "team_id",
        "leg_sequence",
        "game_id",
        "team_game_number",
        "opponent_team_id",
        "previous_game_id",
        "next_game_id",
        "days_since_previous_game",
        "days_until_next_game",
        "road_trip_id",
    ]

    for column in integer_columns:
        prepared[column] = pd.to_numeric(
            prepared[column],
            errors="coerce",
        ).astype("Int64")

    float_columns = [
        "travel_from_latitude",
        "travel_from_longitude",
        "travel_to_latitude",
        "travel_to_longitude",
        "travel_km",
        "travel_miles",
        "team_home_latitude",
        "team_home_longitude",
    ]

    for column in float_columns:
        prepared[column] = pd.to_numeric(
            prepared[column],
            errors="coerce",
        ).astype("Float64")

    boolean_columns = [
        "is_home",
        "is_away",
        "neutral_site",
        "previous_is_home",
        "previous_is_away",
        "next_is_home",
        "next_is_away",
        "involves_travel",
    ]

    for column in boolean_columns:
        prepared[column] = prepared[column].astype(
            "boolean"
        )

    date_columns = [
        "game_date",
        "previous_game_date",
        "next_game_date",
    ]

    for column in date_columns:
        prepared[column] = pd.to_datetime(
            prepared[column],
            errors="coerce",
        ).dt.date

    timestamp_columns = [
        "game_datetime",
        "previous_game_datetime",
        "next_game_datetime",
    ]

    for column in timestamp_columns:
        prepared[column] = pd.to_datetime(
            prepared[column],
            utc=True,
            errors="coerce",
        )

    # Rebuild geography strings from coordinates to ensure that
    # every loaded value is valid WKT.
    prepared["travel_from_geography"] = [
        point_wkt(latitude, longitude)
        for latitude, longitude in zip(
            prepared["travel_from_latitude"],
            prepared["travel_from_longitude"],
        )
    ]

    prepared["travel_to_geography"] = [
        point_wkt(latitude, longitude)
        for latitude, longitude in zip(
            prepared["travel_to_latitude"],
            prepared["travel_to_longitude"],
        )
    ]

    prepared["team_home_geography"] = [
        point_wkt(latitude, longitude)
        for latitude, longitude in zip(
            prepared["team_home_latitude"],
            prepared["team_home_longitude"],
        )
    ]

    return prepared[OUTPUT_COLUMNS]


# ============================================================
# STEP 6: LOAD
# ============================================================

def load_to_bigquery(
    legs_df: pd.DataFrame,
) -> None:
    """Replace Travel_2_Legs with the current output."""
    prepared_df = prepare_for_bigquery(
        legs_df
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

    job = BQ.load_table_from_dataframe(
        prepared_df,
        DESTINATION_TABLE,
        job_config=job_config,
    )

    job.result()

    print(
        f"Loaded {len(prepared_df)} rows into "
        f"{DESTINATION_TABLE}."
    )


# ============================================================
# DIAGNOSTICS
# ============================================================

def print_summary(
    legs_df: pd.DataFrame,
) -> None:
    """Print a compact team-level travel summary."""
    summary = (
        legs_df
        .groupby(
            [
                "season",
                "team_id",
                "team_abbrev",
            ]
        )
        .agg(
            total_legs=(
                "leg_sequence",
                "count",
            ),
            travel_legs=(
                "involves_travel",
                "sum",
            ),
            road_trips=(
                "road_trip_id",
                "nunique",
            ),
            total_km=(
                "travel_km",
                "sum",
            ),
            total_miles=(
                "travel_miles",
                "sum",
            ),
            longest_leg_km=(
                "travel_km",
                "max",
            ),
        )
        .reset_index()
        .sort_values(
            [
                "season",
                "total_km",
            ],
            ascending=[
                False,
                False
            ],
        )
    )

    summary["total_km"] = (
        summary["total_km"].round(1)
    )

    summary["total_miles"] = (
        summary["total_miles"].round(1)
    )

    summary["longest_leg_km"] = (
        summary["longest_leg_km"].round(1)
    )

    print("\nTeam travel summary:")
    print(
        summary.to_string(
            index=False
        )
    )


# ============================================================
# MAIN
# ============================================================

def main() -> None:
    """Run the complete travel-leg pipeline."""
    print("Starting Travel_2_Legs pipeline.")
    print(f"Source: {SOURCE_TABLE}")
    print(f"Destination: {DESTINATION_TABLE}")
    print(
        "Maximum gap within one road trip: "
        f"{MAX_ROAD_TRIP_GAP_DAYS} days"
    )

    print("\nReading expanded schedule...")

    schedule_df = get_schedule_expanded()

    print(
        f"Read {len(schedule_df)} team-game rows."
    )

    print("\nBuilding travel legs...")

    legs_df = build_all_travel_legs(
        schedule_df
    )

    print(
        f"Built {len(legs_df)} travel-leg rows."
    )

    print("\nValidating travel legs...")

    validate_travel_legs(
        legs_df,
        schedule_df,
    )

    print_summary(
        legs_df
    )

    print("\nLoading Travel_2_Legs...")

    load_to_bigquery(
        legs_df
    )

    print(
        "\nTravel_2_Legs pipeline completed "
        "successfully."
    )


if __name__ == "__main__":
    main()