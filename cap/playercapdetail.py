import json
import re
import time
import pandas as pd
from datetime import datetime, timezone
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from google.cloud import bigquery

# ============================================================
# CONFIG
# ============================================================

PROJECT_ID = "pacey32-agency"
SOURCE_TABLE = "pacey32-agency.Cap.Player"
OUTPUT_TABLE = "pacey32-agency.Cap.PlayerDetail"

BATCH_SIZE = 50
PAGE_TIMEOUT = 60000

# ============================================================
# HELPERS
# ============================================================

def clean_text(value):
    if value is None: return None
    value = re.sub(r"\s+", " ", str(value)).strip()
    return value or None

def parse_money(value):
    if not value: return None
    text = str(value).replace("$", "").replace(",", "").strip().upper()
    match = re.search(r"([\d.]+)\s*([KMB])?", text)
    if not match: return None
    number = float(match.group(1))
    multiplier = {"K":1_000,"M":1_000_000,"B":1_000_000_000}.get(match.group(2),1)
    return int(number * multiplier)

def parse_int(value):
    if value is None: return None
    match = re.search(r"\d+", str(value).replace(",", ""))
    return int(match.group()) if match else None

# ============================================================
# PLAYER PARSER
# ============================================================

def parse_player_detail(html, url):
    soup = BeautifulSoup(html, "html.parser")

    player = {
        "player":None,
        "player_url":url,
        "leadership_role":None,
        "sweater_number":None,
        "age":None,
        "position":None,
        "shoots_catches":None,
        "height":None,
        "height_inches":None,
        "weight_lbs":None,
        "depth_chart_position":None,
        "depth_chart_line":None,
        "drafted":False,
        "draft_round":None,
        "draft_pick":None,
        "draft_year":None,
        "agent":None,
        "birthdate":None,
        "birthplace":None,
        "nationality":None,
        "ufa_year":None,
        "elc_age":None,
        "waivers_eligibility":None,
        "estimated_career_earnings":None,
    }

    # JSON-LD
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue

        if data.get("@type") != "SportsTeam": continue

        role = data.get("member", {})
        person = role.get("member", {})

        if person.get("@type") != "Person": continue

        player["player"] = person.get("name")
        player["sweater_number"] = parse_int(role.get("numberedPosition"))

        position_map = {
            "Center":"C","Left Wing":"LW","Right Wing":"RW",
            "Defense":"D","Defence":"D","Goalie":"G","Goaltender":"G"
        }

        role_name = role.get("roleName")
        player["position"] = position_map.get(role_name, role_name)
        player["birthdate"] = person.get("birthDate")
        player["nationality"] = person.get("nationality")

        height = person.get("height", {})
        weight = person.get("weight", {})
        earnings = person.get("netWorth", {})

        player["height_inches"] = parse_int(height.get("value"))
        player["weight_lbs"] = parse_int(weight.get("value"))
        player["estimated_career_earnings"] = parse_money(earnings.get("value"))

        if player["height_inches"]:
            feet, inches = divmod(player["height_inches"], 12)
            player["height"] = f"{feet}'{inches}\""

        if player["birthdate"]:
            try:
                dob = datetime.strptime(player["birthdate"], "%Y-%m-%d").date()
                today = datetime.now().date()
                player["age"] = today.year - dob.year - ((today.month,today.day) < (dob.month,dob.day))
            except ValueError:
                pass

        break

    # Header
    for label in soup.select(".pp_subset"):
        key = clean_text(label.get_text(" ", strip=True))
        parent = label.parent
        if not parent: continue

        value_element = parent.select_one(".statsrow_val")
        if not value_element: continue

        value = clean_text(value_element.get_text(" ", strip=True))
        if not value: continue

        key_lower = key.lower() if key else ""

        if key_lower == "#": player["sweater_number"] = parse_int(value)
        elif key_lower == "age": player["age"] = parse_int(value)
        elif key_lower == "pos": player["position"] = value.upper()
        elif key_lower in {"shot","catches"}: player["shoots_catches"] = value.upper()

        elif key_lower == "h":
            player["height"] = value
            match = re.search(r"(\d+)['′]\s*(\d+)", value)
            if match: player["height_inches"] = int(match.group(1))*12 + int(match.group(2))

        elif key_lower == "w":
            player["weight_lbs"] = parse_int(value)

    # Leadership
    for text in soup.stripped_strings:
        value = clean_text(text)
        if value in {"Captain","A. Captain","Alternate Captain"}:
            player["leadership_role"] = value
            break

    # Depth chart
    depth = soup.select_one(".pp_dc")

    if depth:
        chip = depth.select_one(".pp_dc_chip")
        value = depth.select_one(".pp_dc_value")

        if chip:
            chip_text = clean_text(chip.get_text(" ", strip=True))
            if chip_text:
                match = re.match(r"([A-Za-z]+)(\d+)", chip_text)

                if match:
                    player["depth_chart_position"] = match.group(1).upper()
                    player["depth_chart_line"] = int(match.group(2))
                else:
                    player["depth_chart_position"] = chip_text

        if value and player["depth_chart_line"] is None:
            player["depth_chart_line"] = parse_int(value.get_text(" ", strip=True))

    # Micro fields
    for micro in soup.select(".micro_row"):
        label_element = micro.select_one(".micro_label")
        value_element = micro.select_one(".micro_value")

        if not label_element or not value_element: continue

        label = clean_text(label_element.get_text(" ", strip=True))
        value = clean_text(value_element.get_text(" ", strip=True))

        if not label or not value: continue

        label_lower = label.lower()

        if "ufa year" in label_lower: player["ufa_year"] = parse_int(value)
        elif "elc age" in label_lower: player["elc_age"] = parse_int(value)
        elif "waivers eligibility" in label_lower: player["waivers_eligibility"] = value
        elif "career earnings" in label_lower:
            amount = parse_money(value)
            if amount is not None: player["estimated_career_earnings"] = amount

    # Draft
    draft_label = soup.find("span", string=lambda x: x and x.strip() == "Draft Team")

    if draft_label:
        player["drafted"] = True
        draft_values = draft_label.parent.find_next_sibling("div")

        if draft_values:
            for item in draft_values.find_all("div", recursive=False):
                text = clean_text(item.get_text(" ", strip=True))
                if not text: continue

                match = re.search(r"Round\s+(\d+)", text, re.I)
                if match:
                    player["draft_round"] = int(match.group(1))
                    continue

                match = re.search(r"Pick\s+(\d+)", text, re.I)
                if match:
                    player["draft_pick"] = int(match.group(1))
                    continue

                match = re.search(r"Year\s+(20\d{2})", text, re.I)
                if match: player["draft_year"] = int(match.group(1))

    # Agent / birthplace
    for label_node in soup.find_all(string=re.compile(r"^(Agent|Born|Birthplace)$", re.I)):
        label = clean_text(str(label_node))
        parent = label_node.parent

        if not parent or not parent.parent: continue

        text = clean_text(parent.parent.get_text(" ", strip=True))
        if not text: continue

        value = re.sub(rf"^{re.escape(label)}\s*:?\s*", "", text, flags=re.I).strip()

        if label.lower() == "agent" and value:
            player["agent"] = value
        elif label.lower() in {"born","birthplace"} and value and not player["birthplace"]:
            player["birthplace"] = value

    # ========================================================
    # CONTRACTS
    # ========================================================

    rows = []
    contract_root = soup.select_one("#player-contract-tab-panels")

    if not contract_root:
        return rows

    x_data = contract_root.get("x-data", "")
    options_match = re.search(r"options:\s*(\[.*?\])\s*,\s*tabSelected:", x_data, re.S)
    selected_match = re.search(r"tabSelected:\s*(\d+)", x_data)

    if not options_match:
        return rows

    options = json.loads(options_match.group(1))
    selected_contract = int(selected_match.group(1)) if selected_match else None

    for contract_number, option in enumerate(options, 1):
        contract_id = option["contract_id"]
        contract_value = int(option["value"])
        panel = soup.select_one(f"#c_{contract_id}")

        if not panel: continue

        panel_text = clean_text(panel.get_text(" ", strip=True))
        row = dict(player)

        row.update({
            "contract_number":contract_number,
            "contract_id":contract_id,
            "current_contract":contract_value == selected_contract,
            "team":None,
            "contract_type":None,
            "season_from":None,
            "season_to":None,
            "cap_hit":None,
            "term":None,
            "total_value":None,
            "signing_status":None,
            "signing_age":None,
            "expiry_status":None,
            "expiry_year":None,
            "expiry_age":None,
            "signed_date":None,
            "pct_cap_contract_start":None,
            "signing_gm":None,
            "signing_agent":None,
            "offer_sheet":None,
        })

        # Team
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string or "")
            except:
                continue

            if data.get("@type") == "SportsTeam":
                row["team"] = data.get("name")
                break

        # Contract summary
        match = re.search(r"\b(20\d{2}-\d{2})\s+to\s+(20\d{2}-\d{2})\b", panel_text)
        if match:
            row["season_from"], row["season_to"] = match.group(1), match.group(2)

        match = re.search(r"\b(Entry Level Contract|Standard Player Contract|Standard Contract)\b", panel_text, re.I)
        if match: row["contract_type"] = match.group(1)

        match = re.search(r"Cap Hit\s+\$([\d,]+)", panel_text, re.I)
        if match: row["cap_hit"] = int(match.group(1).replace(",",""))

        match = re.search(r"Term\s+(\d+)\s+years?", panel_text, re.I)
        if match: row["term"] = int(match.group(1))

        match = re.search(r"Total Value\s+\$([\d,]+)", panel_text, re.I)
        if match: row["total_value"] = int(match.group(1).replace(",",""))

        match = re.search(r"Signing Status\s+([A-Za-z0-9.()]+)\s+age\s+(\d+)", panel_text, re.I)
        if match:
            row["signing_status"], row["signing_age"] = match.group(1).upper(), int(match.group(2))

        # GROUP 6 FIX:
        # Previous regex did not allow "-" in values such as UFA-GROUP6.
        match = re.search(
            r"Expiry Status\s+(\S+)\s+(20\d{2})\s+age\s+(\d+)",
            panel_text,
            re.I
        )
        if match:
            row["expiry_status"] = match.group(1).upper()
            row["expiry_year"] = int(match.group(2))
            row["expiry_age"] = int(match.group(3))

        match = re.search(r"Signed\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})", panel_text, re.I)
        if match:
            try: row["signed_date"] = datetime.strptime(match.group(1), "%b %d, %Y").date()
            except ValueError: pass

        match = re.search(r"% Cap Contract Start\s+([\d.]+)%", panel_text, re.I)
        if match: row["pct_cap_contract_start"] = float(match.group(1))

        # GM / agent
        for source_label, field in [("Signing GM","signing_gm"),("Signing Agent","signing_agent")]:
            label = panel.find(string=lambda x: x and clean_text(x) == source_label)

            if label and label.parent and label.parent.parent:
                spans = label.parent.parent.find_all("span", recursive=False)
                if len(spans) >= 2:
                    row[field] = clean_text(spans[-1].get_text(" ", strip=True))

        if re.search(r"Offer Sheet\s+Offer Sheet Matched", panel_text, re.I):
            row["offer_sheet"] = "Offer Sheet Matched"
        elif re.search(r"\bOffer Sheet\b", panel_text, re.I):
            row["offer_sheet"] = "Offer Sheet"

        # Annual fields
        for yr in range(1,9):
            for field in ["cap_hit","aav","base_salary","performance_bonus","signing_bonus","total_salary","minors_salary","clauses"]:
                row[f"{field}_yr{yr}"] = None

        table = panel.find("table")

        if table:
            field_map = {
                "cap hit":"cap_hit",
                "aav":"aav",
                "base salary":"base_salary",
                "perf. bonus":"performance_bonus",
                "performance bonus":"performance_bonus",
                "signing bonus":"signing_bonus",
                "total salary":"total_salary",
                "minors salary":"minors_salary",
                "clauses":"clauses",
            }

            table_rows = table.find_all("tr")

            if table_rows:
                headers = [clean_text(c.get_text(" ", strip=True)) for c in table_rows[0].find_all(["th","td"])]
                year_indexes = [i for i,h in enumerate(headers) if re.fullmatch(r"20\d{2}-\d{2}", h or "")]

                for tr in table_rows[1:]:
                    cells = tr.find_all("td")
                    if not cells: continue

                    label = clean_text(cells[0].get_text(" ", strip=True)).lower()
                    field = field_map.get(label)

                    if not field: continue

                    for yr, cell_index in enumerate(year_indexes, 1):
                        if yr > 8 or cell_index >= len(cells): break

                        cell = cells[cell_index]
                        value_text = clean_text(cell.get_text(" ", strip=True))

                        if field == "clauses":
                            row[f"{field}_yr{yr}"] = value_text or None
                        else:
                            value_element = cell.select_one(".val-lg")
                            money_text = clean_text(value_element.get_text(" ", strip=True)) if value_element else value_text
                            row[f"{field}_yr{yr}"] = parse_money(money_text) if money_text else None

        row["source_url"] = url
        row["scrape_datetime"] = datetime.now(timezone.utc)

        rows.append(row)

    return rows

# ============================================================
# BIGQUERY
# ============================================================

def get_player_urls(client):
    sql = f"""
    SELECT DISTINCT p.player_url
    FROM `{SOURCE_TABLE}` p
    LEFT JOIN (
        SELECT
            player_url,
            MAX(scrape_datetime) AS last_scraped
        FROM `{OUTPUT_TABLE}`
        GROUP BY player_url
    ) d
        ON p.player_url = d.player_url
    WHERE p.player_url IS NOT NULL
      AND (
          d.last_scraped IS NULL
          OR DATE(d.last_scraped) < DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)
      )
    ORDER BY p.player_url
    """
    return [row.player_url for row in client.query(sql).result()]

def upload_batch(client, rows):
    if not rows:
        return

    df = pd.DataFrame(rows)

    job_config = bigquery.LoadJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND
    )

    client.load_table_from_dataframe(
        df,
        OUTPUT_TABLE,
        job_config=job_config
    ).result()

    print(f"Uploaded {len(df):,} contract rows")

# ============================================================
# RUN
# ============================================================

def main():
    client = bigquery.Client(project=PROJECT_ID)

    player_urls = get_player_urls(client)

    print("=" * 70)
    print("PUCKPEDIA PLAYER DETAIL PIPELINE")
    print("=" * 70)
    print(f"Players: {len(player_urls):,}")
    print(f"Output: {OUTPUT_TABLE}")
    print()

    batch = []
    total_rows = 0
    failed = []

    start = time.time()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        context = browser.new_context(
            viewport={"width":1600,"height":1200},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        )

        page = context.new_page()

        for i, url in enumerate(player_urls, 1):
            player_start = time.time()

            try:
                response = page.goto(
                    url,
                    wait_until="domcontentloaded",
                    timeout=PAGE_TIMEOUT
                )

                if not response or response.status != 200:
                    raise RuntimeError(
                        f"HTTP {response.status if response else 'None'}"
                    )

                html = page.content()

                rows = parse_player_detail(
                    html=html,
                    url=url
                )

                if not rows:
                    raise RuntimeError("No contract rows parsed")

                batch.extend(rows)
                total_rows += len(rows)

                print(
                    f"{i}/{len(player_urls)} | "
                    f"{rows[0]['player']} | "
                    f"{len(rows)} contracts | "
                    f"{time.time()-player_start:.2f}s"
                )

                if len(batch) >= BATCH_SIZE:
                    upload_batch(client, batch)
                    batch = []

            except Exception as e:
                failed.append((url, str(e)))

                print(
                    f"{i}/{len(player_urls)} | "
                    f"FAILED | {url} | {e}"
                )

        browser.close()

    # Final partial batch
    if batch:
        upload_batch(client,batch)

    print()
    print("=" * 70)
    print("COMPLETE")
    print("=" * 70)
    print(f"Players attempted: {len(player_urls):,}")
    print(f"Contract rows: {total_rows:,}")
    print(f"Failed players: {len(failed):,}")
    print(f"Runtime: {(time.time()-start)/60:.1f} minutes")

    if failed:
        print()
        print("FAILED URLS")

        for url, error in failed:
            print(f"{url} | {error}")

if __name__ == "__main__":
    main()