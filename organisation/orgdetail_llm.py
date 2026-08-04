"""
Generate player-focused NHL organisation summaries with Gemini and write them
to BigQuery.

Source:
    pacey32-agency.Team.OrganizationDetail

Target:
    pacey32-agency.Team.OrganizationDetail_LLM

Behaviour:
    - If the target table does not exist, generate summaries for every team.
    - If the target table exists, generate summaries only for teams that:
        - are missing from the target table; or
        - do not have the current prompt version.
    - Try multiple Gemini models in order.
    - Retry automatically for rate limits and temporary service errors.
    - Write each successful team to BigQuery immediately.
    - Preserve completed teams if a later request fails.

Required environment variables:
    GEMINI_API_KEY
    GOOGLE_APPLICATION_CREDENTIALS

Optional environment variables:
    GCP_PROJECT_ID
    BQ_DATASET_ID
    SOURCE_TABLE_ID
    DESTINATION_TABLE_ID
    GEMINI_MODEL
    PROMPT_VERSION
    FORCE_REFRESH
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any, Optional

import pandas as pd
from google import genai
from google.api_core.exceptions import NotFound
from google.cloud import bigquery
from google.genai import types
from google.genai.errors import ClientError, ServerError


# ============================================================
# CONFIGURATION
# ============================================================

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "pacey32-agency")
DATASET_ID = os.getenv("BQ_DATASET_ID", "Team")
SOURCE_TABLE_ID = os.getenv("SOURCE_TABLE_ID", "OrganizationDetail")
DESTINATION_TABLE_ID = os.getenv(
    "DESTINATION_TABLE_ID",
    "OrganizationDetail_LLM",
)

SOURCE_TABLE = f"{PROJECT_ID}.{DATASET_ID}.{SOURCE_TABLE_ID}"
TARGET_TABLE = f"{PROJECT_ID}.{DATASET_ID}.{DESTINATION_TABLE_ID}"

PRIMARY_MODEL = os.getenv(
    "GEMINI_MODEL",
    "models/gemini-3.1-flash-lite",
)

MODELS = [
    PRIMARY_MODEL,
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
    "models/gemini-flash-lite-latest",
]

MODELS = list(dict.fromkeys(MODELS))

PROMPT_VERSION = os.getenv("PROMPT_VERSION", "1.0")

REQUEST_DELAY_SECONDS = int(
    os.getenv("REQUEST_DELAY_SECONDS", "13")
)

MAX_RETRIES_PER_TEAM = int(
    os.getenv("MAX_RETRIES_PER_TEAM", "5")
)

DEFAULT_RATE_LIMIT_WAIT_SECONDS = 15
MAX_SERVICE_WAIT_SECONDS = 120

FORCE_REFRESH = (
    os.getenv("FORCE_REFRESH", "false")
    .strip()
    .lower()
    in {"1", "true", "yes", "y"}
)


# ============================================================
# PROMPT
# ============================================================

SYSTEM_PROMPT = """
You are preparing factual, balanced relocation and organisation profiles for
professional ice hockey players considering NHL teams.

Return valid JSON only, with exactly these keys:

- player_neighbourhoods
- organization_summary
- fanbase_media_pressure

Requirements:

player_neighbourhoods:
- Write approximately 90 to 160 words.
- Identify neighbourhoods, suburbs or wider areas publicly associated with
  professional athletes, executives or affluent families in the market.
- Explain why those areas may appeal, including privacy, housing, schools,
  amenities and access to the arena or practice facility.
- Do not claim that a named current player lives somewhere unless that is
  clearly established in reputable public information.
- Where public evidence is limited, say so and avoid presenting speculation
  as fact.

organization_summary:
- Write approximately 100 to 170 words.
- Give a player-relevant overview of the franchise.
- Cover history, competitive identity, organisational stability, player
  development, facilities and affiliate context where relevant.
- Distinguish durable history from facts that can change.
- Do not make predictions or present opinion as fact.

fanbase_media_pressure:
- Write approximately 90 to 150 words.
- Explain market size, fan intensity, expectations and local or national
  media scrutiny.
- Describe pressure comparatively and neutrally.
- Avoid stereotypes and exaggerated claims.
- Make clear where scrutiny changes depending on team performance.

General rules:
- Use clear British English.
- Do not include markdown, headings, citations, URLs or source lists.
- Do not mention taxes or climate.
- Do not mention that you are an AI.
- Do not invent facts.
""".strip()


# ============================================================
# CLIENTS
# ============================================================

def create_clients() -> tuple[genai.Client, bigquery.Client]:
    """Create Gemini and BigQuery clients."""

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it as an environment "
            "variable or GitHub Actions secret."
        )

    gemini_client = genai.Client(
        api_key=api_key,
    )

    bigquery_client = bigquery.Client(
        project=PROJECT_ID,
    )

    return gemini_client, bigquery_client


# ============================================================
# BIGQUERY HELPERS
# ============================================================

def target_table_exists(
    client_bq: bigquery.Client,
) -> bool:
    """Return True when the target table already exists."""

    try:
        client_bq.get_table(TARGET_TABLE)
        return True

    except NotFound:
        return False


def build_team_query(
    table_exists: bool,
) -> str:
    """
    Build the team-selection query.

    First run:
        Select every team.

    Later runs:
        Select teams that are missing or use an older prompt version.

    FORCE_REFRESH:
        Select every team.
    """

    if FORCE_REFRESH or not table_exists:
        return f"""
            SELECT *
            FROM `{SOURCE_TABLE}`
            WHERE fullName IS NOT NULL
              AND TRIM(fullName) != ''
            ORDER BY fullName
        """

    return f"""
        WITH source_teams AS (
            SELECT *
            FROM `{SOURCE_TABLE}`
            WHERE fullName IS NOT NULL
              AND TRIM(fullName) != ''
        ),

        current_summaries AS (
            SELECT
                fullName,
                prompt_version
            FROM `{TARGET_TABLE}`
            QUALIFY ROW_NUMBER() OVER (
                PARTITION BY fullName
                ORDER BY generated_datetime DESC
            ) = 1
        )

        SELECT
            source.*

        FROM source_teams AS source

        LEFT JOIN current_summaries AS existing
          ON source.fullName = existing.fullName

        WHERE existing.fullName IS NULL
           OR existing.prompt_version != @prompt_version

        ORDER BY source.fullName
    """


def read_teams(
    client_bq: bigquery.Client,
    table_exists: bool,
) -> pd.DataFrame:
    """Read teams requiring LLM generation."""

    sql = build_team_query(
        table_exists=table_exists,
    )

    job_config = None

    if table_exists and not FORCE_REFRESH:
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter(
                    "prompt_version",
                    "STRING",
                    PROMPT_VERSION,
                )
            ]
        )

    query_job = client_bq.query(
        sql,
        job_config=job_config,
    )

    return query_job.to_dataframe(
        create_bqstorage_client=False,
    )


def target_schema() -> list[bigquery.SchemaField]:
    """Return the explicit BigQuery target schema."""

    return [
        bigquery.SchemaField(
            "id",
            "INTEGER",
            mode="NULLABLE",
        ),
        bigquery.SchemaField(
            "tricode",
            "STRING",
            mode="NULLABLE",
        ),
        bigquery.SchemaField(
            "fullName",
            "STRING",
            mode="REQUIRED",
        ),
        bigquery.SchemaField(
            "player_neighbourhoods",
            "STRING",
            mode="REQUIRED",
        ),
        bigquery.SchemaField(
            "organization_summary",
            "STRING",
            mode="REQUIRED",
        ),
        bigquery.SchemaField(
            "fanbase_media_pressure",
            "STRING",
            mode="REQUIRED",
        ),
        bigquery.SchemaField(
            "model",
            "STRING",
            mode="REQUIRED",
        ),
        bigquery.SchemaField(
            "prompt_version",
            "STRING",
            mode="REQUIRED",
        ),
        bigquery.SchemaField(
            "generated_datetime",
            "TIMESTAMP",
            mode="REQUIRED",
        ),
    ]


def upload_team_summary(
    client_bq: bigquery.Client,
    summary_row: dict[str, Any],
) -> None:
    """Append one generated team summary to BigQuery immediately."""

    summary_df = pd.DataFrame(
        [summary_row]
    )

    job_config = bigquery.LoadJobConfig(
        schema=target_schema(),
        write_disposition=(
            bigquery.WriteDisposition.WRITE_APPEND
        ),
    )

    load_job = client_bq.load_table_from_dataframe(
        summary_df,
        TARGET_TABLE,
        job_config=job_config,
    )

    load_job.result()


# ============================================================
# DATA AND PROMPT HELPERS
# ============================================================

def clean_optional_text(
    value: object,
) -> str:
    """Convert nullable BigQuery values into clean prompt text."""

    if value is None:
        return "Not supplied"

    try:
        if pd.isna(value):
            return "Not supplied"
    except (TypeError, ValueError):
        pass

    cleaned = " ".join(
        str(value).split()
    ).strip()

    return cleaned or "Not supplied"


def safe_int(
    value: object,
) -> Optional[int]:
    """Convert a nullable numeric value into an integer."""

    if value is None:
        return None

    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def build_team_context(
    row: pd.Series,
) -> str:
    """Build structured organisation context for one team."""

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
        ("AHL affiliate arena", "ahl_arena"),
        ("Captain", "captain"),
        ("Captain since", "captain_since"),
        ("Stanley Cups since 1915", "stanley_cups"),
    ]

    lines: list[str] = []

    for label, column in preferred_fields:
        if column not in row.index:
            continue

        value = clean_optional_text(
            row[column]
        )

        if value != "Not supplied":
            lines.append(
                f"{label}: {value}"
            )

    alternate_columns = sorted(
        column
        for column in row.index
        if re.fullmatch(
            r"alternate_captain_\d+",
            str(column),
        )
    )

    alternates = []

    for column in alternate_columns:
        value = clean_optional_text(
            row[column]
        )

        if value != "Not supplied":
            alternates.append(
                value
            )

    if alternates:
        lines.append(
            f"Alternate captains: {', '.join(alternates)}"
        )

    return "\n".join(
        lines
    )


def build_team_prompt(
    row: pd.Series,
) -> str:
    """Build the user prompt for one NHL team."""

    return f"""
Prepare the three requested player-focused summaries for this NHL team.

Structured organisation data:
{build_team_context(row)}

Use established general knowledge and the structured facts supplied.

For player_neighbourhoods, discuss areas commonly associated with professional
athletes, executives or affluent families in the market. Consider the arena,
practice-facility geography where known, privacy, housing, schools and
amenities. If reliable public information is limited, state that clearly.

For organization_summary, focus on the organisation from a prospective
player's perspective.

For fanbase_media_pressure, assess hockey prominence, supporter intensity,
expectations and media scrutiny.

Return one JSON object only.
""".strip()


# ============================================================
# GEMINI HELPERS
# ============================================================

def extract_retry_seconds(
    error: Exception,
) -> int:
    """
    Extract Google's suggested retry duration when available.

    Example:
        Please retry in 6.290010441s.
    """

    match = re.search(
        r"retry in\s+([0-9.]+)s",
        str(error),
        flags=re.IGNORECASE,
    )

    if not match:
        return DEFAULT_RATE_LIMIT_WAIT_SECONDS

    suggested_wait = float(
        match.group(1)
    )

    return max(
        DEFAULT_RATE_LIMIT_WAIT_SECONDS,
        int(suggested_wait) + 2,
    )


def get_status_code(
    error: Exception,
) -> Optional[int]:
    """Return an HTTP-style status code from a Gemini exception."""

    code = getattr(
        error,
        "code",
        None,
    )

    if isinstance(code, int):
        return code

    status_code = getattr(
        error,
        "status_code",
        None,
    )

    if isinstance(status_code, int):
        return status_code

    error_text = str(error)

    match = re.search(
        r"\b(400|401|403|404|429|500|502|503|504)\b",
        error_text,
    )

    if match:
        return int(
            match.group(1)
        )

    return None


def extract_json_object(
    text: str,
) -> dict[str, Any]:
    """Extract one JSON object from a Gemini response."""

    cleaned = text.strip()

    cleaned = re.sub(
        r"^```(?:json)?\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )

    cleaned = re.sub(
        r"\s*```$",
        "",
        cleaned,
    )

    try:
        parsed = json.loads(
            cleaned
        )

    except json.JSONDecodeError:
        match = re.search(
            r"\{.*\}",
            cleaned,
            flags=re.DOTALL,
        )

        if not match:
            raise ValueError(
                "Gemini response did not contain a JSON object."
            )

        parsed = json.loads(
            match.group(0)
        )

    if not isinstance(parsed, dict):
        raise ValueError(
            "Gemini response JSON was not an object."
        )

    return parsed


def validate_generated_content(
    payload: dict[str, Any],
) -> dict[str, str]:
    """Clean and validate the three generated text fields."""

    limits = {
        "player_neighbourhoods": (60, 220),
        "organization_summary": (70, 230),
        "fanbase_media_pressure": (60, 210),
    }

    output: dict[str, str] = {}

    for key, (minimum_words, maximum_words) in limits.items():
        value = payload.get(
            key
        )

        if not isinstance(value, str):
            raise ValueError(
                f"Gemini response is missing {key!r}."
            )

        cleaned = " ".join(
            value.split()
        ).strip()

        if not cleaned:
            raise ValueError(
                f"Gemini response contains a blank {key!r}."
            )

        word_count = len(
            cleaned.split()
        )

        if word_count < minimum_words:
            raise ValueError(
                f"{key} is unexpectedly short: "
                f"{word_count} words."
            )

        if word_count > maximum_words:
            raise ValueError(
                f"{key} is unexpectedly long: "
                f"{word_count} words."
            )

        output[key] = cleaned

    return output


def generate_team_summary(
    client: genai.Client,
    row: pd.Series,
) -> tuple[dict[str, str], str]:
    """
    Generate and validate one organisation summary.

    Returns:
        generated content dictionary;
        model name actually used.
    """

    team_name = clean_optional_text(
        row.get("fullName")
    )

    prompt = build_team_prompt(
        row
    )

    last_error: Optional[Exception] = None

    for attempt in range(
        1,
        MAX_RETRIES_PER_TEAM + 1,
    ):
        all_models_unavailable = True

        for model_position, model in enumerate(
            MODELS,
            start=1,
        ):
            print(
                f"  Trying {model} "
                f"({model_position}/{len(MODELS)})"
            )

            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        temperature=0.25,
                    ),
                )

                if not response.text:
                    raise ValueError(
                        "Gemini returned an empty response."
                    )

                generated = validate_generated_content(
                    extract_json_object(
                        response.text
                    )
                )

                return generated, model

            except (ClientError, ServerError) as error:
                last_error = error

                status_code = get_status_code(
                    error
                )

                if status_code == 429:
                    all_models_unavailable = False

                    wait_seconds = extract_retry_seconds(
                        error
                    )

                    print(
                        f"  Rate limit reached for {model}. "
                        f"Sleeping {wait_seconds} seconds..."
                    )

                    time.sleep(
                        wait_seconds
                    )

                    # Retry the complete model list.
                    break

                if status_code in {
                    500,
                    502,
                    503,
                    504,
                }:
                    print(
                        f"  {model} temporarily unavailable "
                        f"({status_code})."
                    )

                    # Immediately try the next fallback model.
                    continue

                # A retired or unavailable model should not stop
                # the remaining fallback models.
                if status_code == 404:
                    print(
                        f"  {model} is unavailable or retired."
                    )
                    continue

                # Do not hide authentication, malformed request
                # or other permanent errors.
                raise

            except (ValueError, json.JSONDecodeError) as error:
                last_error = error
                all_models_unavailable = False

                print(
                    f"  Invalid response from {model}: "
                    f"{error}"
                )

                # Try another model before retrying the same one.
                continue

        else:
            # The inner model loop finished without a break.
            if attempt == MAX_RETRIES_PER_TEAM:
                break

            wait_seconds = min(
                15 * (2 ** (attempt - 1)),
                MAX_SERVICE_WAIT_SECONDS,
            )

            reason = (
                "all models were temporarily unavailable"
                if all_models_unavailable
                else "no model returned a valid response"
            )

            print(
                f"  Attempt {attempt}/"
                f"{MAX_RETRIES_PER_TEAM}: {reason}. "
                f"Sleeping {wait_seconds} seconds..."
            )

            time.sleep(
                wait_seconds
            )

            continue

        # Reached when the model loop was broken,
        # normally due to a 429 after already sleeping.
        if attempt < MAX_RETRIES_PER_TEAM:
            continue

    raise RuntimeError(
        f"Unable to generate organisation details for {team_name} "
        f"after {MAX_RETRIES_PER_TEAM} attempts across "
        f"{len(MODELS)} models. Last error: {last_error}"
    )


# ============================================================
# GENERATION
# ============================================================

def generate_summaries(
    gemini_client: genai.Client,
    client_bq: bigquery.Client,
    teams: pd.DataFrame,
) -> tuple[int, list[dict[str, str]]]:
    """Generate each team summary and upload it immediately."""

    successes = 0
    failures: list[dict[str, str]] = []

    total = len(
        teams
    )

    for position, (_, row) in enumerate(
        teams.iterrows(),
        start=1,
    ):
        team_name = clean_optional_text(
            row.get("fullName")
        )

        print()
        print(
            f"[{position}/{total}] "
            f"Generating {team_name}"
        )

        try:
            generated, model_used = generate_team_summary(
                client=gemini_client,
                row=row,
            )

            summary_row = {
                "id": safe_int(
                    row.get("id")
                ),
                "tricode": (
                    None
                    if clean_optional_text(
                        row.get("tricode")
                    ) == "Not supplied"
                    else clean_optional_text(
                        row.get("tricode")
                    )
                ),
                "fullName": team_name,
                "player_neighbourhoods":
                    generated["player_neighbourhoods"],
                "organization_summary":
                    generated["organization_summary"],
                "fanbase_media_pressure":
                    generated["fanbase_media_pressure"],
                "model":
                    model_used,
                "prompt_version":
                    PROMPT_VERSION,
                "generated_datetime":
                    datetime.now(timezone.utc),
            }

            upload_team_summary(
                client_bq=client_bq,
                summary_row=summary_row,
            )

            successes += 1

            print(
                f"  Model used: {model_used}"
            )

            print(
                f"  Uploaded to {TARGET_TABLE}"
            )

        except Exception as error:
            error_message = (
                f"{type(error).__name__}: {error}"
            )

            failures.append(
                {
                    "fullName":
                        team_name,
                    "error":
                        error_message,
                }
            )

            print(
                f"  Failed: {error_message}"
            )

        if position < total:
            time.sleep(
                REQUEST_DELAY_SECONDS
            )

    return successes, failures


# ============================================================
# MAIN
# ============================================================

def main() -> None:
    """Run the organisation-summary workflow."""

    print("=" * 70)
    print("ORGANISATION DETAIL LLM GENERATION")
    print("=" * 70)
    print(f"Project:         {PROJECT_ID}")
    print(f"Source table:    {SOURCE_TABLE}")
    print(f"Target table:    {TARGET_TABLE}")
    print(f"Prompt version:  {PROMPT_VERSION}")
    print(f"Force refresh:   {FORCE_REFRESH}")
    print("Model order:")

    for model_position, model in enumerate(
        MODELS,
        start=1,
    ):
        print(
            f"  {model_position}. {model}"
        )

    print()

    gemini_client, client_bq = create_clients()

    table_exists = target_table_exists(
        client_bq
    )

    print(
        f"Target table exists: "
        f"{table_exists}"
    )

    teams = read_teams(
        client_bq=client_bq,
        table_exists=table_exists,
    )

    print(
        f"Teams requiring generation: "
        f"{len(teams)}"
    )

    if teams.empty:
        print(
            "No teams require new organisation summaries."
        )
        return

    successful_count, failures = generate_summaries(
        gemini_client=gemini_client,
        client_bq=client_bq,
        teams=teams,
    )

    print()
    print("=" * 70)
    print("RUN SUMMARY")
    print("=" * 70)
    print(f"Selected:    {len(teams)}")
    print(f"Successful:  {successful_count}")
    print(f"Failed:      {len(failures)}")

    if failures:
        print()
        print("Failures:")

        for failure in failures:
            print(
                f"  {failure['fullName']}: "
                f"{failure['error']}"
            )

        # Successful rows have already been uploaded.
        # Exit non-zero so GitHub Actions highlights remaining failures.
        sys.exit(1)


if __name__ == "__main__":
    main()
