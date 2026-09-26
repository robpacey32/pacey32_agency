from pathlib import Path
import sys

from google.cloud import bigquery


PROJECT_ID = "pacey32-agency"

QA_DIR = Path(__file__).resolve().parent

QA_FILES = [
    ("Player", "Player.sql"),
    ("Cap", "Cap.sql"),
    ("Comparison", "Comparison.sql"),
    ("Event Locations", "EventLocations.sql"),
    ("Team", "Team.sql"),
    ("Organisation", "Organisation.sql"),
    ("City", "City.sql"),
    ("Tax", "Tax.sql"),
    ("Travel", "Travel.sql"),
    ("Geo", "Geo.sql"),
]


def run_qa_file(
    client: bigquery.Client,
    name: str,
    filename: str,
) -> bool:
    sql_path = QA_DIR / filename

    if not sql_path.exists():
        print(f"FAIL  {name}: {sql_path} not found")
        return False

    sql = sql_path.read_text(encoding="utf-8")

    print(f"Running {name}...")

    try:
        query_job = client.query(sql)
        query_job.result()

        print(f"PASS  {name}")
        return True

    except Exception as exc:
        print(f"FAIL  {name}")
        print(f"      {exc}")
        return False


def main() -> int:
    print("=" * 60)
    print("Pacey32 Agency QA")
    print("=" * 60)
    print()

    client = bigquery.Client(
        project=PROJECT_ID
    )

    successful = 0
    failed = 0

    for index, (
        name,
        filename,
    ) in enumerate(
        QA_FILES,
        start=1,
    ):
        print(
            f"[{index}/{len(QA_FILES)}] "
            f"{name}"
        )

        success = run_qa_file(
            client,
            name,
            filename,
        )

        if success:
            successful += 1
        else:
            failed += 1

        print()

    print("=" * 60)
    print("QA execution complete")
    print(
        f"Successful SQL suites: {successful}"
    )
    print(
        f"Failed SQL suites:     {failed}"
    )
    print("=" * 60)

    if failed > 0:
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())