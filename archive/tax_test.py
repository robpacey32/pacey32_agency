import re
import time
from datetime import datetime, timezone
from io import StringIO
from typing import Optional

import pandas as pd
import requests
from bs4 import BeautifulSoup
from google.cloud import bigquery

# ============================================================
# CONFIGURATION
# ============================================================

PROJECT_ID = "pacey32-agency"
TEAM_TABLE = "pacey32-agency.Team.TeamList"

# Destination for the final city tax data.
TAX_TABLE = "pacey32-agency.City.city_tax"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

CANADA_INCOME_TAX_URL = (
    "https://www.canada.ca/en/revenue-agency/services/tax/"
    "individuals/tax-rates-brackets/current-year.html"
)

US_FEDERAL_TAX_URL = (
    "https://www.irs.gov/newsroom/"
    "irs-releases-tax-inflation-adjustments-for-tax-year-2026-"
    "including-amendments-from-the-one-big-beautiful-bill"
)

QUEBEC_INCOME_TAX_URL = "https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/income-tax-rates/"

CANADA_FEDERAL_TAX_URL = CANADA_INCOME_TAX_URL

HEADERS = {
    # Change the contact address to your own valid address.
    "User-Agent": (
        "pacey32-agency-city-tax/1.0 "
        "(NHL city cost comparison; contact: your-email@example.com)"
    )
}

REQUEST_TIMEOUT = 60
GEOCODE_SLEEP_SECONDS = 1.1

client = bigquery.Client(project=PROJECT_ID)

# ============================================================
# COMMON HELPERS
# ============================================================

def clean_text(value: object) -> str:
    """Convert a value into normalized plain text."""
    if value is None or pd.isna(value):
        return ""

    return re.sub(r"\s+", " ", str(value)).strip()


def parse_percentage(value: object) -> Optional[float]:
    """
    Extract the first percentage from a value.

    Examples:
        '8.99%' -> 8.99
        '0.00% (a)' -> 0.0
        '--' -> None
    """
    text = clean_text(value)

    if not text:
        return None

    if text.lower() in {
        "--",
        "—",
        "-",
        "n/a",
        "none",
        "not applicable",
    }:
        return None

    match = re.search(r"(-?\d+(?:\.\d+)?)\s*%", text)

    if match:
        return float(match.group(1))

    # Some HTML tables omit the percent symbol.
    match = re.search(r"(-?\d+(?:\.\d+)?)", text)

    if match:
        return float(match.group(1))

    return None


def find_all_percentages(value: object) -> list[float]:
    """Extract all percentages from a string."""
    text = clean_text(value)

    return [
        float(number)
        for number in re.findall(
            r"(-?\d+(?:\.\d+)?)\s*%",
            text,
        )
    ]


def flatten_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Flatten pandas MultiIndex table headers."""
    result = df.copy()

    if isinstance(result.columns, pd.MultiIndex):
        result.columns = [
            " ".join(
                clean_text(part)
                for part in column
                if clean_text(part)
                and not clean_text(part).startswith("Unnamed")
            )
            for column in result.columns
        ]
    else:
        result.columns = [
            clean_text(column)
            for column in result.columns
        ]

    return result


def download_html(url: str) -> str:
    """Download an HTML page with error handling."""
    response = requests.get(
        url,
        headers=HEADERS,
        timeout=REQUEST_TIMEOUT,
    )

    response.raise_for_status()

    html = response.text

    if len(html) < 500:
        raise RuntimeError(
            f"Unexpectedly short response from {url}"
        )

    return html


def read_html_tables(url: str) -> list[pd.DataFrame]:
    """Download a page and return all parseable HTML tables."""
    html = download_html(url)

    tables = pd.read_html(StringIO(html))

    return [
        flatten_columns(table)
        for table in tables
    ]


def normalize_country(country_code: str) -> Optional[str]:
    """Map ISO country codes to project country names."""
    mapping = {
        "us": "United States",
        "ca": "Canada",
    }

    return mapping.get(
        clean_text(country_code).lower()
    )


def normalize_us_state_name(value: object) -> str:
    """Remove footnotes and normalize US state names."""
    state = clean_text(value)

    state = re.sub(r"\[[^\]]+\]", "", state)
    state = re.sub(r"\(\d+\)", "", state)
    state = re.sub(r"\d+$", "", state)
    state = re.sub(r"[*†‡]+$", "", state)

    return clean_text(state)


def normalize_canadian_province(value: object) -> str:
    """Normalize common Canadian province representations."""
    province = clean_text(value)

    mappings = {
        "alta.": "Alberta",
        "b.c.": "British Columbia",
        "man.": "Manitoba",
        "n.b.": "New Brunswick",
        "n.l.": "Newfoundland and Labrador",
        "n.s.": "Nova Scotia",
        "n.w.t.": "Northwest Territories",
        "nun.": "Nunavut",
        "ont.": "Ontario",
        "p.e.i.": "Prince Edward Island",
        "que.": "Quebec",
        "québec": "Quebec",
        "sask.": "Saskatchewan",
        "y.t.": "Yukon",
    }

    return mappings.get(
        province.lower(),
        province,
    )

def get_working_url(url_templates):
    """
    Returns the first URL that responds with HTTP 200.

    Parameters
    ----------
    url_templates : list[str]

    Returns
    -------
    str
    """

    for url in url_templates:

        print(f"Trying {url}")

        try:
            response = requests.get(
                url,
                headers=HEADERS,
                timeout=60,
            )

            if response.status_code == 200:
                print("  ✓ Found")
                return url

        except Exception:
            pass

    raise RuntimeError(
        f"No working URL found.\n{url_templates}"
    )

# ============================================================
# STEP 1: PULL NHL CITIES
# ============================================================

def get_nhl_cities() -> pd.DataFrame:
    """Pull distinct NHL venue cities from BigQuery."""
    cities_sql = f"""
    SELECT DISTINCT
        TRIM(venueLocation) AS venueLocation
    FROM `{TEAM_TABLE}`
    WHERE venueLocation IS NOT NULL
      AND TRIM(venueLocation) != ''
    ORDER BY venueLocation
    """

    df = client.query(cities_sql).to_dataframe()

    return df.drop_duplicates(
        subset=["venueLocation"]
    ).reset_index(drop=True)

# ============================================================
# STEP 2: GEOCODE CITIES (OPEN-METEO)
# ============================================================

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"

# These cities are ambiguous so give Open-Meteo a little help.
GEOCODE_SEARCH_OVERRIDES = {
    "St. Louis": "Saint Louis",
    "St. Paul": "Saint Paul",
}

GEOCODE_RESULT_OVERRIDES = {
    "Elmont": {
        "geocoded_city": "Elmont",
        "state_province": "New York",
        "country": "United States",
        "country_code": "US",
    },
    "Paradise": {
        "geocoded_city": "Paradise",
        "state_province": "Nevada",
        "country": "United States",
        "country_code": "US",
    },
}


def geocode_city(city: str) -> dict:

    search_city = GEOCODE_SEARCH_OVERRIDES.get(
        city,
        city,
    )

    response = requests.get(
        GEOCODING_URL,
        params={
            "name": search_city,
            "count": 10,
            "language": "en",
            "format": "json",
        },
        timeout=60,
    )

    response.raise_for_status()

    data = response.json()

    if "results" not in data:

        return {
            "venueLocation": city,
            "geocoded_city": None,
            "state_province": None,
            "country": None,
            "country_code": None,
            "latitude": None,
            "longitude": None,
            "geocode_status": "NOT FOUND",
        }

    results = [
        r
        for r in data["results"]
        if r.get("country_code") in (
            "US",
            "CA",
        )
    ]

    if not results:

        return {
            "venueLocation": city,
            "geocoded_city": None,
            "state_province": None,
            "country": None,
            "country_code": None,
            "latitude": None,
            "longitude": None,
            "geocode_status": "NOT FOUND",
        }

    results = sorted(
        results,
        key=lambda x: x.get("population", 0),
        reverse=True,
    )

    best = results[0]

    result = {
        "venueLocation": city,
        "geocoded_city": best.get("name"),
        "state_province": best.get("admin1"),
        "country": best.get("country"),
        "country_code": best.get("country_code"),
        "latitude": best.get("latitude"),
        "longitude": best.get("longitude"),
        "geocode_status": "FOUND",
    }

    # Override incorrect state/country mappings
    if city in GEOCODE_RESULT_OVERRIDES:

        result.update(
            GEOCODE_RESULT_OVERRIDES[city]
        )

        result["venueLocation"] = city
        result["geocode_status"] = "OVERRIDE"

    return result


def geocode_cities(cities_df):

    rows = []

    for i, city in enumerate(
        cities_df["venueLocation"],
        start=1,
    ):

        print(
            f"Geocoding {i}/{len(cities_df)}: {city}"
        )

        try:

            rows.append(
                geocode_city(city)
            )

        except Exception as e:

            rows.append(
                {
                    "venueLocation": city,
                    "geocoded_city": None,
                    "state_province": None,
                    "country": None,
                    "country_code": None,
                    "latitude": None,
                    "longitude": None,
                    "geocode_status": str(e),
                }
            )

        # Be polite
        time.sleep(0.2)

    return pd.DataFrame(rows)

# ============================================================
# STEP 3: US COMBINED SALES TAX
# ============================================================

def scrape_us_sales_tax():

    current_year = datetime.now().year

    url = get_working_url([
        f"https://taxfoundation.org/data/all/state/sales-tax-rates-midyear-{current_year}/",
        f"https://taxfoundation.org/data/all/state/sales-tax-rates-midyear-{current_year-1}/",
        f"https://taxfoundation.org/data/all/state/sales-tax-rates-midyear-{current_year-2}/",
    ])

    html = requests.get(
        url,
        headers=HEADERS,
        timeout=60,
    ).text

    soup = BeautifulSoup(html, "html.parser")

    # ---------------------------------------------------------
    # Find the correct table by its headers
    # ---------------------------------------------------------

    target_table = None

    for table in soup.find_all("table"):

        headers = [
            th.get_text(" ", strip=True)
            for th in table.find_all("th")
        ]

        if (
            "State" in headers
            and "State Tax Rate" in headers
            and "Avg. Local Tax Rate" in headers
            and "Combined Tax Rate" in headers
        ):
            target_table = table
            break

    if target_table is None:
        raise RuntimeError(
            "Unable to locate the US sales tax table."
        )

    # ---------------------------------------------------------
    # Build a lookup from column name -> position
    # ---------------------------------------------------------

    header_index = {}

    for i, th in enumerate(target_table.find("thead").find_all("th")):

        header = th.get_text(" ", strip=True)

        header_index[header] = i

    # ---------------------------------------------------------
    # Read rows
    # ---------------------------------------------------------

    rows = []

    tbody = target_table.find("tbody")

    for tr in tbody.find_all("tr"):

        tds = tr.find_all("td")

        state = re.sub(
            r"\s*\([a-z]\)$",
            "",
            tds[
                header_index["State"]
            ].get_text(strip=True),
        )

        rows.append(
            {
                "state_province": state,
                "country": "United States",

                "sales_tax_state_rate":
                    parse_percentage(
                        tds[
                            header_index["State Tax Rate"]
                        ].text
                    ),

                "sales_tax_average_local_rate":
                    parse_percentage(
                        tds[
                            header_index["Avg. Local Tax Rate"]
                        ].text
                    ),

                "combined_sales_tax_rate":
                    parse_percentage(
                        tds[
                            header_index["Combined Tax Rate"]
                        ].text
                    ),

                "sales_tax_basis":
                    "State + Avg Local",

                "sales_tax_source_url":
                    url,
            }
        )

    return pd.DataFrame(rows)

# ============================================================
# STEP 4: US STATE INCOME TAX
# ============================================================

def scrape_us_state_income_tax():

    current_year = datetime.now().year

    url = get_working_url([
        f"https://taxfoundation.org/data/all/state/state-income-tax-rates-{current_year}/",
        f"https://taxfoundation.org/data/all/state/state-income-tax-rates-{current_year-1}/",
        f"https://taxfoundation.org/data/all/state/state-income-tax-rates-{current_year-2}/",
    ])

    html = requests.get(
        url,
        headers=HEADERS,
        timeout=60,
    ).text

    soup = BeautifulSoup(html, "html.parser")

    # ---------------------------------------------------------
    # Locate the correct table
    # ---------------------------------------------------------

    target_table = None

    for table in soup.find_all("table"):

        headers = [
            th.get_text(" ", strip=True)
            for th in table.find_all("th")
        ]

        if (
            "State" in headers
            and "Single Filer (Rates)" in headers
            and "Single Filer (Brackets)" in headers
        ):
            target_table = table
            break

    if target_table is None:
        raise RuntimeError("Unable to locate income tax table.")

    # ---------------------------------------------------------
    # Column lookup
    # ---------------------------------------------------------

    header_index = {
        th.get_text(" ", strip=True): i
        for i, th in enumerate(
            target_table.find("thead").find_all("th")
        )
        if th.get_text(" ", strip=True) != ""
    }

    # ---------------------------------------------------------
    # Parse rows
    # ---------------------------------------------------------

    top_rates = {}
    current_state = None

    tbody = target_table.find("tbody")

    for tr in tbody.find_all("tr"):

        tds = tr.find_all("td")

        if len(tds) == 0:
            continue

        state_text = tds[
            header_index["State"]
        ].get_text(" ", strip=True)

        rate_text = tds[
            header_index["Single Filer (Rates)"]
        ].get_text(" ", strip=True)

        # Ignore formatting rows (e.g. Iowa blank row)
        if rate_text == "":
            continue

        # New state
        if not state_text.startswith("-"):

            current_state = re.sub(
                r"\s*\(.*?\)$",
                "",
                state_text
            ).strip()

            if "Washington" in current_state:
                print(repr(current_state))

            # Match the naming used by Open-Meteo
            normalized = (
                current_state
                .replace(".", "")
                .replace(",", "")
                .upper()
            )

            if "WASHINGTON" in normalized and "DC" in normalized:
                current_state = "District of Columbia"

        state = current_state

        # Convert rate
        if rate_text.lower() == "none":
            rate = 0.0
        elif "capital gains" in rate_text.lower():
            rate = 0.0
        else:
            rate = parse_percentage(rate_text)

        if rate is None:
            print(
                f"Skipping unparsable rate '{rate_text}' "
                f"for {state}"
            )
            continue

        # Keep highest marginal rate
        top_rates[state] = max(
            top_rates.get(state, 0.0),
            rate
        )

    # ---------------------------------------------------------
    # Convert to DataFrame
    # ---------------------------------------------------------

    rows = []

    for state in sorted(top_rates):

        rows.append({
            "state_province": state,
            "country": "United States",
            "state_income_tax_rate": top_rates[state],
            "state_income_tax_basis": "Top marginal rate",
            "state_income_tax_source_url": url
        })

    df = pd.DataFrame(rows)

    print(f"Loaded {len(df)} states.")

    return df

# ============================================================
# STEP 5: CANADIAN PROVINCIAL SALES TAX
# ============================================================

def scrape_canadian_sales_tax():

    url = (
        "https://www.canada.ca/en/revenue-agency/services/tax/"
        "businesses/topics/gst-hst-businesses/charge-collect-which-rate/"
        "calculator.html"
    )

    response = requests.get(
        url,
        headers=HEADERS,
        timeout=60,
    )

    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # ---------------------------------------------------------
    # Locate the correct table by its headers
    # ---------------------------------------------------------

    target_table = None

    required_headers = {
        "Province",
        "GST and HST",
        "PST",
    }

    for table in soup.find_all("table"):

        headers = {
            th.get_text(" ", strip=True)
            for th in table.find_all("th")
        }

        if required_headers.issubset(headers):
            target_table = table
            break

    if target_table is None:
        raise RuntimeError(
            "Unable to locate the Canadian GST/HST and PST table."
        )

    # ---------------------------------------------------------
    # Build header-to-column lookup
    # ---------------------------------------------------------

    thead = target_table.find("thead")

    if thead is None:
        raise RuntimeError(
            "Canadian sales-tax table does not contain a thead."
        )

    header_index = {
        th.get_text(" ", strip=True): i
        for i, th in enumerate(thead.find_all("th"))
        if th.get_text(" ", strip=True)
    }

    # ---------------------------------------------------------
    # Parse table rows
    # ---------------------------------------------------------

    rows = []

    tbody = target_table.find("tbody")

    if tbody is None:
        raise RuntimeError(
            "Canadian sales-tax table does not contain a tbody."
        )

    for tr in tbody.find_all("tr"):

        cells = tr.find_all(["td", "th"])

        if len(cells) < len(header_index):
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

        if not province:
            continue

        gst_hst_rate = parse_percentage(gst_hst_text)

        # N/A means the province uses HST rather than a separate PST
        if pst_text.strip().lower() in {
            "",
            "n/a",
            "na",
            "none",
            "not applicable",
        }:
            pst_rate = 0.0
            separate_pst_applies = False
        else:
            pst_rate = parse_percentage(pst_text)
            separate_pst_applies = True

        if gst_hst_rate is None:
            print(
                f"Skipping {province}: unable to parse "
                f"GST/HST rate '{gst_hst_text}'"
            )
            continue

        if pst_rate is None:
            print(
                f"Skipping {province}: unable to parse "
                f"PST rate '{pst_text}'"
            )
            continue

        # Where PST is N/A, GST and HST already contains the full HST rate.
        # Otherwise, combine GST with the separate provincial PST.
        combined_sales_tax_rate = gst_hst_rate + pst_rate

        tax_structure = (
            "GST + PST"
            if separate_pst_applies
            else "HST"
        )

        rows.append({
            "state_province": province,
            "country": "Canada",
            "gst_hst_rate": gst_hst_rate,
            "pst_rate": pst_rate,
            "combined_sales_tax_rate": combined_sales_tax_rate,
            "sales_tax_structure": tax_structure,
            "sales_tax_source_url": url,
        })

    df = pd.DataFrame(rows)

    if df.empty:
        raise RuntimeError(
            "Canadian sales-tax table was found, but no rows were parsed."
        )

    df = (
        df
        .sort_values("state_province")
        .reset_index(drop=True)
    )

    print(f"Loaded Canadian sales-tax rates for {len(df)} provinces and territories.")

    return df

# ============================================================
# STEP 6: CANADIAN PROVINCIAL INCOME TAX
# ============================================================

def scrape_quebec_top_income_tax_rate() -> float:
    """
    Scrape Quebec's top provincial marginal income-tax rate.
    """

    html = download_html(
        QUEBEC_INCOME_TAX_URL
    )

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    table = soup.find("table")

    if table is None:
        raise RuntimeError(
            "Quebec income-tax table not found."
        )

    tbody = table.find("tbody")

    if tbody is None:
        raise RuntimeError(
            "Quebec income-tax table has no tbody."
        )

    rates = []

    for tr in tbody.find_all("tr"):

        cells = tr.find_all("td")

        if len(cells) < 2:
            continue

        rate = parse_percentage(
            cells[1].get_text(
                " ",
                strip=True,
            )
        )

        if rate is not None:
            rates.append(rate)

    if not rates:
        raise RuntimeError(
            "No Quebec income-tax rates found."
        )

    return max(rates)


def scrape_canadian_provincial_income_tax() -> pd.DataFrame:
    """
    Scrape top provincial marginal income-tax rates.
    Uses the CRA for all provinces except Quebec,
    which is published separately by Revenu Québec.
    """

    html = download_html(
        CANADA_INCOME_TAX_URL
    )

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    rows = []

    for details in soup.find_all("details"):

        summary = details.find("summary")

        if summary is None:
            continue

        province = summary.get_text(
            " ",
            strip=True,
        )

        if province == "":
            continue

        # CRA links Quebec to Revenu Québec instead
        if province == "Quebec":
            continue

        table = details.find("table")

        if table is None:
            continue

        tbody = table.find("tbody")

        if tbody is None:
            continue

        rates = []

        for tr in tbody.find_all("tr"):

            cells = tr.find_all("td")

            if len(cells) < 3:
                continue

            rate = parse_percentage(
                cells[2].get_text(
                    " ",
                    strip=True,
                )
            )

            if rate is not None:
                rates.append(rate)

        if not rates:
            print(
                f"Warning: no income-tax rates found for {province}"
            )
            continue

        rows.append(
            {
                "state_province": province,
                "country": "Canada",
                "state_income_tax_rate": max(rates),
                "state_income_tax_basis": "Top marginal statutory rate",
                "state_income_tax_source_url": CANADA_INCOME_TAX_URL,
            }
        )

    # Add Quebec separately
    rows.append(
        {
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
        }
    )

    df = pd.DataFrame(rows)

    df = (
        df
        .sort_values("state_province")
        .reset_index(drop=True)
    )

    print(
        f"Loaded {len(df)} Canadian provinces/territories."
    )

    return df

# ============================================================
# STEP 7: FEDERAL TOP MARGINAL RATES
# ============================================================

def scrape_us_federal_top_rate() -> float:
    """
    Extract the US top federal marginal individual income-tax rate.
    """
    html = download_html(
        US_FEDERAL_TAX_URL
    )

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    text = soup.get_text(
        " ",
        strip=True,
    )

    patterns = [
        r"top tax rate remains\s+(\d+(?:\.\d+)?)\s*%",
        r"top tax rate(?:\s+is)?\s+(\d+(?:\.\d+)?)\s*%",
        r"top marginal(?: income)? tax rate(?:\s+is)?\s+"
        r"(\d+(?:\.\d+)?)\s*%",
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        )

        if match:
            return float(match.group(1))

    # Safe fallback: only consider standard US bracket rates.
    candidates = [
        rate
        for rate in find_all_percentages(text)
        if rate in {
            10.0,
            12.0,
            22.0,
            24.0,
            32.0,
            35.0,
            37.0,
        }
    ]

    if not candidates:
        raise RuntimeError(
            "US federal top marginal rate not found."
        )

    return max(candidates)


def scrape_canada_federal_top_rate() -> float:
    """
    Extract Canada's top federal marginal individual income-tax rate.
    """

    html = download_html(
        CANADA_FEDERAL_TAX_URL
    )

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    # Find the Federal rate table
    target_table = None

    for table in soup.find_all("table"):

        caption = table.find("caption")

        if (
            caption is not None
            and "Federal rate" in caption.get_text(" ", strip=True)
        ):
            target_table = table
            break

    if target_table is None:
        raise RuntimeError(
            "Federal income tax table not found."
        )

    rates = []

    tbody = target_table.find("tbody")

    if tbody is None:
        raise RuntimeError(
            "Federal income tax table has no tbody."
        )

    for tr in tbody.find_all("tr"):

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
            "No federal tax rates found."
        )

    return max(rates)


def get_federal_tax_rates() -> pd.DataFrame:
    """Create a two-country federal-rate lookup."""
    return pd.DataFrame(
        [
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
        ]
    )


# ============================================================
# STEP 8: BUILD FINAL DATASET
# ============================================================

def build_city_tax_dataset() -> pd.DataFrame:
    """Run all collection steps and join the datasets."""

    print("Pulling NHL cities...")
    cities_df = get_nhl_cities()

    print(f"Found {len(cities_df)} distinct venue cities.")

    print("Geocoding NHL cities...")
    geocoded_df = geocode_cities(cities_df)

    not_found = geocoded_df[
        geocoded_df["geocode_status"] != "FOUND"
    ]

    if not not_found.empty:
        print("\nGeocoding failures:")
        print(
            not_found[
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

    print("Scraping Canadian provincial income-tax rates...")
    canada_income_df = scrape_canadian_provincial_income_tax()

    print("Scraping federal income-tax rates...")
    federal_df = get_federal_tax_rates()

    # ---------------------------------------------------------
    # Combine lookup tables
    # ---------------------------------------------------------

    sales_tax_df = pd.concat(
        [
            us_sales_df,
            canada_sales_df,
        ],
        ignore_index=True,
    )

    income_tax_df = pd.concat(
        [
            us_income_df,
            canada_income_df,
        ],
        ignore_index=True,
    )

    # Safety checks
    assert not sales_tax_df.duplicated(
        ["country", "state_province"]
    ).any()

    assert not income_tax_df.duplicated(
        ["country", "state_province"]
    ).any()

    # ---------------------------------------------------------
    # Join onto cities
    # ---------------------------------------------------------

    final_df = geocoded_df.merge(
        sales_tax_df,
        how="left",
        on=[
            "country",
            "state_province",
        ],
        validate="many_to_one",
    )

    final_df = final_df.merge(
        income_tax_df,
        how="left",
        on=[
            "country",
            "state_province",
        ],
        validate="many_to_one",
    )

    final_df = final_df.merge(
        federal_df,
        how="left",
        on="country",
        validate="many_to_one",
    )

    # ---------------------------------------------------------
    # Metadata
    # ---------------------------------------------------------

    final_df["scrape_datetime"] = datetime.now(
        timezone.utc
    )

    final_df["tax_year"] = (
        final_df["scrape_datetime"].dt.year
    )

    final_df["income_tax_rate_basis"] = (
        "Top marginal statutory rate"
    )

    # ---------------------------------------------------------
    # Convert numeric columns
    # ---------------------------------------------------------

    rate_columns = [
        "sales_tax_state_rate",
        "sales_tax_average_local_rate",
        "federal_gst_rate",
        "pst_rate",
        "hst_rate",
        "combined_sales_tax_rate",
        "state_income_tax_rate",
        "federal_income_tax_top_rate",
    ]

    for column in rate_columns:

        if column in final_df.columns:

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

    # ---------------------------------------------------------
    # Validation
    # ---------------------------------------------------------

    missing_sales = final_df[
        final_df["combined_sales_tax_rate"].isna()
    ]

    if not missing_sales.empty:

        print("\nWARNING: Missing sales tax")

        print(
            missing_sales[
                [
                    "venueLocation",
                    "state_province",
                ]
            ].to_string(index=False)
        )

    missing_income = final_df[
        final_df["state_income_tax_rate"].isna()
    ]

    if not missing_income.empty:

        print("\nWARNING: Missing income tax")

        print(
            missing_income[
                [
                    "venueLocation",
                    "state_province",
                ]
            ].to_string(index=False)
        )

    # ---------------------------------------------------------
    # Final column order
    # ---------------------------------------------------------

    preferred_columns = [

        # City
        "venueLocation",
        "geocoded_city",
        "state_province",
        "country",
        "country_code",
        "latitude",
        "longitude",

        # Sales tax
        "combined_sales_tax_rate",
        "sales_tax_state_rate",
        "sales_tax_average_local_rate",
        "federal_gst_rate",
        "pst_rate",
        "hst_rate",

        # Income tax
        "state_income_tax_rate",
        "federal_income_tax_top_rate",
        "combined_top_marginal_income_tax_rate",

        # Metadata
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

    existing_columns = [
        column
        for column in preferred_columns
        if column in final_df.columns
    ]

    return (
        final_df[existing_columns]
        .sort_values(
            [
                "country",
                "state_province",
                "venueLocation",
            ]
        )
        .reset_index(drop=True)
    )

# ============================================================
# STEP 9: VALIDATION AND BIGQUERY LOAD
# ============================================================

def validate_final_dataset(df: pd.DataFrame):
    """Raise an error if important values are missing."""

    required_columns = [
        "state_province",
        "country",
        "combined_sales_tax_rate",
        "state_income_tax_rate",
        "federal_income_tax_top_rate",
    ]

    failures = df[
        df[required_columns].isna().any(axis=1)
    ]

    if not failures.empty:

        print("\nRows with missing tax data:")

        print(
            failures[
                required_columns + ["venueLocation"]
            ].to_string(index=False)
        )

        raise ValueError(
            f"{len(failures)} rows have missing tax values."
        )

    print("\nValidation passed.")


def load_to_bigquery(
    df: pd.DataFrame,
) -> None:
    """Append the final dataset to BigQuery."""
    job_config = bigquery.LoadJobConfig(
        write_disposition=(
            bigquery.WriteDisposition.WRITE_APPEND
        ),
        schema_update_options=[
            bigquery.SchemaUpdateOption.ALLOW_FIELD_ADDITION,
        ],
    )

    load_job = client.load_table_from_dataframe(
        df,
        TAX_TABLE,
        job_config=job_config,
    )

    load_job.result()

    print(
        f"Loaded {len(df)} rows into {TAX_TABLE}."
    )


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    city_tax_df = build_city_tax_dataset()

    print("\nFinal dataset:")
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

    validate_final_dataset(city_tax_df)

#    load_to_bigquery(city_tax_df)

