"""
Shared helpers for NHL geospatial pipelines.

Used by:
- geo_arena.py
- geo_practice_facility.py
- geo_poi.py
"""

from __future__ import annotations

import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

import pandas as pd
import requests
from geopy.extra.rate_limiter import RateLimiter
from geopy.geocoders import Nominatim
from google.cloud import bigquery
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# ============================================================
# Configuration
# ============================================================

PROJECT_ID = os.getenv(
    "GCP_PROJECT_ID",
    "pacey32-agency",
)

GEO_DATASET_ID = os.getenv(
    "GEO_DATASET_ID",
    "Geo",
)

TEAM_SOURCE_TABLE = os.getenv(
    "TEAM_SOURCE_TABLE",
    f"{PROJECT_ID}.Team.OrganizationDetail",
)

CITY_REFERENCE_TABLE = os.getenv(
    "CITY_REFERENCE_TABLE",
    f"{PROJECT_ID}.City.CityReference",
)

GEOAPIFY_API_KEY = os.getenv(
    "GEOAPIFY_API_KEY",
)

GEOAPIFY_BASE_URL = (
    "https://api.geoapify.com/v2/places"
)

GEOAPIFY_GEOCODE_URL = (
    "https://api.geoapify.com/v1/geocode/search"
)

REQUEST_TIMEOUT = int(
    os.getenv("REQUEST_TIMEOUT", "60")
)

NOMINATIM_DELAY_SECONDS = float(
    os.getenv("NOMINATIM_DELAY_SECONDS", "1")
)

GEOAPIFY_DELAY_SECONDS = float(
    os.getenv("GEOAPIFY_DELAY_SECONDS", "0.25")
)

HTTP_USER_AGENT = os.getenv(
    "HTTP_USER_AGENT",
    "pacey32-agency-geospatial/1.0",
)

POI_CATEGORIES = {
    "Airport": (
        "airport",
        "Airport",
        50000,
        10,
    ),
    "Hospital": (
        "healthcare.hospital",
        "Hospital",
        50000,
        20,
    ),
    "School": (
        "education.school",
        "Private School",
        50000,
        50,
    ),
    "GolfClub": (
        "sport.golf_course",
        "Golf Club",
        75000,
        20,
    ),
    "CountryClub": (
        "activity.sport_club",
        "Country Club",
        75000,
        20,
    ),
    "Marina": (
        "maritime.marina",
        "Marina",
        100000,
        20,
    ),
    "Ski": (
        "ski",
        "Ski",
        200000,
        20,
    ),
    "Beach": (
        "beach",
        "Beach",
        100000,
        20,
    ),
    "ShoppingMall": (
        "commercial.shopping_mall",
        "Shopping Mall",
        50000,
        20,
    ),
    "Restaurant": (
        "catering.restaurant",
        "Restaurant",
        50000,
        100,
    ),
}

# ============================================================
# HTTP and clients
# ============================================================

def create_http_session() -> requests.Session:
    """Create a retry-enabled HTTP session."""

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
        allowed_methods=frozenset(
            {"GET", "POST"}
        ),
        respect_retry_after_header=True,
    )

    session = requests.Session()

    session.headers.update(
        {
            "User-Agent": HTTP_USER_AGENT,
        }
    )

    adapter = HTTPAdapter(
        max_retries=retry,
    )

    session.mount(
        "https://",
        adapter,
    )

    session.mount(
        "http://",
        adapter,
    )

    return session


def create_bigquery_client() -> bigquery.Client:
    """Create the BigQuery client."""

    return bigquery.Client(
        project=PROJECT_ID,
    )

def geoapify_geocode(
    session: requests.Session,
    query: str,
) -> dict[str, Any] | None:
    """Geocode a location using the Geoapify API."""

    response = session.get(
        GEOAPIFY_GEOCODE_URL,
        params={
            "text": query,
            "limit": 1,
            "apiKey": GEOAPIFY_API_KEY,
        },
        timeout=REQUEST_TIMEOUT,
    )

    response.raise_for_status()

    features = response.json().get("features", [])

    if not features:
        return None

    props = features[0]["properties"]

    return {
        "latitude": safe_float(props.get("lat")),
        "longitude": safe_float(props.get("lon")),
        "matched_address": clean_text(props.get("formatted")),
    }

def create_nominatim_geocoder() -> RateLimiter:
    """Create the rate-limited Nominatim geocoder."""

    geolocator = Nominatim(
        user_agent=HTTP_USER_AGENT,
        timeout=REQUEST_TIMEOUT,
    )

    return RateLimiter(
        geolocator.geocode,
        min_delay_seconds=(
            NOMINATIM_DELAY_SECONDS
        ),
        swallow_exceptions=False,
    )


HTTP = create_http_session()


# ============================================================
# General helpers
# ============================================================

def clean_text(
    value: object,
) -> Optional[str]:
    """Return cleaned text or None."""

    if value is None:
        return None

    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    text = re.sub(
        r"\s+",
        " ",
        str(value),
    ).strip()

    return text or None


def safe_float(
    value: Any,
) -> Optional[float]:
    """Return a float or None."""

    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def safe_int(
    value: Any,
) -> Optional[int]:
    """Return an integer or None."""

    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def current_timestamp() -> datetime:
    """Return the current UTC timestamp."""

    return datetime.now(
        timezone.utc
    )


def geography_wkt(
    latitude: Any,
    longitude: Any,
) -> Optional[str]:
    """Return POINT WKT for valid coordinates."""

    lat = safe_float(latitude)
    lon = safe_float(longitude)

    if lat is None or lon is None:
        return None

    if not -90 <= lat <= 90:
        return None

    if not -180 <= lon <= 180:
        return None

    return f"POINT({lon} {lat})"


# ============================================================
# BigQuery read helpers
# ============================================================

def query_to_dataframe(
    client: bigquery.Client,
    query: str,
    job_config: Optional[
        bigquery.QueryJobConfig
    ] = None,
) -> pd.DataFrame:
    """
    Run a BigQuery query without requiring BigQuery Storage
    or db-dtypes.
    """

    query_job = client.query(
        query,
        job_config=job_config,
    )

    result = query_job.result()

    rows = [
        dict(row.items())
        for row in result
    ]

    columns = [
        field.name
        for field in result.schema
    ]

    return pd.DataFrame(
        rows,
        columns=columns,
    )


def load_team_locations(
    client: bigquery.Client,
) -> pd.DataFrame:
    """
    Load the 32 current NHL teams and their home-city reference data.

    CityReference is reduced to the newest successful row per city.
    """

    query = f"""
    WITH latest_city AS (
        SELECT
            city_name,
            state_province,
            country,
            latitude,
            longitude
        FROM `{CITY_REFERENCE_TABLE}`
        WHERE geocode_status = 'FOUND'
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY city_name
            ORDER BY last_updated DESC
        ) = 1
    )

    SELECT
        org.id,
        org.fullName,
        org.tricode,
        org.venue,
        org.venueLocation,
        city.state_province,
        city.country,
        city.latitude AS city_latitude,
        city.longitude AS city_longitude
    FROM `{TEAM_SOURCE_TABLE}` AS org
    LEFT JOIN latest_city AS city
      ON org.venueLocation = city.city_name
    ORDER BY org.fullName
    """

    dataframe = query_to_dataframe(
        client,
        query,
    )

    if dataframe.empty:
        raise RuntimeError(
            f"{TEAM_SOURCE_TABLE} returned no teams."
        )

    required_columns = {
        "id",
        "fullName",
        "tricode",
        "venue",
        "venueLocation",
        "state_province",
        "country",
    }

    missing_columns = (
        required_columns
        - set(dataframe.columns)
    )

    if missing_columns:
        raise RuntimeError(
            "Team source is missing columns: "
            + ", ".join(
                sorted(missing_columns)
            )
        )

    if dataframe["id"].duplicated().any():
        duplicates = dataframe.loc[
            dataframe["id"].duplicated(
                keep=False
            ),
            [
                "id",
                "fullName",
                "venueLocation",
            ],
        ]

        raise RuntimeError(
            "Duplicate team rows returned:\n"
            + duplicates.to_string(
                index=False
            )
        )

    print(
        f"{len(dataframe)} teams loaded from "
        f"{TEAM_SOURCE_TABLE}"
    )

    return dataframe

def upload_geo_table(
    dataframe,
    table_name,
):
    upload_dataframe(
        client=bq,
        dataframe=dataframe,
        table_name=table_name,
        schema=SCHEMA,
    )

# ============================================================
# Nominatim geocoding
# ============================================================

def build_location_query(
    name: object = None,
    address: object = None,
    city: object = None,
    state_province: object = None,
    country: object = None,
) -> str:
    """Build a clean geocoding query."""

    parts = [
        clean_text(name),
        clean_text(address),
        clean_text(city),
        clean_text(state_province),
        clean_text(country),
    ]

    unique_parts: list[str] = []

    for part in parts:
        if (
            part
            and part not in unique_parts
        ):
            unique_parts.append(part)

    return ", ".join(unique_parts)


def geocode_location(
    geocode: RateLimiter,
    name: object = None,
    address: object = None,
    city: object = None,
    state_province: object = None,
    country: object = None,
) -> dict[str, Any]:
    """Geocode one location with progressively simpler queries."""

    queries = []

    session = create_http_session()

    # Full query
    queries.append(
        build_location_query(
            name=name,
            address=address,
            city=city,
            state_province=state_province,
            country=country,
        )
    )

    # Name + city
    queries.append(
        build_location_query(
            name=name,
            city=city,
            state_province=state_province,
            country=country,
        )
    )

    # Name + state
    queries.append(
        build_location_query(
            name=name,
            state_province=state_province,
            country=country,
        )
    )

    # Name only
    queries.append(
        build_location_query(
            name=name,
        )
    )

    # Remove blanks / duplicates while preserving order
    seen = set()
    queries = [
        q
        for q in queries
        if q and not (q in seen or seen.add(q))
    ]

    if not queries:
        return {
            "query": None,
            "latitude": None,
            "longitude": None,
            "matched_address": None,
            "geography_wkt": None,
            "geocode_status": "EMPTY_QUERY",
        }

    for query in queries:

        result = geoapify_geocode(
            session=session,
            query=query,
        )

        if result is not None:
            latitude = result["latitude"]
            longitude = result["longitude"]

            return {
                "query": query,
                "latitude": latitude,
                "longitude": longitude,
                "matched_address": result["matched_address"],
                "geography_wkt": geography_wkt(
                    latitude,
                    longitude,
                ),
                "geocode_status": "FOUND",
            }

        location = geocode(query)

        if location is not None:

            latitude = safe_float(
                location.latitude
            )

            longitude = safe_float(
                location.longitude
            )

            return {
                "query": query,
                "latitude": latitude,
                "longitude": longitude,
                "matched_address": clean_text(
                    location.address
                ),
                "geography_wkt": geography_wkt(
                    latitude,
                    longitude,
                ),
                "geocode_status": "FOUND",
            }

    return {
        "query": queries[-1],
        "latitude": None,
        "longitude": None,
        "matched_address": None,
        "geography_wkt": None,
        "geocode_status": "NOT_FOUND",
    }


# ============================================================
# Geoapify Places
# ============================================================

def require_geoapify_key() -> str:
    """Return the Geoapify key or raise a clear error."""

    if not GEOAPIFY_API_KEY:
        raise RuntimeError(
            "GEOAPIFY_API_KEY is not set. Add it as a "
            "local environment variable or GitHub Actions secret."
        )

    return GEOAPIFY_API_KEY


def get_geoapify_pois(
    latitude: float,
    longitude: float,
    category: str,
    radius_metres: int = 50_000,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Retrieve nearby Geoapify Places features."""

    api_key = require_geoapify_key()

    latitude = float(latitude)
    longitude = float(longitude)

    params = {
        "categories": category,
        "filter": (
            f"circle:{longitude},"
            f"{latitude},"
            f"{radius_metres}"
        ),
        "limit": limit,
        "apiKey": api_key,
    }

    response = HTTP.get(
        GEOAPIFY_BASE_URL,
        params=params,
        timeout=REQUEST_TIMEOUT,
    )

    response.raise_for_status()

    payload = response.json()

    features = payload.get(
        "features",
        [],
    )

    if not isinstance(features, list):
        raise RuntimeError(
            "Geoapify response did not contain "
            "a features list."
        )

    if GEOAPIFY_DELAY_SECONDS > 0:
        time.sleep(
            GEOAPIFY_DELAY_SECONDS
        )

    return features


def geoapify_feature_to_row(
    feature: dict[str, Any],
) -> dict[str, Any]:
    """Flatten a Geoapify feature into map-ready columns."""

    properties = feature.get(
        "properties",
        {},
    )

    geometry = feature.get(
        "geometry",
        {},
    )

    coordinates = geometry.get(
        "coordinates",
        [],
    )

    longitude = safe_float(
        properties.get("lon")
    )

    latitude = safe_float(
        properties.get("lat")
    )

    if (
        longitude is None
        and isinstance(coordinates, list)
        and len(coordinates) >= 2
    ):
        longitude = safe_float(
            coordinates[0]
        )

    if (
        latitude is None
        and isinstance(coordinates, list)
        and len(coordinates) >= 2
    ):
        latitude = safe_float(
            coordinates[1]
        )

    return {
        "name": clean_text(
            properties.get("name")
        ),
        "address": clean_text(
            properties.get("formatted")
        ),
        "latitude": latitude,
        "longitude": longitude,
        "city": clean_text(
            properties.get("city")
            or properties.get("county")
        ),
        "state_province": clean_text(
            properties.get("state")
        ),
        "country": clean_text(
            properties.get("country")
        ),
        "country_code": clean_text(
            properties.get("country_code")
        ),
        "postcode": clean_text(
            properties.get("postcode")
        ),
        "place_id": clean_text(
            properties.get("place_id")
        ),
        "categories": properties.get(
            "categories"
        ),
        "geography_wkt": geography_wkt(
            latitude,
            longitude,
        ),
    }


# ============================================================
# QA helpers
# ============================================================

def validate_coordinates(
    dataframe: pd.DataFrame,
    latitude_column: str = "latitude",
    longitude_column: str = "longitude",
    allow_missing: bool = False,
) -> None:
    """Validate latitude and longitude columns."""

    required = {
        latitude_column,
        longitude_column,
    }

    missing_columns = (
        required
        - set(dataframe.columns)
    )

    if missing_columns:
        raise ValueError(
            "Coordinate columns missing: "
            + ", ".join(
                sorted(missing_columns)
            )
        )

    missing_coordinates = dataframe[
        dataframe[latitude_column].isna()
        | dataframe[longitude_column].isna()
    ]

    if (
        not missing_coordinates.empty
        and not allow_missing
    ):
        raise ValueError(
            f"{len(missing_coordinates)} rows have "
            "missing coordinates."
        )

    valid_rows = dataframe[
        dataframe[latitude_column].notna()
        & dataframe[longitude_column].notna()
    ]

    invalid_latitudes = valid_rows[
        ~valid_rows[latitude_column].between(
            -90,
            90,
        )
    ]

    invalid_longitudes = valid_rows[
        ~valid_rows[longitude_column].between(
            -180,
            180,
        )
    ]

    if not invalid_latitudes.empty:
        raise ValueError(
            "Invalid latitude values found."
        )

    if not invalid_longitudes.empty:
        raise ValueError(
            "Invalid longitude values found."
        )


def validate_unique(
    dataframe: pd.DataFrame,
    columns: Iterable[str],
    label: str,
) -> None:
    """Raise when duplicate key rows exist."""

    key_columns = list(columns)

    duplicates = dataframe[
        dataframe.duplicated(
            subset=key_columns,
            keep=False,
        )
    ]

    if not duplicates.empty:
        raise ValueError(
            f"Duplicate {label} rows found:\n"
            + duplicates[
                key_columns
            ].to_string(
                index=False
            )
        )


def print_geo_summary(
    dataframe: pd.DataFrame,
    latitude_column: str = "latitude",
    longitude_column: str = "longitude",
) -> None:
    """Print a compact dataframe QA summary."""

    print(
        f"Rows: {len(dataframe)}"
    )

    if latitude_column in dataframe.columns:
        print(
            "Missing latitude: "
            f"{dataframe[latitude_column].isna().sum()}"
        )

    if longitude_column in dataframe.columns:
        print(
            "Missing longitude: "
            f"{dataframe[longitude_column].isna().sum()}"
        )


# ============================================================
# BigQuery upload
# ============================================================

def prepare_for_bigquery(
    dataframe: pd.DataFrame,
) -> pd.DataFrame:
    """Prepare common values for a BigQuery dataframe load."""

    result = dataframe.copy()

    if "last_updated" in result.columns:
        result["last_updated"] = pd.to_datetime(
            result["last_updated"],
            utc=True,
            errors="coerce",
        )

    for column in (
        "latitude",
        "longitude",
    ):
        if column in result.columns:
            result[column] = pd.to_numeric(
                result[column],
                errors="coerce",
            )

    return result.where(
        pd.notna(result),
        None,
    )


def upload_dataframe(
    client: bigquery.Client,
    dataframe: pd.DataFrame,
    table_name: str,
    schema: list[bigquery.SchemaField],
    write_disposition: str = (
        bigquery.WriteDisposition.WRITE_TRUNCATE
    ),
) -> None:
    """
    Upload a dataframe to:

        pacey32-agency.Geo.<table_name>
    """

    if dataframe.empty:
        raise RuntimeError(
            f"Cannot upload empty dataframe to {table_name}."
        )

    destination_table = (
        f"{PROJECT_ID}."
        f"{GEO_DATASET_ID}."
        f"{table_name}"
    )

    prepared = prepare_for_bigquery(
        dataframe
    )

    job_config = bigquery.LoadJobConfig(
        schema=schema,
        write_disposition=write_disposition,
        create_disposition=(
            bigquery.CreateDisposition.CREATE_IF_NEEDED
        ),
    )

    print(
        f"Uploading {len(prepared)} rows to "
        f"{destination_table}..."
    )

    load_job = client.load_table_from_dataframe(
        prepared,
        destination_table,
        job_config=job_config,
    )

    load_job.result()

    table = client.get_table(
        destination_table
    )

    print(
        f"Upload complete: {table.num_rows} rows "
        f"in {destination_table}"
    )