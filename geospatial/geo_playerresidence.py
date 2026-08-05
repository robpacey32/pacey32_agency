"""
NHL player residential-area geospatial pipeline.

Creates:

    pacey32-agency.Geo.PlayerResidentialArea

Gemini identifies up to five residential areas associated with each
NHL team. Geoapify geocodes each area, with Nominatim as fallback.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

import pandas as pd
from google import genai
from google.cloud import bigquery
from google.genai import types

from geospatial.geo_utils import (
    create_bigquery_client,
    create_nominatim_geocoder,
    current_timestamp,
    geocode_location,
    load_team_locations,
    print_geo_summary,
    query_to_dataframe,
    upload_dataframe,
    validate_coordinates,
    validate_unique,
)


# ============================================================
# Configuration
# ============================================================

OUTPUT_TABLE = "PlayerResidentialArea"

MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.1-flash-lite",
)

PROMPT_VERSION = "1.0"

FORCE_REFRESH = (
    os.getenv("FORCE_REFRESH", "false")
    .strip()
    .lower()
    in {"1", "true", "yes", "y"}
)

GEMINI_API_KEY = os.getenv(
    "GEMINI_API_KEY"
)


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
        "rank",
        "INTEGER",
        mode="REQUIRED",
    ),
    bigquery.SchemaField(
        "area_name",
        "STRING",
        mode="REQUIRED",
    ),
    bigquery.SchemaField(
        "location_type",
        "STRING",
    ),
    bigquery.SchemaField(
        "reason",
        "STRING",
    ),
    bigquery.SchemaField(
        "confidence",
        "FLOAT",
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
        "model",
        "STRING",
    ),
    bigquery.SchemaField(
        "prompt_version",
        "STRING",
    ),
    bigquery.SchemaField(
        "generated_datetime",
        "TIMESTAMP",
    ),
]


OUTPUT_COLUMNS = [
    field.name
    for field in SCHEMA
]


# ============================================================
# Gemini helpers
# ============================================================

def create_gemini_client() -> genai.Client:
    """Create the Gemini client."""

    if not GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY environment variable is missing."
        )

    return genai.Client(
        api_key=GEMINI_API_KEY,
    )


def build_prompt(
    team: pd.Series,
) -> str:
    """Build the residential-area prompt."""

    return f"""
You are helping build an NHL player relocation database.

Return ONLY valid JSON.

Team: {team["fullName"]}
Home city: {team["venueLocation"]}
State/Province: {team["state_province"]}
Country: {team["country"]}

Identify the residential areas where current or recent NHL players
associated with this team genuinely tend to live.

Rules:

- Return a maximum of five areas.
- Return fewer than five if there are not five well-established areas.
- Do not invent neighbourhoods or unsupported player connections.
- Areas may be neighbourhoods, suburbs, towns, districts or villages.
- Areas may be outside the official home city where that is genuinely
  common for players.
- Rank them from most commonly associated with players to least.
- Keep the reason concise and relevant to player relocation.
- Confidence must be a number between 0.00 and 1.00.
- Use the specific municipality in area_name where needed to avoid
  ambiguity.
- Do not include markdown or explanatory text.

Return this exact JSON structure:

[
  {{
    "rank": 1,
    "area_name": "",
    "location_type": "",
    "reason": "",
    "confidence": 0.95
  }}
]
""".strip()


def strip_json_fences(
    value: str,
) -> str:
    """Remove optional Markdown JSON fences."""

    text = value.strip()

    text = re.sub(
        r"^```(?:json)?\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )

    text = re.sub(
        r"\s*```$",
        "",
        text,
    )

    return text.strip()


def generate_residential_areas(
    ai_client: genai.Client,
    team: pd.Series,
) -> list[dict[str, Any]]:
    """Generate structured residential areas for one team."""

    response = ai_client.models.generate_content(
        model=MODEL,
        contents=build_prompt(team),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )

    if not response.text:
        raise RuntimeError(
            f"Gemini returned no text for {team['fullName']}."
        )

    raw_text = strip_json_fences(
        response.text
    )

    decoder = json.JSONDecoder()

    try:

        areas, _ = decoder.raw_decode(
            raw_text
        )

    except json.JSONDecodeError as error:

        raise RuntimeError(
            f"Invalid Gemini JSON for {team['fullName']}:\n\n"
            f"{response.text}"
        ) from error

    if not isinstance(areas, list):
        raise RuntimeError(
            f"Gemini result for {team['fullName']} "
            "was not a JSON list."
        )

    validated: list[dict[str, Any]] = []

    for item in areas[:5]:

        if not isinstance(item, dict):
            continue

        area_name = str(
            item.get(
                "area_name",
                "",
            )
        ).strip()

        if not area_name:
            continue

        try:
            rank = int(
                item.get(
                    "rank",
                    len(validated) + 1,
                )
            )
        except (TypeError, ValueError):
            rank = len(validated) + 1

        try:
            confidence = float(
                item.get(
                    "confidence"
                )
            )
        except (TypeError, ValueError):
            confidence = None

        if confidence is not None:
            confidence = max(
                0.0,
                min(
                    1.0,
                    confidence,
                ),
            )

        validated.append(
            {
                "rank": rank,
                "area_name": area_name,
                "location_type": (
                    str(
                        item.get(
                            "location_type",
                            "",
                        )
                    ).strip()
                    or None
                ),
                "reason": (
                    str(
                        item.get(
                            "reason",
                            "",
                        )
                    ).strip()
                    or None
                ),
                "confidence": confidence,
            }
        )

    if not validated:
        raise RuntimeError(
            f"No valid residential areas returned for "
            f"{team['fullName']}."
        )

    validated.sort(
        key=lambda row: row["rank"]
    )

    for position, area in enumerate(
        validated,
        start=1,
    ):
        area["rank"] = position

    return validated


# ============================================================
# Existing output
# ============================================================

def load_existing_rows(
    client: bigquery.Client,
) -> pd.DataFrame:
    """Load existing output when the table already exists."""

    table_id = (
        f"{client.project}.Geo.{OUTPUT_TABLE}"
    )

    try:
        client.get_table(table_id)
    except Exception:
        return pd.DataFrame(
            columns=OUTPUT_COLUMNS
        )

    query = f"""
    SELECT
        {", ".join(OUTPUT_COLUMNS)}
    FROM `{table_id}`
    """

    return query_to_dataframe(
        client=client,
        query=query,
    )


# ============================================================
# Row construction
# ============================================================

def build_team_rows(
    team: pd.Series,
    areas: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Geocode and construct output rows for one team."""

    geocode = create_nominatim_geocoder()
    generated_datetime = current_timestamp()

    rows: list[dict[str, Any]] = []

    for area in areas:
        result = geocode_location(
            geocode=geocode,
            name=area["area_name"],
            city=team["venueLocation"],
            state_province=team["state_province"],
            country=team["country"],
        )

        rows.append(
            {
                "id": int(team["id"]),
                "tricode": team["tricode"],
                "fullName": team["fullName"],
                "rank": area["rank"],
                "area_name": area["area_name"],
                "location_type": (
                    area["location_type"]
                ),
                "reason": area["reason"],
                "confidence": area["confidence"],
                "city": team["venueLocation"],
                "state_province": (
                    team["state_province"]
                ),
                "country": team["country"],
                "query": result["query"],
                "matched_address": (
                    result["matched_address"]
                ),
                "latitude": result["latitude"],
                "longitude": result["longitude"],
                "geography_wkt": (
                    result["geography_wkt"]
                ),
                "geocode_status": (
                    result["geocode_status"]
                ),
                "model": MODEL,
                "prompt_version": PROMPT_VERSION,
                "generated_datetime": (
                    generated_datetime
                ),
            }
        )

    return rows


def main() -> None:
    """Run the player residential-area pipeline."""

    print("=" * 70)
    print("PLAYER RESIDENTIAL AREA GEOSPATIAL PIPELINE")
    print("=" * 70)

    bq = create_bigquery_client()
    ai_client = create_gemini_client()

    teams = load_team_locations(client=bq)

    existing_df = load_existing_rows(client=bq)

    if FORCE_REFRESH:
        teams_to_process = teams.copy()
        retained_df = pd.DataFrame(columns=OUTPUT_COLUMNS)
    else:
        completed_ids = set(
            pd.to_numeric(
                existing_df.get(
                    "id",
                    pd.Series(dtype="float64"),
                ),
                errors="coerce",
            )
            .dropna()
            .astype(int)
        )

        teams_to_process = teams[
            ~teams["id"].astype(int).isin(completed_ids)
        ].copy()

        retained_df = existing_df.copy()

    print(f"{len(teams_to_process)} teams require generation.")

    total = len(teams_to_process)

    for number, (_, team) in enumerate(
        teams_to_process.iterrows(),
        start=1,
    ):

        print(f"[{number}/{total}] {team['fullName']}")

        try:

            areas = generate_residential_areas(
                ai_client=ai_client,
                team=team,
            )

            print(
                "  Gemini areas: "
                + ", ".join(
                    area["area_name"]
                    for area in areas
                )
            )

            team_rows = build_team_rows(
                team=team,
                areas=areas,
            )

            found_count = sum(
                row["geocode_status"] == "FOUND"
                for row in team_rows
            )

            print(
                f"  Geocoded: {found_count}/{len(team_rows)}"
            )

            retained_df = pd.concat(
                [
                    retained_df,
                    pd.DataFrame(
                        team_rows,
                        columns=OUTPUT_COLUMNS,
                    ),
                ],
                ignore_index=True,
            )

            retained_df = (
                retained_df
                .sort_values(
                    [
                        "fullName",
                        "rank",
                    ]
                )
                .reset_index(drop=True)
            )

            upload_dataframe(
                client=bq,
                dataframe=retained_df,
                table_name=OUTPUT_TABLE,
                schema=SCHEMA,
            )

            print("  Uploaded")

        except Exception as error:

            print(
                f"  ERROR: {team['fullName']}"
            )
            print(error)

            continue

    validate_unique(
        dataframe=retained_df,
        columns=["id", "rank"],
        label="team residential-area rank",
    )

    validate_coordinates(
        dataframe=retained_df,
        allow_missing=True,
    )

    print_geo_summary(
        dataframe=retained_df,
    )

    print("=" * 70)
    print("Pipeline completed.")
    print("=" * 70)

if __name__ == "__main__":
    main()