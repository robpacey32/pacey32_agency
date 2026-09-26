import asyncio
from datetime import datetime, timezone

import pandas as pd
from bs4 import BeautifulSoup
from google.cloud import bigquery
from playwright.async_api import async_playwright


# =====================================================================
# CONFIG
# =====================================================================

PROJECT_ID = "pacey32-agency"

TEAM_TABLE = f"{PROJECT_ID}.Cap.Team"
PLAYER_TABLE = f"{PROJECT_ID}.Cap.Player"
PLAYER_INDEX_TABLE = f"{PROJECT_ID}.Cap.PlayerIndex"

BASE_URL = "https://puckpedia.com"

EXPECTED_TEAM_COUNT = 32


# =====================================================================
# BIGQUERY SCHEMA
# =====================================================================

PLAYER_SCHEMA = [
    bigquery.SchemaField("team_slug", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("team_name", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("contract_section", "STRING"),

    bigquery.SchemaField("player", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("player_url", "STRING"),

    bigquery.SchemaField("position", "STRING"),
    bigquery.SchemaField("catches", "STRING"),

    bigquery.SchemaField("year", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("season", "STRING", mode="REQUIRED"),

    bigquery.SchemaField("cap_hit", "INTEGER"),
    bigquery.SchemaField("aav", "INTEGER"),
    bigquery.SchemaField("total_salary", "INTEGER"),
    bigquery.SchemaField("signing_bonus", "INTEGER"),
    bigquery.SchemaField("performance_bonus_amount", "INTEGER"),

    bigquery.SchemaField("no_movement_clause", "BOOLEAN"),
    bigquery.SchemaField("no_trade_clause", "BOOLEAN"),
    bigquery.SchemaField("modified_no_trade_clause", "BOOLEAN"),
    bigquery.SchemaField("two_way_contract", "BOOLEAN"),
    bigquery.SchemaField("performance_bonus", "BOOLEAN"),

    bigquery.SchemaField("source_url", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("scrape_datetime", "TIMESTAMP", mode="REQUIRED"),
]


PLAYER_INDEX_SCHEMA = [
    bigquery.SchemaField("team_slug", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("team_name", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("contract_section", "STRING"),

    bigquery.SchemaField("player", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("player_url", "STRING", mode="REQUIRED"),

    bigquery.SchemaField("position", "STRING"),
    bigquery.SchemaField("catches", "STRING"),

    bigquery.SchemaField("has_contract_data", "BOOLEAN", mode="REQUIRED"),

    bigquery.SchemaField("source_url", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("scrape_datetime", "TIMESTAMP", mode="REQUIRED"),
]


# =====================================================================
# HELPERS
# =====================================================================

def money_to_int(value):
    """
    Convert:
        "$13,250,000"
        "13,250,000"
        "$0"
        None

    into an integer or None.
    """

    if value is None:
        return None

    value = str(value).strip()

    if not value:
        return None

    negative = value.startswith("-")

    value = (
        value
        .replace("$", "")
        .replace(",", "")
        .replace("-", "")
        .strip()
    )

    if not value:
        return None

    try:
        number = int(float(value))
    except ValueError:
        return None

    return -number if negative else number


# =====================================================================
# READ TEAMS FROM BIGQUERY
# =====================================================================

def load_teams(client):
    """
    Read the 32 PuckPedia team URLs produced by teamcap.py.
    """

    print(f"Loading team URLs from {TEAM_TABLE}...")

    query = f"""
        SELECT
            team_slug,
            team_name,
            url
        FROM `{TEAM_TABLE}`
        WHERE url IS NOT NULL
        ORDER BY team_name
    """

    rows = list(client.query(query).result())

    teams = [
        {
            "team_slug": row.team_slug,
            "team_name": row.team_name,
            "url": row.url,
        }
        for row in rows
    ]

    print(f"{len(teams)} teams loaded.")

    if not teams:
        raise RuntimeError(
            f"No teams found in {TEAM_TABLE}."
        )

    if len(teams) != EXPECTED_TEAM_COUNT:
        print(
            f"WARNING: Expected {EXPECTED_TEAM_COUNT} teams "
            f"but found {len(teams)}."
        )

    return teams


# =====================================================================
# PLAYWRIGHT
# =====================================================================

async def fetch_team_html(page, team_name, url):
    """
    Load one PuckPedia team page and return the rendered HTML.
    """

    print(f"Loading {team_name}...")
    print(f"  {url}")

    response = await page.goto(
        url,
        wait_until="domcontentloaded",
        timeout=60000,
    )

    if response is not None:
        print(f"  HTTP status: {response.status}")

    # Wait for an actual contract salary cell.
    await page.wait_for_selector(
        "table.pp_table-roster td[data-sal]",
        timeout=60000,
    )

    html = await page.content()

    if "Just a moment..." in html:
        raise RuntimeError(
            f"Cloudflare challenge returned for {team_name}."
        )

    return html


# =====================================================================
# PARSE CONTRACT PAGE
# =====================================================================

def parse_team_page(
    html,
    team_slug,
    team_name,
    source_url,
):
    """
    Parse one rendered PuckPedia team page.

    Returns:
        contract_df
            Existing Cap.Player output.
            One row per player / contract year.

        player_index_df
            New Cap.PlayerIndex output.
            One row per player discovered on the team page, including
            players with no current contract data.
    """

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    # -----------------------------------------------------------------
    # Find every roster-style table containing at least one player.
    #
    # This deliberately does NOT require td[data-sal]. That is the key
    # difference which allows unsigned / RFA players to enter the index.
    # -----------------------------------------------------------------

    player_tables = []

    for table in soup.select(
        "table.pp_table-roster"
    ):

        has_player = bool(
            table.select_one(
                'a[href^="/player/"]'
            )
        )

        if has_player:
            player_tables.append(table)

    if not player_tables:
        raise ValueError(
            f"No player tables found for {team_name}."
        )

    contract_records = []
    player_index_records = []

    scrape_datetime = datetime.now(
        timezone.utc
    )

    # -----------------------------------------------------------------
    # Parse every player table
    # -----------------------------------------------------------------

    for table in player_tables:

        section = "Unknown"

        wrapper = table.find_previous(
            "div",
            id=lambda x: x and x.startswith("capby_")
        )

        if wrapper:

            header = wrapper.find(
                "div",
                class_="flex items-center",
            )

            if header:

                divs = header.find_all(
                    "div",
                    recursive=False,
                )

                # div[0] = count
                # div[1] = section name
                if len(divs) >= 2:
                    section = divs[1].get_text(
                        strip=True
                    )

        # -------------------------------------------------------------
        # Read season headings for THIS table
        # -------------------------------------------------------------

        season_headers = []

        for th in table.select(
            "thead th"
        ):

            header_text = th.get_text(
                " ",
                strip=True,
            )

            if (
                len(header_text) == 7
                and header_text[:4].isdigit()
                and header_text[4] == "-"
                and header_text[5:].isdigit()
            ):
                season_headers.append(
                    header_text
                )

        # -------------------------------------------------------------
        # Player rows
        # -------------------------------------------------------------

        for row in table.select(
            "tbody > tr"
        ):

            player_link = row.select_one(
                'a[href^="/player/"]'
            )

            if player_link is None:
                continue

            # ---------------------------------------------------------
            # Player identity
            # "Matthews, Auston" -> "Auston Matthews"
            # ---------------------------------------------------------

            raw_name = player_link.get_text(
                " ",
                strip=True,
            )

            if "," in raw_name:

                last_name, first_name = [
                    value.strip()
                    for value
                    in raw_name.split(",", 1)
                ]

                player = (
                    f"{first_name} {last_name}"
                )

            else:
                player = raw_name

            relative_player_url = (
                player_link.get(
                    "href",
                    "",
                )
            )

            if not relative_player_url:
                continue

            player_url = (
                BASE_URL
                + relative_player_url
            )

            # ---------------------------------------------------------
            # Position / goalie catches
            # ---------------------------------------------------------

            position = None
            catches = None

            first_td = row.find(
                "td"
            )

            if first_td is not None:

                for detail in first_td.select(
                    "div.text-xs > div"
                ):

                    spans = detail.find_all(
                        "span"
                    )

                    if len(spans) < 2:
                        continue

                    label = (
                        spans[0]
                        .get_text(
                            " ",
                            strip=True,
                        )
                        .lower()
                    )

                    value = (
                        spans[-1]
                        .get_text(
                            " ",
                            strip=True,
                        )
                        .upper()
                    )

                    if label == "pos":
                        position = value

                    elif label == "catches":
                        position = "G"
                        catches = value

            # ---------------------------------------------------------
            # Salary cells
            # ---------------------------------------------------------

            salary_cells = row.select(
                "td[data-sal]"
            )

            has_contract_data = bool(
                salary_cells
            )

            # ---------------------------------------------------------
            # Player index record
            #
            # This is written regardless of whether salary cells exist.
            # ---------------------------------------------------------

            player_index_records.append({
                "team_slug":
                    team_slug,

                "team_name":
                    team_name,

                "contract_section":
                    section,

                "player":
                    player,

                "player_url":
                    player_url,

                "position":
                    position,

                "catches":
                    catches,

                "has_contract_data":
                    has_contract_data,

                "source_url":
                    source_url,

                "scrape_datetime":
                    scrape_datetime,
            })

            # ---------------------------------------------------------
            # Existing contract-year records
            # ---------------------------------------------------------

            for year, td in enumerate(
                salary_cells,
                start=1,
            ):

                if year <= len(
                    season_headers
                ):
                    season = (
                        season_headers[
                            year - 1
                        ]
                    )
                else:
                    season = None

                if season is None:
                    raise ValueError(
                        f"Could not identify season "
                        f"for {player}, year {year}, "
                        f"{team_name}."
                    )

                html_cell = str(
                    td
                ).lower()

                no_movement_clause = (
                    "no movement clause"
                    in html_cell
                )

                modified_no_trade_clause = (
                    "modified no trade clause"
                    in html_cell
                )

                no_trade_clause = (
                    "no trade clause"
                    in html_cell
                    and not
                    modified_no_trade_clause
                )

                two_way_contract = (
                    "two-way contract"
                    in html_cell
                    or
                    "two way contract"
                    in html_cell
                )

                performance_bonus = (
                    "performance bonus"
                    in html_cell
                )

                contract_records.append({
                    "team_slug":
                        team_slug,

                    "team_name":
                        team_name,

                    "contract_section":
                        section,

                    "player":
                        player,

                    "player_url":
                        player_url,

                    "position":
                        position,

                    "catches":
                        catches,

                    "year":
                        year,

                    "season":
                        season,

                    "cap_hit":
                        money_to_int(
                            td.get(
                                "data-ch"
                            )
                        ),

                    "aav":
                        money_to_int(
                            td.get(
                                "data-aav"
                            )
                        ),

                    "total_salary":
                        money_to_int(
                            td.get(
                                "data-sal"
                            )
                        ),

                    "signing_bonus":
                        money_to_int(
                            td.get(
                                "data-sb"
                            )
                        ),

                    "performance_bonus_amount":
                        money_to_int(
                            td.get(
                                "data-bonus"
                            )
                        ),

                    "no_movement_clause":
                        no_movement_clause,

                    "no_trade_clause":
                        no_trade_clause,

                    "modified_no_trade_clause":
                        modified_no_trade_clause,

                    "two_way_contract":
                        two_way_contract,

                    "performance_bonus":
                        performance_bonus,

                    "source_url":
                        source_url,

                    "scrape_datetime":
                        scrape_datetime,
                })

    # -----------------------------------------------------------------
    # Existing Cap.Player dataframe
    # -----------------------------------------------------------------

    if not contract_records:
        raise ValueError(
            f"Player tables were found for {team_name}, "
            "but no contract-year records were extracted."
        )

    contract_df = pd.DataFrame(
        contract_records
    )

    contract_df = contract_df[
        [
            "team_slug",
            "team_name",
            "contract_section",
            "player",
            "player_url",
            "position",
            "catches",
            "year",
            "season",
            "cap_hit",
            "aav",
            "total_salary",
            "signing_bonus",
            "performance_bonus_amount",
            "no_movement_clause",
            "no_trade_clause",
            "modified_no_trade_clause",
            "two_way_contract",
            "performance_bonus",
            "source_url",
            "scrape_datetime",
        ]
    ].copy()

    integer_columns = [
        "year",
        "cap_hit",
        "aav",
        "total_salary",
        "signing_bonus",
        "performance_bonus_amount",
    ]

    for col in integer_columns:
        contract_df[col] = (
            contract_df[col]
            .astype(
                "Int64"
            )
        )

    boolean_columns = [
        "no_movement_clause",
        "no_trade_clause",
        "modified_no_trade_clause",
        "two_way_contract",
        "performance_bonus",
    ]

    for col in boolean_columns:
        contract_df[col] = (
            contract_df[col]
            .astype(
                "boolean"
            )
        )

    missing_position = (
        contract_df[
            "position"
        ]
        .isna()
        .sum()
    )

    if missing_position:
        print(
            f"  WARNING: "
            f"{missing_position} contract-year rows "
            "have missing position."
        )

    duplicate_key = [
        "team_slug",
        "player_url",
        "season",
        "contract_section",
    ]

    duplicated = contract_df.duplicated(
        subset=duplicate_key,
        keep=False,
    )

    if duplicated.any():

        print(
            "\nDuplicate player-season rows:"
        )

        print(
            contract_df.loc[
                duplicated,
                duplicate_key,
            ]
            .sort_values(
                duplicate_key
            )
            .to_string(
                index=False
            )
        )

        raise ValueError(
            f"Duplicate player-season records "
            f"found for {team_name}."
        )

    # -----------------------------------------------------------------
    # New Cap.PlayerIndex dataframe
    #
    # A player can appear in more than one PuckPedia table/section.
    # Keep one row per team/player URL. Prefer a row which contains
    # contract data when duplicates exist.
    # -----------------------------------------------------------------

    if not player_index_records:
        raise ValueError(
            f"No player index records were "
            f"extracted for {team_name}."
        )

    player_index_df = pd.DataFrame(
        player_index_records
    )

    player_index_df[
        "has_contract_data"
    ] = (
        player_index_df[
            "has_contract_data"
        ]
        .astype(
            "boolean"
        )
    )

    player_index_df = (
        player_index_df
        .sort_values(
            by=[
                "has_contract_data",
                "contract_section",
            ],
            ascending=[
                False,
                True,
            ],
            na_position="last",
        )
        .drop_duplicates(
            subset=[
                "team_slug",
                "player_url",
            ],
            keep="first",
        )
        .reset_index(
            drop=True
        )
    )

    player_index_df = player_index_df[
        [
            "team_slug",
            "team_name",
            "contract_section",
            "player",
            "player_url",
            "position",
            "catches",
            "has_contract_data",
            "source_url",
            "scrape_datetime",
        ]
    ].copy()

    duplicate_index_key = [
        "team_slug",
        "player_url",
    ]

    duplicated_index = (
        player_index_df
        .duplicated(
            subset=duplicate_index_key,
            keep=False,
        )
    )

    if duplicated_index.any():
        raise ValueError(
            f"Duplicate PlayerIndex records "
            f"found for {team_name}."
        )

    return (
        contract_df,
        player_index_df,
    )


# =====================================================================
# BIGQUERY TABLE MANAGEMENT
# =====================================================================

def ensure_player_table(client):
    """
    Create Cap.Player if it does not already exist.
    """

    try:
        client.get_table(
            PLAYER_TABLE
        )

        print(
            f"Target table exists: "
            f"{PLAYER_TABLE}"
        )

    except Exception:

        print(
            f"Creating target table: "
            f"{PLAYER_TABLE}"
        )

        table = bigquery.Table(
            PLAYER_TABLE,
            schema=PLAYER_SCHEMA,
        )

        client.create_table(
            table
        )

        print(
            "Target table created."
        )


def ensure_player_index_table(
    client,
):
    """
    Create Cap.PlayerIndex if it does not already exist.
    """

    try:
        client.get_table(
            PLAYER_INDEX_TABLE
        )

        print(
            f"Target table exists: "
            f"{PLAYER_INDEX_TABLE}"
        )

    except Exception:

        print(
            f"Creating target table: "
            f"{PLAYER_INDEX_TABLE}"
        )

        table = bigquery.Table(
            PLAYER_INDEX_TABLE,
            schema=PLAYER_INDEX_SCHEMA,
        )

        client.create_table(
            table
        )

        print(
            "Player index table created."
        )


# =====================================================================
# REPLACE ONE TEAM
# =====================================================================

def replace_team_rows(
    client,
    team_slug,
    df,
):
    """
    Replace one team's rows in Cap.Player.

    Process:
        1. DELETE existing rows for team
        2. APPEND newly scraped rows

    This happens immediately after each team scrape.
    """

    # -----------------------------------------------------------------
    # Delete existing team
    # -----------------------------------------------------------------

    delete_sql = f"""
        DELETE FROM `{PLAYER_TABLE}`
        WHERE team_slug = @team_slug
    """

    delete_config = (
        bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter(
                    "team_slug",
                    "STRING",
                    team_slug,
                )
            ]
        )
    )

    client.query(
        delete_sql,
        job_config=delete_config,
    ).result()

    # -----------------------------------------------------------------
    # Append refreshed team
    # -----------------------------------------------------------------

    load_config = (
        bigquery.LoadJobConfig(
            schema=PLAYER_SCHEMA,
            write_disposition=(
                bigquery.WriteDisposition
                .WRITE_APPEND
            ),
        )
    )

    load_job = (
        client.load_table_from_dataframe(
            df,
            PLAYER_TABLE,
            job_config=load_config,
        )
    )

    load_job.result()

    print(
        f"  Uploaded "
        f"{len(df):,} rows."
    )


def replace_player_index_rows(
    client,
    team_slug,
    df,
):
    """
    Replace one team's rows in Cap.PlayerIndex.
    """

    delete_sql = f"""
        DELETE FROM `{PLAYER_INDEX_TABLE}`
        WHERE team_slug = @team_slug
    """

    delete_config = (
        bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter(
                    "team_slug",
                    "STRING",
                    team_slug,
                )
            ]
        )
    )

    client.query(
        delete_sql,
        job_config=delete_config,
    ).result()

    load_config = (
        bigquery.LoadJobConfig(
            schema=PLAYER_INDEX_SCHEMA,
            write_disposition=(
                bigquery.WriteDisposition
                .WRITE_APPEND
            ),
        )
    )

    load_job = (
        client.load_table_from_dataframe(
            df,
            PLAYER_INDEX_TABLE,
            job_config=load_config,
        )
    )

    load_job.result()

    print(
        f"  Uploaded "
        f"{len(df):,} player-index rows."
    )


# =====================================================================
# MAIN PIPELINE
# =====================================================================

async def main():

    print("=" * 70)
    print("PUCKPEDIA PLAYER CAP PIPELINE")
    print("=" * 70)

    print(
        f"Team source: {TEAM_TABLE}"
    )

    print(
        f"Contract output: {PLAYER_TABLE}"
    )

    print(
        f"Player index:    {PLAYER_INDEX_TABLE}"
    )

    print()

    # -----------------------------------------------------------------
    # BigQuery setup
    # -----------------------------------------------------------------

    client = bigquery.Client(
        project=PROJECT_ID
    )

    ensure_player_table(
        client
    )

    ensure_player_index_table(
        client
    )

    teams = load_teams(
        client
    )

    # -----------------------------------------------------------------
    # Track results
    # -----------------------------------------------------------------

    successes = []
    failures = []

    # -----------------------------------------------------------------
    # One browser/context reused for all teams
    # -----------------------------------------------------------------

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
                "Chrome/139.0.0.0 "
                "Safari/537.36"
            ),
            locale="en-GB",
        )

        page = await context.new_page()

        # -------------------------------------------------------------
        # Team loop
        # -------------------------------------------------------------

        for index, team in enumerate(
            teams,
            start=1,
        ):

            team_slug = (
                team["team_slug"]
            )

            team_name = (
                team["team_name"]
            )

            url = team["url"]

            print()
            print("=" * 70)

            print(
                f"[{index}/{len(teams)}] "
                f"{team_name}"
            )

            print("=" * 70)

            try:

                # -----------------------------------------------------
                # Fetch
                # -----------------------------------------------------

                html = await fetch_team_html(
                    page=page,
                    team_name=team_name,
                    url=url,
                )

                # -----------------------------------------------------
                # Parse
                # -----------------------------------------------------

                (
                    team_df,
                    player_index_df,
                ) = parse_team_page(
                    html=html,
                    team_slug=team_slug,
                    team_name=team_name,
                    source_url=url,
                )

                contracted_players = (
                    team_df[
                        "player"
                    ]
                    .nunique()
                )

                indexed_players = (
                    player_index_df[
                        "player_url"
                    ]
                    .nunique()
                )

                unsigned_players = (
                    ~player_index_df[
                        "has_contract_data"
                    ]
                    .fillna(False)
                ).sum()

                unique_seasons = (
                    team_df[
                        "season"
                    ]
                    .nunique()
                )

                print(
                    f"  Contracted players: "
                    f"{contracted_players}"
                )

                print(
                    f"  Indexed players: "
                    f"{indexed_players}"
                )

                print(
                    f"  Without contract data: "
                    f"{unsigned_players}"
                )

                print(
                    f"  Contract-year rows: "
                    f"{len(team_df)}"
                )

                print(
                    f"  Seasons represented: "
                    f"{unique_seasons}"
                )

                # -----------------------------------------------------
                # Upload THIS TEAM immediately
                # -----------------------------------------------------

                replace_team_rows(
                    client=client,
                    team_slug=team_slug,
                    df=team_df,
                )

                replace_player_index_rows(
                    client=client,
                    team_slug=team_slug,
                    df=player_index_df,
                )

                successes.append({
                    "team_slug":
                        team_slug,

                    "team_name":
                        team_name,

                    "contracted_players":
                        contracted_players,

                    "indexed_players":
                        indexed_players,

                    "without_contract":
                        int(
                            unsigned_players
                        ),

                    "rows":
                        len(team_df),
                })

                print(
                    "  SUCCESS"
                )

            except Exception as exc:

                failures.append({
                    "team_slug":
                        team_slug,

                    "team_name":
                        team_name,

                    "url":
                        url,

                    "error":
                        str(exc),
                })

                print(
                    f"  FAILED: {exc}"
                )

                # Continue to next team rather than
                # abandoning the entire run.
                continue

        await context.close()
        await browser.close()

    # -----------------------------------------------------------------
    # Final run summary
    # -----------------------------------------------------------------

    print()
    print("=" * 70)
    print("RUN SUMMARY")
    print("=" * 70)

    print(
        f"Successful teams: "
        f"{len(successes)}"
    )

    print(
        f"Failed teams:     "
        f"{len(failures)}"
    )

    if successes:

        success_df = pd.DataFrame(
            successes
        )

        print()
        print(
            success_df.to_string(
                index=False
            )
        )

    if failures:

        failure_df = pd.DataFrame(
            failures
        )

        print()
        print("FAILURES:")
        print()

        print(
            failure_df.to_string(
                index=False
            )
        )

        # Fail the GitHub Action after all teams
        # have been attempted.
        raise RuntimeError(
            f"{len(failures)} team(s) failed "
            "during the Player Cap refresh."
        )

    print()
    print("=" * 70)
    print("PIPELINE COMPLETE")
    print("=" * 70)


# =====================================================================
# ENTRY POINT
# =====================================================================

if __name__ == "__main__":
    asyncio.run(main())