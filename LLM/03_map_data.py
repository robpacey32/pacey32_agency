import json
from pathlib import Path

from google.cloud import bigquery


# ---------------------------------------------------------
# CONFIG
# ---------------------------------------------------------

PROJECT_ID = "pacey32-agency"

DATASETS = [
    "Player",
    "Comparison",
    "Cap",
    "Team",
    "City",
    "EventLocations",
    "Geo",
]


# ---------------------------------------------------------
# PATHS
# ---------------------------------------------------------

LLM_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = LLM_DIR / "data_map.json"


# ---------------------------------------------------------
# BIGQUERY CLIENT
# ---------------------------------------------------------

client = bigquery.Client(
    project=PROJECT_ID
)


# ---------------------------------------------------------
# IDENTIFY POSSIBLE RELATIONSHIP FIELDS
# ---------------------------------------------------------

def classify_column(column_name):
    name = column_name.lower()

    classifications = []

    # Player identifiers
    if (
        "playerid" in name
        or "player_id" in name
    ):
        classifications.append("player")

    # Team identifiers
    if (
        "teamid" in name
        or "team_id" in name
        or name == "tricode"
        or "team_code" in name
        or name == "team"
    ):
        classifications.append("team")

    # City/location identifiers
    if (
        "city" in name
        or "location" in name
    ):
        classifications.append("location")

    # Season identifiers
    if "season" in name:
        classifications.append("season")

    # Dates/timestamps
    if (
        "date" in name
        or "timestamp" in name
        or name.endswith("_at")
    ):
        classifications.append("date")

    # Game identifiers
    if (
        name == "gameid"
        or name == "game_id"
    ):
        classifications.append("game")

    return classifications


# ---------------------------------------------------------
# MAP TABLE
# ---------------------------------------------------------

def map_table(dataset_id, table_item):
    table_ref = (
        f"{PROJECT_ID}."
        f"{dataset_id}."
        f"{table_item.table_id}"
    )

    table = client.get_table(
        table_ref
    )

    columns = {}

    possible_keys = {
        "player": [],
        "team": [],
        "location": [],
        "season": [],
        "date": [],
        "game": [],
    }

    for field in table.schema:

        columns[field.name] = {
            "type": field.field_type,
            "mode": field.mode,
            "description": field.description,
        }

        classifications = classify_column(
            field.name
        )

        for classification in classifications:
            possible_keys[
                classification
            ].append(
                field.name
            )

    # Remove empty categories.
    possible_keys = {
        key: value
        for key, value in possible_keys.items()
        if value
    }

    return {
        "dataset": dataset_id,
        "table": table_item.table_id,
        "full_table_id": (
            f"{dataset_id}."
            f"{table_item.table_id}"
        ),
        "description": table.description,
        "num_rows": table.num_rows,
        "columns": columns,
        "possible_keys": possible_keys,
    }


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():

    print("\nPacey32 Agency Data Mapper")
    print("--------------------------")

    data_map = {}

    total_tables = 0

    for dataset_id in DATASETS:

        print(
            f"\nDataset: {dataset_id}"
        )

        dataset_ref = (
            f"{PROJECT_ID}.{dataset_id}"
        )

        tables = list(
            client.list_tables(
                dataset_ref
            )
        )

        for table_item in tables:

            print(
                f"  Mapping "
                f"{table_item.table_id}"
            )

            table_data = map_table(
                dataset_id,
                table_item,
            )

            key = (
                f"{dataset_id}."
                f"{table_item.table_id}"
            )

            data_map[key] = table_data

            total_tables += 1

    # ---------------------------------------------
    # WRITE OUTPUT
    # ---------------------------------------------

    with open(
        OUTPUT_FILE,
        "w",
    ) as f:
        json.dump(
            data_map,
            f,
            indent=2,
            default=str,
        )

    print(
        f"\nMapped {total_tables} tables."
    )

    print(
        f"Output written to:\n"
        f"{OUTPUT_FILE}"
    )


# ---------------------------------------------------------
# RUN
# ---------------------------------------------------------

if __name__ == "__main__":
    main()