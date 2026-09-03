import importlib.util
import os
from datetime import datetime, timezone

import pandas as pd
from google.api_core.exceptions import NotFound
from google.cloud import bigquery


# ---------------------------------------------------------
# CONFIG
# ---------------------------------------------------------

PROJECT_ID = "pacey32-agency"
DATASET_ID = "Comparison"
TABLE_ID = "10_ComparablePlayers"

TOP_N = 20
BATCH_SIZE = 50
REFRESH_MONTHS = 3


# ---------------------------------------------------------
# BIGQUERY
# ---------------------------------------------------------

def get_client():
    return bigquery.Client(
        project=PROJECT_ID
    )


def get_table_id():
    return (
        f"{PROJECT_ID}."
        f"{DATASET_ID}."
        f"{TABLE_ID}"
    )


def table_exists(client):
    try:
        client.get_table(
            get_table_id()
        )
        return True

    except NotFound:
        return False


# ---------------------------------------------------------
# LOAD OVERALL MODEL
# ---------------------------------------------------------

def load_overall_model():
    path = os.path.join(
        os.path.dirname(__file__),
        "06_overall.py"
    )

    spec = importlib.util.spec_from_file_location(
        "overall",
        path
    )

    if (
        spec is None
        or spec.loader is None
    ):
        raise ImportError(
            "Unable to load 06_overall.py"
        )

    overall = (
        importlib.util.module_from_spec(
            spec
        )
    )

    spec.loader.exec_module(
        overall
    )

    return overall


# ---------------------------------------------------------
# LOAD ACTIVE PLAYERS
# ---------------------------------------------------------

def load_players(client):
    query = """
    SELECT DISTINCT
        playerId,
        player_name,
        position
    FROM `pacey32-agency.Comparison.01_PlayerProfile`
    WHERE activeFlag = 1
      AND playerId IS NOT NULL
      AND position IS NOT NULL
    ORDER BY player_name
    """

    df = client.query(
        query
    ).to_dataframe()

    df["playerId"] = pd.to_numeric(
        df["playerId"],
        errors="coerce"
    )

    df = (
        df
        .dropna(
            subset=["playerId"]
        )
        .copy()
    )

    df["playerId"] = (
        df["playerId"]
        .astype(int)
    )

    return df


# ---------------------------------------------------------
# LOAD LAST SUCCESSFUL RUNS
# ---------------------------------------------------------

def load_last_runs(client):
    if not table_exists(client):
        return pd.DataFrame(
            columns=[
                "target_playerId",
                "last_run",
            ]
        )

    query = f"""
    SELECT
        target_playerId,
        MAX(RunDate) AS last_run
    FROM `{get_table_id()}`
    GROUP BY target_playerId
    """

    return client.query(
        query
    ).to_dataframe()


# ---------------------------------------------------------
# DETERMINE PLAYERS TO REFRESH
# ---------------------------------------------------------

def get_players_to_refresh(
    players,
    last_runs,
    force_refresh,
):
    if force_refresh:
        print(
            "Force refresh enabled - "
            "all active players will run."
        )

        return players.copy()

    if last_runs.empty:
        print(
            "No existing comparison data - "
            "all active players will run."
        )

        return players.copy()

    last_runs = last_runs.rename(
        columns={
            "target_playerId":
                "playerId"
        }
    )

    last_runs["playerId"] = (
        pd.to_numeric(
            last_runs["playerId"],
            errors="coerce"
        )
    )

    last_runs = (
        last_runs
        .dropna(
            subset=["playerId"]
        )
        .copy()
    )

    last_runs["playerId"] = (
        last_runs["playerId"]
        .astype(int)
    )

    df = players.merge(
        last_runs,
        on="playerId",
        how="left"
    )

    df["last_run"] = pd.to_datetime(
        df["last_run"],
        utc=True,
        errors="coerce"
    )

    cutoff = (
        pd.Timestamp.now(
            tz="UTC"
        )
        - pd.DateOffset(
            months=REFRESH_MONTHS
        )
    )

    refresh = df[
        df["last_run"].isna()
        | (
            df["last_run"]
            < cutoff
        )
    ].copy()

    return refresh[
        [
            "playerId",
            "player_name",
            "position",
        ]
    ]


# ---------------------------------------------------------
# PREPARE MODEL OUTPUT
# ---------------------------------------------------------

def prepare_output(df):
    columns = [
        "target_playerId",
        "target_player",
        "target_position",

        "comparable_rank",
        "comparable_playerId",
        "comparable_player",
        "comparable_position",

        "overall_similarity",

        "playing_style_similarity",
        "playing_style_rank",

        "production_similarity",
        "production_rank",

        "effectiveness_similarity",
        "effectiveness_rank",

        "usage_similarity",
        "usage_rank",

        "trajectory_similarity",
        "trajectory_rank",

        "models_available",

        "current_aav",
        "current_contract_term",
        "current_contract_to",
        "current_contract_cap_pct",

        "RunDate",
    ]

    missing_columns = [
        column
        for column in columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            "Missing model output columns: "
            + ", ".join(
                missing_columns
            )
        )

    df = df[
        columns
    ].copy()

    integer_columns = [
        "target_playerId",
        "comparable_rank",
        "comparable_playerId",
        "playing_style_rank",
        "production_rank",
        "effectiveness_rank",
        "usage_rank",
        "trajectory_rank",
        "models_available",
    ]

    for column in integer_columns:
        df[column] = pd.to_numeric(
            df[column],
            errors="coerce"
        ).astype("Int64")

    numeric_columns = [
        "overall_similarity",
        "playing_style_similarity",
        "production_similarity",
        "effectiveness_similarity",
        "usage_similarity",
        "trajectory_similarity",
        "current_aav",
        "current_contract_term",
        "current_contract_cap_pct",
    ]

    for column in numeric_columns:
        df[column] = pd.to_numeric(
            df[column],
            errors="coerce"
        )

    df["RunDate"] = pd.to_datetime(
        df["RunDate"],
        utc=True
    )

    return df


# ---------------------------------------------------------
# WRITE ONE BATCH
# ---------------------------------------------------------

def write_batch(
    client,
    df,
):
    if df.empty:
        return

    table_id = get_table_id()

    target_ids = (
        df["target_playerId"]
        .dropna()
        .astype(int)
        .unique()
        .tolist()
    )

    existing_table = (
        table_exists(client)
    )

    if existing_table:
        delete_query = f"""
        DELETE FROM `{table_id}`
        WHERE target_playerId
            IN UNNEST(@playerIds)
        """

        delete_config = (
            bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ArrayQueryParameter(
                        "playerIds",
                        "INT64",
                        target_ids
                    )
                ]
            )
        )

        client.query(
            delete_query,
            job_config=delete_config
        ).result()

        write_disposition = (
            bigquery.WriteDisposition
            .WRITE_APPEND
        )

    else:
        write_disposition = (
            bigquery.WriteDisposition
            .WRITE_TRUNCATE
        )

    load_config = (
        bigquery.LoadJobConfig(
            write_disposition=
                write_disposition
        )
    )

    client.load_table_from_dataframe(
        df,
        table_id,
        job_config=load_config
    ).result()

    print(
        f"Uploaded {len(df):,} "
        f"comparable rows for "
        f"{len(target_ids):,} players."
    )


# ---------------------------------------------------------
# RUN COMPARISON MODEL
# ---------------------------------------------------------

def run_model(
    client,
    force_refresh=False,
):
    overall = load_overall_model()

    players = load_players(
        client
    )

    print(
        f"Active players: "
        f"{len(players):,}"
    )

    last_runs = load_last_runs(
        client
    )

    players_to_refresh = (
        get_players_to_refresh(
            players,
            last_runs,
            force_refresh,
        )
    )

    total_players = len(
        players_to_refresh
    )

    print(
        f"Players to model: "
        f"{total_players:,}"
    )

    if total_players == 0:
        print(
            "No players require refresh."
        )
        return

    run_datetime = datetime.now(
        timezone.utc
    )

    batch_results = []
    batch_player_count = 0

    successful_players = 0
    failed_players = 0
    no_comparable_players = 0

    for number, (_, row) in enumerate(
        players_to_refresh.iterrows(),
        start=1
    ):
        player_id = int(
            row["playerId"]
        )

        player_name = (
            row["player_name"]
        )

        position = (
            row["position"]
        )

        print()
        print(
            f"[{number:,}/"
            f"{total_players:,}] "
            f"{player_name} "
            f"({player_id})"
        )

        try:
            comps = (
                overall
                .find_overall_comparables(
                    player_id,
                    n=TOP_N,
                    require_all_models=True
                )
            )

            if (
                comps is None
                or comps.empty
            ):
                print(
                    "  No comparables found."
                )

                no_comparable_players += 1

            else:
                comps = comps.copy()

                comps.insert(
                    0,
                    "target_playerId",
                    player_id
                )

                comps.insert(
                    1,
                    "target_player",
                    player_name
                )

                comps.insert(
                    2,
                    "target_position",
                    position
                )

                comps = comps.rename(
                    columns={
                        "rank":
                            "comparable_rank",

                        "playerId":
                            "comparable_playerId",

                        "player":
                            "comparable_player",

                        "position":
                            "comparable_position",
                    }
                )

                comps["RunDate"] = (
                    run_datetime
                )

                comps = prepare_output(
                    comps
                )

                batch_results.append(
                    comps
                )

                successful_players += 1

                print(
                    f"  Comparables: "
                    f"{len(comps)}"
                )

        except Exception as error:
            failed_players += 1

            print(
                f"  ERROR: "
                f"{type(error).__name__}: "
                f"{error}"
            )

        batch_player_count += 1

        # ---------------------------------------------
        # WRITE EVERY 50 PROCESSED PLAYERS
        # ---------------------------------------------

        if (
            batch_player_count
            >= BATCH_SIZE
            or number
            == total_players
        ):
            print()
            print(
                "---------------------------------"
            )
            print(
                "Writing batch to BigQuery..."
            )

            if batch_results:
                batch_df = pd.concat(
                    batch_results,
                    ignore_index=True
                )

                write_batch(
                    client,
                    batch_df
                )

            else:
                print(
                    "No successful results "
                    "in this batch."
                )

            batch_results = []
            batch_player_count = 0

            print(
                "---------------------------------"
            )

    print()
    print(
        "================================="
    )
    print(
        "COMPARISON MODEL COMPLETE"
    )
    print(
        "================================="
    )

    print(
        f"Players considered: "
        f"{total_players:,}"
    )

    print(
        f"Successful: "
        f"{successful_players:,}"
    )

    print(
        f"No comparables: "
        f"{no_comparable_players:,}"
    )

    print(
        f"Failed: "
        f"{failed_players:,}"
    )


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():
    force_refresh = (
        os.getenv(
            "FORCE_REFRESH",
            "false"
        )
        .strip()
        .lower()
        == "true"
    )

    print(
        "================================="
    )
    print(
        "PACEY32 COMPARISON MODEL"
    )
    print(
        "================================="
    )

    print(
        f"Top comparables: "
        f"{TOP_N}"
    )

    print(
        f"Batch size: "
        f"{BATCH_SIZE}"
    )

    print(
        f"Refresh period: "
        f"{REFRESH_MONTHS} months"
    )

    print(
        f"Force refresh: "
        f"{force_refresh}"
    )

    print()

    client = get_client()

    run_model(
        client,
        force_refresh=
            force_refresh
    )


if __name__ == "__main__":
    main()