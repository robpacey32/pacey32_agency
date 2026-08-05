"""
Generic city reference pipeline.

Purpose
-------
1. Read distinct city names from the configured BigQuery team table.
2. Compare them with the existing CityReference table.
3. Geocode only new or previously unsuccessful cities.
4. Validate the geocoding output.
5. Load the results to a staging table.
6. Merge into CityReference using:
       city_name + state_province + country
7. Store coordinates as a native BigQuery GEOGRAPHY point.

Designed to run locally or from GitHub Actions.

Required packages
-----------------
google-cloud-bigquery
pandas
pyarrow
requests
"""

from __future__ import annotations

import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Optional

import pandas as pd
import requests
from google.api_core.exceptions import NotFound
from google.cloud import bigquery
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# ============================================================
# CONFIGURATION
# ============================================================

PROJECT_ID = os.getenv(
    "GCP_PROJECT",
    "pacey32-agency",
)

TEAM_TABLE = os.getenv(
    "TEAM_TABLE",
    "pacey32-agency.Team.TeamList",
)

CITY_REFERENCE_TABLE = os.getenv(
    "CITY_REFERENCE_TABLE",
    "pacey32-agency.City.CityReference",
)

CITY_REFERENCE_STAGING_TABLE = os.getenv(
    "CITY_REFERENCE_STAGING_TABLE",
    "pacey32-agency.City.CityReference_staging",
)

SOURCE_CITY_COLUMN = os.getenv(
    "SOURCE_CITY_COLUMN",
    "venueLocation",
)

GEOCODING_URL = (
    "https://geocoding-api.open-meteo.com/v1/search"
)

REQUEST_TIMEOUT = int(
    os.getenv("REQUEST_TIMEOUT", "60")
)

GEOCODE_SLEEP_SECONDS = float(
    os.getenv("GEOCODE_SLEEP_SECONDS", "0.25")
)

GEOCODE_RESULT_COUNT = int(
    os.getenv("GEOCODE_RESULT_COUNT", "10")
)

FORCE_REFRESH = os.getenv(
    "FORCE_REFRESH",
    "false",
).strip().lower() in {
    "1",
    "true",
    "yes",
    "y",
}

# Optional comma-separated list, for example:
# FORCE_CITIES="St. Louis,Elmont"
FORCE_CITIES = {
    city.strip()
    for city in os.getenv(
        "FORCE_CITIES",
        "",
    ).split(",")
    if city.strip()
}

# When false, any unsuccessful geocode causes the run to fail
# before loading to BigQuery.
ALLOW_GEOCODE_FAILURES = os.getenv(
    "ALLOW_GEOCODE_FAILURES",
    "false",
).strip().lower() in {
    "1",
    "true",
    "yes",
    "y",
}

HEADERS = {
    "User-Agent": os.getenv(
        "HTTP_USER_AGENT",
        "pacey32-agency-city-reference/1.0",
    )
}


# ============================================================
# GEOCODING OVERRIDES
# ============================================================

# Override the text sent to Open-Meteo where the source city name
# is ambiguous or punctuation reduces search quality.
GEOCODE_SEARCH_OVERRIDES = {
    "St. Louis": "Saint Louis, Missouri",
    "St. Paul": "Saint Paul, Minnesota",
    "Paradise": "Paradise, Nevada",
    "Elmont": "Elmont, New York",
    "Sunrise": "Sunrise, Florida",
}

# Where useful, require a matching first-level administrative area.
# This prevents a larger city with the same name being selected.
GEOCODE_EXPECTED_ADMIN1 = {
    "St. Louis": "Missouri",
    "St. Paul": "Minnesota",
    "Paradise": "Nevada",
    "Elmont": "New York",
    "Sunrise": "Florida",
}

# The current source contains US and Canadian NHL locations.
# Set GEOCODE_COUNTRY_CODES="" to remove this restriction when the
# source expands internationally.
GEOCODE_COUNTRY_CODES = {
    code.strip().upper()
    for code in os.getenv(
        "GEOCODE_COUNTRY_CODES",
        "US,CA",
    ).split(",")
    if code.strip()
}


# ============================================================
# OUTPUT DEFINITION
# ============================================================

OUTPUT_COLUMNS = [
    "city_name",
    "search_name",
    "geocoded_city",
    "state_province",
    "country",
    "country_code",
    "latitude",
    "longitude",
    "geography_wkt",
    "timezone",
    "population",
    "elevation",
    "open_meteo_id",
    "geocode_status",
    "geocode_source",
    "last_updated",
]

STAGING_SCHEMA = [
    bigquery.SchemaField(
        "city_name",
        "STRING",
        mode="REQUIRED",
    ),
    bigquery.SchemaField(
        "search_name",
        "STRING",
    ),
    bigquery.SchemaField(
        "geocoded_city",
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
        "country_code",
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
        "timezone",
        "STRING",
    ),
    bigquery.SchemaField(
        "population",
        "INTEGER",
    ),
    bigquery.SchemaField(
        "elevation",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "open_meteo_id",
        "INTEGER",
    ),
    bigquery.SchemaField(
        "geocode_status",
        "STRING",
        mode="REQUIRED",
    ),
    bigquery.SchemaField(
        "geocode_source",
        "STRING",
    ),
    bigquery.SchemaField(
        "last_updated",
        "TIMESTAMP",
        mode="REQUIRED",
    ),
]


# ============================================================
# CLIENTS
# ============================================================

def create_http_session() -> requests.Session:
    """Create one retry-enabled HTTP session for the run."""
    retry = Retry(
        total=4,
        connect=4,
        read=4,
        status=4,
        backoff_factor=1.5,
        status_forcelist=(
            429,
            500,
            502,
            503,
            504,
        ),
        allowed_methods=frozenset({"GET"}),
        respect_retry_after_header=True,
    )

    adapter = HTTPAdapter(
        max_retries=retry,
    )

    session = requests.Session()
    session.headers.update(HEADERS)
    session.mount("https://", adapter)
    session.mount("http://", adapter)

    return session


HTTP = create_http_session()
BQ = bigquery.Client(project=PROJECT_ID)


# ============================================================
# COMMON HELPERS
# ============================================================

def clean_text(value: object) -> str:
    """Return a whitespace-normalised string."""
    if value is None:
        return ""

    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass

    return re.sub(
        r"\s+",
        " ",
        str(value),
    ).strip()


def normalise_place_name(value: object) -> str:
    """
    Normalise a place name for comparison.

    Punctuation and whitespace are ignored so that, for example,
    'St. Louis' and 'St Louis' compare more closely.
    """
    return re.sub(
        r"[^a-z0-9]",
        "",
        clean_text(value).lower(),
    )


def query_to_dataframe(
    query: str,
) -> pd.DataFrame:
    """
    Run a BigQuery query without using to_dataframe().

    This avoids dependency problems previously encountered with
    db-dtypes in local environments.
    """
    rows = [
        dict(row.items())
        for row in BQ.query(query).result()
    ]

    return pd.DataFrame(rows)


def table_exists(
    table_id: str,
) -> bool:
    """Return whether a BigQuery table exists."""
    try:
        BQ.get_table(table_id)
        return True
    except NotFound:
        return False


def empty_output_dataframe() -> pd.DataFrame:
    """Return an empty DataFrame with the output columns."""
    return pd.DataFrame(
        columns=OUTPUT_COLUMNS
    )


def safe_int(
    value: Any,
) -> Optional[int]:
    """Convert a value to int when possible."""
    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def safe_float(
    value: Any,
) -> Optional[float]:
    """Convert a value to float when possible."""
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ============================================================
# STEP 1: READ SOURCE CITIES
# ============================================================

def get_source_cities() -> pd.DataFrame:
    """Read distinct non-empty city names from the source table."""
    query = f"""
    SELECT DISTINCT
        TRIM(CAST(`{SOURCE_CITY_COLUMN}` AS STRING)) AS city_name,

        CASE TRIM(CAST(`{SOURCE_CITY_COLUMN}` AS STRING))
            WHEN 'Washington' THEN 'District of Columbia'
            WHEN 'Paradise' THEN 'Nevada'
            WHEN 'Elmont' THEN 'New York'
            WHEN 'St. Louis' THEN 'Missouri'
            WHEN 'St. Paul' THEN 'Minnesota'
            WHEN 'Sunrise' THEN 'Florida'
            ELSE NULL
        END AS state_province,

        CASE
            WHEN TRIM(CAST(`{SOURCE_CITY_COLUMN}` AS STRING)) IN (
                'Calgary',
                'Edmonton',
                'Montreal',
                'Ottawa',
                'Toronto',
                'Vancouver',
                'Winnipeg'
            )
            THEN 'Canada'
            ELSE 'United States'
        END AS country

    FROM `{TEAM_TABLE}`

    WHERE `{SOURCE_CITY_COLUMN}` IS NOT NULL
    AND TRIM(CAST(`{SOURCE_CITY_COLUMN}` AS STRING)) != ''

    ORDER BY city_name
    """

    result = query_to_dataframe(query)

    if result.empty:
        raise RuntimeError(
            f"No city names were found in {TEAM_TABLE}."
        )

    result["city_name"] = (
        result["city_name"]
        .map(clean_text)
    )

    result = (
        result[
            result["city_name"] != ""
        ]
        .drop_duplicates(
            subset=["city_name"]
        )
        .sort_values("city_name")
        .reset_index(drop=True)
    )

    return result


# ============================================================
# STEP 2: DETERMINE CITIES REQUIRING GEOCODING
# ============================================================

def get_existing_successful_cities() -> pd.DataFrame:
    """
    Read city names that already have at least one successful
    CityReference record.

    The source currently provides only a city name, so discovery of
    new records must initially compare on city_name. The final master
    table itself uses city_name, state_province and country as its
    composite identity.
    """
    if not table_exists(CITY_REFERENCE_TABLE):
        return pd.DataFrame(
            columns=["city_name"]
        )

    query = f"""
    SELECT DISTINCT
        city_name
    FROM `{CITY_REFERENCE_TABLE}`
    WHERE city_name IS NOT NULL
      AND geocode_status = 'FOUND'
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
    ORDER BY city_name
    """

    result = query_to_dataframe(query)

    if result.empty:
        return pd.DataFrame(
            columns=["city_name"]
        )

    result["city_name"] = (
        result["city_name"]
        .map(clean_text)
    )

    return result


def get_cities_to_geocode(
    source_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Select cities which are new, previously unsuccessful, explicitly
    forced, or included in a full forced refresh.
    """
    if FORCE_REFRESH:
        due_df = source_df.copy()
        reason = "FORCE_REFRESH is enabled"

    else:
        existing_df = (
            get_existing_successful_cities()
        )

        existing_names = set(
            existing_df.get(
                "city_name",
                pd.Series(dtype="object"),
            )
            .dropna()
            .map(clean_text)
        )

        due_df = source_df[
            ~source_df["city_name"].isin(
                existing_names
            )
            | source_df["city_name"].isin(
                FORCE_CITIES
            )
        ].copy()

        reason = (
            "new, unsuccessful or explicitly forced cities"
        )

    due_df = (
        due_df
        .drop_duplicates(
            subset=["city_name"]
        )
        .sort_values("city_name")
        .reset_index(drop=True)
    )

    print(
        f"Selected {len(due_df)} {reason}."
    )

    return due_df


# ============================================================
# STEP 3: GEOCODE
# ============================================================

def not_found_result(
    city_name: str,
    search_name: str,
    status: str = "NOT_FOUND",
) -> dict[str, Any]:
    """Build a standard unsuccessful geocoding result."""
    return {
        "city_name": city_name,
        "search_name": search_name,
        "geocoded_city": None,
        "state_province": None,
        "country": None,
        "country_code": None,
        "latitude": None,
        "longitude": None,
        "geography_wkt": None,
        "timezone": None,
        "population": None,
        "elevation": None,
        "open_meteo_id": None,
        "geocode_status": status,
        "geocode_source": "Open-Meteo",
        "last_updated": datetime.now(
            timezone.utc
        ),
    }


def filter_country_results(
    results: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Apply the optional country-code restriction."""
    if not GEOCODE_COUNTRY_CODES:
        return results

    return [
        result
        for result in results
        if clean_text(
            result.get("country_code")
        ).upper() in GEOCODE_COUNTRY_CODES
    ]


def select_best_result(
    city_name: str,
    results: list[dict[str, Any]],
) -> Optional[dict[str, Any]]:
    """
    Select the best Open-Meteo result.

    Ranking favours:
    1. The expected administrative area, when configured.
    2. An exact normalised city-name match.
    3. A result with population data.
    4. The largest reported population.
    """
    if not results:
        return None

    expected_admin1 = clean_text(
        GEOCODE_EXPECTED_ADMIN1.get(
            city_name
        )
    )

    if expected_admin1:
        admin_matches = [
            result
            for result in results
            if clean_text(
                result.get("admin1")
            ).casefold()
            == expected_admin1.casefold()
        ]

        if admin_matches:
            results = admin_matches

    expected_names = {
        normalise_place_name(city_name),
        normalise_place_name(
            GEOCODE_SEARCH_OVERRIDES.get(
                city_name,
                city_name,
            ).split(",")[0]
        ),
    }

    def ranking_key(
        result: dict[str, Any],
    ) -> tuple[int, int, int]:
        result_name = normalise_place_name(
            result.get("name")
        )

        exact_name_match = int(
            result_name in expected_names
        )

        population = safe_int(
            result.get("population")
        )

        has_population = int(
            population is not None
        )

        return (
            exact_name_match,
            has_population,
            population or 0,
        )

    return max(
        results,
        key=ranking_key,
    )


def geocode_city(
    city_name: str,
    state_province: str | None = None,
    country: str | None = None,
) -> dict[str, Any]:
    """Geocode one city using the Open-Meteo Geocoding API."""
    city_name = clean_text(city_name)
    state_province = clean_text(state_province)
    country = clean_text(country)

    search_name = GEOCODE_SEARCH_OVERRIDES.get(city_name)

    if search_name is None:

        parts = [city_name]

        if state_province:
            parts.append(state_province)

        if country:
            parts.append(country)

        search_name = ", ".join(parts)

    response = HTTP.get(
        GEOCODING_URL,
        params={
            "name": search_name,
            "count": GEOCODE_RESULT_COUNT,
            "language": "en",
            "format": "json",
        },
        timeout=REQUEST_TIMEOUT,
    )

    response.raise_for_status()

    payload = response.json()
    results = payload.get(
        "results",
        [],
    )

    if not isinstance(results, list):
        return not_found_result(
            city_name=city_name,
            search_name=search_name,
            status="INVALID_RESPONSE",
        )

    results = filter_country_results(
        results
    )

    best = select_best_result(
        city_name=city_name,
        results=results,
    )

    if best is None:
        return not_found_result(
            city_name=city_name,
            search_name=search_name,
        )

    latitude = safe_float(
        best.get("latitude")
    )

    longitude = safe_float(
        best.get("longitude")
    )

    geography_wkt = None

    if (
        latitude is not None
        and longitude is not None
    ):
        geography_wkt = (
            f"POINT({longitude} {latitude})"
        )

    return {
        "city_name": city_name,
        "search_name": search_name,
        "geocoded_city": clean_text(
            best.get("name")
        ) or None,
        "state_province": clean_text(
            best.get("admin1")
        ) or None,
        "country": clean_text(
            best.get("country")
        ) or None,
        "country_code": clean_text(
            best.get("country_code")
        ).upper() or None,
        "latitude": latitude,
        "longitude": longitude,
        "geography_wkt": geography_wkt,
        "timezone": clean_text(
            best.get("timezone")
        ) or None,
        # Population is nullable because Open-Meteo does not return
        # it for every otherwise valid location.
        "population": safe_int(
            best.get("population")
        ),
        "elevation": safe_float(
            best.get("elevation")
        ),
        "open_meteo_id": safe_int(
            best.get("id")
        ),
        "geocode_status": "FOUND",
        "geocode_source": "Open-Meteo",
        "last_updated": datetime.now(
            timezone.utc
        ),
    }


def geocode_cities(
    cities_df: pd.DataFrame,
) -> pd.DataFrame:
    """Geocode every city in the supplied DataFrame."""
    if cities_df.empty:
        return empty_output_dataframe()

    rows: list[dict[str, Any]] = []

    total = len(cities_df)

    for position, source_row in enumerate(
        cities_df.itertuples(index=False),
        start=1,
    ):

        city_name = clean_text(source_row.city_name)

        print(
            f"Geocoding {position}/{total}: {city_name}"
        )

        try:

            row = geocode_city(
                city_name=city_name,
                state_province=getattr(
                    source_row,
                    "state_province",
                    None,
                ),
                country=getattr(
                    source_row,
                    "country",
                    None,
                ),
            )

        except Exception as exc:

            search_name = GEOCODE_SEARCH_OVERRIDES.get(
                city_name,
                city_name,
            )

            row = not_found_result(
                city_name=city_name,
                search_name=search_name,
                status=f"ERROR: {type(exc).__name__}: {exc}",
            )

        rows.append(row)

        if position < total:
            time.sleep(GEOCODE_SLEEP_SECONDS)

        if position < total:
            time.sleep(
                GEOCODE_SLEEP_SECONDS
            )

    result = pd.DataFrame(rows)

    for column in OUTPUT_COLUMNS:
        if column not in result.columns:
            result[column] = pd.NA

    return result[OUTPUT_COLUMNS]


# ============================================================
# STEP 4: VALIDATE
# ============================================================

def validate_geocoded_data(
    df: pd.DataFrame,
    expected_city_count: int,
) -> None:
    """Validate the data before writing to BigQuery."""
    if len(df) != expected_city_count:
        raise ValueError(
            f"Expected {expected_city_count} rows, "
            f"but generated {len(df)}."
        )

    if df["city_name"].isna().any():
        raise ValueError(
            "One or more rows have a missing city_name."
        )

    if df["city_name"].duplicated().any():
        duplicates = df[
            df["city_name"].duplicated(
                keep=False
            )
        ]

        raise ValueError(
            "Duplicate source city rows were generated:\n"
            + duplicates.to_string(
                index=False
            )
        )

    successful = df[
        df["geocode_status"] == "FOUND"
    ]

    successful_required = [
        "city_name",
        "geocoded_city",
        "state_province",
        "country",
        "country_code",
        "latitude",
        "longitude",
        "geography_wkt",
        "geocode_source",
        "last_updated",
    ]

    incomplete_successes = successful[
        successful[
            successful_required
        ].isna().any(axis=1)
    ]

    if not incomplete_successes.empty:
        raise ValueError(
            "Rows marked FOUND have missing required values:\n"
            + incomplete_successes[
                successful_required
            ].to_string(index=False)
        )

    invalid_latitudes = successful[
        ~successful["latitude"].between(
            -90,
            90,
        )
    ]

    if not invalid_latitudes.empty:
        raise ValueError(
            "Invalid latitude values:\n"
            + invalid_latitudes[
                [
                    "city_name",
                    "latitude",
                ]
            ].to_string(index=False)
        )

    invalid_longitudes = successful[
        ~successful["longitude"].between(
            -180,
            180,
        )
    ]

    if not invalid_longitudes.empty:
        raise ValueError(
            "Invalid longitude values:\n"
            + invalid_longitudes[
                [
                    "city_name",
                    "longitude",
                ]
            ].to_string(index=False)
        )

    composite_duplicates = successful[
        successful.duplicated(
            subset=[
                "city_name",
                "state_province",
                "country",
            ],
            keep=False,
        )
    ]

    if not composite_duplicates.empty:
        raise ValueError(
            "Duplicate composite city keys were generated:\n"
            + composite_duplicates[
                [
                    "city_name",
                    "state_province",
                    "country",
                ]
            ].to_string(index=False)
        )

    failures = df[
        df["geocode_status"] != "FOUND"
    ]

    if not failures.empty:
        print("\nUnsuccessful geocodes:")
        print(
            failures[
                [
                    "city_name",
                    "search_name",
                    "geocode_status",
                ]
            ].to_string(index=False)
        )

        if not ALLOW_GEOCODE_FAILURES:
            raise ValueError(
                f"{len(failures)} city or cities could not "
                "be geocoded. Set "
                "ALLOW_GEOCODE_FAILURES=true to load them "
                "with an unsuccessful status."
            )

    print(
        f"Validation passed for {len(df)} rows."
    )


# ============================================================
# STEP 5: PREPARE DATAFRAME FOR BIGQUERY
# ============================================================

def prepare_for_bigquery(
    df: pd.DataFrame,
) -> pd.DataFrame:
    """Apply stable pandas types before loading staging."""
    result = df[OUTPUT_COLUMNS].copy()

    string_columns = [
        "city_name",
        "search_name",
        "geocoded_city",
        "state_province",
        "country",
        "country_code",
        "geography_wkt",
        "timezone",
        "geocode_status",
        "geocode_source",
    ]

    for column in string_columns:
        result[column] = result[column].astype(
            "string"
        )

    float_columns = [
        "latitude",
        "longitude",
        "elevation",
    ]

    for column in float_columns:
        result[column] = pd.to_numeric(
            result[column],
            errors="coerce",
        ).astype("Float64")

    integer_columns = [
        "population",
        "open_meteo_id",
    ]

    for column in integer_columns:
        result[column] = pd.to_numeric(
            result[column],
            errors="coerce",
        ).astype("Int64")

    result["last_updated"] = pd.to_datetime(
        result["last_updated"],
        utc=True,
        errors="coerce",
    )

    return result


# ============================================================
# STEP 6: CREATE TABLES
# ============================================================

def create_destination_table() -> None:
    """Create the CityReference table when it does not exist."""
    query = f"""
    CREATE TABLE IF NOT EXISTS `{CITY_REFERENCE_TABLE}`
    (
        city_name STRING NOT NULL,
        search_name STRING,
        geocoded_city STRING,
        state_province STRING,
        country STRING,
        country_code STRING,
        latitude FLOAT64,
        longitude FLOAT64,
        geography GEOGRAPHY,
        timezone STRING,
        population INT64,
        elevation FLOAT64,
        open_meteo_id INT64,
        geocode_status STRING NOT NULL,
        geocode_source STRING,
        last_updated TIMESTAMP NOT NULL
    )
    """

    BQ.query(query).result()

    print(
        f"Destination table ready: "
        f"{CITY_REFERENCE_TABLE}"
    )


def load_staging_table(
    df: pd.DataFrame,
) -> None:
    """Replace the staging table with the current run's rows."""
    prepared_df = prepare_for_bigquery(
        df
    )

    job_config = bigquery.LoadJobConfig(
        schema=STAGING_SCHEMA,
        write_disposition=(
            bigquery.WriteDisposition.WRITE_TRUNCATE
        ),
        create_disposition=(
            bigquery.CreateDisposition.CREATE_IF_NEEDED
        ),
    )

    load_job = BQ.load_table_from_dataframe(
        prepared_df,
        CITY_REFERENCE_STAGING_TABLE,
        job_config=job_config,
    )

    load_job.result()

    print(
        f"Loaded {len(prepared_df)} rows into "
        f"{CITY_REFERENCE_STAGING_TABLE}."
    )


# ============================================================
# STEP 7: MERGE
# ============================================================

def merge_staging_to_destination() -> None:
    """
    Merge staging into CityReference.

    Successful rows use the composite key:
        city_name + state_province + country

    Unsuccessful rows cannot have that complete key, so they match
    on city_name plus blank administrative values. This permits a
    later successful result to be inserted without overwriting a
    valid city in another region.
    """
    merge_query = f"""
    MERGE `{CITY_REFERENCE_TABLE}` AS target
    USING (
        SELECT
            city_name,
            search_name,
            geocoded_city,
            state_province,
            country,
            country_code,
            latitude,
            longitude,
            CASE
                WHEN geography_wkt IS NOT NULL
                THEN ST_GEOGFROMTEXT(geography_wkt)
                ELSE NULL
            END AS geography,
            timezone,
            population,
            elevation,
            open_meteo_id,
            geocode_status,
            geocode_source,
            last_updated
        FROM `{CITY_REFERENCE_STAGING_TABLE}`
    ) AS source

    ON target.city_name = source.city_name
       AND target.state_province
           IS NOT DISTINCT FROM source.state_province
       AND target.country
           IS NOT DISTINCT FROM source.country

    WHEN MATCHED THEN
        UPDATE SET
            search_name = source.search_name,
            geocoded_city = source.geocoded_city,
            country_code = source.country_code,
            latitude = source.latitude,
            longitude = source.longitude,
            geography = source.geography,
            timezone = source.timezone,
            population = source.population,
            elevation = source.elevation,
            open_meteo_id = source.open_meteo_id,
            geocode_status = source.geocode_status,
            geocode_source = source.geocode_source,
            last_updated = source.last_updated

    WHEN NOT MATCHED THEN
        INSERT
        (
            city_name,
            search_name,
            geocoded_city,
            state_province,
            country,
            country_code,
            latitude,
            longitude,
            geography,
            timezone,
            population,
            elevation,
            open_meteo_id,
            geocode_status,
            geocode_source,
            last_updated
        )
        VALUES
        (
            source.city_name,
            source.search_name,
            source.geocoded_city,
            source.state_province,
            source.country,
            source.country_code,
            source.latitude,
            source.longitude,
            source.geography,
            source.timezone,
            source.population,
            source.elevation,
            source.open_meteo_id,
            source.geocode_status,
            source.geocode_source,
            source.last_updated
        )
    """

    BQ.query(
        merge_query
    ).result()

    print(
        f"Merged staging into "
        f"{CITY_REFERENCE_TABLE}."
    )


def delete_staging_table() -> None:
    """Delete the temporary staging table."""
    BQ.delete_table(
        CITY_REFERENCE_STAGING_TABLE,
        not_found_ok=True,
    )

    print(
        f"Deleted staging table "
        f"{CITY_REFERENCE_STAGING_TABLE}."
    )


# ============================================================
# STEP 8: POST-LOAD CHECKS
# ============================================================

def print_destination_summary() -> None:
    """Print a compact summary of the destination table."""
    query = f"""
    SELECT
        COUNT(*) AS total_rows,
        COUNTIF(
            geocode_status = 'FOUND'
        ) AS successful_rows,
        COUNTIF(
            geocode_status != 'FOUND'
        ) AS unsuccessful_rows,
        COUNTIF(
            geography IS NOT NULL
        ) AS rows_with_geography,
        COUNT(DISTINCT city_name)
            AS distinct_source_city_names,
        MAX(last_updated)
            AS latest_update
    FROM `{CITY_REFERENCE_TABLE}`
    """

    summary_df = query_to_dataframe(
        query
    )

    print("\nCityReference summary:")
    print(
        summary_df.to_string(
            index=False
        )
    )


# ============================================================
# MAIN
# ============================================================

def main() -> None:
    """Run the complete CityReference pipeline."""
    print("Starting CityReference pipeline.")
    print(f"Source table: {TEAM_TABLE}")
    print(
        f"Destination table: "
        f"{CITY_REFERENCE_TABLE}"
    )
    print(
        f"Force refresh: {FORCE_REFRESH}"
    )

    if FORCE_CITIES:
        print(
            "Explicitly forced cities: "
            + ", ".join(
                sorted(FORCE_CITIES)
            )
        )

    print("\nReading source cities...")

    source_df = get_source_cities()

    print(
        f"Found {len(source_df)} distinct "
        "source cities."
    )

    due_df = get_cities_to_geocode(
        source_df
    )

    if due_df.empty:
        print(
            "No cities require geocoding."
        )

        if table_exists(
            CITY_REFERENCE_TABLE
        ):
            print_destination_summary()

        return

    print("\nCities to geocode:")
    print(
        due_df.to_string(
            index=False
        )
    )

    city_reference_df = geocode_cities(
        due_df
    )

    print("\nGeocoding output:")
    print(
        city_reference_df[
            [
                "city_name",
                "geocoded_city",
                "state_province",
                "country",
                "latitude",
                "longitude",
                "population",
                "geocode_status",
            ]
        ].to_string(index=False)
    )

    validate_geocoded_data(
        city_reference_df,
        expected_city_count=len(due_df),
    )

    create_destination_table()

    try:
        load_staging_table(
            city_reference_df
        )

        merge_staging_to_destination()

    finally:
        delete_staging_table()

    print_destination_summary()

    print(
        "\nCityReference pipeline completed "
        "successfully."
    )


if __name__ == "__main__":
    main()