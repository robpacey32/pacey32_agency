"""
NHL income-tax bracket pipeline.

Purpose
-------
1. Scrape 2026 US federal income-tax brackets.
2. Scrape 2026 US state income-tax brackets.
3. Scrape 2026 Canadian federal income-tax brackets.
4. Scrape 2026 Canadian provincial income-tax brackets.
5. Scrape Quebec separately.
6. Validate bracket structure.
7. Replace BigQuery City.tax_brackets.

Designed to support the NHL city salary tax calculator.
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
import requests
from bs4 import BeautifulSoup
from google.cloud import bigquery
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# ============================================================
# CONFIG
# ============================================================

PROJECT_ID = os.getenv(
    "GCP_PROJECT",
    "pacey32-agency",
)

TAX_TABLE = os.getenv(
    "TAX_BRACKET_TABLE",
    "pacey32-agency.City.tax_brackets",
)

TAX_YEAR = int(
    os.getenv(
        "TAX_YEAR",
        "2026",
    )
)

REQUEST_TIMEOUT = int(
    os.getenv(
        "REQUEST_TIMEOUT",
        "20",
    )
)

US_FEDERAL_TAX_URL = (
    "https://www.irs.gov/newsroom/"
    "irs-releases-tax-inflation-adjustments-for-tax-year-2026-"
    "including-amendments-from-the-one-big-beautiful-bill"
)

US_STATE_TAX_URL = (
    "https://taxfoundation.org/data/all/state/"
    "state-income-tax-rates-2026/"
)

CANADA_TAX_URLS = [
    (
        "https://www.canada.ca/en/revenue-agency/services/tax/"
        "individuals/tax-rates-brackets/current-year.html"
    ),
    (
        "https://www.canada.ca/en/revenue-agency/services/tax/"
        "individuals/tax-rates-brackets.html"
    ),
]

QUEBEC_TAX_URL = (
    "https://www.revenuquebec.ca/en/citizens/"
    "income-tax-return/completing-your-income-tax-return/"
    "income-tax-rates/"
)

HEADERS = {
    "User-Agent": os.getenv(
        "HTTP_USER_AGENT",
        "pacey32-agency-tax-brackets/1.0",
    )
}

OUTPUT_COLUMNS = [
    "tax_year",
    "country_code",
    "country",
    "jurisdiction",
    "jurisdiction_type",
    "filing_status",
    "bracket_min",
    "bracket_max",
    "tax_rate",
    "source_url",
    "scrape_datetime",
]

BQ_SCHEMA = [
    bigquery.SchemaField(
        "tax_year",
        "INTEGER",
    ),
    bigquery.SchemaField(
        "country_code",
        "STRING",
    ),
    bigquery.SchemaField(
        "country",
        "STRING",
    ),
    bigquery.SchemaField(
        "jurisdiction",
        "STRING",
    ),
    bigquery.SchemaField(
        "jurisdiction_type",
        "STRING",
    ),
    bigquery.SchemaField(
        "filing_status",
        "STRING",
    ),
    bigquery.SchemaField(
        "bracket_min",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "bracket_max",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "tax_rate",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "source_url",
        "STRING",
    ),
    bigquery.SchemaField(
        "scrape_datetime",
        "TIMESTAMP",
    ),
]


# ============================================================
# CLIENTS
# ============================================================

def create_http_session() -> requests.Session:
    retry = Retry(
        total=2,
        connect=2,
        read=2,
        status=2,
        backoff_factor=1.5,
        status_forcelist=(
            429,
            500,
            502,
            503,
            504,
        ),
        allowed_methods=frozenset(
            {"GET"}
        ),
        respect_retry_after_header=True,
    )

    adapter = HTTPAdapter(
        max_retries=retry
    )

    session = requests.Session()

    session.headers.update(
        HEADERS
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


HTTP = create_http_session()

BQ = bigquery.Client(
    project=PROJECT_ID
)


# ============================================================
# HELPERS
# ============================================================

def clean_text(
    value: object,
) -> str:
    if (
        value is None
        or pd.isna(value)
    ):
        return ""

    return re.sub(
        r"\s+",
        " ",
        str(value),
    ).strip()


def get_html(
    url: str,
) -> str:
    """
    Fetch HTML.

    Canada.ca deliberately uses a plain requests.get()
    call with no custom headers/session. Direct testing
    showed this is reliable while the custom session
    intermittently hangs against Canada.ca.
    """

    print(
        f"Fetching: {url}"
    )

    if "canada.ca" in url:
        response = requests.get(
            url,
            timeout=REQUEST_TIMEOUT,
        )
    else:
        response = HTTP.get(
            url,
            timeout=REQUEST_TIMEOUT,
        )

    print(
        f"  HTTP {response.status_code}"
    )

    response.raise_for_status()

    if len(response.text) < 500:
        raise RuntimeError(
            f"Unexpectedly short response from {url}"
        )

    return response.text


def get_canada_tax_page(
) -> tuple[str, str]:
    """
    Try each CRA URL.

    Return both URL and HTML from the first successful
    request so Canada.ca is fetched only once.
    """

    errors: list[str] = []

    for url in CANADA_TAX_URLS:
        print(
            f"Trying: {url}"
        )

        try:
            response = requests.get(
                url,
                timeout=REQUEST_TIMEOUT,
            )

            print(
                f"  HTTP {response.status_code}"
            )

            response.raise_for_status()

            if len(response.text) < 500:
                raise RuntimeError(
                    f"Unexpectedly short response from {url}"
                )

            print(
                "  Using this URL."
            )

            return (
                url,
                response.text,
            )

        except (
            requests.RequestException,
            RuntimeError,
        ) as exc:
            print(
                f"  Failed: {exc}"
            )

            errors.append(
                f"{url}: {exc}"
            )

    raise RuntimeError(
        "No working Canadian tax URL found:\n"
        + "\n".join(errors)
    )


def parse_percentage(
    value: object,
) -> Optional[float]:
    text = clean_text(
        value
    )

    match = re.search(
        r"(-?\d+(?:\.\d+)?)\s*%",
        text,
    )

    if not match:
        return None

    return float(
        match.group(1)
    )


def parse_money(
    value: object,
) -> Optional[float]:
    text = clean_text(
        value
    ).lower()

    if not text:
        return None

    matches = re.findall(
        r"\$?\s*([\d,]+(?:\.\d+)?)",
        text,
    )

    if not matches:
        return None

    return float(
        matches[-1].replace(
            ",",
            "",
        )
    )


def normalize_state_name(
    value: str,
) -> str:
    value = clean_text(
        value
    )

    value = re.sub(
        r"^\-\s*",
        "",
        value,
    )

    value = re.sub(
        r"\s*\([^)]*\)\s*$",
        "",
        value,
    )

    normalized = re.sub(
        r"[^A-Z]",
        "",
        value.upper(),
    )

    if normalized == "WASHINGTONDC":
        return "District of Columbia"

    return value.strip()


def build_brackets(
    starts: list[float],
    rates: list[float],
) -> list[
    tuple[
        float,
        Optional[float],
        float,
    ]
]:
    if len(starts) != len(rates):
        raise ValueError(
            "Bracket starts and rates differ in length."
        )

    pairs = sorted(
        zip(
            starts,
            rates,
        ),
        key=lambda x: x[0],
    )

    result = []

    for index, (
        start,
        rate,
    ) in enumerate(pairs):

        bracket_max = (
            pairs[index + 1][0]
            if index + 1 < len(pairs)
            else None
        )

        result.append(
            (
                float(start),
                (
                    float(bracket_max)
                    if bracket_max is not None
                    else None
                ),
                float(rate),
            )
        )

    return result


# ============================================================
# US FEDERAL
# ============================================================

def scrape_us_federal_brackets(
) -> pd.DataFrame:

    # Confirm official IRS source is still available.
    get_html(
        US_FEDERAL_TAX_URL
    )

    starts = [
        0,
        12400,
        50400,
        105700,
        201775,
        256225,
        640600,
    ]

    rates = [
        10.0,
        12.0,
        22.0,
        24.0,
        32.0,
        35.0,
        37.0,
    ]

    rows = []

    for (
        bracket_min,
        bracket_max,
        rate,
    ) in build_brackets(
        starts,
        rates,
    ):
        rows.append({
            "tax_year": TAX_YEAR,
            "country_code": "US",
            "country": "United States",
            "jurisdiction": "Federal",
            "jurisdiction_type": "Federal",
            "filing_status": "Single",
            "bracket_min": bracket_min,
            "bracket_max": bracket_max,
            "tax_rate": rate,
            "source_url": US_FEDERAL_TAX_URL,
        })

    return pd.DataFrame(
        rows
    )


# ============================================================
# US STATES
# ============================================================

def scrape_us_state_brackets(
) -> pd.DataFrame:

    soup = BeautifulSoup(
        get_html(
            US_STATE_TAX_URL
        ),
        "html.parser",
    )

    target_table = None

    for table in soup.find_all(
        "table"
    ):
        text = clean_text(
            table.get_text(
                " ",
                strip=True,
            )
        )

        if (
            "Single Filer (Rates)" in text
            and "Single Filer (Brackets)" in text
            and "Standard Deduction" in text
        ):
            target_table = table
            break

    if target_table is None:
        raise RuntimeError(
            "Unable to find US state income-tax table."
        )

    tbody = target_table.find(
        "tbody"
    )

    if tbody is None:
        raise RuntimeError(
            "US state tax table has no tbody."
        )

    raw_rows = []
    current_state = None
    zero_tax_states_added = set()

    for tr in tbody.find_all(
        "tr"
    ):
        cells = tr.find_all(
            "td"
        )

        # Current Tax Foundation structure:
        #
        # 0 State
        # 1 Single filer rate
        # 2 >
        # 3 Single filer bracket
        #
        if len(cells) < 4:
            continue

        state_text = clean_text(
            cells[0].get_text(
                " ",
                strip=True,
            )
        )

        rate_text = clean_text(
            cells[1].get_text(
                " ",
                strip=True,
            )
        )

        bracket_text = clean_text(
            cells[3].get_text(
                " ",
                strip=True,
            )
        )

        if state_text:
            state_text = re.sub(
                r"^-\s*",
                "",
                state_text,
            )

            current_state = (
                normalize_state_name(
                    state_text
                )
            )

        if current_state is None:
            continue

        rate_lower = (
            rate_text.lower()
        )

        # Washington only taxes capital gains,
        # not ordinary NHL salary/wage income.
        if current_state == "Washington":
            if (
                current_state
                not in zero_tax_states_added
            ):
                raw_rows.append({
                    "state": current_state,
                    "start": 0.0,
                    "rate": 0.0,
                })

                zero_tax_states_added.add(
                    current_state
                )

            continue

        # States with no individual wage
        # income tax.
        if rate_lower in {
            "none",
            "n.a.",
            "n/a",
        }:
            if (
                current_state
                not in zero_tax_states_added
            ):
                raw_rows.append({
                    "state": current_state,
                    "start": 0.0,
                    "rate": 0.0,
                })

                zero_tax_states_added.add(
                    current_state
                )

            continue

        if not rate_text:
            continue

        rate = parse_percentage(
            rate_text
        )

        if rate is None:
            continue

        start = parse_money(
            bracket_text
        )

        if start is None:
            continue

        raw_rows.append({
            "state": current_state,
            "start": start,
            "rate": rate,
        })

    raw_df = pd.DataFrame(
        raw_rows
    )

    if raw_df.empty:
        raise RuntimeError(
            "US state tax scrape produced no rows."
        )

    rows = []

    for state, state_df in raw_df.groupby(
        "state"
    ):
        state_df = (
            state_df
            .drop_duplicates(
                [
                    "start",
                    "rate",
                ]
            )
            .sort_values(
                "start"
            )
            .reset_index(
                drop=True
            )
        )

        starts = state_df[
            "start"
        ].tolist()

        rates = state_df[
            "rate"
        ].tolist()

        # Some states have an explicit untaxed
        # income band before the first positive
        # marginal rate.
        ZERO_RATE_INITIAL_BAND_STATES = {
            "Delaware",
            "Idaho",
            "Mississippi",
            "Missouri",
            "North Dakota",
            "Ohio",
            "Oklahoma",
        }

        if (
            state in ZERO_RATE_INITIAL_BAND_STATES
            and starts
            and starts[0] > 0
        ):
            starts.insert(
                0,
                0.0,
            )

            rates.insert(
                0,
                0.0,
            )

        for (
            bracket_min,
            bracket_max,
            rate,
        ) in build_brackets(
            starts,
            rates,
        ):
            rows.append({
                "tax_year": TAX_YEAR,
                "country_code": "US",
                "country": "United States",
                "jurisdiction": state,
                "jurisdiction_type": "State",
                "filing_status": "Single",
                "bracket_min": bracket_min,
                "bracket_max": bracket_max,
                "tax_rate": rate,
                "source_url": US_STATE_TAX_URL,
            })

    return pd.DataFrame(
        rows
    )


# ============================================================
# CANADA FEDERAL
# ============================================================

def scrape_canada_federal_brackets(
    canada_url: str,
    canada_html: str,
) -> pd.DataFrame:

    soup = BeautifulSoup(
        canada_html,
        "html.parser",
    )

    target_table = None

    for table in soup.find_all(
        "table"
    ):
        caption = table.find(
            "caption"
        )

        if caption is None:
            continue

        caption_text = clean_text(
            caption.get_text(
                " ",
                strip=True,
            )
        )

        if "Federal rate" in caption_text:
            target_table = table
            break

    if target_table is None:
        raise RuntimeError(
            "Canadian federal bracket table not found."
        )

    tbody = target_table.find(
        "tbody"
    )

    if tbody is None:
        raise RuntimeError(
            "Canadian federal bracket table has no tbody."
        )

    starts = []
    rates = []

    for tr in tbody.find_all(
        "tr"
    ):
        cells = tr.find_all(
            "td"
        )

        if len(cells) < 3:
            continue

        bracket_text = clean_text(
            cells[0].get_text(
                " ",
                strip=True,
            )
        )

        bracket_min = parse_money(
            bracket_text
        )

        rate = parse_percentage(
            cells[2].get_text(
                " ",
                strip=True,
            )
        )

        if rate is None:
            continue

        if (
            "or less" in bracket_text.lower()
            or "up to" in bracket_text.lower()
        ):
            bracket_min = 0.0

        if bracket_min is None:
            continue

        starts.append(
            bracket_min
        )

        rates.append(
            rate
        )

    if not starts:
        raise RuntimeError(
            "No Canadian federal brackets parsed."
        )

    rows = []

    for (
        bracket_min,
        bracket_max,
        rate,
    ) in build_brackets(
        starts,
        rates,
    ):
        rows.append({
            "tax_year": TAX_YEAR,
            "country_code": "CA",
            "country": "Canada",
            "jurisdiction": "Federal",
            "jurisdiction_type": "Federal",
            "filing_status": "Individual",
            "bracket_min": bracket_min,
            "bracket_max": bracket_max,
            "tax_rate": rate,
            "source_url": canada_url,
        })

    return pd.DataFrame(
        rows
    )


# ============================================================
# CANADIAN PROVINCES
# ============================================================

def scrape_canada_provincial_brackets(
    canada_url: str,
    canada_html: str,
) -> pd.DataFrame:

    soup = BeautifulSoup(
        canada_html,
        "html.parser",
    )

    rows = []

    for details in soup.find_all(
        "details"
    ):
        summary = details.find(
            "summary"
        )

        if summary is None:
            continue

        province = clean_text(
            summary.get_text(
                " ",
                strip=True,
            )
        )

        if not province:
            continue

        if province == "Quebec":
            continue

        table = details.find(
            "table"
        )

        if table is None:
            continue

        tbody = table.find(
            "tbody"
        )

        if tbody is None:
            continue

        starts = []
        rates = []

        for tr in tbody.find_all(
            "tr"
        ):
            cells = tr.find_all(
                "td"
            )

            if len(cells) < 3:
                continue

            bracket_text = clean_text(
                cells[0].get_text(
                    " ",
                    strip=True,
                )
            )

            bracket_min = parse_money(
                bracket_text
            )

            rate = parse_percentage(
                cells[2].get_text(
                    " ",
                    strip=True,
                )
            )

            if rate is None:
                continue

            if (
                "or less" in bracket_text.lower()
                or "up to" in bracket_text.lower()
            ):
                bracket_min = 0.0

            if bracket_min is None:
                continue

            starts.append(
                bracket_min
            )

            rates.append(
                rate
            )

        if not starts:
            continue

        for (
            bracket_min,
            bracket_max,
            rate,
        ) in build_brackets(
            starts,
            rates,
        ):
            rows.append({
                "tax_year": TAX_YEAR,
                "country_code": "CA",
                "country": "Canada",
                "jurisdiction": province,
                "jurisdiction_type": "Province",
                "filing_status": "Individual",
                "bracket_min": bracket_min,
                "bracket_max": bracket_max,
                "tax_rate": rate,
                "source_url": canada_url,
            })

    result = pd.DataFrame(
        rows
    )

    if result.empty:
        raise RuntimeError(
            "Canadian provincial tax scrape produced no rows."
        )

    return result


# ============================================================
# QUEBEC
# ============================================================

def scrape_quebec_brackets(
) -> pd.DataFrame:

    soup = BeautifulSoup(
        get_html(
            QUEBEC_TAX_URL
        ),
        "html.parser",
    )

    target_table = None

    for table in soup.find_all(
        "table"
    ):
        text = clean_text(
            table.get_text(
                " ",
                strip=True,
            )
        )

        if (
            "Taxable income" in text
            and "Rate" in text
            and "54,345" in text
        ):
            target_table = table
            break

    if target_table is None:
        raise RuntimeError(
            "Quebec 2026 income-tax table not found."
        )

    tbody = target_table.find(
        "tbody"
    )

    if tbody is None:
        raise RuntimeError(
            "Quebec tax table has no tbody."
        )

    starts = []
    rates = []

    for tr in tbody.find_all(
        "tr"
    ):
        cells = tr.find_all(
            "td"
        )

        if len(cells) < 2:
            continue

        income_text = clean_text(
            cells[0].get_text(
                " ",
                strip=True,
            )
        )

        rate = parse_percentage(
            cells[1].get_text(
                " ",
                strip=True,
            )
        )

        if rate is None:
            continue

        money_values = re.findall(
            r"\$?\s*([\d,]+(?:\.\d+)?)",
            income_text,
        )

        if not money_values:
            continue

        # First Quebec bracket:
        # "$54,345 or less"
        if "or less" in income_text.lower():
            bracket_min = 0.0

        else:
            # Examples:
            # More than $54,345 but not more than $108,680
            # More than $108,680 but not more than $132,245
            # More than $132,245
            #
            # The FIRST number is the lower threshold.
            bracket_min = float(
                money_values[0].replace(
                    ",",
                    "",
                )
            )

        starts.append(
            bracket_min
        )

        rates.append(
            rate
        )

    if not starts:
        raise RuntimeError(
            "No Quebec tax brackets parsed."
        )

    rows = []

    for (
        bracket_min,
        bracket_max,
        rate,
    ) in build_brackets(
        starts,
        rates,
    ):
        rows.append({
            "tax_year": TAX_YEAR,
            "country_code": "CA",
            "country": "Canada",
            "jurisdiction": "Quebec",
            "jurisdiction_type": "Province",
            "filing_status": "Individual",
            "bracket_min": bracket_min,
            "bracket_max": bracket_max,
            "tax_rate": rate,
            "source_url": QUEBEC_TAX_URL,
        })

    return pd.DataFrame(
        rows
    )


# ============================================================
# BUILD
# ============================================================

def build_dataset(
) -> pd.DataFrame:

    print(
        "Scraping US federal brackets..."
    )

    us_federal = (
        scrape_us_federal_brackets()
    )

    print(
        "Scraping US state brackets..."
    )

    us_states = (
        scrape_us_state_brackets()
    )

    print(
        "Finding Canadian tax source..."
    )

    (
        canada_url,
        canada_html,
    ) = get_canada_tax_page()

    print(
        "Scraping Canadian federal brackets..."
    )

    canada_federal = (
        scrape_canada_federal_brackets(
            canada_url,
            canada_html,
        )
    )

    print(
        "Scraping Canadian provincial brackets..."
    )

    canada_provinces = (
        scrape_canada_provincial_brackets(
            canada_url,
            canada_html,
        )
    )

    print(
        "Scraping Quebec brackets..."
    )

    quebec = (
        scrape_quebec_brackets()
    )

    df = pd.concat(
        [
            us_federal,
            us_states,
            canada_federal,
            canada_provinces,
            quebec,
        ],
        ignore_index=True,
    )

    df[
        "scrape_datetime"
    ] = datetime.now(
        timezone.utc
    )

    return (
        df[
            OUTPUT_COLUMNS
        ]
        .sort_values(
            [
                "country_code",
                "jurisdiction_type",
                "jurisdiction",
                "bracket_min",
            ]
        )
        .reset_index(
            drop=True
        )
    )


# ============================================================
# VALIDATION
# ============================================================

def validate_dataset(
    df: pd.DataFrame,
) -> None:

    if df.empty:
        raise ValueError(
            "Tax bracket dataset is empty."
        )

    required = [
        "tax_year",
        "country_code",
        "jurisdiction",
        "jurisdiction_type",
        "bracket_min",
        "tax_rate",
    ]

    if (
        df[
            required
        ]
        .isna()
        .any()
        .any()
    ):
        bad = df[
            df[
                required
            ]
            .isna()
            .any(
                axis=1
            )
        ]

        raise ValueError(
            "Missing required values:\n"
            + bad.to_string(
                index=False
            )
        )

    duplicates = df.duplicated(
        [
            "tax_year",
            "country_code",
            "jurisdiction",
            "filing_status",
            "bracket_min",
        ],
        keep=False,
    )

    if duplicates.any():
        raise ValueError(
            "Duplicate tax brackets:\n"
            + df[
                duplicates
            ].to_string(
                index=False
            )
        )

    first_brackets = (
        df.groupby(
            [
                "tax_year",
                "country_code",
                "jurisdiction",
            ]
        )[
            "bracket_min"
        ]
        .min()
    )

    bad_first = first_brackets[
        first_brackets != 0
    ]

    if not bad_first.empty:
        raise ValueError(
            "Jurisdictions not beginning at zero:\n"
            + bad_first.to_string()
        )

    invalid_rates = df[
        (
            df[
                "tax_rate"
            ] < 0
        )
        |
        (
            df[
                "tax_rate"
            ] > 100
        )
    ]

    if not invalid_rates.empty:
        raise ValueError(
            "Invalid tax rates:\n"
            + invalid_rates.to_string(
                index=False
            )
        )

    print(
        "Validation passed."
    )


# ============================================================
# BIGQUERY
# ============================================================

def load_to_bigquery(
    df: pd.DataFrame,
) -> None:

    job_config = (
        bigquery.LoadJobConfig(
            schema=BQ_SCHEMA,
            write_disposition=(
                bigquery.WriteDisposition.WRITE_TRUNCATE
            ),
            create_disposition=(
                bigquery.CreateDisposition.CREATE_IF_NEEDED
            ),
        )
    )

    job = BQ.load_table_from_dataframe(
        df,
        TAX_TABLE,
        job_config=job_config,
    )

    job.result()

    print(
        f"Loaded {len(df)} rows "
        f"into {TAX_TABLE}."
    )


# ============================================================
# MAIN
# ============================================================

def main(
) -> None:

    df = build_dataset()

    print(
        "\nTax bracket preview:"
    )

    print(
        df[
            [
                "country_code",
                "jurisdiction",
                "jurisdiction_type",
                "bracket_min",
                "bracket_max",
                "tax_rate",
            ]
        ].to_string(
            index=False
        )
    )

    validate_dataset(
        df
    )

    load_to_bigquery(
        df
    )


if __name__ == "__main__":
    main()