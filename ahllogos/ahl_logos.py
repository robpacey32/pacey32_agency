import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from google.cloud import bigquery


# --------------------------------------------------
# CONFIG
# --------------------------------------------------

PROJECT_ID = "pacey32-agency"
DATASET_ID = "Team"
TABLE_ID = "AHLLogo"

LEAGUE_URL = (
    "https://www.sportslogos.net/teams/list_by_league/"
    "2/American-Hockey-League-Logos/AHL-Logos/"
)

TABLE_REF = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"

# Script lives in:
# pacey32_agency/ahllogos/ahl_logos.py
#
# App public folder is:
# pacey32_agency/app/public/ahl-logos/

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = (
    PROJECT_ROOT
    / "app"
    / "public"
    / "ahl-logos"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/140.0.0.0 Safari/537.36"
    )
}


# --------------------------------------------------
# HELPERS
# --------------------------------------------------

def get_soup(url):
    response = requests.get(
        url,
        headers=HEADERS,
        timeout=30,
    )

    response.raise_for_status()

    return BeautifulSoup(
        response.text,
        "html.parser",
    )


def clean_text(value):
    return re.sub(
        r"\s+",
        " ",
        value or "",
    ).strip()


def slugify(value):
    value = value.lower().strip()

    value = re.sub(
        r"[^a-z0-9]+",
        "-",
        value,
    )

    return value.strip("-")


def extract_current_teams(soup):
    heading = soup.find(
        lambda tag:
            tag.name in ["h2", "h3"]
            and "AHL Team Logos"
            in clean_text(
                tag.get_text(
                    " ",
                    strip=True,
                )
            )
    )

    if not heading:
        raise RuntimeError(
            "Could not find AHL Team Logos section."
        )

    teams = []

    for element in heading.find_all_next():

        text = clean_text(
            element.get_text(
                " ",
                strip=True,
            )
        )

        if (
            element.name in ["h2", "h3"]
            and "AHL League Related Logos"
            in text
        ):
            break

        if element.name != "a":
            continue

        href = element.get("href")

        if not href:
            continue

        if "/logos/list_by_team/" not in href:
            continue

        team_name = clean_text(
            element.get_text(
                " ",
                strip=True,
            )
        )

        team_name = re.sub(
            r"\s+\d{4}/\d{2}\s*-\s*Pres.*$",
            "",
            team_name,
            flags=re.I,
        )

        if not team_name:
            continue

        team_url = urljoin(
            LEAGUE_URL,
            href,
        )

        already_exists = any(
            row["ahl_team"] == team_name
            for row in teams
        )

        if already_exists:
            continue

        teams.append(
            {
                "ahl_team": team_name,
                "sportslogos_team_url": team_url,
            }
        )

    return teams


def extract_primary_logo(team_url):
    soup = get_soup(team_url)

    heading = soup.find(
        lambda tag:
            tag.name in ["h2", "h3"]
            and "Primary Logos History"
            in clean_text(
                tag.get_text(
                    " ",
                    strip=True,
                )
            )
    )

    if not heading:
        return None

    for element in heading.find_all_next():

        if (
            element is not heading
            and element.name in ["h2", "h3"]
            and "Logos History"
            in clean_text(
                element.get_text(
                    " ",
                    strip=True,
                )
            )
        ):
            break

        if element.name != "img":
            continue

        src = (
            element.get("src")
            or element.get("data-src")
            or element.get("data-lazy-src")
        )

        if not src:
            continue

        src = urljoin(
            team_url,
            src,
        )

        if (
            "content.sportslogos.net"
            not in src
        ):
            continue

        return src

    return None


def download_logo(
    team_name,
    source_url,
):
    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    parsed = urlparse(
        source_url
    )

    suffix = Path(
        parsed.path
    ).suffix.lower()

    if not suffix:
        suffix = ".gif"

    filename = (
        f"{slugify(team_name)}"
        f"{suffix}"
    )

    output_path = (
        OUTPUT_DIR
        / filename
    )

    response = requests.get(
        source_url,
        headers={
            **HEADERS,
            "Referer":
                "https://www.sportslogos.net/",
        },
        timeout=30,
    )

    response.raise_for_status()

    output_path.write_bytes(
        response.content
    )

    return (
        output_path,
        f"/ahl-logos/{filename}",
    )


# --------------------------------------------------
# BIGQUERY
# --------------------------------------------------

def upload_to_bigquery(rows):
    client = bigquery.Client(
        project=PROJECT_ID
    )

    schema = [
        bigquery.SchemaField(
            "ahl_team",
            "STRING",
        ),
        bigquery.SchemaField(
            "sportslogos_team_url",
            "STRING",
        ),
        bigquery.SchemaField(
            "source_logo_url",
            "STRING",
        ),
        bigquery.SchemaField(
            "logo_url",
            "STRING",
        ),
        bigquery.SchemaField(
            "last_updated",
            "TIMESTAMP",
        ),
    ]

    job_config = (
        bigquery.LoadJobConfig(
            schema=schema,
            write_disposition=(
                bigquery.WriteDisposition
                .WRITE_TRUNCATE
            ),
        )
    )

    job = client.load_table_from_json(
        rows,
        TABLE_REF,
        job_config=job_config,
    )

    job.result()

    print(
        f"\nUploaded "
        f"{len(rows)} rows "
        f"to {TABLE_REF}"
    )


# --------------------------------------------------
# MAIN
# --------------------------------------------------

def main():
    print("=" * 70)
    print("AHL LOGO SCRAPER")
    print("=" * 70)

    print(
        f"\nLogo output folder:\n"
        f"{OUTPUT_DIR}"
    )

    print(
        "\nLoading AHL team list..."
    )

    soup = get_soup(
        LEAGUE_URL
    )

    teams = extract_current_teams(
        soup
    )

    print(
        f"Found {len(teams)} "
        f"current AHL teams.\n"
    )

    rows = []

    for i, team in enumerate(
        teams,
        start=1,
    ):
        team_name = (
            team["ahl_team"]
        )

        team_url = (
            team[
                "sportslogos_team_url"
            ]
        )

        print(
            f"[{i}/{len(teams)}] "
            f"{team_name}"
        )

        source_logo_url = None
        local_logo_url = None

        try:
            source_logo_url = (
                extract_primary_logo(
                    team_url
                )
            )

            if not source_logo_url:
                print(
                    "    WARNING: "
                    "No logo URL found"
                )
            else:
                print(
                    f"    Source: "
                    f"{source_logo_url}"
                )

                (
                    output_path,
                    local_logo_url,
                ) = download_logo(
                    team_name,
                    source_logo_url,
                )

                print(
                    f"    Saved: "
                    f"{output_path.name}"
                )

                print(
                    f"    App URL: "
                    f"{local_logo_url}"
                )

        except Exception as exc:
            print(
                f"    ERROR: {exc}"
            )

        rows.append(
            {
                "ahl_team":
                    team_name,

                "sportslogos_team_url":
                    team_url,

                "source_logo_url":
                    source_logo_url,

                "logo_url":
                    local_logo_url,

                "last_updated":
                    datetime.now(
                        timezone.utc
                    ).isoformat(),
            }
        )

    found = sum(
        1
        for row in rows
        if row["logo_url"]
    )

    print(
        "\nScrape complete."
    )

    print(
        f"Logos downloaded: "
        f"{found}/{len(rows)}"
    )

    upload_to_bigquery(
        rows
    )


if __name__ == "__main__":
    main()