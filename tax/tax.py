"""
NHL city tax pipeline.

Purpose
-------
1. Read distinct NHL venue cities from BigQuery.
2. Select only cities not loaded in the last N calendar months.
3. Geocode those cities.
4. Scrape US and Canadian sales and income tax sources.
5. Join the tax lookups to the due cities.
6. Validate the output.
7. Append refreshed rows to BigQuery.

Designed to run locally or from GitHub Actions.
"""

from __future__ import annotations

import os
import re
import time
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
import requests
from bs4 import BeautifulSoup
from google.api_core.exceptions import NotFound
from google.cloud import bigquery
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# ============================================================
# CONFIGURATION
# ============================================================

PROJECT_ID = os.getenv("GCP_PROJECT", "pacey32-agency")
TEAM_TABLE = os.getenv(
    "TEAM_TABLE",
    "pacey32-agency.Team.TeamList",
)
TAX_TABLE = os.getenv(
    "TAX_TABLE",
    "pacey32-agency.City.city_tax",
)

REFRESH_MONTHS = int(os.getenv("REFRESH_MONTHS", "3"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "60"))
GEOCODE_SLEEP_SECONDS = float(
    os.getenv("GEOCODE_SLEEP_SECONDS", "0.25")
)

CANADA_SALES_TAX_URL = (
    "https://www.canada.ca/en/revenue-agency/services/tax/"
    "businesses/topics/gst-hst-businesses/charge-collect-which-rate/"
    "calculator.html"
)

CANADA_INCOME_TAX_URL = (
    "https://www.canada.ca/en/revenue-agency/services/tax/"
    "individuals/tax-rates-brackets/current-year.html"
)

QUEBEC_INCOME_TAX_URL = (
    "https://www.revenuquebec.ca/en/citizens/income-tax-return/"
    "completing-your-income-tax-return/income-tax-rates/"
)

# This is an official IRS source for the 2026 brackets. It can be
# overridden in GitHub Actions without changing the code when needed.
US_FEDERAL_TAX_URL = os.getenv(
    "US_FEDERAL_TAX_URL",
    (
        "https://www.irs.gov/newsroom/"
        "irs-releases-tax-inflation-adjustments-for-tax-year-2026-"
        "including-amendments-from-the-one-big-beautiful-bill"
    ),
)

CANADA_FEDERAL_TAX_URL = CANADA_INCOME_TAX_URL

GEOCODING_URL = (
    "https://geocoding-api.open-meteo.com/v1/search"
)

HEADERS = {
    "User-Agent": os.getenv(
        "HTTP_USER_AGENT",
        "pacey32-agency-city-tax/1.0",
    )
}

OUTPUT_COLUMNS = [
    "venueLocation",
    "geocoded_city",
    "state_province",
    "country",
    "country_code",
    "latitude",
    "longitude",
    "combined_sales_tax_rate",
    "sales_tax_state_rate",
    "sales_tax_average_local_rate",
    "gst_hst_rate",
    "pst_rate",
    "state_income_tax_rate",
    "federal_income_tax_top_rate",
    "combined_top_marginal_income_tax_rate",
    "sales_tax_basis",
    "state_income_tax_basis",
    "income_tax_rate_basis",
    "tax_year",
    "geocode_status",
    "sales_tax_source_url",
    "state_income_tax_source_url",
    "federal_income_tax_source_url",
    "scrape_datetime",
]

BQ_SCHEMA = [
    bigquery.SchemaField("venueLocation", "STRING"),
    bigquery.SchemaField("geocoded_city", "STRING"),
    bigquery.SchemaField("state_province", "STRING"),
    bigquery.SchemaField("country", "STRING"),
    bigquery.SchemaField("country_code", "STRING"),
    bigquery.SchemaField("latitude", "FLOAT"),
    bigquery.SchemaField("longitude", "FLOAT"),
    bigquery.SchemaField("combined_sales_tax_rate", "FLOAT"),
    bigquery.SchemaField("sales_tax_state_rate", "FLOAT"),
    bigquery.SchemaField("sales_tax_average_local_rate", "FLOAT"),
    bigquery.SchemaField("gst_hst_rate", "FLOAT"),
    bigquery.SchemaField("pst_rate", "FLOAT"),
    bigquery.SchemaField("state_income_tax_rate", "FLOAT"),
    bigquery.SchemaField("federal_income_tax_top_rate", "FLOAT"),
    bigquery.SchemaField(
        "combined_top_marginal_income_tax_rate",
        "FLOAT",
    ),
    bigquery.SchemaField("sales_tax_basis", "STRING"),
    bigquery.SchemaField("state_income_tax_basis", "STRING"),
    bigquery.SchemaField("income_tax_rate_basis", "STRING"),
    bigquery.SchemaField("tax_year", "INTEGER"),
    bigquery.SchemaField("geocode_status", "STRING"),
    bigquery.SchemaField("sales_tax_source_url", "STRING"),
    bigquery.SchemaField("state_income_tax_source_url", "STRING"),
    bigquery.SchemaField("federal_income_tax_source_url", "STRING"),
    bigquery.SchemaField("scrape_datetime", "TIMESTAMP"),
]


# ============================================================
# CLIENTS
# ============================================================

def create_http_session() -> requests.Session:
    """Create one retrying HTTP session for the full run."""
    retry = Retry(
        total=4,
        connect=4,
        read=4,
        status=4,
        backoff_factor=1.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
        respect_retry_after_header=True,
    )

    adapter = HTTPAdapter(max_retries=retry)

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
    """Return whitespace-normalised text."""
    if value is None or pd.isna(value):
        return ""

    return re.sub(r"\s+", " ", str(value)).strip()


def parse_percentage(value: object) -> Optional[float]:
    """Extract the first percentage or numeric value."""
    text = clean_text(value)

    if not text:
        return None

    if text.lower() in {
        "--",
        "—",
        "-",
        "n/a",
        "na",
        "none",
        "not applicable",
    }:
        return None

    match = re.search(
        r"(-?\d+(?:\.\d+)?)\s*%",
        text,
    )

    if match:
        return float(match.group(1))

    match = re.search(
        r"(-?\d+(?:\.\d+)?)",
        text,
    )

    return float(match.group(1)) if match else None


def find_all_percentages(value: object) -> list[float]:
    """Extract every percentage from text."""
    return [
        float(number)
        for number in re.findall(
            r"(-?\d+(?:\.\d+)?)\s*%",
            clean_text(value),
        )
    ]


def get_html(url: str) -> str:
    """Download HTML and reject suspiciously short responses."""
    response = HTTP.get(
        url,
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()

    if len(response.text) < 500:
        raise RuntimeError(
            f"Unexpectedly short response from {url}"
        )

    return response.text


def get_working_url(urls: list[str]) -> str:
    """Return the first URL that has a usable HTTP response."""
    errors: list[str] = []

    for url in urls:
        print(f"Trying {url}")

        try:
            response = HTTP.get(
                url,
                timeout=REQUEST_TIMEOUT,
            )

            if response.status_code == 200:
                print("  Found")
                return url

            errors.append(
                f"{url}: HTTP {response.status_code}"
            )

        except requests.RequestException as exc:
            errors.append(f"{url}: {exc}")

    raise RuntimeError(
        "No working URL found:\n" + "\n".join(errors)
    )


def empty_output_dataframe() -> pd.DataFrame:
    """Return an empty DataFrame with the final schema."""
    return pd.DataFrame(columns=OUTPUT_COLUMNS)


# ============================================================
# STEP 1: SELECT CITIES REQUIRING REFRESH
# ============================================================

def tax_table_exists() -> bool:
    """Return whether the destination table currently exists."""
    try:
        BQ.get_table(TAX_TABLE)
        return True
    except NotFound:
        return False


def get_nhl_cities_to_refresh() -> pd.DataFrame:
    """
    Return cities which have never been loaded or whose latest
    scrape date is at least REFRESH_MONTHS calendar months old.
    """
    if not tax_table_exists():
        query = f"""
        SELECT DISTINCT
            TRIM(venueLocation) AS venueLocation,
            CAST(NULL AS TIMESTAMP) AS last_scrape_datetime
        FROM `{TEAM_TABLE}`
        WHERE venueLocation IS NOT NULL
          AND TRIM(venueLocation) != ''
        ORDER BY venueLocation
        """
    else:
        query = f"""
        WITH team_cities AS (
            SELECT DISTINCT
                TRIM(venueLocation) AS venueLocation
            FROM `{TEAM_TABLE}`
            WHERE venueLocation IS NOT NULL
              AND TRIM(venueLocation) != ''
        ),
        latest_scrapes AS (
            SELECT
                venueLocation,
                MAX(scrape_datetime) AS last_scrape_datetime
            FROM `{TAX_TABLE}`
            WHERE venueLocation IS NOT NULL
            GROUP BY venueLocation
        )
        SELECT
            t.venueLocation,
            s.last_scrape_datetime
        FROM team_cities AS t
        LEFT JOIN latest_scrapes AS s
            USING (venueLocation)
        WHERE s.last_scrape_datetime IS NULL
           OR DATE(s.last_scrape_datetime)
              <= DATE_SUB(
                    CURRENT_DATE(),
                    INTERVAL {REFRESH_MONTHS} MONTH
                 )
        ORDER BY t.venueLocation
        """

    result = BQ.query(query).to_dataframe()

    if "last_scrape_datetime" in result.columns:
        result["last_scrape_datetime"] = pd.to_datetime(
            result["last_scrape_datetime"],
            utc=True,
            errors="coerce",
        )

    return result


# ============================================================
# STEP 2: GEOCODE DUE CITIES
# ============================================================

GEOCODE_SEARCH_OVERRIDES = {
    "St. Louis": "Saint Louis Missouri",
    "St. Paul": "Saint Paul Minnesota",
}

GEOCODE_EXPECTED_ADMIN1 = {
    "St. Louis": "Missouri",
    "St. Paul": "Minnesota",
}

GEOCODE_RESULT_OVERRIDES = {
    "Elmont": {
        "geocoded_city": "Elmont",
        "state_province": "New York",
        "country": "United States",
        "country_code": "US",
        "latitude": None,
        "longitude": None,
    },
    "Paradise": {
        "geocoded_city": "Las Vegas",
        "state_province": "Nevada",
        "country": "United States",
        "country_code": "US",
        "latitude": None,
        "longitude": None,
    },
}


def geocode_not_found(city: str) -> dict:
    return {
        "venueLocation": city,
        "geocoded_city": None,
        "state_province": None,
        "country": None,
        "country_code": None,
        "latitude": None,
        "longitude": None,
        "geocode_status": "NOT_FOUND",
    }


def geocode_city(city: str) -> dict:
    """Geocode one city using Open-Meteo."""
    if city in GEOCODE_RESULT_OVERRIDES:
        return {
            "venueLocation": city,
            **GEOCODE_RESULT_OVERRIDES[city],
            "geocode_status": "OVERRIDE",
        }

    search_name = GEOCODE_SEARCH_OVERRIDES.get(
        city,
        city,
    )

    response = HTTP.get(
        GEOCODING_URL,
        params={
            "name": search_name,
            "count": 10,
            "language": "en",
            "format": "json",
        },
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()

    results = response.json().get("results", [])

    results = [
        result
        for result in results
        if result.get("country_code") in {"US", "CA"}
    ]

    expected_admin1 = GEOCODE_EXPECTED_ADMIN1.get(city)

    if expected_admin1:
        expected_results = [
            result
            for result in results
            if result.get("admin1") == expected_admin1
        ]
        if expected_results:
            results = expected_results

    if not results:
        return geocode_not_found(city)

    results.sort(
        key=lambda result: (
            result.get("population") or 0
        ),
        reverse=True,
    )

    best = results[0]

    return {
        "venueLocation": city,
        "geocoded_city": best.get("name"),
        "state_province": best.get("admin1"),
        "country": best.get("country"),
        "country_code": best.get("country_code"),
        "latitude": best.get("latitude"),
        "longitude": best.get("longitude"),
        "geocode_status": "FOUND",
    }


def geocode_cities(cities_df: pd.DataFrame) -> pd.DataFrame:
    """Geocode every city in the supplied DataFrame."""
    rows: list[dict] = []

    for position, city in enumerate(
        cities_df["venueLocation"],
        start=1,
    ):
        print(
            f"Geocoding {position}/{len(cities_df)}: {city}"
        )

        try:
            rows.append(geocode_city(city))
        except Exception as exc:
            rows.append({
                **geocode_not_found(city),
                "geocode_status": f"ERROR: {exc}",
            })

        time.sleep(GEOCODE_SLEEP_SECONDS)

    return pd.DataFrame(rows)


# ============================================================
# STEP 3: US SALES TAX
# ============================================================

def scrape_us_sales_tax() -> pd.DataFrame:
    current_year = datetime.now(timezone.utc).year

    url = get_working_url([
        (
            "https://taxfoundation.org/data/all/state/"
            f"sales-tax-rates-midyear-{year}/"
        )
        for year in (
            current_year,
            current_year - 1,
            current_year - 2,
        )
    ])

    soup = BeautifulSoup(get_html(url), "html.parser")

    target_table = None

    for table in soup.find_all("table"):
        headers = {
            th.get_text(" ", strip=True)
            for th in table.find_all("th")
        }

        required = {
            "State",
            "State Tax Rate",
            "Avg. Local Tax Rate",
            "Combined Tax Rate",
        }

        if required.issubset(headers):
            target_table = table
            break

    if target_table is None:
        raise RuntimeError(
            "Unable to locate the US sales-tax table."
        )

    header_index = {
        th.get_text(" ", strip=True): index
        for index, th in enumerate(
            target_table.find("thead").find_all("th")
        )
    }

    rows: list[dict] = []

    for tr in target_table.find("tbody").find_all("tr"):
        cells = tr.find_all("td")

        if len(cells) <= max(header_index.values()):
            continue

        state = re.sub(
            r"\s*\([a-z]\)$",
            "",
            cells[
                header_index["State"]
            ].get_text(" ", strip=True),
            flags=re.IGNORECASE,
        ).strip()

        rows.append({
            "state_province": state,
            "country": "United States",
            "sales_tax_state_rate": parse_percentage(
                cells[
                    header_index["State Tax Rate"]
                ].get_text(" ", strip=True)
            ),
            "sales_tax_average_local_rate": parse_percentage(
                cells[
                    header_index["Avg. Local Tax Rate"]
                ].get_text(" ", strip=True)
            ),
            "combined_sales_tax_rate": parse_percentage(
                cells[
                    header_index["Combined Tax Rate"]
                ].get_text(" ", strip=True)
            ),
            "sales_tax_basis": (
                "State plus average local rate"
            ),
            "sales_tax_source_url": url,
        })

    result = pd.DataFrame(rows)

    if result.empty:
        raise RuntimeError(
            "US sales-tax table contained no parsed rows."
        )

    return result


# ============================================================
# STEP 4: US STATE INCOME TAX
# ============================================================

def scrape_us_state_income_tax() -> pd.DataFrame:
    current_year = datetime.now(timezone.utc).year

    url = get_working_url([
        (
            "https://taxfoundation.org/data/all/state/"
            f"state-income-tax-rates-{year}/"
        )
        for year in (
            current_year,
            current_year - 1,
            current_year - 2,
        )
    ])

    soup = BeautifulSoup(get_html(url), "html.parser")

    target_table = None

    for table in soup.find_all("table"):
        headers = {
            th.get_text(" ", strip=True)
            for th in table.find_all("th")
        }

        if {
            "State",
            "Single Filer (Rates)",
            "Single Filer (Brackets)",
        }.issubset(headers):
            target_table = table
            break

    if target_table is None:
        raise RuntimeError(
            "Unable to locate the US income-tax table."
        )

    header_index = {
        th.get_text(" ", strip=True): index
        for index, th in enumerate(
            target_table.find("thead").find_all("th")
        )
        if th.get_text(" ", strip=True)
    }

    top_rates: dict[str, float] = {}
    current_state: Optional[str] = None

    for tr in target_table.find("tbody").find_all("tr"):
        cells = tr.find_all("td")

        if len(cells) <= max(header_index.values()):
            continue

        state_text = cells[
            header_index["State"]
        ].get_text(" ", strip=True)

        rate_text = cells[
            header_index["Single Filer (Rates)"]
        ].get_text(" ", strip=True)

        # Ignore blank presentation rows such as Iowa's blank row.
        if not rate_text:
            continue

        if not state_text.startswith("-"):
            current_state = re.sub(
                r"\s*\(.*?\)$",
                "",
                state_text,
            ).strip()

            normalized = re.sub(
                r"[^A-Z]",
                "",
                current_state.upper(),
            )

            if normalized == "WASHINGTONDC":
                current_state = "District of Columbia"

        if current_state is None:
            continue

        rate_lower = rate_text.lower()

        if rate_lower == "none":
            rate = 0.0
        elif "capital gains" in rate_lower:
            # Washington has no ordinary wage income tax.
            rate = 0.0
        else:
            rate = parse_percentage(rate_text)

        if rate is None:
            print(
                f"Skipping unparsable rate "
                f"'{rate_text}' for {current_state}"
            )
            continue

        top_rates[current_state] = max(
            top_rates.get(current_state, 0.0),
            rate,
        )

    rows = [
        {
            "state_province": state,
            "country": "United States",
            "state_income_tax_rate": rate,
            "state_income_tax_basis": (
                "Top marginal ordinary income rate"
            ),
            "state_income_tax_source_url": url,
        }
        for state, rate in sorted(top_rates.items())
    ]

    result = pd.DataFrame(rows)

    if result.empty:
        raise RuntimeError(
            "US income-tax table contained no parsed rows."
        )

    return result


# ============================================================
# STEP 5: CANADIAN SALES TAX
# ============================================================

def scrape_canadian_sales_tax() -> pd.DataFrame:
    soup = BeautifulSoup(
        get_html(CANADA_SALES_TAX_URL),
        "html.parser",
    )

    target_table = None

    for table in soup.find_all("table"):
        headers = {
            th.get_text(" ", strip=True)
            for th in table.find_all("th")
        }

        if {
            "Province",
            "GST and HST",
            "PST",
        }.issubset(headers):
            target_table = table
            break

    if target_table is None:
        raise RuntimeError(
            "Unable to locate the Canadian sales-tax table."
        )

    header_index = {
        th.get_text(" ", strip=True): index
        for index, th in enumerate(
            target_table.find("thead").find_all("th")
        )
        if th.get_text(" ", strip=True)
    }

    rows: list[dict] = []

    for tr in target_table.find("tbody").find_all("tr"):
        cells = tr.find_all(["td", "th"])

        if len(cells) <= max(header_index.values()):
            continue

        province = cells[
            header_index["Province"]
        ].get_text(" ", strip=True)

        gst_hst_text = cells[
            header_index["GST and HST"]
        ].get_text(" ", strip=True)

        pst_text = cells[
            header_index["PST"]
        ].get_text(" ", strip=True)

        gst_hst_rate = parse_percentage(gst_hst_text)

        if pst_text.lower() in {
            "",
            "n/a",
            "na",
            "none",
            "not applicable",
        }:
            pst_rate = 0.0
            separate_pst = False
        else:
            pst_rate = parse_percentage(pst_text)
            separate_pst = True

        if gst_hst_rate is None or pst_rate is None:
            print(
                f"Skipping Canadian sales-tax row "
                f"for {province}"
            )
            continue

        rows.append({
            "state_province": province,
            "country": "Canada",
            "gst_hst_rate": gst_hst_rate,
            "pst_rate": pst_rate,
            "combined_sales_tax_rate": (
                gst_hst_rate + pst_rate
            ),
            "sales_tax_basis": (
                "GST plus PST"
                if separate_pst
                else "HST or GST only"
            ),
            "sales_tax_source_url": (
                CANADA_SALES_TAX_URL
            ),
        })

    result = pd.DataFrame(rows)

    if result.empty:
        raise RuntimeError(
            "Canadian sales-tax table contained no rows."
        )

    return result


# ============================================================
# STEP 6: CANADIAN PROVINCIAL INCOME TAX
# ============================================================

def scrape_quebec_top_income_tax_rate() -> float:
    soup = BeautifulSoup(
        get_html(QUEBEC_INCOME_TAX_URL),
        "html.parser",
    )

    target_table = None

    for table in soup.find_all("table"):
        headers = {
            cell.get_text(" ", strip=True)
            for cell in table.find_all(["th", "td"])
        }

        if "Taxable income" in headers and "Rate" in headers:
            target_table = table
            break

    if target_table is None:
        raise RuntimeError(
            "Quebec income-tax table not found."
        )

    rates: list[float] = []

    for tr in target_table.find("tbody").find_all("tr"):
        cells = tr.find_all("td")

        if len(cells) < 2:
            continue

        rate = parse_percentage(
            cells[1].get_text(" ", strip=True)
        )

        if rate is not None:
            rates.append(rate)

    if not rates:
        raise RuntimeError(
            "No Quebec income-tax rates found."
        )

    return max(rates)


def scrape_canadian_provincial_income_tax() -> pd.DataFrame:
    soup = BeautifulSoup(
        get_html(CANADA_INCOME_TAX_URL),
        "html.parser",
    )

    rows: list[dict] = []

    for details in soup.find_all("details"):
        summary = details.find("summary")

        if summary is None:
            continue

        province = summary.get_text(" ", strip=True)

        if not province or province == "Quebec":
            continue

        table = details.find("table")

        if table is None or table.find("tbody") is None:
            continue

        rates: list[float] = []

        for tr in table.find("tbody").find_all("tr"):
            cells = tr.find_all("td")

            if len(cells) < 3:
                continue

            rate = parse_percentage(
                cells[2].get_text(" ", strip=True)
            )

            if rate is not None:
                rates.append(rate)

        if not rates:
            print(
                f"No provincial rates parsed for {province}"
            )
            continue

        rows.append({
            "state_province": province,
            "country": "Canada",
            "state_income_tax_rate": max(rates),
            "state_income_tax_basis": (
                "Top marginal statutory rate"
            ),
            "state_income_tax_source_url": (
                CANADA_INCOME_TAX_URL
            ),
        })

    rows.append({
        "state_province": "Quebec",
        "country": "Canada",
        "state_income_tax_rate": (
            scrape_quebec_top_income_tax_rate()
        ),
        "state_income_tax_basis": (
            "Top marginal statutory rate"
        ),
        "state_income_tax_source_url": (
            QUEBEC_INCOME_TAX_URL
        ),
    })

    result = pd.DataFrame(rows)

    if result.empty:
        raise RuntimeError(
            "Canadian provincial income-tax scrape "
            "returned no rows."
        )

    return result


# ============================================================
# STEP 7: FEDERAL TOP MARGINAL RATES
# ============================================================

def scrape_us_federal_top_rate() -> float:
    soup = BeautifulSoup(
        get_html(US_FEDERAL_TAX_URL),
        "html.parser",
    )
    text = soup.get_text(" ", strip=True)

    patterns = [
        (
            r"top tax rate remains\s+"
            r"(\d+(?:\.\d+)?)\s*%"
        ),
        (
            r"top tax rate(?:\s+is)?\s+"
            r"(\d+(?:\.\d+)?)\s*%"
        ),
        (
            r"top marginal(?: income)? tax rate"
            r"(?:\s+is)?\s+"
            r"(\d+(?:\.\d+)?)\s*%"
        ),
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        )

        if match:
            return float(match.group(1))

    standard_rates = {
        10.0,
        12.0,
        22.0,
        24.0,
        32.0,
        35.0,
        37.0,
    }

    candidates = [
        rate
        for rate in find_all_percentages(text)
        if rate in standard_rates
    ]

    if not candidates:
        raise RuntimeError(
            "US federal top marginal rate not found."
        )

    return max(candidates)


def scrape_canada_federal_top_rate() -> float:
    soup = BeautifulSoup(
        get_html(CANADA_FEDERAL_TAX_URL),
        "html.parser",
    )

    target_table = None

    for table in soup.find_all("table"):
        caption = table.find("caption")

        if (
            caption is not None
            and "Federal rate" in caption.get_text(
                " ",
                strip=True,
            )
        ):
            target_table = table
            break

    if target_table is None:
        raise RuntimeError(
            "Canadian federal income-tax table "
            "not found."
        )

    rates: list[float] = []

    for tr in target_table.find("tbody").find_all("tr"):
        cells = tr.find_all("td")

        if len(cells) < 3:
            continue

        rate = parse_percentage(
            cells[2].get_text(" ", strip=True)
        )

        if rate is not None:
            rates.append(rate)

    if not rates:
        raise RuntimeError(
            "No Canadian federal rates found."
        )

    return max(rates)


def get_federal_tax_rates() -> pd.DataFrame:
    return pd.DataFrame([
        {
            "country": "United States",
            "federal_income_tax_top_rate": (
                scrape_us_federal_top_rate()
            ),
            "federal_income_tax_source_url": (
                US_FEDERAL_TAX_URL
            ),
        },
        {
            "country": "Canada",
            "federal_income_tax_top_rate": (
                scrape_canada_federal_top_rate()
            ),
            "federal_income_tax_source_url": (
                CANADA_FEDERAL_TAX_URL
            ),
        },
    ])


# ============================================================
# STEP 8: BUILD FINAL DATASET
# ============================================================

def build_city_tax_dataset(
    cities_df: pd.DataFrame,
) -> pd.DataFrame:
    """Scrape lookups and join them to the due cities."""
    if cities_df.empty:
        return empty_output_dataframe()

    print("Geocoding due NHL cities...")
    geocoded_df = geocode_cities(cities_df)

    bad_geocodes = geocoded_df[
        ~geocoded_df["geocode_status"].isin(
            {"FOUND", "OVERRIDE"}
        )
    ]

    if not bad_geocodes.empty:
        print("\nGeocoding failures:")
        print(
            bad_geocodes[
                [
                    "venueLocation",
                    "geocode_status",
                ]
            ].to_string(index=False)
        )

    print("Scraping US sales-tax rates...")
    us_sales_df = scrape_us_sales_tax()

    print("Scraping US state income-tax rates...")
    us_income_df = scrape_us_state_income_tax()

    print("Scraping Canadian sales-tax rates...")
    canada_sales_df = scrape_canadian_sales_tax()

    print(
        "Scraping Canadian provincial "
        "income-tax rates..."
    )
    canada_income_df = (
        scrape_canadian_provincial_income_tax()
    )

    print("Scraping federal income-tax rates...")
    federal_df = get_federal_tax_rates()

    sales_tax_df = pd.concat(
        [us_sales_df, canada_sales_df],
        ignore_index=True,
        sort=False,
    )

    income_tax_df = pd.concat(
        [us_income_df, canada_income_df],
        ignore_index=True,
        sort=False,
    )

    if sales_tax_df.duplicated(
        ["country", "state_province"]
    ).any():
        duplicates = sales_tax_df[
            sales_tax_df.duplicated(
                ["country", "state_province"],
                keep=False,
            )
        ]
        raise RuntimeError(
            "Duplicate sales-tax lookup rows:\n"
            + duplicates.to_string(index=False)
        )

    if income_tax_df.duplicated(
        ["country", "state_province"]
    ).any():
        duplicates = income_tax_df[
            income_tax_df.duplicated(
                ["country", "state_province"],
                keep=False,
            )
        ]
        raise RuntimeError(
            "Duplicate income-tax lookup rows:\n"
            + duplicates.to_string(index=False)
        )

    final_df = geocoded_df.merge(
        sales_tax_df,
        how="left",
        on=["country", "state_province"],
        validate="many_to_one",
    )

    final_df = final_df.merge(
        income_tax_df,
        how="left",
        on=["country", "state_province"],
        validate="many_to_one",
    )

    final_df = final_df.merge(
        federal_df,
        how="left",
        on="country",
        validate="many_to_one",
    )

    numeric_columns = [
        "latitude",
        "longitude",
        "combined_sales_tax_rate",
        "sales_tax_state_rate",
        "sales_tax_average_local_rate",
        "gst_hst_rate",
        "pst_rate",
        "state_income_tax_rate",
        "federal_income_tax_top_rate",
    ]

    for column in numeric_columns:
        if column not in final_df.columns:
            final_df[column] = pd.NA

        final_df[column] = pd.to_numeric(
            final_df[column],
            errors="coerce",
        )

    final_df[
        "combined_top_marginal_income_tax_rate"
    ] = (
        final_df["state_income_tax_rate"]
        + final_df["federal_income_tax_top_rate"]
    )

    scrape_datetime = datetime.now(timezone.utc)

    final_df["scrape_datetime"] = scrape_datetime
    final_df["tax_year"] = scrape_datetime.year
    final_df["income_tax_rate_basis"] = (
        "Top marginal statutory rate"
    )

    for column in OUTPUT_COLUMNS:
        if column not in final_df.columns:
            final_df[column] = pd.NA

    return (
        final_df[OUTPUT_COLUMNS]
        .sort_values(
            [
                "country",
                "state_province",
                "venueLocation",
            ],
            na_position="last",
        )
        .reset_index(drop=True)
    )


# ============================================================
# STEP 9: VALIDATE AND LOAD
# ============================================================

def validate_final_dataset(
    df: pd.DataFrame,
    expected_city_count: int,
) -> None:
    """Reject incomplete or duplicated refresh output."""
    if len(df) != expected_city_count:
        raise ValueError(
            f"Expected {expected_city_count} city rows, "
            f"but built {len(df)}."
        )

    if df["venueLocation"].duplicated().any():
        duplicates = df[
            df["venueLocation"].duplicated(
                keep=False
            )
        ]
        raise ValueError(
            "Duplicate city rows in final output:\n"
            + duplicates.to_string(index=False)
        )

    required_columns = [
        "venueLocation",
        "state_province",
        "country",
        "combined_sales_tax_rate",
        "state_income_tax_rate",
        "federal_income_tax_top_rate",
        "combined_top_marginal_income_tax_rate",
        "scrape_datetime",
    ]

    failures = df[
        df[required_columns].isna().any(axis=1)
    ]

    if not failures.empty:
        raise ValueError(
            "Rows with missing required values:\n"
            + failures[
                required_columns
            ].to_string(index=False)
        )

    print("Validation passed.")


def load_to_bigquery(df: pd.DataFrame) -> None:
    """
    Append refreshed rows.

    Historical rows are retained. The next run uses MAX(scrape_datetime)
    per venueLocation to determine whether each city is due again.
    """
    if df.empty:
        print("No rows to load.")
        return

    job_config = bigquery.LoadJobConfig(
        schema=BQ_SCHEMA,
        write_disposition=(
            bigquery.WriteDisposition.WRITE_APPEND
        ),
        create_disposition=(
            bigquery.CreateDisposition.CREATE_IF_NEEDED
        ),
        schema_update_options=[
            bigquery.SchemaUpdateOption.ALLOW_FIELD_ADDITION,
        ],
    )

    job = BQ.load_table_from_dataframe(
        df,
        TAX_TABLE,
        job_config=job_config,
    )
    job.result()

    print(
        f"Loaded {len(df)} refreshed city rows "
        f"into {TAX_TABLE}."
    )


# ============================================================
# MAIN
# ============================================================

def main() -> None:
    print(
        f"Selecting cities not refreshed in the last "
        f"{REFRESH_MONTHS} calendar months..."
    )

    due_cities_df = get_nhl_cities_to_refresh()

    if due_cities_df.empty:
        print("No NHL cities require refreshing.")
        return

    print(
        f"{len(due_cities_df)} NHL cities require refresh."
    )

    print(
        due_cities_df[
            [
                "venueLocation",
                "last_scrape_datetime",
            ]
        ].to_string(index=False)
    )

    city_tax_df = build_city_tax_dataset(
        due_cities_df[["venueLocation"]]
    )

    print("\nRefresh output:")
    print(
        city_tax_df[
            [
                "venueLocation",
                "state_province",
                "country",
                "combined_sales_tax_rate",
                "state_income_tax_rate",
                "federal_income_tax_top_rate",
                "combined_top_marginal_income_tax_rate",
            ]
        ].to_string(index=False)
    )

    validate_final_dataset(
        city_tax_df,
        expected_city_count=len(due_cities_df),
    )

    load_to_bigquery(city_tax_df)


if __name__ == "__main__":
    main()
