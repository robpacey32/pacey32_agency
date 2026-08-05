"""
NHL practice facility geospatial pipeline.

Creates:

    pacey32-agency.Geo.PracticeFacility

The practice facility reference is manually maintained because these
locations change infrequently and should remain deterministic.

Coordinates are refreshed with OpenStreetMap Nominatim before upload.
"""

from __future__ import annotations

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
# Configuration
# ============================================================

OUTPUT_TABLE = "PracticeFacility"

SOURCE = "Manual reference + OpenStreetMap Nominatim"


# ============================================================
# BigQuery schema
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
        "facility_name",
        "STRING",
        mode="REQUIRED",
    ),
    bigquery.SchemaField(
        "facility_type",
        "STRING",
    ),
    bigquery.SchemaField(
        "address",
        "STRING",
    ),
    bigquery.SchemaField(
        "city",
        "STRING",
    ),
    bigquery.SchemaField(
        "state_province",
        "STRING",
    ),
    bigquery.SchemaField(
        "country",
        "STRING",
    ),
    bigquery.SchemaField(
        "notes",
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
# Practice facility reference
# ============================================================

PRACTICE_FACILITIES = {
    "Anaheim Ducks": {
        "facility_name": "Great Park Ice & FivePoint Arena",
        "facility_type": "Dedicated practice facility",
        "address": "888 Ridge Valley, Irvine, CA 92618",
        "city": "Irvine",
        "state_province": "California",
        "country": "United States",
        "notes": "Official Ducks practice facility.",
    },
    "Boston Bruins": {
        "facility_name": "Warrior Ice Arena",
        "facility_type": "Dedicated practice facility",
        "address": "90 Guest Street, Boston, MA 02135",
        "city": "Boston",
        "state_province": "Massachusetts",
        "country": "United States",
        "notes": "Official Bruins practice facility.",
    },
    "Buffalo Sabres": {
        "facility_name": "LECOM Harborcenter",
        "facility_type": "Arena-connected",
        "address": "100 Washington Street, Buffalo, NY 14203",
        "city": "Buffalo",
        "state_province": "New York",
        "country": "United States",
        "notes": "Connected to KeyBank Center.",
    },
    "Calgary Flames": {
        "facility_name": "Scotiabank Saddledome",
        "facility_type": "Arena",
        "address": "555 Saddledome Rise SE, Calgary, AB",
        "city": "Calgary",
        "state_province": "Alberta",
        "country": "Canada",
        "notes": "Current practice location until Scotia Place opens.",
    },
    "Carolina Hurricanes": {
        "facility_name": "Wake Competition Center",
        "facility_type": "Dedicated practice facility",
        "address": "801 Corporate Center Drive, Raleigh, NC",
        "city": "Morrisville",
        "state_province": "North Carolina",
        "country": "United States",
        "notes": "Formerly known as Invisalign Arena.",
    },
    "Chicago Blackhawks": {
        "facility_name": "Fifth Third Arena",
        "facility_type": "Dedicated practice facility",
        "address": "1801 W Jackson Boulevard, Chicago, IL 60612",
        "city": "Chicago",
        "state_province": "Illinois",
        "country": "United States",
        "notes": None,
    },
    "Colorado Avalanche": {
        "facility_name": "Family Sports Center",
        "facility_type": "Dedicated practice facility",
        "address": "6901 S Peoria Street, Centennial, CO",
        "city": "Centennial",
        "state_province": "Colorado",
        "country": "United States",
        "notes": None,
    },
    "Columbus Blue Jackets": {
        "facility_name": "OhioHealth Ice Haus",
        "facility_type": "Arena-connected",
        "address": "200 W Nationwide Boulevard, Columbus, OH",
        "city": "Columbus",
        "state_province": "Ohio",
        "country": "United States",
        "notes": "Connected to Nationwide Arena.",
    },
    "Dallas Stars": {
        "facility_name": "Comerica Center",
        "facility_type": "Dedicated practice facility",
        "address": "2601 Avenue of the Stars, Frisco, TX",
        "city": "Frisco",
        "state_province": "Texas",
        "country": "United States",
        "notes": None,
    },
    "Detroit Red Wings": {
        "facility_name": "BELFOR Training Center",
        "facility_type": "Arena-connected",
        "address": "2645 Woodward Avenue, Detroit, MI",
        "city": "Detroit",
        "state_province": "Michigan",
        "country": "United States",
        "notes": "Located inside Little Caesars Arena.",
    },
    "Edmonton Oilers": {
        "facility_name": "Downtown Community Arena",
        "facility_type": "Arena-connected",
        "address": "10220 104 Avenue NW, Edmonton, AB",
        "city": "Edmonton",
        "state_province": "Alberta",
        "country": "Canada",
        "notes": "Connected to Rogers Place.",
    },
    "Florida Panthers": {
        "facility_name": "Baptist Health IcePlex",
        "facility_type": "Dedicated practice facility",
        "address": "800 NE 8th Street, Fort Lauderdale, FL",
        "city": "Fort Lauderdale",
        "state_province": "Florida",
        "country": "United States",
        "notes": None,
    },
    "Los Angeles Kings": {
        "facility_name": "Toyota Sports Performance Center",
        "facility_type": "Dedicated practice facility",
        "address": "555 N Nash Street, El Segundo, CA",
        "city": "El Segundo",
        "state_province": "California",
        "country": "United States",
        "notes": None,
    },
    "Minnesota Wild": {
        "facility_name": "TRIA Rink",
        "facility_type": "Dedicated practice facility",
        "address": "400 Wabasha Street N, St. Paul, MN",
        "city": "St. Paul",
        "state_province": "Minnesota",
        "country": "United States",
        "notes": None,
    },
    "Montréal Canadiens": {
        "facility_name": "CN Sports Complex",
        "facility_type": "Dedicated practice facility",
        "address": "8000 Boulevard Leduc, Brossard, QC",
        "city": "Brossard",
        "state_province": "Quebec",
        "country": "Canada",
        "notes": None,
    },
    "Nashville Predators": {
        "facility_name": "Ford Ice Center Bellevue",
        "facility_type": "Dedicated practice facility",
        "address": "7638 B Highway 70 S, Nashville, TN",
        "city": "Nashville",
        "state_province": "Tennessee",
        "country": "United States",
        "notes": "Primary practice facility.",
    },
    "New Jersey Devils": {
        "facility_name": "RWJBarnabas Health Hockey House",
        "facility_type": "Arena-connected",
        "address": "25 Lafayette Street, Newark, NJ",
        "city": "Newark",
        "state_province": "New Jersey",
        "country": "United States",
        "notes": "Attached to Prudential Center.",
    },
    "New York Islanders": {
        "facility_name": "Northwell Health Ice Center",
        "facility_type": "Dedicated practice facility",
        "address": "200 Merrick Avenue, East Meadow, NY",
        "city": "East Meadow",
        "state_province": "New York",
        "country": "United States",
        "notes": None,
    },
    "New York Rangers": {
        "facility_name": "MSG Training Center",
        "facility_type": "Dedicated practice facility",
        "address": "600 Corporate Court, Greenburgh, NY",
        "city": "Greenburgh",
        "state_province": "New York",
        "country": "United States",
        "notes": None,
    },
    "Ottawa Senators": {
        "facility_name": "Bell Sensplex",
        "facility_type": "Dedicated practice facility",
        "address": "1565 Maple Grove Road, Ottawa, ON",
        "city": "Ottawa",
        "state_province": "Ontario",
        "country": "Canada",
        "notes": None,
    },
    "Philadelphia Flyers": {
        "facility_name": "Flyers Training Center",
        "facility_type": "Dedicated practice facility",
        "address": "601 Laurel Oak Road, Voorhees, NJ",
        "city": "Voorhees",
        "state_province": "New Jersey",
        "country": "United States",
        "notes": None,
    },
    "Pittsburgh Penguins": {
        "facility_name": "UPMC Lemieux Sports Complex",
        "facility_type": "Dedicated practice facility",
        "address": (
            "8000 Cranberry Springs Drive, "
            "Cranberry Township, PA"
        ),
        "city": "Cranberry Township",
        "state_province": "Pennsylvania",
        "country": "United States",
        "notes": None,
    },
    "San Jose Sharks": {
        "facility_name": "Sharks Ice at San Jose",
        "facility_type": "Dedicated practice facility",
        "address": "1500 S 10th Street, San Jose, CA",
        "city": "San Jose",
        "state_province": "California",
        "country": "United States",
        "notes": "Adjacent to Tech CU Arena.",
    },
    "Seattle Kraken": {
        "facility_name": "Kraken Community Iceplex",
        "facility_type": "Dedicated practice facility",
        "address": "10601 5th Avenue NE, Seattle, WA",
        "city": "Seattle",
        "state_province": "Washington",
        "country": "United States",
        "notes": None,
    },
    "St. Louis Blues": {
        "facility_name": "Centene Community Ice Center",
        "facility_type": "Dedicated practice facility",
        "address": "750 Casino Center Drive, Maryland Heights, MO",
        "city": "Maryland Heights",
        "state_province": "Missouri",
        "country": "United States",
        "notes": None,
    },
    "Tampa Bay Lightning": {
        "facility_name": "TGH Ice Plex",
        "facility_type": "Dedicated practice facility",
        "address": "10222 Elizabeth Place, Tampa, FL",
        "city": "Brandon",
        "state_province": "Florida",
        "country": "United States",
        "notes": None,
    },
    "Toronto Maple Leafs": {
        "facility_name": "Ford Performance Centre",
        "facility_type": "Dedicated practice facility",
        "address": "400 Kipling Avenue, Toronto, ON",
        "city": "Toronto",
        "state_province": "Ontario",
        "country": "Canada",
        "notes": None,
    },
    "Utah Mammoth": {
        "facility_name": "Utah Mammoth Ice Center",
        "facility_type": "Dedicated practice facility",
        "address": "Sandy, UT",
        "city": "Sandy",
        "state_province": "Utah",
        "country": "United States",
        "notes": (
            "Current or planned primary training facility; "
            "verify when the permanent facility is fully operational."
        ),
    },
    "Vancouver Canucks": {
        "facility_name": (
            "UBC Doug Mitchell Thunderbird Sports Centre"
        ),
        "facility_type": "Shared practice facility",
        "address": "6066 Thunderbird Boulevard, Vancouver, BC",
        "city": "Vancouver",
        "state_province": "British Columbia",
        "country": "Canada",
        "notes": (
            "Primary shared practice venue; Rogers Arena may also "
            "be used depending on schedule."
        ),
    },
    "Vegas Golden Knights": {
        "facility_name": "City National Arena",
        "facility_type": "Dedicated practice facility",
        "address": (
            "1550 S Pavilion Center Drive, "
            "Las Vegas, NV"
        ),
        "city": "Las Vegas",
        "state_province": "Nevada",
        "country": "United States",
        "notes": None,
    },
    "Washington Capitals": {
        "facility_name": "MedStar Capitals Iceplex",
        "facility_type": "Dedicated practice facility",
        "address": "627 N Glebe Road, Arlington, VA",
        "city": "Arlington",
        "state_province": "Virginia",
        "country": "United States",
        "notes": None,
    },
    "Winnipeg Jets": {
        "facility_name": "Hockey for All Centre",
        "facility_type": "Dedicated practice facility",
        "address": "3969 Portage Avenue, Winnipeg, MB",
        "city": "Winnipeg",
        "state_province": "Manitoba",
        "country": "Canada",
        "notes": None,
    }
}


# ============================================================
# Build dataframe
# ============================================================

def build_practice_dataframe(
    teams: pd.DataFrame,
) -> pd.DataFrame:
    """Geocode every NHL practice facility."""

    geocode = create_nominatim_geocoder()

    rows: list[dict] = []

    total = len(teams)

    missing_reference_teams = sorted(
        set(teams["fullName"])
        - set(PRACTICE_FACILITIES)
    )

    extra_reference_teams = sorted(
        set(PRACTICE_FACILITIES)
        - set(teams["fullName"])
    )

    if missing_reference_teams:
        raise RuntimeError(
            "Practice facility references are missing for: "
            + ", ".join(missing_reference_teams)
        )

    if extra_reference_teams:
        print(
            "WARNING: practice facility references exist for teams "
            "not present in the source: "
            + ", ".join(extra_reference_teams)
        )

    for number, (_, team) in enumerate(
        teams.iterrows(),
        start=1,
    ):
        print(
            f"[{number}/{total}] "
            f"{team.fullName}"
        )

        facility = PRACTICE_FACILITIES[
            team.fullName
        ]

        result = geocode_location(
            geocode=geocode,
            name=facility["facility_name"],
            address=facility["address"],
            city=facility["city"],
            state_province=facility[
                "state_province"
            ],
            country=facility["country"],
        )

        rows.append(
            {
                "id": int(team.id),
                "tricode": team.tricode,
                "fullName": team.fullName,
                "facility_name": facility[
                    "facility_name"
                ],
                "facility_type": facility[
                    "facility_type"
                ],
                "address": facility["address"],
                "city": facility["city"],
                "state_province": facility[
                    "state_province"
                ],
                "country": facility["country"],
                "notes": facility["notes"],
                "query": result["query"],
                "matched_address": result[
                    "matched_address"
                ],
                "latitude": result["latitude"],
                "longitude": result["longitude"],
                "geography_wkt": result[
                    "geography_wkt"
                ],
                "geocode_status": result[
                    "geocode_status"
                ],
                "source": SOURCE,
                "last_updated": (
                    current_timestamp()
                ),
            }
        )

    dataframe = pd.DataFrame(rows)

    return dataframe[
        [
            "id",
            "tricode",
            "fullName",
            "facility_name",
            "facility_type",
            "address",
            "city",
            "state_province",
            "country",
            "notes",
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


# ============================================================
# Main
# ============================================================

def main() -> None:
    """Run the Practice Facility pipeline."""

    print("=" * 70)
    print("PRACTICE FACILITY GEOSPATIAL PIPELINE")
    print("=" * 70)
    print(f"Output table: {OUTPUT_TABLE}")
    print()

    bq = create_bigquery_client()

    teams = load_team_locations(
        client=bq,
    )

    print()

    practice_df = build_practice_dataframe(
        teams=teams,
    )

    print()

    validate_unique(
        dataframe=practice_df,
        columns=["id"],
        label="practice facility team",
    )

    validate_coordinates(
        dataframe=practice_df,
        allow_missing=False,
    )

    print_geo_summary(
        dataframe=practice_df,
    )

    print()

    upload_dataframe(
        client=bq,
        dataframe=practice_df,
        table_name=OUTPUT_TABLE,
        schema=SCHEMA,
    )

    print()
    print("=" * 70)
    print(
        "Practice Facility pipeline completed successfully."
    )
    print("=" * 70)


if __name__ == "__main__":
    main()