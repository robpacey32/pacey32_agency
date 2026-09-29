import json
from pathlib import Path

from google.cloud import bigquery


PROJECT_ID = "pacey32-agency"
DATASET_ID = "LLM"

OUTPUT_FILE = Path(__file__).parent / "schema.json"

client = bigquery.Client(project=PROJECT_ID)


def build_schema():

    dataset_ref = f"{PROJECT_ID}.{DATASET_ID}"

    schema = []

    tables = sorted(
        client.list_tables(dataset_ref),
        key=lambda x: x.table_id,
    )

    for table_item in tables:

        table = client.get_table(
            f"{PROJECT_ID}.{DATASET_ID}.{table_item.table_id}"
        )

        columns = []

        for field in table.schema:
            columns.append(
                {
                    "name": field.name,
                    "type": field.field_type,
                    "mode": field.mode,
                    "description": field.description,
                }
            )

        schema.append(
            {
                "table": f"{DATASET_ID}.{table.table_id}",
                "full_table_id": (
                    f"{PROJECT_ID}.{DATASET_ID}.{table.table_id}"
                ),
                "description": table.description,
                "columns": columns,
            }
        )

        print(
            f"Mapped: {DATASET_ID}.{table.table_id} "
            f"({len(columns)} columns)"
        )

    return schema


def main():

    schema = build_schema()

    with open(OUTPUT_FILE, "w") as f:
        json.dump(
            schema,
            f,
            indent=2,
            default=str,
        )

    print()
    print(
        f"Schema written: {OUTPUT_FILE}"
    )
    print(
        f"Tables/views mapped: {len(schema)}"
    )


if __name__ == "__main__":
    main()