"""
Build NHL organisation details from Wikipedia and upload to BigQuery.

Sources:
- NHL arenas
- NHL head coaches
- NHL general managers
- NHL franchise owners
- American Hockey League teams and NHL affiliates
"""

from __future__ import annotations

import os
import re
import time
import unicodedata
from datetime import datetime, timezone
from io import StringIO
from typing import Iterable

import pandas as pd
import requests
from google.cloud import bigquery
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# ============================================================
# Configuration
# ============================================================

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "pacey32-agency")
DATASET_ID = os.getenv("BQ_DATASET_ID", "Team")
TABLE_ID = os.getenv("BQ_TABLE_ID", "OrganizationDetail")
DESTINATION_TABLE = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"

TEAMLIST_SQL = f"""
SELECT *
FROM `{PROJECT_ID}.Team.TeamList`
ORDER BY fullName
"""

URL_ARENAS = (
    "https://en.wikipedia.org/wiki/"
    "List_of_National_Hockey_League_arenas"
)
URL_COACHES = "https://en.wikipedia.org/wiki/List_of_NHL_head_coaches"
URL_GMS = (
    "https://en.wikipedia.org/wiki/"
    "List_of_current_NHL_general_managers"
)
URL_OWNERS = (
    "https://en.wikipedia.org/wiki/"
    "List_of_current_NHL_franchise_owners"
)
URL_AHL = "https://en.wikipedia.org/wiki/American_Hockey_League"
URL_CAPTAINS = (
    "https://en.wikipedia.org/wiki/"
    "List_of_current_NHL_captains_and_alternate_captains"
)

URL_STANLEY_CUPS = (
    "https://en.wikipedia.org/wiki/"
    "List_of_Stanley_Cup_champions"
)

REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "60"))
SCRAPE_DELAY_SECONDS = float(os.getenv("SCRAPE_DELAY_SECONDS", "0.5"))

HEADERS = {
    "User-Agent": (
        "pacey32-agency/1.0 "
        "(NHL organisation data research; contact via GitHub)"
    )
}


# ============================================================
# Helpers
# ============================================================

def normalise_team_name(value: object) -> str | None:
    """Create an accent-insensitive team name for joining sources."""
    if pd.isna(value):
        return None

    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"\[.*?\]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def remove_references(series: pd.Series) -> pd.Series:
    """Remove Wikipedia citation markers and surrounding whitespace."""
    return (
        series.astype("string")
        .str.replace(r"\[.*?\]", "", regex=True)
        .str.replace(r"\s+", " ", regex=True)
        .str.strip()
    )


def flatten_columns(dataframe: pd.DataFrame) -> pd.DataFrame:
    """Flatten pandas MultiIndex columns returned by read_html."""
    dataframe = dataframe.copy()

    if isinstance(dataframe.columns, pd.MultiIndex):
        flattened: list[str] = []

        for column in dataframe.columns:
            parts = [
                str(part).strip()
                for part in column
                if str(part).strip() and not str(part).startswith("Unnamed:")
            ]

            if not parts:
                flattened.append("")
            elif len(set(parts)) == 1:
                flattened.append(parts[0])
            else:
                flattened.append("_".join(parts))

        dataframe.columns = flattened
    else:
        dataframe.columns = [str(column).strip() for column in dataframe.columns]

    return dataframe


def find_column(
    columns: Iterable[str],
    exact: str | None = None,
    startswith: str | None = None,
) -> str:
    """Find a column by exact name or prefix."""
    column_list = list(columns)

    if exact is not None and exact in column_list:
        return exact

    if startswith is not None:
        for column in column_list:
            if column.startswith(startswith):
                return column

    description = exact or f"prefix {startswith!r}"
    raise RuntimeError(f"Required column not found: {description}. Columns: {column_list}")


def build_http_session() -> requests.Session:
    """Create a requests session with retries for transient failures."""
    retry = Retry(
        total=4,
        connect=4,
        read=4,
        status=4,
        backoff_factor=1.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
        respect_retry_after_header=True,
    )

    session = requests.Session()
    session.headers.update(HEADERS)
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.mount("http://", HTTPAdapter(max_retries=retry))
    return session


def read_wikipedia_tables(
    session: requests.Session,
    url: str,
) -> list[pd.DataFrame]:
    """Download a Wikipedia page and return all HTML tables."""
    response = session.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    tables = pd.read_html(StringIO(response.text))

    if not tables:
        raise RuntimeError(f"No HTML tables found at {url}")

    if SCRAPE_DELAY_SECONDS > 0:
        time.sleep(SCRAPE_DELAY_SECONDS)

    return tables


def select_table(
    tables: list[pd.DataFrame],
    required_exact: Iterable[str] = (),
    required_prefixes: Iterable[str] = (),
    label: str = "table",
) -> pd.DataFrame:
    """Locate a table using required column names and prefixes."""
    for index, table in enumerate(tables):
        candidate = flatten_columns(table)
        columns = list(candidate.columns)

        exact_match = all(column in columns for column in required_exact)
        prefix_match = all(
            any(column.startswith(prefix) for column in columns)
            for prefix in required_prefixes
        )

        if exact_match and prefix_match:
            print(f"{label} found (table {index}, {len(candidate)} rows)")
            return candidate

    available = [list(flatten_columns(table).columns) for table in tables]
    raise RuntimeError(
        f"Could not locate {label}. Available table columns: {available}"
    )


def add_source_metadata(
    dataframe: pd.DataFrame,
    prefix: str,
    source_url: str,
    scrape_ts: datetime,
) -> pd.DataFrame:
    dataframe = dataframe.copy()
    dataframe[f"{prefix}_source_url"] = source_url
    dataframe[f"{prefix}_last_updated"] = scrape_ts
    return dataframe


def load_team_list(client: bigquery.Client) -> pd.DataFrame:
    """Load the NHL team reference view from BigQuery."""
    query_job = client.query(TEAMLIST_SQL)

    # Build from rows rather than relying on BigQuery Storage/db-dtypes.
    rows = list(query_job.result())
    team_df = pd.DataFrame(
        [dict(row.items()) for row in rows],
        columns=[field.name for field in query_job.result().schema],
    )

    if team_df.empty:
        raise RuntimeError("Team.TeamList returned no rows.")

    if "fullName" not in team_df.columns:
        raise RuntimeError("Team.TeamList does not contain fullName.")

    team_df["join_team"] = team_df["fullName"].apply(normalise_team_name)

    if team_df["join_team"].duplicated().any():
        duplicates = team_df.loc[
            team_df["join_team"].duplicated(keep=False),
            ["fullName", "join_team"],
        ]
        raise RuntimeError(
            "Duplicate normalized team names in TeamList:\n"
            f"{duplicates.to_string(index=False)}"
        )

    print(f"{len(team_df)} teams loaded from Team.TeamList")
    return team_df


# ============================================================
# Wikipedia scrapers
# ============================================================

def scrape_arenas(
    session: requests.Session,
    scrape_ts: datetime,
) -> pd.DataFrame:
    tables = read_wikipedia_tables(session, URL_ARENAS)
    arena_df = select_table(
        tables,
        required_exact=(
            "Arena",
            "Capacity",
            "Opened",
            "Season of first NHL game",
        ),
        label="Arena table",
    )

    arena_df = arena_df.rename(
        columns={
            "Team": "fullName",
            "Arena": "arena_name",
            "Capacity": "arena_capacity",
            "Opened": "arena_opened",
            "Season of first NHL game": "arena_first_nhl_season",
        }
    )

    required = [
        "fullName",
        "arena_name",
        "arena_capacity",
        "arena_opened",
        "arena_first_nhl_season",
    ]
    arena_df = arena_df[required].copy()

    arena_df["fullName"] = remove_references(arena_df["fullName"])
    arena_df["arena_name"] = remove_references(arena_df["arena_name"])
    arena_df["arena_opened"] = remove_references(arena_df["arena_opened"])
    arena_df["arena_first_nhl_season"] = remove_references(
        arena_df["arena_first_nhl_season"]
    )

    arena_df["arena_capacity"] = (
        remove_references(arena_df["arena_capacity"])
        .str.replace(",", "", regex=False)
    )
    arena_df["arena_capacity"] = pd.to_numeric(
        arena_df["arena_capacity"],
        errors="coerce",
    ).astype("Int64")

    arena_df["join_team"] = arena_df["fullName"].apply(normalise_team_name)
    return add_source_metadata(arena_df, "arena", URL_ARENAS, scrape_ts)


def scrape_head_coaches(
    session: requests.Session,
    scrape_ts: datetime,
) -> pd.DataFrame:
    tables = read_wikipedia_tables(session, URL_COACHES)
    coach_df = select_table(
        tables,
        required_exact=("Team", "Coach"),
        required_prefixes=("Start date",),
        label="Head coach table",
    )

    start_date_column = find_column(
        coach_df.columns,
        startswith="Start date",
    )

    coach_df = coach_df.rename(
        columns={
            "Team": "fullName",
            "Coach": "head_coach",
            start_date_column: "head_coach_since",
        }
    )

    coach_df = coach_df[
        ["fullName", "head_coach", "head_coach_since"]
    ].copy()

    for column in coach_df.columns:
        coach_df[column] = remove_references(coach_df[column])

    coach_df["join_team"] = coach_df["fullName"].apply(normalise_team_name)
    return add_source_metadata(coach_df, "coach", URL_COACHES, scrape_ts)


def scrape_general_managers(
    session: requests.Session,
    scrape_ts: datetime,
) -> pd.DataFrame:
    tables = read_wikipedia_tables(session, URL_GMS)
    gm_df = select_table(
        tables,
        required_exact=("Team", "General manager"),
        label="General manager table",
    )

    tenured_column = find_column(gm_df.columns, startswith="Tenured since")
    career_column = find_column(gm_df.columns, startswith="Pro career")

    gm_df = gm_df.rename(
        columns={
            "Team": "fullName",
            "General manager": "general_manager",
            tenured_column: "gm_since",
            career_column: "gm_playing_career",
        }
    )

    gm_df = gm_df[
        ["fullName", "general_manager", "gm_since", "gm_playing_career"]
    ].copy()

    for column in gm_df.columns:
        gm_df[column] = remove_references(gm_df[column])

    gm_df["join_team"] = gm_df["fullName"].apply(normalise_team_name)
    return add_source_metadata(gm_df, "gm", URL_GMS, scrape_ts)


def scrape_owners(
    session: requests.Session,
    scrape_ts: datetime,
) -> pd.DataFrame:
    tables = read_wikipedia_tables(session, URL_OWNERS)
    owner_df = select_table(
        tables,
        required_exact=("Franchise", "Principal owner(s)"),
        label="Owner table",
    )

    year_column = find_column(owner_df.columns, startswith="Year purchased")
    purchase_column = find_column(
        owner_df.columns,
        startswith="Purchase price (US$ millions)",
    )
    adjusted_column = find_column(
        owner_df.columns,
        startswith="Adjusted price",
    )

    owner_df = owner_df.rename(
        columns={
            "Franchise": "fullName",
            "Principal owner(s)": "principal_owner",
            year_column: "owner_since",
            purchase_column: "purchase_price_usd_m",
            adjusted_column: "purchase_price_adjusted_usd_m",
        }
    )

    owner_df = owner_df[
        [
            "fullName",
            "principal_owner",
            "owner_since",
            "purchase_price_usd_m",
            "purchase_price_adjusted_usd_m",
        ]
    ].copy()

    for column in owner_df.columns:
        owner_df[column] = remove_references(owner_df[column])

    # owner_since remains a string because entries may contain multiple years.
    owner_df["join_team"] = owner_df["fullName"].apply(normalise_team_name)
    return add_source_metadata(owner_df, "owner", URL_OWNERS, scrape_ts)


def scrape_ahl(
    session: requests.Session,
    scrape_ts: datetime,
) -> pd.DataFrame:
    tables = read_wikipedia_tables(session, URL_AHL)
    ahl_df = select_table(
        tables,
        required_exact=("Team Name", "NHL affiliate"),
        label="AHL team table",
    )

    ahl_df = ahl_df.rename(
        columns={
            "Team Name": "ahl_team",
            "City": "ahl_city",
            "Arena": "ahl_arena",
            "Capacity": "ahl_capacity",
            "Founded": "ahl_founded",
            "Joined": "ahl_joined",
            "Current city since": "ahl_current_city_since",
            "Head coach": "ahl_head_coach",
            "NHL affiliate": "fullName",
        }
    )

    required = [
        "fullName",
        "ahl_team",
        "ahl_city",
        "ahl_arena",
        "ahl_capacity",
        "ahl_founded",
        "ahl_joined",
        "ahl_current_city_since",
        "ahl_head_coach",
    ]
    ahl_df = ahl_df[required].copy()

    for column in ahl_df.columns:
        ahl_df[column] = remove_references(ahl_df[column])

    ahl_df["join_team"] = ahl_df["fullName"].apply(normalise_team_name)
    return add_source_metadata(ahl_df, "ahl", URL_AHL, scrape_ts)

def scrape_captains(
    session: requests.Session,
    scrape_ts: datetime,
) -> pd.DataFrame:

    tables = read_wikipedia_tables(session, URL_CAPTAINS)

    # -------------------------
    # Captains
    # -------------------------

    captain_df = select_table(
        tables,
        required_exact=("Team", "Captain"),
        label="Captain table",
    )

    captain_df = captain_df.rename(
        columns={
            "Team": "fullName",
            "Captain": "captain",
            "Since": "captain_since",
            "Pos": "captain_position",
        }
    )

    captain_df = captain_df[
        [
            "fullName",
            "captain",
            "captain_since",
            "captain_position",
        ]
    ].copy()

    # -------------------------
    # Alternate captains
    # -------------------------

    alternate_df = select_table(
        tables,
        required_exact=("Team", "Alternate captain(s)"),
        label="Alternate captain table",
    )

    alternate_df = alternate_df.rename(
        columns={
            "Team": "fullName",
            "Alternate captain(s)": "alternate_captain",
        }
    )

    alternate_df = alternate_df[
        [
            "fullName",
            "alternate_captain",
        ]
    ].copy()

    # Clean both tables
    for column in captain_df.columns:
        captain_df[column] = remove_references(captain_df[column])

    for column in alternate_df.columns:
        alternate_df[column] = remove_references(alternate_df[column])

    # Collapse alternates to one row per NHL team
    alternate_df = (
        alternate_df
        .groupby("fullName")["alternate_captain"]
        .apply(list)
        .reset_index()
    )

    for i in range(3):
        alternate_df[f"alternate_captain_{i+1}"] = (
            alternate_df["alternate_captain"]
            .apply(lambda x: x[i] if len(x) > i else None)
        )

    alternate_df = alternate_df.drop(columns="alternate_captain")

    # Merge captains + alternates
    captain_df = captain_df.merge(
        alternate_df,
        on="fullName",
        how="left",
    )

    captain_df["join_team"] = captain_df["fullName"].apply(normalise_team_name)

    return add_source_metadata(
        captain_df,
        "captain",
        URL_CAPTAINS,
        scrape_ts,
    )

def scrape_stanley_cups(
    session: requests.Session,
    scrape_ts: datetime,
) -> pd.DataFrame:

    tables = read_wikipedia_tables(session, URL_STANLEY_CUPS)

    cup_df = select_table(
        tables,
        required_exact=("Team", "Wins"),
        label="Stanley Cup Final era",
    )

    cup_df = cup_df.rename(
        columns={
            "Team": "fullName",
            "Wins": "stanley_cups",
        }
    )

    cup_df = cup_df[
        [
            "fullName",
            "stanley_cups",
        ]
    ].copy()

    for column in cup_df.columns:
        cup_df[column] = remove_references(cup_df[column])

    cup_df["stanley_cups"] = pd.to_numeric(
        cup_df["stanley_cups"],
        errors="coerce",
    )

    cup_df["join_team"] = cup_df["fullName"].apply(normalise_team_name)

    return add_source_metadata(
        cup_df,
        "stanley_cup",
        URL_STANLEY_CUPS,
        scrape_ts,
    )

# ============================================================
# Merge, QA and upload
# ============================================================

def report_unmatched(
    team_df: pd.DataFrame,
    source_df: pd.DataFrame,
    source_name: str,
) -> None:
    comparison = team_df[["fullName", "join_team"]].merge(
        source_df[["join_team"]].drop_duplicates(),
        on="join_team",
        how="left",
        indicator=True,
    )

    missing = comparison.loc[
        comparison["_merge"] != "both",
        ["fullName", "join_team"],
    ]

    if missing.empty:
        print(f"QA passed: all NHL teams matched to {source_name}")
    else:
        print(
            f"WARNING: {len(missing)} NHL team(s) did not match "
            f"{source_name}:\n{missing.to_string(index=False)}"
        )


def assert_unique_source(
    source_df: pd.DataFrame,
    source_name: str,
) -> None:
    duplicates = source_df.loc[
        source_df["join_team"].duplicated(keep=False),
        ["fullName", "join_team"],
    ]

    if not duplicates.empty:
        raise RuntimeError(
            f"Duplicate team rows found in {source_name}:\n"
            f"{duplicates.to_string(index=False)}"
        )


def merge_organisation_data(
    team_df: pd.DataFrame,
    arena_df: pd.DataFrame,
    coach_df: pd.DataFrame,
    gm_df: pd.DataFrame,
    owner_df: pd.DataFrame,
    ahl_df: pd.DataFrame,
    captain_df: pd.DataFrame,
    cup_df: pd.DataFrame,
) -> pd.DataFrame:
    sources = {
        "arenas": arena_df,
        "head coaches": coach_df,
        "general managers": gm_df,
        "owners": owner_df,
        "AHL affiliates": ahl_df,
        "captains": captain_df,
        "stanley_cups": cup_df,
    }

    for name, dataframe in sources.items():
        assert_unique_source(dataframe, name)
        report_unmatched(team_df, dataframe, name)

    organisation_df = team_df.copy()

    for dataframe in (
        arena_df,
        coach_df,
        gm_df,
        owner_df,
        ahl_df,
        captain_df,
        cup_df,
    ):
        organisation_df = organisation_df.merge(
            dataframe.drop(columns=["fullName"]),
            on="join_team",
            how="left",
            validate="one_to_one",
        )

    organisation_df = organisation_df.drop(columns=["join_team"])

    if len(organisation_df) != len(team_df):
        raise RuntimeError(
            "Final row count does not match TeamList: "
            f"{len(organisation_df)} vs {len(team_df)}"
        )

    if organisation_df["fullName"].duplicated().any():
        raise RuntimeError("Duplicate NHL teams found after final merge.")

    # Avoid pandas NA scalar issues during BigQuery schema inference.
    organisation_df = organisation_df.where(
        pd.notna(organisation_df),
        None,
    )

    print(
        f"Final dataset contains {len(organisation_df)} rows "
        f"and {len(organisation_df.columns)} columns"
    )
    return organisation_df


def upload_to_bigquery(
    client: bigquery.Client,
    dataframe: pd.DataFrame,
) -> None:
    job_config = bigquery.LoadJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )

    print(f"Uploading {len(dataframe)} rows to {DESTINATION_TABLE}...")

    load_job = client.load_table_from_dataframe(
        dataframe,
        DESTINATION_TABLE,
        job_config=job_config,
    )
    load_job.result()

    destination = client.get_table(DESTINATION_TABLE)
    print(
        f"Upload complete: {destination.num_rows} rows in "
        f"{DESTINATION_TABLE}"
    )


def main() -> None:
    scrape_ts = datetime.now(timezone.utc)
    print(f"Organisation detail refresh started at {scrape_ts.isoformat()}")

    client = bigquery.Client(project=PROJECT_ID)
    session = build_http_session()

    team_df = load_team_list(client)
    arena_df = scrape_arenas(session, scrape_ts)
    coach_df = scrape_head_coaches(session, scrape_ts)
    gm_df = scrape_general_managers(session, scrape_ts)
    owner_df = scrape_owners(session, scrape_ts)
    ahl_df = scrape_ahl(session, scrape_ts)
    captain_df = scrape_captains(session, scrape_ts)
    cup_df = scrape_stanley_cups(session, scrape_ts)

    organisation_df = merge_organisation_data(
        team_df=team_df,
        arena_df=arena_df,
        coach_df=coach_df,
        gm_df=gm_df,
        owner_df=owner_df,
        ahl_df=ahl_df,
        captain_df=captain_df,
        cup_df=cup_df
    )

    upload_to_bigquery(client, organisation_df)
    print("Organisation detail refresh finished successfully.")


if __name__ == "__main__":
    main()
