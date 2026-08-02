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
    - Try multiple Gemini models in order.
    - Retry automatically for rate limits and temporary service errors.
    - Write each successful city to BigQuery immediately.
    - Preserve completed cities if a later request fails.

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
from google.genai.errors import ClientError, ServerError


# ============================================================
# CONFIGURATION
# ============================================================

PROJECT_ID = "pacey32-agency"

SOURCE_TABLE = f"{PROJECT_ID}.City.city_tax"
TARGET_TABLE = f"{PROJECT_ID}.City.city_summary"

# GEMINI_MODEL can override the first model in GitHub Actions.
PRIMARY_MODEL = os.getenv(
    "GEMINI_MODEL",
    "models/gemini-3.1-flash-lite",
)

# Models are tried in order.
MODELS = [
    PRIMARY_MODEL,
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
    "models/gemini-flash-lite-latest",
]

# Remove duplicate model names while preserving order.
MODELS = list(dict.fromkeys(MODELS))

# Increase this whenever the prompt changes materially.
# Existing rows using an older version will then be regenerated.
PROMPT_VERSION = "1.0"

# Your free-tier limit was five requests per minute.
# Thirteen seconds between successful cities stays below this.
REQUEST_DELAY_SECONDS = 13

# Number of complete passes through the model list for one city.
MAX_RETRIES_PER_CITY = 5

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

    First run:
        Select every distinct city.

    Later runs:
        Select cities that are missing or use an older prompt version.

    FORCE_REFRESH:
        Select every distinct city.
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
    """Return the explicit BigQuery target schema."""

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
    summary_row: dict,
) -> None:
    """Append one generated summary to BigQuery immediately."""

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
# GEMINI HELPERS
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


def build_city_prompt(
    venue_location: str,
    state_province: str,
    country: str,
) -> str:
    """Build the user prompt for one city."""

    return f"""
City: {venue_location}
State or province: {state_province}
Country: {country}

Write the requested city introduction.

Use the state or province and country to disambiguate the location,
but focus the paragraph primarily on the city itself.
""".strip()


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
        r"\b(429|500|502|503|504)\b",
        error_text,
    )

    if match:
        return int(
            match.group(1)
        )

    return None


def generate_summary(
    client: genai.Client,
    venue_location: str,
    state_province: str,
    country: str,
) -> tuple[str, str]:
    """
    Generate and validate one city summary.

    Returns:
        summary text;
        model name actually used.
    """

    prompt = build_city_prompt(
        venue_location=venue_location,
        state_province=state_province,
        country=country,
    )

    last_error: Optional[Exception] = None

    for attempt in range(
        1,
        MAX_RETRIES_PER_CITY + 1,
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
                        temperature=0.3,
                    ),
                )

                summary = validate_summary(
                    response.text
                )

                return summary, model

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

                # Do not hide authentication, invalid model,
                # malformed request or other permanent errors.
                raise

            except ValueError as error:
                last_error = error
                all_models_unavailable = False

                print(
                    f"  Invalid response from {model}: "
                    f"{error}"
                )

                # Try another model before retrying the same one.
                continue

        else:
            # The inner model loop finished without a break,
            # meaning every model either failed temporarily or
            # returned an invalid response.
            if attempt == MAX_RETRIES_PER_CITY:
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
                f"{MAX_RETRIES_PER_CITY}: {reason}. "
                f"Sleeping {wait_seconds} seconds..."
            )

            time.sleep(
                wait_seconds
            )

            continue

        # Reached when the model loop was broken, normally due
        # to a 429 after already sleeping.
        if attempt < MAX_RETRIES_PER_CITY:
            continue

    raise RuntimeError(
        f"Unable to generate a summary for {venue_location} "
        f"after {MAX_RETRIES_PER_CITY} attempts across "
        f"{len(MODELS)} models. Last error: {last_error}"
    )


# ============================================================
# GENERATION
# ============================================================

def generate_summaries(
    gemini_client: genai.Client,
    client_bq: bigquery.Client,
    cities: pd.DataFrame,
) -> tuple[int, list[dict]]:
    """Generate each summary and upload it immediately."""

    successes = 0
    failures: list[dict] = []

    total = len(cities)

    for position, row in enumerate(
        cities.itertuples(index=False),
        start=1,
    ):
        venue_location = clean_optional_text(
            row.venueLocation
        )

        state_province = clean_optional_text(
            row.state_province
        )

        country = clean_optional_text(
            row.country
        )

        print()
        print(
            f"[{position}/{total}] "
            f"Generating {venue_location}"
        )

        try:
            summary, model_used = generate_summary(
                client=gemini_client,
                venue_location=venue_location,
                state_province=state_province,
                country=country,
            )

            summary_row = {
                "venueLocation":
                    venue_location,
                "state_province":
                    None
                    if state_province == "Not supplied"
                    else state_province,
                "country":
                    None
                    if country == "Not supplied"
                    else country,
                "summary":
                    summary,
                "model":
                    model_used,
                "prompt_version":
                    PROMPT_VERSION,
                "generated_datetime":
                    datetime.now(timezone.utc),
            }

            upload_summary(
                client_bq=client_bq,
                summary_row=summary_row,
            )

            successes += 1

            print(
                f"  Success: "
                f"{len(summary.split())} words"
            )

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
                    "venueLocation":
                        venue_location,
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
    """Run the city-summary workflow."""

    print("=" * 70)
    print("CITY SUMMARY GENERATION")
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
    print(f"Successful:  {successful_count}")
    print(f"Failed:      {len(failures)}")

    if failures:
        print()
        print("Failures:")

        for failure in failures:
            print(
                f"  {failure['venueLocation']}: "
                f"{failure['error']}"
            )

        # Successful rows have already been uploaded.
        # Exit non-zero so GitHub Actions highlights remaining failures.
        sys.exit(1)


if __name__ == "__main__":
    main()