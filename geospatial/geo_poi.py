"""
NHL Points of Interest pipeline.

Creates:

Geo.Airport
Geo.Hospital
Geo.School
Geo.GolfClub
Geo.CountryClub
Geo.Marina
Geo.Ski
Geo.Beach
Geo.ShoppingMall
Geo.Restaurant
"""

from __future__ import annotations

import pandas as pd
from google.cloud import bigquery

from geospatial.geo_utils import (
    POI_CATEGORIES,
    create_bigquery_client,
    current_timestamp,
    geoapify_feature_to_row,
    get_geoapify_pois,
    load_team_locations,
    print_geo_summary,
    upload_dataframe,
)

SOURCE = "Geoapify"

SCHEMA = [

    bigquery.SchemaField("id","INTEGER","REQUIRED"),
    bigquery.SchemaField("tricode","STRING"),
    bigquery.SchemaField("fullName","STRING"),

    bigquery.SchemaField("name","STRING"),
    bigquery.SchemaField("address","STRING"),

    bigquery.SchemaField("city","STRING"),
    bigquery.SchemaField("state_province","STRING"),
    bigquery.SchemaField("country","STRING"),

    bigquery.SchemaField("latitude","FLOAT"),
    bigquery.SchemaField("longitude","FLOAT"),
    bigquery.SchemaField("geography_wkt","STRING"),

    bigquery.SchemaField("place_id","STRING"),

    bigquery.SchemaField("source","STRING"),
    bigquery.SchemaField("last_updated","TIMESTAMP"),

]

# ============================================================
# BUILD ONE POI DATAFRAME
# ============================================================

def build_poi_dataframe(
    teams: pd.DataFrame,
    category_name: str,
    category: str,
    radius_metres: int = 50_000,
    limit: int = 10,
) -> pd.DataFrame:
    """
    Build one dataframe for a Geo table.

    Example:
        Airport
        Hospital
        GolfClub
    """

    print()
    print("=" * 70)
    print(category_name)
    print("=" * 70)

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

        try:

            features = get_geoapify_pois(
                latitude=team.city_latitude,
                longitude=team.city_longitude,
                category=category,
                radius_metres=radius_metres,
                limit=limit,
            )

        except Exception as exc:

            print(
                f"    ERROR: {exc}"
            )

            continue

        print(
            f"    {len(features)} found"
        )

        for feature in features:

            poi = geoapify_feature_to_row(
                feature
            )

            rows.append(
                {
                    "id": int(team.id),
                    "tricode": team.tricode,
                    "fullName": team.fullName,

                    "name": poi["name"],
                    "address": poi["address"],

                    "city": poi["city"],
                    "state_province": poi["state_province"],
                    "country": poi["country"],

                    "latitude": poi["latitude"],
                    "longitude": poi["longitude"],
                    "geography_wkt": poi["geography_wkt"],

                    "place_id": poi["place_id"],

                    "source": SOURCE,
                    "last_updated": current_timestamp(),
                }
            )

    dataframe = pd.DataFrame(rows)

    if dataframe.empty:

        print(
            f"No {category_name} rows returned."
        )

        return dataframe

    dataframe = dataframe[
        [
            "id",
            "tricode",
            "fullName",

            "name",
            "address",

            "city",
            "state_province",
            "country",

            "latitude",
            "longitude",
            "geography_wkt",

            "place_id",

            "source",
            "last_updated",
        ]
    ]

    dataframe = dataframe.sort_values(
        [
            "fullName",
            "name",
        ],
        ignore_index=True,
    )

    print_geo_summary(
        dataframe
    )

    return dataframe

# ============================================================
# MAIN
# ============================================================

def main() -> None:

    print("=" * 70)
    print("POINTS OF INTEREST PIPELINE")
    print("=" * 70)

    bq = create_bigquery_client()

    teams = load_team_locations(
        client=bq,
    )

    print()
    print(f"{len(teams)} teams loaded.")

    for table_name, (
        category,
        description,
        radius_metres,
        limit,
    ) in POI_CATEGORIES.items():

        print()
        print("=" * 70)
        print(f"Building {table_name}")
        print("=" * 70)

        dataframe = build_poi_dataframe(
            teams=teams,
            category_name=description,
            category=category,
            radius_metres=radius_metres,
            limit=limit,
        )

        if dataframe.empty:

            print(
                f"Skipping {table_name} (no rows)"
            )

            continue

        upload_dataframe(
            client=bq,
            dataframe=dataframe,
            table_name=table_name,
            schema=SCHEMA,
        )

        print(
            f"{table_name} uploaded."
        )

    print()
    print("=" * 70)
    print("POI pipeline completed successfully.")
    print("=" * 70)


if __name__ == "__main__":
    main()