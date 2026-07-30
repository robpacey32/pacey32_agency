# ------------------------------------------------------------------
# Imports
# ------------------------------------------------------------------

import time
from datetime import date

import pandas as pd
import requests

from google.api_core.exceptions import NotFound
from google.cloud import bigquery

from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter


# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------

PROJECT_ID = "pacey32-agency"

TEAM_TABLE = "pacey32-agency.Team.TeamList"
CLIMATE_TABLE = "pacey32-agency.City.climate"

CLIMATE_START = "2021-01-01"
CLIMATE_END = "2050-12-31"
CLIMATE_MODEL = "MRI_AGCM3_2_S"

API_URL = "https://climate-api.open-meteo.com/v1/climate"

DAILY_FIELDS = [
    "temperature_2m_mean",
    "temperature_2m_min",
    "temperature_2m_max",
    "precipitation_sum",
    "snowfall_sum",
    "cloud_cover_mean",
    "shortwave_radiation_sum",
]


# ------------------------------------------------------------------
# Clients
# ------------------------------------------------------------------

client = bigquery.Client(project=PROJECT_ID)

geolocator = Nominatim(
    user_agent="pacey32-hockey-climate",
    timeout=10,
)

geocode = RateLimiter(
    geolocator.geocode,
    min_delay_seconds=1.1,
)


# ------------------------------------------------------------------
# Read cities from BigQuery
# ------------------------------------------------------------------

cities_sql = f"""
SELECT DISTINCT
    venueLocation
FROM `{TEAM_TABLE}`
WHERE venueLocation IS NOT NULL
  AND TRIM(venueLocation) != ''
ORDER BY venueLocation
"""

cities = client.query(cities_sql).to_dataframe()

print(f"Found {len(cities)} cities in {TEAM_TABLE}")


# ------------------------------------------------------------------
# Read latest successful climate run for each city
# ------------------------------------------------------------------

refresh_sql = f"""
SELECT
    venueLocation,
    MAX(last_updated) AS last_updated
FROM `{CLIMATE_TABLE}`
GROUP BY venueLocation
"""

try:
    previous_runs = client.query(refresh_sql).to_dataframe()

except NotFound:
    # The climate table does not exist yet.
    previous_runs = pd.DataFrame(
        columns=[
            "venueLocation",
            "last_updated",
        ]
    )

    print(
        f"{CLIMATE_TABLE} does not exist yet. "
        "All cities will be processed."
    )


# ------------------------------------------------------------------
# Join cities to their previous run dates
# ------------------------------------------------------------------

cities = cities.merge(
    previous_runs,
    on="venueLocation",
    how="left",
)

cities["last_updated"] = pd.to_datetime(
    cities["last_updated"],
    utc=True,
    errors="coerce",
)

refresh_cutoff = pd.Timestamp.now(tz="UTC") - pd.DateOffset(
    months=3
)

cities["requires_refresh"] = (
    cities["last_updated"].isna()
    | (cities["last_updated"] < refresh_cutoff)
)

cities_to_run = cities.loc[
    cities["requires_refresh"]
].copy()

print(
    f"{len(cities_to_run)} cities require refreshing; "
    f"{len(cities) - len(cities_to_run)} are current."
)


# ------------------------------------------------------------------
# BigQuery output schema
# ------------------------------------------------------------------

climate_schema = [
    bigquery.SchemaField(
        "venueLocation",
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
        "Month",
        "INTEGER",
    ),
    bigquery.SchemaField(
        "AvgTemp",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "MinTemp",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "MaxTemp",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "RainMM",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "Snowfall",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "CloudCover",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "SolarRadiation",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "climate_start",
        "DATE",
    ),
    bigquery.SchemaField(
        "climate_end",
        "DATE",
    ),
    bigquery.SchemaField(
        "climate_model",
        "STRING",
    ),
    bigquery.SchemaField(
        "api_url",
        "STRING",
    ),
    bigquery.SchemaField(
        "last_updated",
        "TIMESTAMP",
    ),
]

load_job_config = bigquery.LoadJobConfig(
    schema=climate_schema,
    write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
)


# ------------------------------------------------------------------
# Process each city
# ------------------------------------------------------------------

successful_cities = []
failed_cities = []

for _, row in cities_to_run.iterrows():

    city = row["venueLocation"]

    try:
        # ----------------------------------------------------------
        # Geocode city
        # ----------------------------------------------------------

        print(f"\nGeocoding {city}")

        location = geocode(city)

        if location is None:
            raise ValueError(
                f"No coordinates found for {city}"
            )

        lat = float(location.latitude)
        lon = float(location.longitude)

        print(
            f"Getting climate data for {city}: "
            f"{lat}, {lon}"
        )

        # ----------------------------------------------------------
        # Call Open-Meteo Climate API
        # ----------------------------------------------------------

        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": CLIMATE_START,
            "end_date": CLIMATE_END,
            "models": CLIMATE_MODEL,
            "daily": ",".join(DAILY_FIELDS),
        }

        response = requests.get(
            API_URL,
            params=params,
            timeout=120,
        )

        while response.status_code == 429:
            print(
                f"Rate limited while processing {city}. "
                "Waiting 60 seconds."
            )

            time.sleep(60)

            response = requests.get(
                API_URL,
                params=params,
                timeout=120,
            )

        response.raise_for_status()

        data = response.json()

        if "daily" not in data:
            raise ValueError(
                f"No daily climate data returned for {city}: "
                f"{data}"
            )

        # ----------------------------------------------------------
        # Convert daily API response to DataFrame
        # ----------------------------------------------------------

        df = pd.DataFrame(
            data["daily"]
        )

        df["time"] = pd.to_datetime(
            df["time"]
        )

        df["Year"] = df["time"].dt.year
        df["Month"] = df["time"].dt.month

        # ----------------------------------------------------------
        # Calculate values for each year/month
        # ----------------------------------------------------------

        year_month = (
            df
            .groupby(
                [
                    "Year",
                    "Month",
                ],
                as_index=False,
            )
            .agg(
                AvgTemp=(
                    "temperature_2m_mean",
                    "mean",
                ),
                MinTemp=(
                    "temperature_2m_min",
                    "mean",
                ),
                MaxTemp=(
                    "temperature_2m_max",
                    "mean",
                ),
                RainMM=(
                    "precipitation_sum",
                    "sum",
                ),
                Snowfall=(
                    "snowfall_sum",
                    "sum",
                ),
                CloudCover=(
                    "cloud_cover_mean",
                    "mean",
                ),
                SolarRadiation=(
                    "shortwave_radiation_sum",
                    "mean",
                ),
            )
        )

        # ----------------------------------------------------------
        # Average each calendar month across 2021–2050
        # ----------------------------------------------------------

        climate_df = (
            year_month
            .groupby(
                "Month",
                as_index=False,
            )
            .agg(
                AvgTemp=(
                    "AvgTemp",
                    "mean",
                ),
                MinTemp=(
                    "MinTemp",
                    "mean",
                ),
                MaxTemp=(
                    "MaxTemp",
                    "mean",
                ),
                RainMM=(
                    "RainMM",
                    "mean",
                ),
                Snowfall=(
                    "Snowfall",
                    "mean",
                ),
                CloudCover=(
                    "CloudCover",
                    "mean",
                ),
                SolarRadiation=(
                    "SolarRadiation",
                    "mean",
                ),
            )
        )

        # ----------------------------------------------------------
        # Add metadata
        # ----------------------------------------------------------

        climate_df["venueLocation"] = city
        climate_df["latitude"] = lat
        climate_df["longitude"] = lon

        climate_df["climate_start"] = date.fromisoformat(
            CLIMATE_START
        )

        climate_df["climate_end"] = date.fromisoformat(
            CLIMATE_END
        )

        climate_df["climate_model"] = CLIMATE_MODEL
        climate_df["api_url"] = API_URL

        climate_df["last_updated"] = pd.Timestamp.now(
            tz="UTC"
        )

        climate_df = climate_df[
            [
                "venueLocation",
                "latitude",
                "longitude",
                "Month",
                "AvgTemp",
                "MinTemp",
                "MaxTemp",
                "RainMM",
                "Snowfall",
                "CloudCover",
                "SolarRadiation",
                "climate_start",
                "climate_end",
                "climate_model",
                "api_url",
                "last_updated",
            ]
        ]

        # Ensure expected numeric types.
        climate_df["Month"] = climate_df[
            "Month"
        ].astype("int64")

        # ----------------------------------------------------------
        # Immediately append this city to BigQuery
        # ----------------------------------------------------------

        load_job = client.load_table_from_dataframe(
            climate_df,
            CLIMATE_TABLE,
            job_config=load_job_config,
        )

        load_job.result()

        successful_cities.append(city)

        print(
            f"Written {len(climate_df)} rows for "
            f"{city} to {CLIMATE_TABLE}"
        )

        # Small pause between API calls.
        time.sleep(1)

    except Exception as exc:

        failed_cities.append(
            {
                "venueLocation": city,
                "error": str(exc),
            }
        )

        print(
            f"FAILED: {city}: {exc}"
        )


# ------------------------------------------------------------------
# Run summary
# ------------------------------------------------------------------

print("\nClimate refresh complete")

print(
    f"Successful cities: {len(successful_cities)}"
)

print(
    f"Failed cities: {len(failed_cities)}"
)

if successful_cities:
    print(
        "Successful: "
        + ", ".join(successful_cities)
    )

if failed_cities:
    print("\nFailures:")

    for failure in failed_cities:
        print(
            f"- {failure['venueLocation']}: "
            f"{failure['error']}"
        )