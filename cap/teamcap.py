import asyncio
import re
from datetime import datetime, timezone

import pandas as pd
from bs4 import BeautifulSoup
from google.cloud import bigquery
from playwright.async_api import async_playwright


# =====================================================================
# CONFIG
# =====================================================================

PROJECT_ID = "pacey32-agency"
DATASET_ID = "Cap"
TABLE_ID = "Team"

FULL_TABLE_ID = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"

BASE_URL = "https://puckpedia.com"
TEAMS_URL = f"{BASE_URL}/teams"

EXPECTED_TEAM_COUNT = 32


# =====================================================================
# HELPERS
# =====================================================================

def clean_column_name(name):
    """
    Convert a PuckPedia table heading into a BigQuery-friendly
    snake_case column name.
    """

    name = name.strip().lower()

    replacements = {
        "proj cap hit": "projected_cap_hit",
        "proj cap space": "projected_cap_space",
        "current space": "current_cap_space",
        "deadline space": "deadline_cap_space",
        "dead space": "dead_cap_space",
        "active roster": "active_roster",
        "retained left": "retained_salary_remaining",
        "contracts": "contracts",
        "2027 draft value": "draft_pick_value_2027",
        "average age": "average_age",
        "forwards": "forwards",
        "defense": "defense",
        "goalies": "goalies",
    }

    if name in replacements:
        return replacements[name]

    name = re.sub(r"[^a-z0-9]+", "_", name)
    name = re.sub(r"_+", "_", name)

    return name.strip("_")


def money_to_int(value):
    """
    Convert values such as:
        $112,661,182
        -$8,661,182
        $0
    into integers.
    """

    if value is None:
        return None

    value = str(value).strip()

    if value == "":
        return None

    negative = value.startswith("-")

    value = (
        value
        .replace("$", "")
        .replace(",", "")
        .replace("-", "")
        .strip()
    )

    if value == "":
        return None

    try:
        number = int(float(value))
    except ValueError:
        return None

    return -number if negative else number


def numeric_to_int(value):
    """
    Convert simple integer-like fields such as roster counts/contracts.
    """

    if value is None:
        return None

    value = str(value).strip()

    if value == "":
        return None

    match = re.search(r"-?\d+", value)

    if not match:
        return None

    return int(match.group())


def numeric_to_float(value):
    """
    Convert values such as average age to float.
    """

    if value is None:
        return None

    value = str(value).strip()

    if value == "":
        return None

    match = re.search(r"-?\d+(?:\.\d+)?", value)

    if not match:
        return None

    return float(match.group())


def team_name_from_slug(slug):
    """
    Convert:
        toronto-maple-leafs
    into:
        Toronto Maple Leafs
    """

    return " ".join(
        part.capitalize()
        for part in slug.split("-")
    )


# =====================================================================
# PLAYWRIGHT
# =====================================================================

async def get_html(url):
    """
    Fetch rendered HTML using Chromium.
    """

    print(f"Loading: {url}")

    async with async_playwright() as p:

        browser = await p.chromium.launch(
            headless=True
        )

        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 "
                "(Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 "
                "(KHTML, like Gecko) "
                "Chrome/138.0.0.0 "
                "Safari/537.36"
            ),
            locale="en-GB",
        )

        page = await context.new_page()

        response = await page.goto(
            url,
            wait_until="domcontentloaded",
            timeout=60000,
        )

        if response is not None:
            print(f"HTTP status: {response.status}")

        await page.wait_for_selector(
            "table.pp_table-teams",
            timeout=60000,
        )

        html = await page.content()

        await context.close()
        await browser.close()

        if "Just a moment..." in html:
            raise RuntimeError(
                "Cloudflare challenge page returned instead of PuckPedia."
            )

        return html


# =====================================================================
# PARSE TEAMS TABLE
# =====================================================================

def parse_team_table(html):
    """
    Parse the main PuckPedia teams salary-cap table.
    """

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    table = soup.select_one(
        "table.pp_table-teams"
    )

    if table is None:
        raise ValueError(
            "Could not locate the PuckPedia teams table."
        )

    # -----------------------------------------------------------------
    # Read headers
    # -----------------------------------------------------------------

    raw_headers = []

    for th in table.select("thead th"):
        raw_headers.append(
            th.get_text(
                " ",
                strip=True,
            )
        )

    print("\nPuckPedia headers:")
    for i, header in enumerate(raw_headers):
        print(f"  {i}: {header!r}")

    records = []

    # -----------------------------------------------------------------
    # Parse rows
    # -----------------------------------------------------------------

    for row in table.select("tbody > tr"):

        team_link = row.select_one(
            'a[href^="/team/"]'
        )

        if team_link is None:
            continue

        relative_url = team_link.get(
            "href",
            "",
        ).strip()

        if not relative_url:
            continue

        team_slug = (
            relative_url
            .rstrip("/")
            .split("/")[-1]
        )

        team_name = team_name_from_slug(
            team_slug
        )

        cells = row.find_all(
            "td",
            recursive=False,
        )

        # Fallback in case td elements are nested unexpectedly
        if not cells:
            cells = row.find_all("td")

        values = []

        for td in cells:

            # PuckPedia provides the exact, non-rounded value here
            exact_value = td.get(
                "data-extract_ch"
            )

            if exact_value not in (
                None,
                "",
            ):
                values.append(
                    exact_value.strip()
                )

            else:
                values.append(
                    td.get_text(
                        " ",
                        strip=True,
                    )
                )

        record = {
            "team_slug": team_slug,
            "team_name": team_name,
            "url": (
                BASE_URL
                + relative_url
            ),
        }

        for header, value in zip(
            raw_headers,
            values,
        ):

            cleaned_header = (
                clean_column_name(header)
            )

            if not cleaned_header:
                continue

            record[cleaned_header] = value

        records.append(record)

    if not records:
        raise ValueError(
            "Teams table was found but no team rows were extracted."
        )

    df = pd.DataFrame(records)

    return df


# =====================================================================
# CLEAN DATA
# =====================================================================

def clean_team_dataframe(df):
    """
    Standardise columns and types before loading to BigQuery.
    """

    print(
        f"\nRaw rows extracted: {len(df)}"
    )

    # -----------------------------------------------------------------
    # Required columns
    # -----------------------------------------------------------------

    required_columns = [
        "team_slug",
        "team_name",
        "url",
        "projected_cap_hit",
        "projected_cap_space",
        "current_cap_space",
        "deadline_cap_space",
        "dead_cap_space",
        "active_roster",
        "retained_salary_remaining",
        "contracts",
        "draft_pick_value_2027",
        "average_age",
        "forwards",
        "defense",
        "goalies",
    ]

    missing = [
        col
        for col in required_columns
        if col not in df.columns
    ]

    if missing:
        print(
            "\nAvailable columns:"
        )
        print(
            sorted(df.columns.tolist())
        )

        raise ValueError(
            "Expected columns missing from "
            f"PuckPedia table: {missing}"
        )

    # -----------------------------------------------------------------
    # Money columns
    # -----------------------------------------------------------------

    money_columns = [
        "projected_cap_hit",
        "projected_cap_space",
        "current_cap_space",
        "deadline_cap_space",
        "dead_cap_space",
    ]

    for col in money_columns:
        df[col] = (
            df[col]
            .apply(money_to_int)
            .astype("Int64")
        )

    # -----------------------------------------------------------------
    # Integer columns
    # -----------------------------------------------------------------

    integer_columns = [
        "active_roster",
        "retained_salary_remaining",
        "contracts",
        "draft_pick_value_2027",
        "forwards",
        "defense",
        "goalies",
    ]

    for col in integer_columns:
        df[col] = (
            df[col]
            .apply(numeric_to_int)
            .astype("Int64")
        )

    # -----------------------------------------------------------------
    # Float columns
    # -----------------------------------------------------------------

    df["average_age"] = (
        df["average_age"]
        .apply(numeric_to_float)
        .astype("Float64")
    )

    # -----------------------------------------------------------------
    # Metadata
    # -----------------------------------------------------------------

    df["last_updated"] = datetime.now(
        timezone.utc
    )

    # -----------------------------------------------------------------
    # Final schema/order
    # -----------------------------------------------------------------

    df = df[
        [
            "team_slug",
            "team_name",
            "url",
            "projected_cap_hit",
            "projected_cap_space",
            "current_cap_space",
            "deadline_cap_space",
            "dead_cap_space",
            "active_roster",
            "retained_salary_remaining",
            "contracts",
            "draft_pick_value_2027",
            "average_age",
            "forwards",
            "defense",
            "goalies",
            "last_updated",
        ]
    ].copy()

    # -----------------------------------------------------------------
    # QA
    # -----------------------------------------------------------------

    if df["team_slug"].duplicated().any():

        duplicates = df.loc[
            df["team_slug"].duplicated(
                keep=False
            ),
            [
                "team_slug",
                "team_name",
            ],
        ]

        raise ValueError(
            "Duplicate teams found:\n"
            f"{duplicates}"
        )

    if len(df) != EXPECTED_TEAM_COUNT:
        raise ValueError(
            f"Expected {EXPECTED_TEAM_COUNT} teams "
            f"but extracted {len(df)}."
        )

    return df


# =====================================================================
# BIGQUERY
# =====================================================================

def upload_to_bigquery(df):
    """
    Replace pacey32-agency.Cap.Team with the refreshed dataset.
    """

    print(
        f"\nUploading to {FULL_TABLE_ID}..."
    )

    client = bigquery.Client(
        project=PROJECT_ID
    )

    schema = [
        bigquery.SchemaField(
            "team_slug",
            "STRING",
            mode="REQUIRED",
        ),
        bigquery.SchemaField(
            "team_name",
            "STRING",
            mode="REQUIRED",
        ),
        bigquery.SchemaField(
            "url",
            "STRING",
            mode="REQUIRED",
        ),
        bigquery.SchemaField(
            "projected_cap_hit",
            "INTEGER",
        ),
        bigquery.SchemaField(
            "projected_cap_space",
            "INTEGER",
        ),
        bigquery.SchemaField(
            "current_cap_space",
            "INTEGER",
        ),
        bigquery.SchemaField(
            "deadline_cap_space",
            "INTEGER",
        ),
        bigquery.SchemaField(
            "dead_cap_space",
            "INTEGER",
        ),
        bigquery.SchemaField(
            "active_roster",
            "INTEGER",
        ),
        bigquery.SchemaField(
            "retained_salary_remaining",
            "INTEGER",
        ),
        bigquery.SchemaField(
            "contracts",
            "INTEGER",
        ),
        bigquery.SchemaField(
            "draft_pick_value_2027",
            "INTEGER",
        ),
        bigquery.SchemaField(
            "average_age",
            "FLOAT",
        ),
        bigquery.SchemaField(
            "forwards",
            "INTEGER",
        ),
        bigquery.SchemaField(
            "defense",
            "INTEGER",
        ),
        bigquery.SchemaField(
            "goalies",
            "INTEGER",
        ),
        bigquery.SchemaField(
            "last_updated",
            "TIMESTAMP",
            mode="REQUIRED",
        ),
    ]

    job_config = (
        bigquery.LoadJobConfig(
            schema=schema,
            write_disposition=(
                bigquery.WriteDisposition.WRITE_TRUNCATE
            ),
        )
    )

    job = client.load_table_from_dataframe(
        df,
        FULL_TABLE_ID,
        job_config=job_config,
    )

    job.result()

    table = client.get_table(
        FULL_TABLE_ID
    )

    print(
        f"Upload complete: "
        f"{table.num_rows} rows."
    )


# =====================================================================
# MAIN
# =====================================================================

async def main():

    print("=" * 70)
    print("PUCKPEDIA TEAM CAP PIPELINE")
    print("=" * 70)

    print(
        f"Source: {TEAMS_URL}"
    )

    print(
        f"Target: {FULL_TABLE_ID}"
    )

    print()

    # -----------------------------------------------------------------
    # Fetch
    # -----------------------------------------------------------------

    html = await get_html(
        TEAMS_URL
    )

    # -----------------------------------------------------------------
    # Parse
    # -----------------------------------------------------------------

    df = parse_team_table(
        html
    )

    # -----------------------------------------------------------------
    # Clean / QA
    # -----------------------------------------------------------------

    df = clean_team_dataframe(
        df
    )

    print(
        f"\n{len(df)} NHL teams ready for upload."
    )

    print()

    print(
        df[
            [
                "team_slug",
                "team_name",
                "projected_cap_hit",
                "projected_cap_space",
                "active_roster",
                "contracts",
                "average_age",
            ]
        ]
        .to_string(
            index=False
        )
    )

    # -----------------------------------------------------------------
    # Upload
    # -----------------------------------------------------------------

    upload_to_bigquery(
        df
    )

    print()
    print("=" * 70)
    print("PIPELINE COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())