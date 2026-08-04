"""
Generate player-focused NHL organisation summaries with Gemini and upload them
into BigQuery.

Input:  pacey32-agency.Team.OrganizationDetail
Output: pacey32-agency.Team.OrganizationDetail_LLM
"""

from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Any

import pandas as pd
from google import genai
from google.cloud import bigquery
from google.genai import types

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "pacey32-agency")
DATASET_ID = os.getenv("BQ_DATASET_ID", "Team")
SOURCE_TABLE_ID = os.getenv("SOURCE_TABLE_ID", "OrganizationDetail")
DESTINATION_TABLE_ID = os.getenv("DESTINATION_TABLE_ID", "OrganizationDetail_LLM")

SOURCE_TABLE = f"{PROJECT_ID}.{DATASET_ID}.{SOURCE_TABLE_ID}"
DESTINATION_TABLE = f"{PROJECT_ID}.{DATASET_ID}.{DESTINATION_TABLE_ID}"

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
PROMPT_VERSION = os.getenv("PROMPT_VERSION", "1.0")
FORCE_REFRESH = os.getenv("FORCE_REFRESH", "false").strip().lower() in {
    "1", "true", "yes", "y"
}
REQUEST_DELAY_SECONDS = float(os.getenv("REQUEST_DELAY_SECONDS", "2.0"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "4"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

OUTPUT_COLUMNS = [
    "id",
    "tricode",
    "fullName",
    "player_neighbourhoods",
    "organization_summary",
    "fanbase_media_pressure",
    "prompt_version",
    "model",
    "generated_datetime",
]

SYSTEM_PROMPT = """
You are preparing factual, balanced relocation and organisation profiles for
professional ice hockey players considering NHL teams.

Use Google Search where useful. Prefer reputable public sources such as official
team, arena, league, municipal or tourism websites; established newspapers;
major sports broadcasters; recognised hockey publications; and reputable
neighbourhood or property publications.

Do not rely on gossip, private information, anonymous claims, message boards,
social-media speculation or unsupported assumptions.

Return valid JSON only, with exactly these keys:
- player_neighbourhoods
- organization_summary
- fanbase_media_pressure

Requirements:
- player_neighbourhoods: 90-160 words. Identify neighbourhoods, suburbs or wider
  areas publicly associated with NHL players, professional athletes, executives
  or affluent families. Explain privacy, housing, schools, amenities and access
  to the arena or practice facility. Do not claim a named current player lives
  somewhere unless reputable public reporting clearly establishes it. Where
  evidence is limited, say so.
- organization_summary: 100-170 words. Give a player-relevant overview of the
  franchise, including history, competitive identity, organisational stability,
  development, facilities and affiliate context where supported.
- fanbase_media_pressure: 90-150 words. Explain market size, fan intensity,
  expectations and local or national media scrutiny, neutrally and without
  stereotypes.
- Use clear British English.
- Do not include markdown, headings, citations, URLs or source lists.
- Do not mention taxes or climate.
- Do not mention that you are an AI.
"""


def query_to_dataframe(client: bigquery.Client, sql: str) -> pd.DataFrame:
    query_job = client.query(sql)
    result = query_job.result()
    return pd.DataFrame(
        [dict(row.items()) for row in result],
        columns=[field.name for field in result.schema],
    )


def load_source_data(client: bigquery.Client) -> pd.DataFrame:
    dataframe = query_to_dataframe(
        client,
        f"SELECT * FROM `{SOURCE_TABLE}` ORDER BY fullName",
    )
    if dataframe.empty:
        raise RuntimeError(f"{SOURCE_TABLE} returned no rows.")
    if "fullName" not in dataframe.columns:
        raise RuntimeError(f"{SOURCE_TABLE} does not contain fullName.")
    if dataframe["fullName"].duplicated().any():
        raise RuntimeError("Duplicate fullName values found in source table.")
    print(f"{len(dataframe)} teams loaded from {SOURCE_TABLE}")
    return dataframe


def load_existing_data(client: bigquery.Client) -> pd.DataFrame:
    try:
        client.get_table(DESTINATION_TABLE)
    except Exception as exc:
        if exc.__class__.__name__ == "NotFound" or getattr(exc, "code", None) == 404:
            print(f"{DESTINATION_TABLE} does not yet exist.")
            return pd.DataFrame(columns=OUTPUT_COLUMNS)
        raise

    dataframe = query_to_dataframe(client, f"SELECT * FROM `{DESTINATION_TABLE}`")
    for column in OUTPUT_COLUMNS:
        if column not in dataframe.columns:
            dataframe[column] = None
    dataframe = dataframe[OUTPUT_COLUMNS].copy()
    print(f"{len(dataframe)} existing rows loaded from {DESTINATION_TABLE}")
    return dataframe


def safe_value(value: Any) -> str:
    if value is None or pd.isna(value):
        return "Not available"
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text if text else "Not available"


def build_team_context(row: pd.Series) -> str:
    preferred_fields = [
        ("Team", "fullName"),
        ("Team code", "tricode"),
        ("Home market", "hometeamplacename"),
        ("Venue city", "venueLocation"),
        ("Conference", "conferenceName"),
        ("Division", "divisionName"),
        ("Arena", "arena_name"),
        ("Arena capacity", "arena_capacity"),
        ("Arena opened", "arena_opened"),
        ("First NHL arena season", "arena_first_nhl_season"),
        ("Head coach", "head_coach"),
        ("Head coach since", "head_coach_since"),
        ("General manager", "general_manager"),
        ("GM since", "gm_since"),
        ("Principal owner", "principal_owner"),
        ("Owner since", "owner_since"),
        ("AHL affiliate", "ahl_team"),
        ("AHL affiliate city", "ahl_city"),
        ("Captain", "captain"),
        ("Captain since", "captain_since"),
        ("Stanley Cups since 1915", "stanley_cups"),
    ]

    lines: list[str] = []
    for label, column in preferred_fields:
        if column in row.index:
            lines.append(f"{label}: {safe_value(row[column])}")

    alternate_columns = sorted(
        column for column in row.index
        if re.fullmatch(r"alternate_captain_\d+", str(column))
    )
    alternates = [
        safe_value(row[column]) for column in alternate_columns
        if safe_value(row[column]) != "Not available"
    ]
    if alternates:
        lines.append(f"Alternate captains: {', '.join(alternates)}")

    return "\n".join(lines)


def build_user_prompt(row: pd.Series) -> str:
    return f"""
Prepare the three requested player-focused summaries for this NHL team.

Structured organisation data:
{build_team_context(row)}

Research emphasis:
1. For player_neighbourhoods, find reputable public information on areas
   commonly favoured by NHL players, professional athletes, executives or
   affluent families in this market, considering arena and practice-facility
   geography.
2. For organization_summary, use the supplied facts plus reputable current
   information where needed.
3. For fanbase_media_pressure, assess hockey prominence, supporter intensity,
   expectations and media scrutiny.

Return one JSON object only.
""".strip()


def create_gemini_client() -> genai.Client:
    if not GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it as a GitHub Actions secret."
        )
    return genai.Client(api_key=GEMINI_API_KEY)


def extract_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise RuntimeError(
                f"Gemini response did not contain JSON: {cleaned[:500]}"
            )
        parsed = json.loads(match.group(0))

    if not isinstance(parsed, dict):
        raise RuntimeError("Gemini response JSON was not an object.")
    return parsed


def validate_generated_content(payload: dict[str, Any]) -> dict[str, str]:
    required = [
        "player_neighbourhoods",
        "organization_summary",
        "fanbase_media_pressure",
    ]
    output: dict[str, str] = {}
    for key in required:
        value = payload.get(key)
        if not isinstance(value, str) or not value.strip():
            raise RuntimeError(f"Gemini response is missing {key!r}.")
        output[key] = re.sub(r"\s+", " ", value).strip()
    return output


def generate_team_summary(
    gemini_client: genai.Client,
    row: pd.Series,
) -> dict[str, str]:
    team_name = safe_value(row.get("fullName"))
    grounding_tool = types.Tool(google_search=types.GoogleSearch())
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        temperature=0.25,
        response_mime_type="application/json",
        tools=[grounding_tool],
    )

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=build_user_prompt(row),
                config=config,
            )
            if not response.text:
                raise RuntimeError("Gemini returned an empty response.")
            return validate_generated_content(extract_json_object(response.text))
        except Exception as exc:
            if attempt >= MAX_RETRIES:
                raise RuntimeError(
                    f"Gemini failed for {team_name} after {MAX_RETRIES} attempts: {exc}"
                ) from exc
            delay = min(60.0, 2 ** attempt * 2.0)
            print(
                f"Gemini attempt {attempt} failed for {team_name}: {exc}. "
                f"Retrying after {delay:.0f}s."
            )
            time.sleep(delay)

    raise RuntimeError(f"Unexpected generation failure for {team_name}.")


def build_existing_lookup(existing_df: pd.DataFrame) -> dict[str, dict[str, Any]]:
    if existing_df.empty:
        return {}
    return {
        str(row["fullName"]): row.to_dict()
        for _, row in existing_df.iterrows()
        if pd.notna(row.get("fullName"))
    }


def row_requires_refresh(
    team_name: str,
    existing_lookup: dict[str, dict[str, Any]],
) -> tuple[bool, str]:
    if FORCE_REFRESH:
        return True, "forced"
    existing = existing_lookup.get(team_name)
    if existing is None:
        return True, "missing"
    if existing.get("prompt_version") != PROMPT_VERSION:
        return True, "prompt version changed"
    if existing.get("model") != GEMINI_MODEL:
        return True, "model changed"

    for column in (
        "player_neighbourhoods",
        "organization_summary",
        "fanbase_media_pressure",
    ):
        if not str(existing.get(column) or "").strip():
            return True, "incomplete existing row"

    return False, "current"


def build_output_row(
    source_row: pd.Series,
    generated: dict[str, str],
    generated_datetime: datetime,
) -> dict[str, Any]:
    return {
        "id": int(source_row["id"]) if "id" in source_row and pd.notna(source_row["id"]) else None,
        "tricode": None if safe_value(source_row.get("tricode")) == "Not available" else safe_value(source_row.get("tricode")),
        "fullName": safe_value(source_row["fullName"]),
        "player_neighbourhoods": generated["player_neighbourhoods"],
        "organization_summary": generated["organization_summary"],
        "fanbase_media_pressure": generated["fanbase_media_pressure"],
        "prompt_version": PROMPT_VERSION,
        "model": GEMINI_MODEL,
        "generated_datetime": generated_datetime,
    }


def retain_existing_row(
    source_row: pd.Series,
    existing: dict[str, Any],
) -> dict[str, Any]:
    return {
        "id": int(source_row["id"]) if "id" in source_row and pd.notna(source_row["id"]) else existing.get("id"),
        "tricode": None if safe_value(source_row.get("tricode")) == "Not available" else safe_value(source_row.get("tricode")),
        "fullName": safe_value(source_row["fullName"]),
        "player_neighbourhoods": existing.get("player_neighbourhoods"),
        "organization_summary": existing.get("organization_summary"),
        "fanbase_media_pressure": existing.get("fanbase_media_pressure"),
        "prompt_version": existing.get("prompt_version"),
        "model": existing.get("model"),
        "generated_datetime": existing.get("generated_datetime"),
    }


def upload_to_bigquery(
    client: bigquery.Client,
    dataframe: pd.DataFrame,
) -> None:
    dataframe = dataframe[OUTPUT_COLUMNS].copy()
    dataframe["generated_datetime"] = pd.to_datetime(
        dataframe["generated_datetime"], utc=True, errors="coerce"
    )

    schema = [
        bigquery.SchemaField("id", "INTEGER"),
        bigquery.SchemaField("tricode", "STRING"),
        bigquery.SchemaField("fullName", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("player_neighbourhoods", "STRING"),
        bigquery.SchemaField("organization_summary", "STRING"),
        bigquery.SchemaField("fanbase_media_pressure", "STRING"),
        bigquery.SchemaField("prompt_version", "STRING"),
        bigquery.SchemaField("model", "STRING"),
        bigquery.SchemaField("generated_datetime", "TIMESTAMP"),
    ]

    job_config = bigquery.LoadJobConfig(
        schema=schema,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )
    print(f"Uploading {len(dataframe)} rows to {DESTINATION_TABLE}...")
    load_job = client.load_table_from_dataframe(
        dataframe, DESTINATION_TABLE, job_config=job_config
    )
    load_job.result()
    destination = client.get_table(DESTINATION_TABLE)
    print(f"Upload complete: {destination.num_rows} rows in {DESTINATION_TABLE}")


def main() -> None:
    started_at = datetime.now(timezone.utc)
    print(f"Organisation LLM refresh started at {started_at.isoformat()}")
    print(
        f"Model={GEMINI_MODEL}; prompt_version={PROMPT_VERSION}; "
        f"force_refresh={FORCE_REFRESH}"
    )

    bigquery_client = bigquery.Client(project=PROJECT_ID)
    gemini_client = create_gemini_client()

    source_df = load_source_data(bigquery_client)
    existing_df = load_existing_data(bigquery_client)
    existing_lookup = build_existing_lookup(existing_df)

    output_rows: list[dict[str, Any]] = []
    generated_count = 0
    retained_count = 0

    for index, source_row in source_df.iterrows():
        team_name = safe_value(source_row["fullName"])
        refresh, reason = row_requires_refresh(team_name, existing_lookup)
        print(
            f"[{index + 1}/{len(source_df)}] {team_name}: "
            f"{'generate' if refresh else 'retain'} ({reason})"
        )

        if refresh:
            generated = generate_team_summary(gemini_client, source_row)
            output_rows.append(
                build_output_row(
                    source_row,
                    generated,
                    datetime.now(timezone.utc),
                )
            )
            generated_count += 1
            if REQUEST_DELAY_SECONDS > 0:
                time.sleep(REQUEST_DELAY_SECONDS)
        else:
            output_rows.append(
                retain_existing_row(source_row, existing_lookup[team_name])
            )
            retained_count += 1

    output_df = pd.DataFrame(output_rows, columns=OUTPUT_COLUMNS)
    if len(output_df) != len(source_df):
        raise RuntimeError(
            f"Output row count mismatch: {len(output_df)} vs {len(source_df)}"
        )
    if output_df["fullName"].duplicated().any():
        raise RuntimeError("Duplicate teams found in LLM output.")

    upload_to_bigquery(bigquery_client, output_df)
    print(
        "Organisation LLM refresh finished successfully. "
        f"Generated={generated_count}; retained={retained_count}."
    )


if __name__ == "__main__":
    main()
