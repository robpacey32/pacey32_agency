"""
Arena geospatial pipeline.

Purpose
-------
Creates:

    pacey32-agency.Geo.Arena

One row per NHL team containing the arena location.

Uses:
    OrganizationDetail
    CityReference
    OpenStreetMap (Nominatim)
"""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd
from google.cloud import bigquery

from geospatial.geo_utils import (
    create_bigquery_client,
    create_nominatim_geocoder,
    current_timestamp,
    geocode_location,
    load_team_locations,
    print_geo_summary,
    upload_dataframe,
    validate_coordinates,
    validate_unique,
)


# ============================================================
# CONFIGURATION
# ============================================================

OUTPUT_TABLE = "Arena"

SOURCE = "OpenStreetMap Nominatim"


# ============================================================
# BIGQUERY SCHEMA
# ============================================================

SCHEMA = [

    bigquery.SchemaField(
        "id",
        "INTEGER",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "tricode",
        "STRING",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "fullName",
        "STRING",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "arena_name",
        "STRING",
    ),

    bigquery.SchemaField(
        "query",
        "STRING",
    ),

    bigquery.SchemaField(
        "matched_address",
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
        "geography_wkt",
        "STRING",
    ),

    bigquery.SchemaField(
        "geocode_status",
        "STRING",
    ),

    bigquery.SchemaField(
        "source",
        "STRING",
    ),

    bigquery.SchemaField(
        "last_updated",
        "TIMESTAMP",
    ),

]


# ============================================================
# BUILD ARENA DATAFRAME
# ============================================================

def build_arena_dataframe(
    teams: pd.DataFrame,
) -> pd.DataFrame:
    """
    Geocode every NHL arena.
    """

    geocode = create_nominatim_geocoder()

    rows = []

    total = len(teams)

    for number, (_, team) in enumerate(
        teams.iterrows(),
        start=1,
    ):

        print(
            f"[{number}/{total}] "
            f"{team.fullName}"
        )

        result = geocode_location(
            geocode=geocode,
            name=team.venue,
            city=team.venueLocation,
            state_province=team.state_province,
            country=team.country,
        )

        rows.append(
            {
                "id": team.id,
                "tricode": team.tricode,
                "fullName": team.fullName,
                "arena_name": team.venue,
                "query": result["query"],
                "matched_address": result[
                    "matched_address"
                ],
                "latitude": result[
                    "latitude"
                ],
                "longitude": result[
                    "longitude"
                ],
                "geography_wkt": result[
                    "geography_wkt"
                ],
                "geocode_status": result[
                    "geocode_status"
                ],
                "source": SOURCE,
                "last_updated": current_timestamp(),
            }
        )

    dataframe = pd.DataFrame(rows)

    dataframe = dataframe[
        [
            "id",
            "tricode",
            "fullName",
            "arena_name",
            "query",
            "matched_address",
            "latitude",
            "longitude",
            "geography_wkt",
            "geocode_status",
            "source",
            "last_updated",
        ]
    ]

    return dataframe

# ============================================================
# MAIN
# ============================================================

def main() -> None:
    """Run the Arena geospatial pipeline."""

    print("=" * 70)
    print("ARENA GEOSPATIAL PIPELINE")
    print("=" * 70)
    print(f"Output table: {OUTPUT_TABLE}")
    print()

    # --------------------------------------------------------
    # Clients
    # --------------------------------------------------------

    bq = create_bigquery_client()

    # --------------------------------------------------------
    # Read source data
    # --------------------------------------------------------

    teams = load_team_locations(
        client=bq,
    )

    print()

    # --------------------------------------------------------
    # Build arena dataframe
    # --------------------------------------------------------

    arena_df = build_arena_dataframe(
        teams,
    )

    print()

    # --------------------------------------------------------
    # Validation
    # --------------------------------------------------------

    validate_unique(
        dataframe=arena_df,
        columns=["id"],
        label="team",
    )

    validate_coordinates(
        dataframe=arena_df,
        allow_missing=False,
    )

    print_geo_summary(
        dataframe=arena_df,
    )

    print()

    # --------------------------------------------------------
    # Upload
    # --------------------------------------------------------

    upload_dataframe(
        client=bq,
        dataframe=arena_df,
        table_name=OUTPUT_TABLE,
        schema=SCHEMA,
    )

    print()
    print("=" * 70)
    print("Arena pipeline completed successfully.")
    print("=" * 70)


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()