"""
Scrape NHL retired numbers from Wikipedia and upload them to BigQuery.

Output:
    pacey32-agency.Team.RetiredNumbers

Special handling:
    Wayne Gretzky's league-wide retirement is expanded to all 32
    current NHL teams.
"""

from __future__ import annotations

import io
import os
import re
import unicodedata
from datetime import datetime, timezone

import pandas as pd
import requests
from google.cloud import bigquery


# ============================================================
# Configuration
# ============================================================

PROJECT_ID = os.getenv(
    "GCP_PROJECT",
    "pacey32-agency",
)

TEAM_TABLE = (
    f"{PROJECT_ID}.Team.OrganizationDetail"
)

OUTPUT_TABLE = (
    f"{PROJECT_ID}.Team.RetiredNumbers"
)

SOURCE_URL = (
    "https://en.wikipedia.org/wiki/"
    "List_of_National_Hockey_League_retired_numbers"
)

REQUEST_TIMEOUT = 60

USER_AGENT = (
    "pacey32-agency/1.0 "
    "(NHL retired-number educational data pipeline)"
)


# ============================================================
# Output schema
# ============================================================

SCHEMA = [
    bigquery.SchemaField(
        "id",
        "INTEGER",
        mode="REQUIRED",
    ),
    bigquery.SchemaField(
        "tricode",
        "STRING",
        mode="REQUIRED",
    ),
    bigquery.SchemaField(
        "fullName",
        "STRING",
        mode="REQUIRED",
    ),
    bigquery.SchemaField(
        "player_name",
        "STRING",
        mode="REQUIRED",
    ),
    bigquery.SchemaField(
        "jersey_number",
        "INTEGER",
        mode="REQUIRED",
    ),
    bigquery.SchemaField(
        "retirement_date",
        "DATE",
    ),
    bigquery.SchemaField(
        "league_retired",
        "BOOLEAN",
        mode="REQUIRED",
    ),
    bigquery.SchemaField(
        "source_team_name",
        "STRING",
    ),
    bigquery.SchemaField(
        "source_url",
        "STRING",
        mode="REQUIRED",
    ),
    bigquery.SchemaField(
        "scrape_datetime",
        "TIMESTAMP",
        mode="REQUIRED",
    ),
]


OUTPUT_COLUMNS = [
    field.name
    for field in SCHEMA
]


# ============================================================
# Text helpers
# ============================================================

def clean_text(value: object) -> str | None:
    """Clean a scraped text value."""

    if value is None or pd.isna(value):
        return None

    text = str(value)

    text = re.sub(
        r"\[[^\]]*\]",
        "",
        text,
    )

    text = text.replace(
        "\xa0",
        " ",
    )

    text = re.sub(
        r"\s+",
        " ",
        text,
    ).strip()

    return text or None


def normalise_name(value: object) -> str:
    """Normalise a team name for matching."""

    text = clean_text(value) or ""

    text = unicodedata.normalize(
        "NFKD",
        text,
    )

    text = "".join(
        character
        for character in text
        if not unicodedata.combining(character)
    )

    text = text.lower()

    text = text.replace(
        "&",
        "and",
    )

    text = re.sub(
        r"[^a-z0-9]+",
        "",
        text,
    )

    return text


def parse_jersey_number(
    value: object,
) -> int | None:
    """Extract the first integer from a jersey-number field."""

    text = clean_text(value)

    if not text:
        return None

    match = re.search(
        r"\d+",
        text,
    )

    if not match:
        return None

    return int(
        match.group(0)
    )


def parse_retirement_date(
    value: object,
):
    """Convert the retirement date to a Python date."""

    text = clean_text(value)

    if not text:
        return None

    parsed = pd.to_datetime(
        text,
        errors="coerce",
    )

    if pd.isna(parsed):
        return None

    return parsed.date()


# ============================================================
# BigQuery input
# ============================================================

def load_current_teams(
    client: bigquery.Client,
) -> pd.DataFrame:
    """Load all current NHL teams."""

    query = f"""
    SELECT
        id,
        tricode,
        fullName
    FROM `{TEAM_TABLE}`
    WHERE id IS NOT NULL
      AND tricode IS NOT NULL
      AND fullName IS NOT NULL
    ORDER BY fullName
    """

    rows = client.query(
        query
    ).result()

    dataframe = pd.DataFrame(
        [
            dict(row.items())
            for row in rows
        ]
    )

    if dataframe.empty:
        raise RuntimeError(
            f"No teams were loaded from {TEAM_TABLE}."
        )

    if dataframe["id"].duplicated().any():
        raise RuntimeError(
            "Duplicate team IDs found in OrganizationDetail."
        )

    dataframe["team_match_key"] = (
        dataframe["fullName"]
        .map(normalise_name)
    )

    print(
        f"{len(dataframe)} teams loaded from {TEAM_TABLE}"
    )

    return dataframe


# ============================================================
# Wikipedia scrape
# ============================================================

def download_wikipedia_page() -> str:
    """Download the Wikipedia page."""

    response = requests.get(
        SOURCE_URL,
        headers={
            "User-Agent": USER_AGENT,
        },
        timeout=REQUEST_TIMEOUT,
    )

    response.raise_for_status()

    return response.text


def find_retired_numbers_table(
    html: str,
) -> pd.DataFrame:
    """Find the table with Name, Team, No. and Date columns."""

    tables = pd.read_html(
        io.StringIO(html),
    )

    for table in tables:
        table.columns = [
            clean_text(column)
            for column in table.columns
        ]

        columns = set(
            table.columns
        )

        required = {
            "Name",
            "Team",
            "No.",
            "Date",
        }

        if required.issubset(columns):
            return table.copy()

    raise RuntimeError(
        "Could not find the retired-numbers table."
    )


def prepare_scraped_rows(
    raw_table: pd.DataFrame,
) -> pd.DataFrame:
    """Clean and standardise the Wikipedia table."""

    dataframe = raw_table[
        [
            "Name",
            "Team",
            "No.",
            "Date",
        ]
    ].copy()

    dataframe = dataframe.rename(
        columns={
            "Name": "player_name",
            "Team": "source_team_name",
            "No.": "jersey_number",
            "Date": "retirement_date",
        }
    )

    # Wikipedia uses rowspans for players or numbers associated
    # with multiple teams/players. Carry values into subsequent rows.
    dataframe[
        [
            "player_name",
            "source_team_name",
            "jersey_number",
            "retirement_date",
        ]
    ] = dataframe[
        [
            "player_name",
            "source_team_name",
            "jersey_number",
            "retirement_date",
        ]
    ].ffill()

    dataframe["player_name"] = (
        dataframe["player_name"]
        .map(clean_text)
    )

    dataframe["source_team_name"] = (
        dataframe["source_team_name"]
        .map(clean_text)
    )

    dataframe["jersey_number"] = (
        dataframe["jersey_number"]
        .map(parse_jersey_number)
    )

    dataframe["retirement_date"] = (
        dataframe["retirement_date"]
        .map(parse_retirement_date)
    )

    dataframe = dataframe[
        dataframe["player_name"].notna()
        & dataframe["source_team_name"].notna()
        & dataframe["jersey_number"].notna()
    ].copy()

    dataframe["jersey_number"] = (
        dataframe["jersey_number"]
        .astype(int)
    )

    dataframe = dataframe.drop_duplicates(
        subset=[
            "player_name",
            "source_team_name",
            "jersey_number",
            "retirement_date",
        ]
    )

    return dataframe.reset_index(
        drop=True
    )


# ============================================================
# Team matching and Gretzky expansion
# ============================================================

TEAM_NAME_OVERRIDES = {
    normalise_name(
        "Montreal Canadiens"
    ): normalise_name(
        "Montréal Canadiens"
    ),
}


def match_team(
    source_team_name: str,
    teams: pd.DataFrame,
) -> pd.Series:
    """Match one Wikipedia team name to OrganizationDetail."""

    source_key = normalise_name(
        source_team_name
    )

    source_key = TEAM_NAME_OVERRIDES.get(
        source_key,
        source_key,
    )

    matches = teams[
        teams["team_match_key"] == source_key
    ]

    if len(matches) != 1:
        raise RuntimeError(
            "Could not uniquely match Wikipedia team "
            f"'{source_team_name}'. Matches found: {len(matches)}"
        )

    return matches.iloc[0]


def build_output_rows(
    scraped: pd.DataFrame,
    teams: pd.DataFrame,
) -> pd.DataFrame:
    """Build final rows and expand the league-wide retirement."""

    scrape_datetime = datetime.now(
        timezone.utc
    )

    output_rows = []

    for _, source_row in scraped.iterrows():
        source_team_name = source_row[
            "source_team_name"
        ]

        league_retired = (
            normalise_name(source_team_name)
            == normalise_name("All NHL teams")
        )

        if league_retired:
            matched_teams = teams
        else:
            matched_team = match_team(
                source_team_name=source_team_name,
                teams=teams,
            )

            matched_teams = pd.DataFrame(
                [matched_team]
            )

        for _, team in matched_teams.iterrows():
            output_rows.append(
                {
                    "id": int(team["id"]),
                    "tricode": team["tricode"],
                    "fullName": team["fullName"],
                    "player_name": source_row[
                        "player_name"
                    ],
                    "jersey_number": int(
                        source_row["jersey_number"]
                    ),
                    "retirement_date": source_row[
                        "retirement_date"
                    ],
                    "league_retired": league_retired,
                    "source_team_name": (
                        source_team_name
                    ),
                    "source_url": SOURCE_URL,
                    "scrape_datetime": (
                        scrape_datetime
                    ),
                }
            )

    output = pd.DataFrame(
        output_rows,
        columns=OUTPUT_COLUMNS,
    )

    output = output.drop_duplicates(
        subset=[
            "id",
            "player_name",
            "jersey_number",
            "retirement_date",
            "league_retired",
        ]
    )

    output = output.sort_values(
        [
            "fullName",
            "jersey_number",
            "player_name",
        ]
    ).reset_index(
        drop=True
    )

    return output


# ============================================================
# Validation
# ============================================================

def validate_output(
    dataframe: pd.DataFrame,
    teams: pd.DataFrame,
) -> None:
    """Validate the final dataset before upload."""

    if dataframe.empty:
        raise RuntimeError(
            "No retired-number rows were produced."
        )

    required_columns = [
        "id",
        "tricode",
        "fullName",
        "player_name",
        "jersey_number",
        "league_retired",
    ]

    missing_required = dataframe[
        required_columns
    ].isna().any()

    if missing_required.any():
        invalid_columns = (
            missing_required[
                missing_required
            ]
            .index
            .tolist()
        )

        raise RuntimeError(
            "Missing required values in columns: "
            + ", ".join(invalid_columns)
        )

    gretzky = dataframe[
        (dataframe["player_name"] == "Wayne Gretzky")
        & (dataframe["jersey_number"] == 99)
        & dataframe["league_retired"]
    ]

    expected_teams = len(
        teams
    )

    actual_teams = gretzky[
        "id"
    ].nunique()

    if actual_teams != expected_teams:
        raise RuntimeError(
            "Wayne Gretzky league-wide retirement was "
            f"expanded to {actual_teams} teams; "
            f"expected {expected_teams}."
        )

    duplicate_columns = [
        "id",
        "player_name",
        "jersey_number",
        "retirement_date",
        "league_retired",
    ]

    duplicates = dataframe.duplicated(
        subset=duplicate_columns,
        keep=False,
    )

    if duplicates.any():
        raise RuntimeError(
            "Duplicate retired-number rows found:\n"
            + dataframe.loc[
                duplicates,
                duplicate_columns,
            ].to_string(
                index=False
            )
        )


# ============================================================
# Upload
# ============================================================

def upload_to_bigquery(
    client: bigquery.Client,
    dataframe: pd.DataFrame,
) -> None:
    """Replace the BigQuery output table."""

    job_config = bigquery.LoadJobConfig(
        schema=SCHEMA,
        write_disposition=(
            bigquery.WriteDisposition.WRITE_TRUNCATE
        ),
    )

    load_job = client.load_table_from_dataframe(
        dataframe,
        OUTPUT_TABLE,
        job_config=job_config,
    )

    load_job.result()

    table = client.get_table(
        OUTPUT_TABLE
    )

    print(
        f"{table.num_rows} rows uploaded to {OUTPUT_TABLE}"
    )


# ============================================================
# Main
# ============================================================

def main() -> None:
    """Run the retired-numbers pipeline."""

    print("=" * 70)
    print("NHL RETIRED NUMBERS PIPELINE")
    print("=" * 70)
    print(f"Source: {SOURCE_URL}")
    print(f"Output: {OUTPUT_TABLE}")
    print()

    client = bigquery.Client(
        project=PROJECT_ID,
    )

    teams = load_current_teams(
        client
    )

    html = download_wikipedia_page()

    raw_table = find_retired_numbers_table(
        html
    )

    print(
        f"{len(raw_table)} raw Wikipedia rows found"
    )

    scraped = prepare_scraped_rows(
        raw_table
    )

    print(
        f"{len(scraped)} cleaned retirement records found"
    )

    output = build_output_rows(
        scraped=scraped,
        teams=teams,
    )

    validate_output(
        dataframe=output,
        teams=teams,
    )

    league_rows = output[
        "league_retired"
    ].sum()

    print(
        f"{len(output)} final rows produced"
    )
    print(
        f"{league_rows} league-wide rows produced"
    )

    upload_to_bigquery(
        client=client,
        dataframe=output,
    )

    print()
    print("=" * 70)
    print(
        "Retired numbers pipeline completed successfully."
    )
    print("=" * 70)


if __name__ == "__main__":
    main()