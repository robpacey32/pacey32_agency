"""
Generate short AI-written introductions for cities and write them to BigQuery.

Source:
    pacey32-agency.City.city_tax

Target:
    pacey32-agency.City.city_summary

Behaviour:
    - If the target table does not exist, generate summaries for every city.
    - If the target table exists, generate summaries only for cities that:
        - are missing from the target table; or
        - do not have the current prompt version.
    - Retry automatically when the Gemini free-tier rate limit is reached.
    - Append new summaries to BigQuery.

Required environment variables:
    GEMINI_API_KEY
    GOOGLE_APPLICATION_CREDENTIALS

Optional environment variables:
    GEMINI_MODEL
    FORCE_REFRESH
"""

import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
from google import genai
from google.api_core.exceptions import NotFound
from google.cloud import bigquery
from google.genai import types
from google.genai.errors import ClientError


# ============================================================
# CONFIGURATION
# ============================================================

PROJECT_ID = "pacey32-agency"

SOURCE_TABLE = f"{PROJECT_ID}.City.city_tax"
TARGET_TABLE = f"{PROJECT_ID}.City.city_summary"

MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-flash-latest",
)

# Increase this whenever the prompt changes materially.
# Existing rows using an older version will then be regenerated.
PROMPT_VERSION = "1.0"

# Gemini free-tier limit shown by your account is five requests
# per minute. A 13-second delay keeps the workflow below that.
REQUEST_DELAY_SECONDS = 13

MAX_RETRIES_PER_CITY = 5
DEFAULT_RATE_LIMIT_WAIT_SECONDS = 15

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
You are writing relocation guides for professional sports players.

Write one factual paragraph of approximately 100 to 140 words about
the supplied city.

Describe, where relevant:

- where the city is located;
- what it is best known for;
- its major industries and economic character;
- its culture and general lifestyle;
- its geography and urban character;
- notable landmarks, institutions or nearby attractions;
- anything useful or interesting for a newcomer to understand.

Write in neutral, clear international English.

Do not mention professional sports teams.

Do not discuss taxes, specific weather statistics, house prices,
rent prices or cost-of-living figures.

Do not use bullet points, headings or markdown.

Do not use exaggerated tourism language such as "amazing",
"perfect", "world-class" or "something for everyone".

Do not invent facts.

Return only the paragraph.
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


def build_city_query(
    table_exists: bool,
) -> str:
    """
    Build the city-selection query.

    On the first run, every distinct city is selected.

    On later runs, cities are selected when:
        - they do not exist in city_summary; or
        - their stored prompt version differs from the current version.

    FORCE_REFRESH selects every city regardless of existing data.
    """

    if FORCE_REFRESH or not table_exists:
        return f"""
            SELECT DISTINCT
                TRIM(venueLocation) AS venueLocation,
                state_province,
                country
            FROM `{SOURCE_TABLE}`
            WHERE venueLocation IS NOT NULL
              AND TRIM(venueLocation) != ''
            ORDER BY venueLocation
        """

    return f"""
        WITH source_cities AS (
            SELECT DISTINCT
                TRIM(venueLocation) AS venueLocation,
                state_province,
                country
            FROM `{SOURCE_TABLE}`
            WHERE venueLocation IS NOT NULL
              AND TRIM(venueLocation) != ''
        ),

        current_summaries AS (
            SELECT
                venueLocation,
                prompt_version
            FROM `{TARGET_TABLE}`
            QUALIFY ROW_NUMBER() OVER (
                PARTITION BY venueLocation
                ORDER BY generated_datetime DESC
            ) = 1
        )

        SELECT
            source.venueLocation,
            source.state_province,
            source.country

        FROM source_cities AS source

        LEFT JOIN current_summaries AS existing
          ON source.venueLocation = existing.venueLocation

        WHERE existing.venueLocation IS NULL
           OR existing.prompt_version != @prompt_version

        ORDER BY source.venueLocation
    """


def read_cities(
    client_bq: bigquery.Client,
    table_exists: bool,
) -> pd.DataFrame:
    """Read cities requiring summary generation."""

    sql = build_city_query(
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
    """Return the explicit BigQuery schema."""

    return [
        bigquery.SchemaField(
            "venueLocation",
            "STRING",
            mode="REQUIRED",
        ),
        bigquery.SchemaField(
            "state_province",
            "STRING",
            mode="NULLABLE",
        ),
        bigquery.SchemaField(
            "country",
            "STRING",
            mode="NULLABLE",
        ),
        bigquery.SchemaField(
            "summary",
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


def upload_summary(
    client_bq: bigquery.Client,
    summary: dict,
) -> None:
    """Append a single generated summary."""

    df = pd.DataFrame([summary])

    job_config = bigquery.LoadJobConfig(
        schema=target_schema(),
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
    )

    load_job = client_bq.load_table_from_dataframe(
        df,
        TARGET_TABLE,
        job_config=job_config,
    )

    load_job.result()


# ============================================================
# GEMINI HELPERS
# ============================================================

def clean_optional_text(value: object) -> str:
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


def build_city_prompt(
    venue_location: str,
    state_province: str,
    country: str,
) -> str:
    """Build the Gemini user prompt for one city."""

    return f"""
City: {venue_location}
State or province: {state_province}
Country: {country}

Write the requested city introduction.

Use the state or province and country to disambiguate the location,
but focus the paragraph primarily on the city itself.
""".strip()


def extract_retry_seconds(
    error: ClientError,
) -> int:
    """
    Extract Google's suggested retry duration when available.

    Example API text:
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

    # Add a small buffer so the next request is not made at
    # the exact boundary of the quota window.
    return max(
        DEFAULT_RATE_LIMIT_WAIT_SECONDS,
        int(suggested_wait) + 2,
    )


def validate_summary(
    summary: Optional[str],
) -> str:
    """Clean and validate a Gemini response."""

    if not summary:
        raise ValueError(
            "Gemini returned an empty response."
        )

    cleaned = " ".join(
        summary.split()
    ).strip()

    if not cleaned:
        raise ValueError(
            "Gemini returned a blank response."
        )

    word_count = len(
        cleaned.split()
    )

    if word_count < 60:
        raise ValueError(
            f"Summary is unexpectedly short: "
            f"{word_count} words."
        )

    if word_count > 200:
        raise ValueError(
            f"Summary is unexpectedly long: "
            f"{word_count} words."
        )

    return cleaned


def generate_summary(
    client: genai.Client,
    venue_location: str,
    state_province: str,
    country: str,
) -> str:
    """Generate and validate one city summary."""

    prompt = build_city_prompt(
        venue_location=venue_location,
        state_province=state_province,
        country=country,
    )

    for attempt in range(
        1,
        MAX_RETRIES_PER_CITY + 1,
    ):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.3,
                ),
            )

            return validate_summary(
                response.text
            )

        except ClientError as error:
            status_code = getattr(
                error,
                "code",
                None,
            )

            if status_code != 429:
                raise

            wait_seconds = extract_retry_seconds(
                error
            )

            print(
                f"  Rate limit reached on attempt "
                f"{attempt}/{MAX_RETRIES_PER_CITY}. "
                f"Sleeping {wait_seconds} seconds..."
            )

            if attempt == MAX_RETRIES_PER_CITY:
                raise RuntimeError(
                    f"Gemini rate limit persisted after "
                    f"{MAX_RETRIES_PER_CITY} attempts."
                ) from error

            time.sleep(
                wait_seconds
            )

        except ValueError as error:
            print(
                f"  Invalid response on attempt "
                f"{attempt}/{MAX_RETRIES_PER_CITY}: "
                f"{error}"
            )

            if attempt == MAX_RETRIES_PER_CITY:
                raise

            time.sleep(5)

    raise RuntimeError(
        "Summary generation ended unexpectedly."
    )


# ============================================================
# GENERATION
# ============================================================

def generate_summaries(
    gemini_client: genai.Client,
    client_bq: bigquery.Client,
    cities: pd.DataFrame,
) -> tuple[int, list[dict]]:
    """Generate summaries and immediately write each one to BigQuery."""

    successes = 0
    failures: list[dict] = []

    total = len(cities)

    for position, row in enumerate(
        cities.itertuples(index=False),
        start=1,
    ):

        venue_location = clean_optional_text(row.venueLocation)
        state_province = clean_optional_text(row.state_province)
        country = clean_optional_text(row.country)

        print()
        print(f"[{position}/{total}] Generating {venue_location}")

        try:

            summary = generate_summary(
                client=gemini_client,
                venue_location=venue_location,
                state_province=state_province,
                country=country,
            )

            summary_row = {
                "venueLocation": venue_location,
                "state_province": None if state_province == "Not supplied" else state_province,
                "country": None if country == "Not supplied" else country,
                "summary": summary,
                "model": MODEL,
                "prompt_version": PROMPT_VERSION,
                "generated_datetime": datetime.now(timezone.utc),
            }

            # Upload immediately
            upload_summary(
                client_bq=client_bq,
                summary=summary_row,
            )

            successes += 1

            print(
                f"  Success ({len(summary.split())} words) - uploaded"
            )

        except Exception as error:

            error_message = f"{type(error).__name__}: {error}"

            failures.append(
                {
                    "venueLocation": venue_location,
                    "error": error_message,
                }
            )

            print(f"  Failed: {error_message}")

        if position < total:
            time.sleep(REQUEST_DELAY_SECONDS)

    return successes, failures


# ============================================================
# MAIN
# ============================================================

def main() -> None:
    """Run the city-summary workflow."""

    print("=" * 70)
    print("CITY SUMMARY GENERATION")
    print("=" * 70)
    print(f"Project:         {PROJECT_ID}")
    print(f"Source table:    {SOURCE_TABLE}")
    print(f"Target table:    {TARGET_TABLE}")
    print(f"Gemini model:    {MODEL}")
    print(f"Prompt version:  {PROMPT_VERSION}")
    print(f"Force refresh:   {FORCE_REFRESH}")
    print()

    gemini_client, client_bq = create_clients()

    table_exists = target_table_exists(
        client_bq
    )

    print(
        f"Target table exists: "
        f"{table_exists}"
    )

    cities = read_cities(
        client_bq=client_bq,
        table_exists=table_exists,
    )

    print(
        f"Cities requiring generation: "
        f"{len(cities)}"
    )

    if cities.empty:
        print(
            "No cities require a new summary."
        )
        return

    successful_count, failures = generate_summaries(
        gemini_client=gemini_client,
        client_bq=client_bq,
        cities=cities,
    )

    print()
    print("=" * 70)
    print("RUN SUMMARY")
    print("=" * 70)
    print(f"Selected:    {len(cities)}")
    print(f"Successful:  {successful_count)")
    print(f"Failed:      {len(failures)}")

    if failures:
        print()
        print("Failures:")

        for failure in failures:
            print(
                f"  {failure['venueLocation']}: "
                f"{failure['error']}"
            )

        # Successful rows have already been written to BigQuery,
        # but return a failure code so GitHub Actions highlights
        # that some cities need another attempt.
        sys.exit(1)


if __name__ == "__main__":
    main()