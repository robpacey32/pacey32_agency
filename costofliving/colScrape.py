# ------------------------------
# 📦 Imports
# ------------------------------
import time

import pandas as pd
import requests
import re

from bs4 import BeautifulSoup
from google.cloud import bigquery
from datetime import datetime, timezone

# ===============================================================
# ⚙️ SETTINGS
# ===============================================================

GCP_PROJECT = "pacey32-agency"

TEAM_TABLE = "pacey32-agency.Team.TeamList"
COL_TABLE = "pacey32-agency.City.costofliving"

client = bigquery.Client(project=GCP_PROJECT)

BASE_URL = "https://www.numbeo.com/cost-of-living/in/{city}"

CITY_OVERRIDES = {
    "Elmont": "New-York",
    "Paradise": "Las-Vegas",
    "Sunrise": "Fort-Lauderdale",
    "St. Louis": "Saint-Louis",
    "St. Paul": "Saint-Paul",
}

# ===============================================================
# 🔎 GET CITIES FROM BIGQUERY
# ===============================================================

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

# ===============================================================
# 🧩 GET NUMBEO URLS
# ===============================================================

def city_urls(cities_df):

    results = []

    for _, row in cities_df.iterrows():

        city = row["venueLocation"].strip()

        url_city = CITY_OVERRIDES.get(
            city,
            city.replace(" ", "-")
            )

        requested_url = BASE_URL.format(
            city=url_city
        )

        results.append({
            "venueLocation": city,
            "url_city": url_city,
            "final_url": requested_url,
            })

    return pd.DataFrame(results)

numbeo_urls_df = city_urls(cities_df=cities)

# ===============================================================
# 🔎 GET MOST RECENT SCRAPE FOR EACH CITY
# ===============================================================

latest_scrape_sql = f"""
SELECT
    url_name,
    MAX(scrape_datetime) AS last_scrape_datetime
FROM `{COL_TABLE}`
GROUP BY url_name
"""

try:
    latest_scrapes_df = client.query(
        latest_scrape_sql
    ).to_dataframe()

except Exception as e:
    # This allows the first run to continue if the table does not yet exist
    print(f"Could not retrieve previous scrape dates: {e}")

    latest_scrapes_df = pd.DataFrame(
        columns=[
            "url_name",
            "last_scrape_datetime",
        ]
    )


# Match the generated URL value to the stored url_name
numbeo_urls_df = numbeo_urls_df.merge(
    latest_scrapes_df,
    left_on="url_city",
    right_on="url_name",
    how="left",
)


# Ensure timestamps are handled consistently
numbeo_urls_df["last_scrape_datetime"] = pd.to_datetime(
    numbeo_urls_df["last_scrape_datetime"],
    utc=True,
    errors="coerce",
)


# Three calendar months before today
refresh_cutoff = pd.Timestamp.now(
    tz="UTC"
) - pd.DateOffset(months=3)


numbeo_urls_df["needs_refresh"] = (
    numbeo_urls_df["last_scrape_datetime"].isna()
    |
    (
        numbeo_urls_df["last_scrape_datetime"]
        < refresh_cutoff
    )
)


cities_to_scrape_df = numbeo_urls_df[
    numbeo_urls_df["needs_refresh"]
].copy()


cities_skipped_df = numbeo_urls_df[
    ~numbeo_urls_df["needs_refresh"]
].copy()


print(
    f"{len(cities_to_scrape_df)} cities require scraping; "
    f"{len(cities_skipped_df)} were scraped within the last "
    f"three months."
)


if not cities_skipped_df.empty:
    print("\nSkipping:")

    for _, row in cities_skipped_df.iterrows():
        print(
            f"- {row['venueLocation']}: "
            f"last scraped {row['last_scrape_datetime']}"
        )

# ===============================================================
# 🧩 FUNCTION: parse_number
# ===============================================================
def parse_number(value):
    """
    Converts values such as:
        "$20.00" -> 20.0
        "15.00"  -> 15.0
        "1,250"  -> 1250.0
    """

    if value is None:
        return None

    value = re.sub(r"[^\d.-]", "", value)

    try:
        return float(value)
    except ValueError:
        return None

# ===============================================================
# 🧩 FUNCTION: get_table
# ===============================================================
def get_table(url, debug=False):
    """
    Returns DataFrame:

    metric | avg | low | high
    """

    try:
        response = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=15
        )
        response.raise_for_status()

    except Exception as e:
        print(f"Error fetching page: {e}")
        return pd.DataFrame(columns=["metric", "avg", "low", "high"])

    soup = BeautifulSoup(response.content, "html.parser")

    # Timestamp for this scrape
    scrape_datetime = datetime.now(timezone.utc)

    # Last part of the URL
    url_name = url.rstrip("/").split("/")[-1]

    rows = soup.find_all("tr")

    if debug:
        print(f"Found {len(rows)} rows")

    output = []

    for row in rows:

        try:

            cells = row.find_all("td")

            # Ignore rows that aren't metric rows
            if len(cells) < 3:
                continue

            # First column
            metric = cells[0].get_text(strip=True)

            # Second column
            avg = parse_number(cells[1].get_text())

            # Third column
            price_range = cells[2]

            low_element = price_range.find("span", class_="barTextLeft")
            high_element = price_range.find("span", class_="barTextRight")

            low = (
                 parse_number(low_element.get_text(strip=True))
                 if low_element
                 else None
                 )

            high = (
                parse_number(high_element.get_text(strip=True))
                if high_element
                else None
                )

            output.append({
                "metric": metric,
                "avg": avg,
                "low": low,
                "high": high,
                "url": url,
                "url_name": url_name,
                "scrape_datetime": scrape_datetime
            })

        except Exception as e:

            if debug:
                print(f"Skipping row: {e}")

            continue

    df = pd.DataFrame(
        output,
        columns=[
            "metric",
            "avg",
            "low",
            "high",
            "url",
            "url_name",
            "scrape_datetime"
        ]
    )

    if debug:
        print(f"Extracted {len(df)} metrics")

    return df

# ===============================================================
# LOOP THROUGH URLS
# ===============================================================

for _, city_row in cities_to_scrape_df.iterrows():

    url = city_row["final_url"]
    venue_location = city_row["venueLocation"]

    try:
        print(f"Scraping {venue_location}: {url}")

        df = get_table(url=url)

        if df.empty:
            print(f"✗ No data returned for {venue_location}")
            continue

        # Keep the original team venue as well as the Numbeo city
        df["venueLocation"] = venue_location

        job = client.load_table_from_dataframe(
            df,
            COL_TABLE,
            job_config=bigquery.LoadJobConfig(
                write_disposition="WRITE_APPEND"
            ),
        )

        job.result()

        print(
            f"✓ Loaded {len(df)} rows for "
            f"{venue_location}"
        )

        # A modest delay to avoid making rapid consecutive requests
        time.sleep(5)

    except Exception as e:
        print(
            f"✗ Failed {venue_location} ({url}): {e}"
        )