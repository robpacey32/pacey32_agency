
"""
weatherAPI.py

Refreshes climate data for NHL cities and appends history to:
    pacey32-agency.City.climate
"""

import time
from datetime import datetime, timedelta, timezone

import pandas as pd
import requests
from google.cloud import bigquery
from google.api_core.exceptions import NotFound

# ---------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------

PROJECT_ID = "pacey32-agency"

TEAM_TABLE = "pacey32-agency.Team.TeamList"
CLIMATE_TABLE = "pacey32-agency.City.climate"

REFRESH_DAYS = 90

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
    "shortwave_radiation_sum"
]

client = bigquery.Client(project=PROJECT_ID)


def get_cities():
    sql=f"""
    SELECT DISTINCT
        venueLocation,
        latitude,
        longitude
    FROM `{TEAM_TABLE}`
    WHERE latitude IS NOT NULL
      AND longitude IS NOT NULL
    ORDER BY venueLocation
    """
    return client.query(sql).to_dataframe()


def get_refresh_dates():
    try:
        sql=f"""
        SELECT venueLocation,
               MAX(last_updated) last_updated
        FROM `{CLIMATE_TABLE}`
        GROUP BY venueLocation
        """
        return client.query(sql).to_dataframe()
    except NotFound:
        return pd.DataFrame(columns=["venueLocation","last_updated"])


def needs_refresh(last_updated):
    if pd.isna(last_updated):
        return True
    ts=pd.Timestamp(last_updated)
    if ts.tzinfo is None:
        ts=ts.tz_localize("UTC")
    else:
        ts=ts.tz_convert("UTC")
    return ts.to_pydatetime() < datetime.now(timezone.utc)-timedelta(days=REFRESH_DAYS)


def call_api(lat,lon):
    params={
        "latitude":lat,
        "longitude":lon,
        "start_date":CLIMATE_START,
        "end_date":CLIMATE_END,
        "models":CLIMATE_MODEL,
        "daily":DAILY_FIELDS
    }

    while True:
        r=requests.get(API_URL,params=params,timeout=120)
        if r.status_code==200:
            return r.json()
        if r.status_code==429:
            print("  Rate limited. Waiting 60 seconds...")
            time.sleep(60)
            continue
        r.raise_for_status()


def monthly_summary(data,city,lat,lon):
    df=pd.DataFrame(data["daily"])
    df["time"]=pd.to_datetime(df["time"])
    df["Month"]=df["time"].dt.month

    out=(df.groupby("Month",as_index=False)
           .agg(
                AvgTemp=("temperature_2m_mean","mean"),
                MinTemp=("temperature_2m_min","mean"),
                MaxTemp=("temperature_2m_max","mean"),
                RainMM=("precipitation_sum","mean"),
                SnowCM=("snowfall_sum","mean"),
                CloudCover=("cloud_cover_mean","mean"),
                SolarRadiation=("shortwave_radiation_sum","mean")
            ))

    out["venueLocation"]=city
    out["latitude"]=lat
    out["longitude"]=lon
    out["climate_start"]=CLIMATE_START
    out["climate_end"]=CLIMATE_END
    out["climate_model"]=CLIMATE_MODEL
    out["api_url"]=API_URL
    out["last_updated"]=pd.Timestamp.utcnow()

    cols=[
        "venueLocation","latitude","longitude","Month",
        "AvgTemp","MinTemp","MaxTemp","RainMM","SnowCM",
        "CloudCover","SolarRadiation",
        "climate_start","climate_end",
        "climate_model","api_url","last_updated"
    ]
    return out[cols]


def upload(df):
    schema=[
        bigquery.SchemaField("venueLocation","STRING"),
        bigquery.SchemaField("latitude","FLOAT"),
        bigquery.SchemaField("longitude","FLOAT"),
        bigquery.SchemaField("Month","INTEGER"),
        bigquery.SchemaField("AvgTemp","FLOAT"),
        bigquery.SchemaField("MinTemp","FLOAT"),
        bigquery.SchemaField("MaxTemp","FLOAT"),
        bigquery.SchemaField("RainMM","FLOAT"),
        bigquery.SchemaField("SnowCM","FLOAT"),
        bigquery.SchemaField("CloudCover","FLOAT"),
        bigquery.SchemaField("SolarRadiation","FLOAT"),
        bigquery.SchemaField("climate_start","DATE"),
        bigquery.SchemaField("climate_end","DATE"),
        bigquery.SchemaField("climate_model","STRING"),
        bigquery.SchemaField("api_url","STRING"),
        bigquery.SchemaField("last_updated","TIMESTAMP"),
    ]

    job=client.load_table_from_dataframe(
        df,
        CLIMATE_TABLE,
        job_config=bigquery.LoadJobConfig(
            write_disposition="WRITE_APPEND",
            schema=schema
        )
    )
    job.result()


def main():
    cities=get_cities()
    refresh=get_refresh_dates()

    cities=cities.merge(refresh,on="venueLocation",how="left")

    output=[]

    for _,row in cities.iterrows():

        if not needs_refresh(row["last_updated"]):
            print(f"Skipping {row['venueLocation']}")
            continue

        print(f"Refreshing {row['venueLocation']}")

        data=call_api(row["latitude"],row["longitude"])

        output.append(
            monthly_summary(
                data,
                row["venueLocation"],
                row["latitude"],
                row["longitude"]
            )
        )

        time.sleep(1)

    if not output:
        print("Nothing to refresh.")
        return

    final=pd.concat(output,ignore_index=True)

    upload(final)

    print(f"Uploaded {len(final)} rows.")


if __name__=="__main__":
    main()
