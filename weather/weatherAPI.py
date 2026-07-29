from datetime import date

import meteostat as ms
import pandas as pd


# Approximate centre of Anaheim, California
ANAHEIM = ms.Point(
    latitude=33.8366,
    longitude=-117.9143,
    elevation=48
)

# Standard climate-normal period
START_DATE = date(1991, 1, 1)
END_DATE = date(2020, 12, 31)


# Retrieve monthly observations
monthly_ts = ms.monthly(
    ANAHEIM,
    START_DATE,
    END_DATE,
    parameters=[
        ms.Parameter.TEMP,
        ms.Parameter.TMIN,
        ms.Parameter.TMAX,
        ms.Parameter.PRCP,
        ms.Parameter.TSUN,
    ],
)

monthly_raw = monthly_ts.fetch().reset_index()

# Check the returned columns while developing
print(monthly_raw.columns)
print(monthly_raw.head())


# Add calendar month
monthly_raw["month_number"] = pd.to_datetime(
    monthly_raw["time"]
).dt.month


# Average each calendar month across 1991–2020
anaheim_climate = (
    monthly_raw
    .groupby("month_number", as_index=False)
    .agg(
        average_temperature_c=("temp", "mean"),
        average_min_temperature_c=("tmin", "mean"),
        average_max_temperature_c=("tmax", "mean"),
        average_rainfall_mm=("prcp", "mean"),
        average_sunshine_minutes=("tsun", "mean"),
        years_temperature=("temp", "count"),
        years_rainfall=("prcp", "count"),
        years_sunshine=("tsun", "count"),
    )
)

anaheim_climate["month"] = pd.to_datetime(
    anaheim_climate["month_number"],
    format="%m"
).dt.month_name()

anaheim_climate["average_sunshine_hours"] = (
    anaheim_climate["average_sunshine_minutes"] / 60
)

anaheim_climate = anaheim_climate[
    [
        "month_number",
        "month",
        "average_temperature_c",
        "average_min_temperature_c",
        "average_max_temperature_c",
        "average_rainfall_mm",
        "average_sunshine_hours",
        "years_temperature",
        "years_rainfall",
        "years_sunshine",
    ]
].round(1)

print(anaheim_climate)

anaheim_climate.to_csv(
    "anaheim_monthly_climate_1991_2020.csv",
    index=False
)