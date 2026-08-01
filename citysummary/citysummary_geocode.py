"""
Create and maintain the central NHL city reference table.

Source:
    pacey32-agency.Team.TeamList

Target:
    pacey32-agency.City.CityReference

The script:

1. Reads distinct venueLocation values from Team.TeamList.
2. Creates City.CityReference if it does not exist.
3. Identifies locations which:
   - are not in CityReference;
   - previously failed geocoding;
   - have no coordinates;
   - are older than REFRESH_MONTHS;
   - or are being force-refreshed.
4. Geocodes each location using OpenStreetMap Nominatim.
5. Reverse-geocodes the coordinates to obtain consistent administrative data.
6. Determines the IANA timezone using timezonefinder.
7. Upserts results into BigQuery.

Environment variables:

    FORCE_REFRESH=false
    REFRESH_MONTHS=24
    NOMINATIM_USER_AGENT=pacey32-agency-cityreference
    NOMINATIM_EMAIL=your-email@example.com
    GEOCODE_DELAY_SECONDS=1.1
    GEOCODE_TIMEOUT_SECONDS=30

Google authentication is handled through:

    GOOGLE_APPLICATION_CREDENTIALS
"""

import hashlib
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

from google.api_core.exceptions import NotFound
from google.cloud import bigquery
from geopy.exc import (
    GeocoderQueryError,
    GeocoderQuotaExceeded,
    GeocoderServiceError,
    GeocoderTimedOut,
    GeocoderUnavailable,
)
from geopy.extra.rate_limiter import RateLimiter
from geopy.geocoders import Nominatim
from timezonefinder import TimezoneFinder


# ============================================================
# CONFIGURATION
# ============================================================

PROJECT_ID = "pacey32-agency"
DATASET_ID = "City"

SOURCE_TABLE = f"{PROJECT_ID}.Team.TeamList"
TARGET_TABLE = f"{PROJECT_ID}.{DATASET_ID}.CityReference"

FORCE_REFRESH = (
    os.getenv("FORCE_REFRESH", "false").strip().lower()
    in {"1", "true", "yes", "y"}
)

REFRESH_MONTHS = int(
    os.getenv("REFRESH_MONTHS", "24")
)

NOMINATIM_USER_AGENT = os.getenv(
    "NOMINATIM_USER_AGENT",
    "pacey32-agency-cityreference",
).strip()

NOMINATIM_EMAIL = os.getenv(
    "NOMINATIM_EMAIL",
    "",
).strip()

GEOCODE_DELAY_SECONDS = float(
    os.getenv("GEOCODE_DELAY_SECONDS", "1.1")
)

GEOCODE_TIMEOUT_SECONDS = int(
    os.getenv("GEOCODE_TIMEOUT_SECONDS", "30")
)

GEOCODE_MAX_RETRIES = int(
    os.getenv("GEOCODE_MAX_RETRIES", "3")
)

RETRY_WAIT_SECONDS = int(
    os.getenv("RETRY_WAIT_SECONDS", "10")
)

# Restrict the search to countries containing NHL teams.
COUNTRY_CODES = "us,ca"

GEOCODE_SOURCE = "OpenStreetMap Nominatim"
SCRIPT_VERSION = "1.0"


# ============================================================
# BIGQUERY SCHEMA
# ============================================================

CITY_REFERENCE_SCHEMA = [
    bigquery.SchemaField(
        "venueLocation",
        "STRING",
        mode="REQUIRED",
        description="Venue location exactly as stored in Team.TeamList.",
    ),
    bigquery.SchemaField(
        "geocoded_name",
        "STRING",
        mode="NULLABLE",
        description="Location name returned by Nominatim.",
    ),
    bigquery.SchemaField(
        "city",
        "STRING",
        mode="NULLABLE",
        description="Canonical city or municipality returned by reverse geocoding.",
    ),
    bigquery.SchemaField(
        "municipality",
        "STRING",
        mode="NULLABLE",
        description="Municipality or equivalent local administrative area.",
    ),
    bigquery.SchemaField(
        "county",
        "STRING",
        mode="NULLABLE",
        description="County or equivalent administrative area.",
    ),
    bigquery.SchemaField(
        "state_province",
        "STRING",
        mode="NULLABLE",
        description="State, province, territory or equivalent region.",
    ),
    bigquery.SchemaField(
        "state_province_code",
        "STRING",
        mode="NULLABLE",
        description="ISO 3166-2 state or province code where available.",
    ),
    bigquery.SchemaField(
        "country",
        "STRING",
        mode="NULLABLE",
        description="Country name returned by reverse geocoding.",
    ),
    bigquery.SchemaField(
        "country_code",
        "STRING",
        mode="NULLABLE",
        description="Two-letter ISO country code.",
    ),
    bigquery.SchemaField(
        "continent",
        "STRING",
        mode="NULLABLE",
        description="Continent derived from the country code.",
    ),
    bigquery.SchemaField(
        "latitude",
        "FLOAT64",
        mode="NULLABLE",
        description="Geocoded WGS84 latitude.",
    ),
    bigquery.SchemaField(
        "longitude",
        "FLOAT64",
        mode="NULLABLE",
        description="Geocoded WGS84 longitude.",
    ),
    bigquery.SchemaField(
        "timezone",
        "STRING",
        mode="NULLABLE",
        description="IANA timezone derived from latitude and longitude.",
    ),
    bigquery.SchemaField(
        "display_name",
        "STRING",
        mode="NULLABLE",
        description="Full display name returned by Nominatim.",
    ),
    bigquery.SchemaField(
        "osm_type",
        "STRING",
        mode="NULLABLE",
        description="OpenStreetMap object type.",
    ),
    bigquery.SchemaField(
        "osm_id",
        "INT64",
        mode="NULLABLE",
        description="OpenStreetMap object identifier.",
    ),
    bigquery.SchemaField(
        "place_id",
        "INT64",
        mode="NULLABLE",
        description="Nominatim place identifier.",
    ),
    bigquery.SchemaField(
        "place_type",
        "STRING",
        mode="NULLABLE",
        description="Nominatim place type.",
    ),
    bigquery.SchemaField(
        "place_class",
        "STRING",
        mode="NULLABLE",
        description="Nominatim place class/category.",
    ),
    bigquery.SchemaField(
        "importance",
        "FLOAT64",
        mode="NULLABLE",
        description="Nominatim result importance score.",
    ),
    bigquery.SchemaField(
        "bounding_box_south",
        "FLOAT64",
        mode="NULLABLE",
    ),
    bigquery.SchemaField(
        "bounding_box_north",
        "FLOAT64",
        mode="NULLABLE",
    ),
    bigquery.SchemaField(
        "bounding_box_west",
        "FLOAT64",
        mode="NULLABLE",
    ),
    bigquery.SchemaField(
        "bounding_box_east",
        "FLOAT64",
        mode="NULLABLE",
    ),
    bigquery.SchemaField(
        "geocode_status",
        "STRING",
        mode="REQUIRED",
        description="SUCCESS, NOT_FOUND or ERROR.",
    ),
    bigquery.SchemaField(
        "geocode_error",
        "STRING",
        mode="NULLABLE",
        description="Error information from the most recent geocoding attempt.",
    ),
    bigquery.SchemaField(
        "geocode_source",
        "STRING",
        mode="NULLABLE",
    ),
    bigquery.SchemaField(
        "geocode_query",
        "STRING",
        mode="NULLABLE",
        description="Search query supplied to the geocoder.",
    ),
    bigquery.SchemaField(
        "raw_geocode_json",
        "STRING",
        mode="NULLABLE",
        description="Raw forward-geocoding result as JSON.",
    ),
    bigquery.SchemaField(
        "raw_reverse_json",
        "STRING",
        mode="NULLABLE",
        description="Raw reverse-geocoding result as JSON.",
    ),
    bigquery.SchemaField(
        "source_record_hash",
        "STRING",
        mode="NULLABLE",
        description="Hash representing the source venueLocation.",
    ),
    bigquery.SchemaField(
        "script_version",
        "STRING",
        mode="NULLABLE",
    ),
    bigquery.SchemaField(
        "first_created_datetime",
        "TIMESTAMP",
        mode="NULLABLE",
    ),
    bigquery.SchemaField(
        "last_geocode_attempt_datetime",
        "TIMESTAMP",
        mode="NULLABLE",
    ),
    bigquery.SchemaField(
        "last_successful_geocode_datetime",
        "TIMESTAMP",
        mode="NULLABLE",
    ),
    bigquery.SchemaField(
        "updated_datetime",
        "TIMESTAMP",
        mode="NULLABLE",
    ),
]


# ============================================================
# GENERAL HELPERS
# ============================================================

def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def timestamp_string(value: datetime) -> str:
    return value.isoformat()


def clean_text(value: Any) -> Optional[str]:
    if value is None:
        return None

    cleaned = " ".join(str(value).split()).strip()

    return cleaned or None


def safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def safe_int(value: Any) -> Optional[int]:
    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def json_string(value: Any) -> Optional[str]:
    if value is None:
        return None

    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        default=str,
    )


def source_hash(venue_location: str) -> str:
    normalized = venue_location.strip().casefold()

    return hashlib.sha256(
        normalized.encode("utf-8")
    ).hexdigest()


def derive_continent(
    country_code: Optional[str],
) -> Optional[str]:
    if country_code in {"US", "CA"}:
        return "North America"

    return None


def choose_first(
    mapping: Dict[str, Any],
    keys: Iterable[str],
) -> Optional[str]:
    for key in keys:
        value = clean_text(mapping.get(key))

        if value:
            return value

    return None


# ============================================================
# BIGQUERY SETUP
# ============================================================

def create_bigquery_client() -> bigquery.Client:
    return bigquery.Client(project=PROJECT_ID)


def ensure_dataset_exists(
    client: bigquery.Client,
) -> None:
    dataset_ref = f"{PROJECT_ID}.{DATASET_ID}"

    try:
        dataset = client.get_dataset(dataset_ref)

        print(
            f"Dataset exists: {dataset_ref} "
            f"(location={dataset.location})"
        )

    except NotFound:
        dataset = bigquery.Dataset(dataset_ref)
        dataset.location = "US"

        client.create_dataset(dataset)

        print(f"Created dataset: {dataset_ref}")


def ensure_target_table_exists(
    client: bigquery.Client,
) -> None:
    try:
        table = client.get_table(TARGET_TABLE)

        print(
            f"Target table exists: {TARGET_TABLE} "
            f"({table.num_rows} rows)"
        )

        add_missing_columns(
            client=client,
            existing_table=table,
        )

    except NotFound:
        table = bigquery.Table(
            TARGET_TABLE,
            schema=CITY_REFERENCE_SCHEMA,
        )

        table.description = (
            "Central reference table for NHL venue locations, "
            "administrative geography, coordinates and timezones."
        )

        table.clustering_fields = [
            "country_code",
            "state_province",
            "venueLocation",
        ]

        client.create_table(table)

        print(f"Created target table: {TARGET_TABLE}")


def add_missing_columns(
    client: bigquery.Client,
    existing_table: bigquery.Table,
) -> None:
    existing_names = {
        field.name
        for field in existing_table.schema
    }

    missing_fields = [
        field
        for field in CITY_REFERENCE_SCHEMA
        if field.name not in existing_names
    ]

    if not missing_fields:
        return

    existing_table.schema = (
        list(existing_table.schema)
        + missing_fields
    )

    client.update_table(
        existing_table,
        ["schema"],
    )

    print(
        "Added missing columns: "
        + ", ".join(
            field.name
            for field in missing_fields
        )
    )


# ============================================================
# READ SOURCE LOCATIONS
# ============================================================

def read_source_locations(
    client: bigquery.Client,
) -> List[str]:
    query = f"""
        SELECT DISTINCT
            TRIM(venueLocation) AS venueLocation
        FROM `{SOURCE_TABLE}`
        WHERE venueLocation IS NOT NULL
          AND TRIM(venueLocation) != ''
        ORDER BY venueLocation
    """

    rows = client.query(query).result()

    locations = [
        clean_text(row["venueLocation"])
        for row in rows
    ]

    locations = [
        location
        for location in locations
        if location
    ]

    print(
        f"Found {len(locations)} distinct locations "
        f"in {SOURCE_TABLE}."
    )

    return locations


def select_locations_for_refresh(
    client: bigquery.Client,
    source_locations: List[str],
) -> List[Dict[str, Any]]:
    if not source_locations:
        return []

    if FORCE_REFRESH:
        print("FORCE_REFRESH is enabled.")

        return [
            {
                "venueLocation": location,
                "reason": "forced refresh",
            }
            for location in source_locations
        ]

    query = f"""
        WITH source_locations AS (
            SELECT venueLocation
            FROM UNNEST(@locations) AS venueLocation
        ),

        current_reference AS (
            SELECT
                venueLocation,
                geocode_status,
                latitude,
                longitude,
                last_geocode_attempt_datetime,
                last_successful_geocode_datetime
            FROM `{TARGET_TABLE}`
            QUALIFY ROW_NUMBER() OVER (
                PARTITION BY venueLocation
                ORDER BY updated_datetime DESC
            ) = 1
        )

        SELECT
            source.venueLocation,

            CASE
                WHEN reference.venueLocation IS NULL
                    THEN 'not in CityReference'

                WHEN reference.geocode_status != 'SUCCESS'
                    THEN CONCAT(
                        'previous status: ',
                        COALESCE(
                            reference.geocode_status,
                            'NULL'
                        )
                    )

                WHEN reference.latitude IS NULL
                  OR reference.longitude IS NULL
                    THEN 'missing coordinates'

                WHEN reference.last_successful_geocode_datetime IS NULL
                    THEN 'missing successful geocode timestamp'

                WHEN reference.last_successful_geocode_datetime
                     < TIMESTAMP_SUB(
                         CURRENT_TIMESTAMP(),
                         INTERVAL @refresh_months * 30 DAY
                     )
                    THEN 'successful geocode is stale'

                ELSE NULL
            END AS refresh_reason

        FROM source_locations AS source

        LEFT JOIN current_reference AS reference
          ON source.venueLocation = reference.venueLocation

        WHERE reference.venueLocation IS NULL
           OR reference.geocode_status != 'SUCCESS'
           OR reference.latitude IS NULL
           OR reference.longitude IS NULL
           OR reference.last_successful_geocode_datetime IS NULL
           OR reference.last_successful_geocode_datetime
                < TIMESTAMP_SUB(
                    CURRENT_TIMESTAMP(),
                    INTERVAL @refresh_months * 30 DAY
                )

        ORDER BY source.venueLocation
    """

    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ArrayQueryParameter(
                "locations",
                "STRING",
                source_locations,
            ),
            bigquery.ScalarQueryParameter(
                "refresh_months",
                "INT64",
                REFRESH_MONTHS,
            ),
        ]
    )

    rows = client.query(
        query,
        job_config=job_config,
    ).result()

    selected = [
        {
            "venueLocation": row["venueLocation"],
            "reason": row["refresh_reason"],
        }
        for row in rows
    ]

    for record in selected:
        print(
            f"  Refresh: {record['venueLocation']} "
            f"— {record['reason']}"
        )

    return selected


# ============================================================
# GEOCODING SETUP
# ============================================================

def create_geocoders() -> Tuple[
    RateLimiter,
    RateLimiter,
    TimezoneFinder,
]:
    if not NOMINATIM_USER_AGENT:
        raise RuntimeError(
            "NOMINATIM_USER_AGENT must not be empty."
        )

    nominatim_kwargs: Dict[str, Any] = {
        "user_agent": NOMINATIM_USER_AGENT,
        "timeout": GEOCODE_TIMEOUT_SECONDS,
    }

    if NOMINATIM_EMAIL:
        nominatim_kwargs["email"] = NOMINATIM_EMAIL

    geolocator = Nominatim(
        **nominatim_kwargs
    )

    forward_geocode = RateLimiter(
        geolocator.geocode,
        min_delay_seconds=GEOCODE_DELAY_SECONDS,
        max_retries=2,
        error_wait_seconds=max(
            5,
            GEOCODE_DELAY_SECONDS,
        ),
        swallow_exceptions=False,
    )

    reverse_geocode = RateLimiter(
        geolocator.reverse,
        min_delay_seconds=GEOCODE_DELAY_SECONDS,
        max_retries=2,
        error_wait_seconds=max(
            5,
            GEOCODE_DELAY_SECONDS,
        ),
        swallow_exceptions=False,
    )

    timezone_finder = TimezoneFinder()

    return (
        forward_geocode,
        reverse_geocode,
        timezone_finder,
    )


# ============================================================
# GEOCODING
# ============================================================

def perform_forward_geocode(
    forward_geocode: RateLimiter,
    venue_location: str,
):
    # A structured city query generally reduces false matches.
    structured_query = {
        "city": venue_location,
    }

    result = forward_geocode(
        structured_query,
        exactly_one=True,
        addressdetails=True,
        language="en",
        country_codes=COUNTRY_CODES,
    )

    if result is not None:
        return result, f"city={venue_location}"

    # Some NHL venue locations are towns, villages or
    # unincorporated places rather than formally classified cities.
    result = forward_geocode(
        venue_location,
        exactly_one=True,
        addressdetails=True,
        language="en",
        country_codes=COUNTRY_CODES,
    )

    return result, venue_location


def perform_reverse_geocode(
    reverse_geocode: RateLimiter,
    latitude: float,
    longitude: float,
):
    return reverse_geocode(
        (latitude, longitude),
        exactly_one=True,
        addressdetails=True,
        language="en",
        zoom=10,
    )


def parse_bounding_box(
    raw: Dict[str, Any],
) -> Dict[str, Optional[float]]:
    bounding_box = raw.get("boundingbox") or []

    if len(bounding_box) != 4:
        return {
            "bounding_box_south": None,
            "bounding_box_north": None,
            "bounding_box_west": None,
            "bounding_box_east": None,
        }

    return {
        "bounding_box_south": safe_float(
            bounding_box[0]
        ),
        "bounding_box_north": safe_float(
            bounding_box[1]
        ),
        "bounding_box_west": safe_float(
            bounding_box[2]
        ),
        "bounding_box_east": safe_float(
            bounding_box[3]
        ),
    }


def parse_location_record(
    venue_location: str,
    forward_result: Any,
    reverse_result: Any,
    geocode_query: str,
    timezone_finder: TimezoneFinder,
    attempt_datetime: datetime,
) -> Dict[str, Any]:
    forward_raw = forward_result.raw or {}

    reverse_raw = (
        reverse_result.raw
        if reverse_result is not None
        else {}
    ) or {}

    forward_address = (
        forward_raw.get("address")
        or {}
    )

    reverse_address = (
        reverse_raw.get("address")
        or {}
    )

    # Reverse-geocoded administrative data is preferred.
    # Forward-geocoded data acts as a fallback.
    address = {
        **forward_address,
        **reverse_address,
    }

    latitude = safe_float(
        forward_result.latitude
    )

    longitude = safe_float(
        forward_result.longitude
    )

    if latitude is None or longitude is None:
        raise ValueError(
            "Geocoder returned a result without usable coordinates."
        )

    canonical_city = choose_first(
        address,
        [
            "city",
            "town",
            "village",
            "municipality",
            "hamlet",
            "borough",
            "suburb",
            "city_district",
        ],
    )

    municipality = choose_first(
        address,
        [
            "municipality",
            "city",
            "town",
            "village",
            "borough",
        ],
    )

    county = choose_first(
        address,
        [
            "county",
            "county_code",
            "district",
            "region",
        ],
    )

    state_province = choose_first(
        address,
        [
            "state",
            "province",
            "territory",
            "region",
        ],
    )

    state_province_code = choose_first(
        address,
        [
            "ISO3166-2-lvl4",
            "ISO3166-2-lvl3",
            "state_code",
        ],
    )

    country = clean_text(
        address.get("country")
    )

    country_code = clean_text(
        address.get("country_code")
    )

    if country_code:
        country_code = country_code.upper()

    timezone_name = timezone_finder.timezone_at(
        lat=latitude,
        lng=longitude,
    )

    if timezone_name is None:
        timezone_name = (
            timezone_finder.closest_timezone_at(
                lat=latitude,
                lng=longitude,
            )
            if hasattr(
                timezone_finder,
                "closest_timezone_at",
            )
            else None
        )

    bounding_box = parse_bounding_box(
        forward_raw
    )

    geocoded_name = choose_first(
        address,
        [
            "city",
            "town",
            "village",
            "municipality",
            "hamlet",
            "suburb",
        ],
    )

    return {
        "venueLocation": venue_location,
        "geocoded_name": geocoded_name,
        "city": canonical_city,
        "municipality": municipality,
        "county": county,
        "state_province": state_province,
        "state_province_code": state_province_code,
        "country": country,
        "country_code": country_code,
        "continent": derive_continent(
            country_code
        ),
        "latitude": latitude,
        "longitude": longitude,
        "timezone": timezone_name,
        "display_name": clean_text(
            forward_raw.get("display_name")
            or getattr(
                forward_result,
                "address",
                None,
            )
        ),
        "osm_type": clean_text(
            forward_raw.get("osm_type")
        ),
        "osm_id": safe_int(
            forward_raw.get("osm_id")
        ),
        "place_id": safe_int(
            forward_raw.get("place_id")
        ),
        "place_type": clean_text(
            forward_raw.get("type")
        ),
        "place_class": clean_text(
            forward_raw.get("class")
            or forward_raw.get("category")
        ),
        "importance": safe_float(
            forward_raw.get("importance")
        ),
        **bounding_box,
        "geocode_status": "SUCCESS",
        "geocode_error": None,
        "geocode_source": GEOCODE_SOURCE,
        "geocode_query": geocode_query,
        "raw_geocode_json": json_string(
            forward_raw
        ),
        "raw_reverse_json": json_string(
            reverse_raw
        ),
        "source_record_hash": source_hash(
            venue_location
        ),
        "script_version": SCRIPT_VERSION,
        "first_created_datetime":
            timestamp_string(attempt_datetime),
        "last_geocode_attempt_datetime":
            timestamp_string(attempt_datetime),
        "last_successful_geocode_datetime":
            timestamp_string(attempt_datetime),
        "updated_datetime":
            timestamp_string(attempt_datetime),
    }


def build_failure_record(
    venue_location: str,
    status: str,
    error_message: str,
    geocode_query: Optional[str],
    attempt_datetime: datetime,
) -> Dict[str, Any]:
    return {
        "venueLocation": venue_location,
        "geocoded_name": None,
        "city": None,
        "municipality": None,
        "county": None,
        "state_province": None,
        "state_province_code": None,
        "country": None,
        "country_code": None,
        "continent": None,
        "latitude": None,
        "longitude": None,
        "timezone": None,
        "display_name": None,
        "osm_type": None,
        "osm_id": None,
        "place_id": None,
        "place_type": None,
        "place_class": None,
        "importance": None,
        "bounding_box_south": None,
        "bounding_box_north": None,
        "bounding_box_west": None,
        "bounding_box_east": None,
        "geocode_status": status,
        "geocode_error": clean_text(
            error_message
        ),
        "geocode_source": GEOCODE_SOURCE,
        "geocode_query": geocode_query,
        "raw_geocode_json": None,
        "raw_reverse_json": None,
        "source_record_hash": source_hash(
            venue_location
        ),
        "script_version": SCRIPT_VERSION,
        "first_created_datetime":
            timestamp_string(attempt_datetime),
        "last_geocode_attempt_datetime":
            timestamp_string(attempt_datetime),
        "last_successful_geocode_datetime": None,
        "updated_datetime":
            timestamp_string(attempt_datetime),
    }


def geocode_one_location(
    venue_location: str,
    forward_geocode: RateLimiter,
    reverse_geocode: RateLimiter,
    timezone_finder: TimezoneFinder,
) -> Dict[str, Any]:
    last_error: Optional[Exception] = None
    geocode_query: Optional[str] = None

    for attempt in range(
        1,
        GEOCODE_MAX_RETRIES + 1,
    ):
        attempt_datetime = utc_now()

        try:
            print(
                f"    Attempt {attempt}/"
                f"{GEOCODE_MAX_RETRIES}"
            )

            (
                forward_result,
                geocode_query,
            ) = perform_forward_geocode(
                forward_geocode=forward_geocode,
                venue_location=venue_location,
            )

            if forward_result is None:
                return build_failure_record(
                    venue_location=venue_location,
                    status="NOT_FOUND",
                    error_message=(
                        "Nominatim returned no matching location."
                    ),
                    geocode_query=geocode_query,
                    attempt_datetime=attempt_datetime,
                )

            latitude = safe_float(
                forward_result.latitude
            )

            longitude = safe_float(
                forward_result.longitude
            )

            if latitude is None or longitude is None:
                raise ValueError(
                    "Forward result did not contain "
                    "valid latitude and longitude."
                )

            reverse_result = perform_reverse_geocode(
                reverse_geocode=reverse_geocode,
                latitude=latitude,
                longitude=longitude,
            )

            result = parse_location_record(
                venue_location=venue_location,
                forward_result=forward_result,
                reverse_result=reverse_result,
                geocode_query=geocode_query,
                timezone_finder=timezone_finder,
                attempt_datetime=attempt_datetime,
            )

            return result

        except (
            GeocoderTimedOut,
            GeocoderUnavailable,
            GeocoderQuotaExceeded,
            GeocoderServiceError,
            GeocoderQueryError,
            ValueError,
            TypeError,
        ) as exc:
            last_error = exc

            print(
                f"    Attempt failed: "
                f"{type(exc).__name__}: {exc}"
            )

            if attempt < GEOCODE_MAX_RETRIES:
                delay = (
                    RETRY_WAIT_SECONDS
                    * attempt
                )

                print(
                    f"    Retrying in "
                    f"{delay} seconds..."
                )

                time.sleep(delay)

        except Exception as exc:
            last_error = exc

            print(
                f"    Unexpected error: "
                f"{type(exc).__name__}: {exc}"
            )

            if attempt < GEOCODE_MAX_RETRIES:
                delay = (
                    RETRY_WAIT_SECONDS
                    * attempt
                )

                time.sleep(delay)

    failure_time = utc_now()

    return build_failure_record(
        venue_location=venue_location,
        status="ERROR",
        error_message=(
            f"{type(last_error).__name__}: "
            f"{last_error}"
            if last_error
            else "Unknown geocoding error."
        ),
        geocode_query=geocode_query,
        attempt_datetime=failure_time,
    )


def geocode_locations(
    locations: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    (
        forward_geocode,
        reverse_geocode,
        timezone_finder,
    ) = create_geocoders()

    results: List[Dict[str, Any]] = []
    total = len(locations)

    for position, source_record in enumerate(
        locations,
        start=1,
    ):
        venue_location = source_record[
            "venueLocation"
        ]

        print()
        print(
            f"[{position}/{total}] "
            f"Geocoding {venue_location}"
        )

        result = geocode_one_location(
            venue_location=venue_location,
            forward_geocode=forward_geocode,
            reverse_geocode=reverse_geocode,
            timezone_finder=timezone_finder,
        )

        results.append(result)

        if result["geocode_status"] == "SUCCESS":
            print(
                "  Success: "
                f"{result['city'] or result['geocoded_name']}, "
                f"{result['state_province']}, "
                f"{result['country']} "
                f"({result['latitude']}, "
                f"{result['longitude']})"
            )

            print(
                f"  Timezone: "
                f"{result['timezone']}"
            )

        else:
            print(
                f"  {result['geocode_status']}: "
                f"{result['geocode_error']}"
            )

    return results


# ============================================================
# BIGQUERY UPLOAD AND MERGE
# ============================================================

def load_staging_table(
    client: bigquery.Client,
    records: List[Dict[str, Any]],
) -> str:
    staging_table = (
        f"{PROJECT_ID}.{DATASET_ID}."
        f"CityReference_staging_"
        f"{uuid.uuid4().hex[:12]}"
    )

    job_config = bigquery.LoadJobConfig(
        schema=CITY_REFERENCE_SCHEMA,
        write_disposition=(
            bigquery.WriteDisposition.WRITE_TRUNCATE
        ),
    )

    load_job = client.load_table_from_json(
        records,
        staging_table,
        job_config=job_config,
    )

    load_job.result()

    print()
    print(
        f"Loaded {len(records)} records "
        f"to {staging_table}."
    )

    return staging_table


def merge_staging_table(
    client: bigquery.Client,
    staging_table: str,
) -> None:
    merge_query = f"""
        MERGE `{TARGET_TABLE}` AS target
        USING `{staging_table}` AS source
          ON target.venueLocation
             = source.venueLocation

        WHEN MATCHED
         AND source.geocode_status = 'SUCCESS'
        THEN UPDATE SET
            geocoded_name =
                source.geocoded_name,
            city =
                source.city,
            municipality =
                source.municipality,
            county =
                source.county,
            state_province =
                source.state_province,
            state_province_code =
                source.state_province_code,
            country =
                source.country,
            country_code =
                source.country_code,
            continent =
                source.continent,
            latitude =
                source.latitude,
            longitude =
                source.longitude,
            timezone =
                source.timezone,
            display_name =
                source.display_name,
            osm_type =
                source.osm_type,
            osm_id =
                source.osm_id,
            place_id =
                source.place_id,
            place_type =
                source.place_type,
            place_class =
                source.place_class,
            importance =
                source.importance,
            bounding_box_south =
                source.bounding_box_south,
            bounding_box_north =
                source.bounding_box_north,
            bounding_box_west =
                source.bounding_box_west,
            bounding_box_east =
                source.bounding_box_east,
            geocode_status =
                source.geocode_status,
            geocode_error =
                source.geocode_error,
            geocode_source =
                source.geocode_source,
            geocode_query =
                source.geocode_query,
            raw_geocode_json =
                source.raw_geocode_json,
            raw_reverse_json =
                source.raw_reverse_json,
            source_record_hash =
                source.source_record_hash,
            script_version =
                source.script_version,
            last_geocode_attempt_datetime =
                source.last_geocode_attempt_datetime,
            last_successful_geocode_datetime =
                source.last_successful_geocode_datetime,
            updated_datetime =
                source.updated_datetime

        WHEN MATCHED
         AND source.geocode_status != 'SUCCESS'
        THEN UPDATE SET
            geocode_status =
                source.geocode_status,
            geocode_error =
                source.geocode_error,
            geocode_source =
                source.geocode_source,
            geocode_query =
                source.geocode_query,
            source_record_hash =
                source.source_record_hash,
            script_version =
                source.script_version,
            last_geocode_attempt_datetime =
                source.last_geocode_attempt_datetime,
            updated_datetime =
                source.updated_datetime

        WHEN NOT MATCHED THEN
          INSERT (
            venueLocation,
            geocoded_name,
            city,
            municipality,
            county,
            state_province,
            state_province_code,
            country,
            country_code,
            continent,
            latitude,
            longitude,
            timezone,
            display_name,
            osm_type,
            osm_id,
            place_id,
            place_type,
            place_class,
            importance,
            bounding_box_south,
            bounding_box_north,
            bounding_box_west,
            bounding_box_east,
            geocode_status,
            geocode_error,
            geocode_source,
            geocode_query,
            raw_geocode_json,
            raw_reverse_json,
            source_record_hash,
            script_version,
            first_created_datetime,
            last_geocode_attempt_datetime,
            last_successful_geocode_datetime,
            updated_datetime
          )
          VALUES (
            source.venueLocation,
            source.geocoded_name,
            source.city,
            source.municipality,
            source.county,
            source.state_province,
            source.state_province_code,
            source.country,
            source.country_code,
            source.continent,
            source.latitude,
            source.longitude,
            source.timezone,
            source.display_name,
            source.osm_type,
            source.osm_id,
            source.place_id,
            source.place_type,
            source.place_class,
            source.importance,
            source.bounding_box_south,
            source.bounding_box_north,
            source.bounding_box_west,
            source.bounding_box_east,
            source.geocode_status,
            source.geocode_error,
            source.geocode_source,
            source.geocode_query,
            source.raw_geocode_json,
            source.raw_reverse_json,
            source.source_record_hash,
            source.script_version,
            source.first_created_datetime,
            source.last_geocode_attempt_datetime,
            source.last_successful_geocode_datetime,
            source.updated_datetime
          )
    """

    merge_job = client.query(merge_query)
    merge_job.result()

    print(
        f"Merged staging data into "
        f"{TARGET_TABLE}."
    )


def delete_staging_table(
    client: bigquery.Client,
    staging_table: str,
) -> None:
    client.delete_table(
        staging_table,
        not_found_ok=True,
    )

    print(
        f"Deleted staging table: "
        f"{staging_table}"
    )


# ============================================================
# OUTPUT VALIDATION
# ============================================================

def print_reference_table(
    client: bigquery.Client,
) -> None:
    query = f"""
        SELECT
            venueLocation,
            city,
            state_province,
            country,
            country_code,
            latitude,
            longitude,
            timezone,
            geocode_status,
            last_successful_geocode_datetime
        FROM `{TARGET_TABLE}`
        ORDER BY venueLocation
    """

    rows = list(
        client.query(query).result()
    )

    print()
    print("Current CityReference contents:")
    print("-" * 150)

    header = (
        f"{'venueLocation':<20} "
        f"{'city':<20} "
        f"{'state_province':<24} "
        f"{'country':<16} "
        f"{'latitude':>10} "
        f"{'longitude':>11} "
        f"{'timezone':<24} "
        f"{'status':<10}"
    )

    print(header)
    print("-" * 150)

    for row in rows:
        latitude = (
            f"{row['latitude']:.5f}"
            if row["latitude"] is not None
            else ""
        )

        longitude = (
            f"{row['longitude']:.5f}"
            if row["longitude"] is not None
            else ""
        )

        print(
            f"{str(row['venueLocation'] or ''):<20} "
            f"{str(row['city'] or ''):<20} "
            f"{str(row['state_province'] or ''):<24} "
            f"{str(row['country'] or ''):<16} "
            f"{latitude:>10} "
            f"{longitude:>11} "
            f"{str(row['timezone'] or ''):<24} "
            f"{str(row['geocode_status'] or ''):<10}"
        )


def print_summary(
    records: List[Dict[str, Any]],
) -> None:
    successes = [
        row
        for row in records
        if row["geocode_status"] == "SUCCESS"
    ]

    not_found = [
        row
        for row in records
        if row["geocode_status"] == "NOT_FOUND"
    ]

    errors = [
        row
        for row in records
        if row["geocode_status"] == "ERROR"
    ]

    print()
    print("=" * 70)
    print("CITYREFERENCE RUN SUMMARY")
    print("=" * 70)
    print(f"Processed:   {len(records)}")
    print(f"Successful:  {len(successes)}")
    print(f"Not found:   {len(not_found)}")
    print(f"Errors:      {len(errors)}")

    failures = not_found + errors

    if failures:
        print()
        print("Locations requiring attention:")

        for row in failures:
            print(
                f"  {row['venueLocation']}: "
                f"{row['geocode_status']} — "
                f"{row['geocode_error']}"
            )


# ============================================================
# MAIN
# ============================================================

def main() -> None:
    print("=" * 70)
    print("CITYREFERENCE")
    print("=" * 70)
    print(f"Project:          {PROJECT_ID}")
    print(f"Source table:     {SOURCE_TABLE}")
    print(f"Target table:     {TARGET_TABLE}")
    print(f"Refresh months:   {REFRESH_MONTHS}")
    print(f"Force refresh:    {FORCE_REFRESH}")
    print(f"Geocode source:   {GEOCODE_SOURCE}")
    print(f"Country filter:   {COUNTRY_CODES}")
    print(f"Request delay:    {GEOCODE_DELAY_SECONDS}s")
    print()

    client = create_bigquery_client()

    ensure_dataset_exists(client)
    ensure_target_table_exists(client)

    source_locations = read_source_locations(
        client
    )

    locations_to_refresh = (
        select_locations_for_refresh(
            client=client,
            source_locations=source_locations,
        )
    )

    print()
    print(
        f"{len(locations_to_refresh)} locations "
        f"require geocoding."
    )

    if not locations_to_refresh:
        print(
            "CityReference is already up to date."
        )

        print_reference_table(client)
        return

    records = geocode_locations(
        locations_to_refresh
    )

    staging_table: Optional[str] = None

    try:
        staging_table = load_staging_table(
            client=client,
            records=records,
        )

        merge_staging_table(
            client=client,
            staging_table=staging_table,
        )

    finally:
        if staging_table:
            delete_staging_table(
                client=client,
                staging_table=staging_table,
            )

    print_summary(records)
    print_reference_table(client)

    failed_records = [
        record
        for record in records
        if record["geocode_status"]
        != "SUCCESS"
    ]

    if failed_records:
        # The records have still been written to BigQuery.
        # Returning a non-zero code makes failures visible
        # within GitHub Actions.
        sys.exit(1)


if __name__ == "__main__":
    main()