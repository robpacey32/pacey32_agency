import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.cloud import bigquery


# ---------------------------------------------------------
# PATHS
# ---------------------------------------------------------

LLM_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = LLM_DIR.parent

SCHEMA_FILE = LLM_DIR / "schema.json"
SEMANTICS_FILE = LLM_DIR / "semantics.json"
ENV_FILE = PROJECT_ROOT / ".env"


# ---------------------------------------------------------
# CONFIG
# ---------------------------------------------------------

PROJECT_ID = "pacey32-agency"

MAX_BYTES_PROCESSED = 100 * 1024 * 1024
MAX_BYTES_BILLED = 100 * 1024 * 1024

MAX_HISTORY = 5


# ---------------------------------------------------------
# LOAD ENVIRONMENT
# ---------------------------------------------------------

load_dotenv(ENV_FILE)

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError(
        "GEMINI_API_KEY not found in project .env file."
    )


# ---------------------------------------------------------
# CLIENTS
# ---------------------------------------------------------

client = genai.Client(
    api_key=api_key,
    http_options=types.HttpOptions(
        timeout=30000,
    ),
)

bq_client = bigquery.Client(
    project=PROJECT_ID
)


# ---------------------------------------------------------
# LOAD DATA CONTEXT
# ---------------------------------------------------------

with open(SCHEMA_FILE, "r") as f:
    schema = json.load(f)

with open(SEMANTICS_FILE, "r") as f:
    semantics = json.load(f)


# ---------------------------------------------------------
# SESSION CONTEXT
# ---------------------------------------------------------

def new_context():
    return {
        "player": None,
        "team": None,
        "city": None,
        "awaiting": None,
    }


def format_context(context):
    if not context:
        return "No established session context."

    parts = []

    player = context.get("player")
    team = context.get("team")
    city = context.get("city")

    if player:
        parts.append(
            f"Current player: "
            f"{player['playerName']} "
            f"(playerId {player['playerId']}, "
            f"position {player['position']})"
        )

    if team:
        parts.append(
            f"Team currently being discussed: "
            f"{team['teamName']} "
            f"({team['teamCode']}, "
            f"teamId {team['teamId']})"
        )

    if city:
        parts.append(
            f"Current city: {city['cityName']}"
        )

    if not parts:
        return "No established session context."

    return "\n".join(parts)


# ---------------------------------------------------------
# GEMINI ERROR CHECK
# ---------------------------------------------------------

def is_temporary_error(error):
    error_text = str(error).lower()

    return (
        "429" in error_text
        or "resource_exhausted" in error_text
        or "quota exceeded" in error_text
        or "503" in error_text
        or "504" in error_text
        or "timeout" in error_text
        or "timed out" in error_text
        or "deadline_exceeded" in error_text
        or "deadline expired" in error_text
    )


# ---------------------------------------------------------
# FORMAT CONVERSATION HISTORY
# ---------------------------------------------------------

def format_history(history):
    if not history:
        return "No previous conversation."

    recent_history = history[-MAX_HISTORY:]

    parts = []

    for item in recent_history:
        parts.append(
            f"""
USER:
{item["question"]}

ASSISTANT:
{item["answer"]}
"""
        )

    return "\n".join(parts)


# ---------------------------------------------------------
# SUBJECT REQUIREMENTS
# ---------------------------------------------------------

def requires_player(question):
    text = question.lower().strip()

    player_patterns = [
        r"\bme\b",
        r"\bmy\b",
        r"\bmyself\b",
        r"\bfor me\b",
        r"\bafford me\b",
        r"\bmy position\b",
        r"\bmy contract\b",
        r"\bmy career\b",
        r"\bmy comparables\b",
        r"\bwhere should i\b",
    ]

    return any(
        re.search(pattern, text)
        for pattern in player_patterns
    )


# ---------------------------------------------------------
# PLAYER LOOKUP
# ---------------------------------------------------------

def find_player(player_name):
    sql = """
        SELECT
            playerId,
            playerName,
            teamId,
            teamCode,
            teamName,
            position
        FROM `pacey32-agency.LLM.Player`
        WHERE LOWER(playerName) = LOWER(@player_name)
        LIMIT 2
    """

    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter(
                "player_name",
                "STRING",
                player_name,
            )
        ],
        maximum_bytes_billed=MAX_BYTES_BILLED,
    )

    rows = list(
        bq_client.query(
            sql,
            job_config=job_config,
        ).result()
    )

    if len(rows) != 1:
        return None

    row = rows[0]

    return {
        "playerId": row.playerId,
        "playerName": row.playerName,
        "teamId": row.teamId,
        "teamCode": row.teamCode,
        "teamName": row.teamName,
        "position": row.position,
    }


# ---------------------------------------------------------
# DETECT PLAYER INTRODUCTION
# ---------------------------------------------------------

def extract_player_introduction(question):
    text = question.strip()

    patterns = [
        r"^i['’]?m\s+(.+?)[.!]?$",
        r"^i am\s+(.+?)[.!]?$",
        r"^my name is\s+(.+?)[.!]?$",
    ]

    for pattern in patterns:
        match = re.match(
            pattern,
            text,
            flags=re.IGNORECASE,
        )

        if match:
            return match.group(1).strip()

    return None


# ---------------------------------------------------------
# TEAM LOOKUP
# ---------------------------------------------------------

def get_all_teams():
    sql = """
        SELECT
            teamId,
            teamCode,
            teamName,
            venueLocation
        FROM `pacey32-agency.LLM.Team`
    """

    job_config = bigquery.QueryJobConfig(
        maximum_bytes_billed=MAX_BYTES_BILLED,
    )

    rows = list(
        bq_client.query(
            sql,
            job_config=job_config,
        ).result()
    )

    return [
        {
            "teamId": row.teamId,
            "teamCode": row.teamCode,
            "teamName": row.teamName,
            "venueLocation": row.venueLocation,
        }
        for row in rows
    ]


def find_team_in_text(text):
    text_lower = text.lower()

    teams = get_all_teams()

    matches = []

    for team in teams:
        team_name = (
            team.get("teamName") or ""
        ).lower()

        team_code = (
            team.get("teamCode") or ""
        ).lower()

        home_location = (
            team.get("venueLocation") or ""
        ).lower()

        # Full team name, e.g. "Detroit Red Wings"
        if (
            team_name
            and team_name in text_lower
        ):
            matches.append(team)
            continue

        # Home location, e.g. "Detroit"
        if (
            home_location
            and re.search(
                rf"\b{re.escape(home_location)}\b",
                text_lower,
            )
        ):
            matches.append(team)
            continue

        # Nickname, e.g. "Red Wings"
        if team_name and home_location:
            nickname = team_name

            if nickname.startswith(
                home_location + " "
            ):
                nickname = nickname[
                    len(home_location) + 1:
                ]

                if (
                    len(nickname) >= 4
                    and nickname in text_lower
                ):
                    matches.append(team)
                    continue

        # Team code, e.g. DET
        if (
            team_code
            and len(team_code) >= 3
            and re.search(
                rf"\b{re.escape(team_code)}\b",
                text_lower,
            )
        ):
            matches.append(team)

    # Remove duplicates.
    unique_matches = {
        team["teamId"]: team
        for team in matches
    }

    matches = list(
        unique_matches.values()
    )

    if len(matches) == 1:
        return matches[0]

    return None


# ---------------------------------------------------------
# HANDLE SESSION CONTEXT
# ---------------------------------------------------------

def handle_context(question, context):
    # ---------------------------------------------
    # USER IS ANSWERING A PLAYER CLARIFICATION
    # ---------------------------------------------

    if context.get("awaiting") == "player":
        player = find_player(question)

        if not player:
            return (
                "I couldn't identify that NHL player. "
                "Which player are you or do you represent?"
            )

        context["player"] = player
        context["awaiting"] = None

        return (
            f"Got it — I'll treat you as "
            f"{player['playerName']}."
        )

    # ---------------------------------------------
    # EXPLICIT PLAYER INTRODUCTION
    # ---------------------------------------------

    player_name = extract_player_introduction(
        question
    )

    if player_name:
        player = find_player(player_name)

        if player:
            context["player"] = player
            context["awaiting"] = None

        # Keep existing behaviour:
        # allow normal SQL/answer flow to continue.
        return None

    # ---------------------------------------------
    # PLAYER REQUIRED BUT NOT KNOWN
    # ---------------------------------------------

    if (
        requires_player(question)
        and not context.get("player")
    ):
        context["awaiting"] = "player"

        return "Which player are you or do you represent?"

    # ---------------------------------------------
    # EXPLICIT TEAM REFERENCE
    # ---------------------------------------------

    team = find_team_in_text(question)

    if team:
        context["team"] = team

    return None


# ---------------------------------------------------------
# SELECT RELEVANT LLM TABLES
# ---------------------------------------------------------

def get_relevant_tables(question, history):
    text = (
        format_history(history)
        + "\n"
        + question
    ).lower()

    tables = {"LLM.Player"}

    if any(term in text for term in [
        "best for me",
        "best team",
        "where should",
        "destination",
        "fit",
        "afford me",
        "afford him",
        "afford",
    ]):
        tables.update({
            "LLM.PlayerTeamFit",
            "LLM.PlayerCurrentContract",
            "LLM.TeamCap",
        })

    if any(term in text for term in [
        "comparable",
        "comparables",
        "similar player",
        "similar players",
    ]):
        tables.add("LLM.PlayerComparables")

    if any(term in text for term in [
        "points",
        "goals",
        "assists",
        "ppg",
        "performance",
        "production",
        "trajectory",
        "toi",
    ]):
        tables.add("LLM.PlayerPerformance")

    if any(term in text for term in [
        "contract",
        "cap hit",
        "aav",
        "salary",
        "agent",
        "term",
        "expiry",
    ]):
        tables.update({
            "LLM.PlayerCurrentContract",
            "LLM.PlayerContracts",
        })

    if any(term in text for term in [
        "team",
        "roster",
        "depth",
        "lineup",
        "position",
    ]):
        tables.update({
            "LLM.Team",
            "LLM.TeamRoster",
        })

    if any(term in text for term in [
        "coach",
        "general manager",
        " gm ",
        "owner",
        "captain",
        "organisation",
        "organization",
        "ahl",
    ]):
        tables.add("LLM.TeamOrganisation")

    if any(term in text for term in [
        "travel",
        "miles",
        "road trip",
    ]):
        tables.add("LLM.TeamTravel")

    if any(term in text for term in [
        "tax",
        "take home",
        "take-home",
    ]):
        tables.add("LLM.CityTax")

    if any(term in text for term in [
        "cost of living",
        "cost to live",
        "expensive",
        "cheap",
        "affordability",
        "housing",
    ]):
        tables.add("LLM.CityCostOfLiving")

    if any(term in text for term in [
        "climate",
        "weather",
        "sun",
        "sunshine",
        "temperature",
        "snow",
    ]):
        tables.add("LLM.CityClimate")

    if any(term in text for term in [
        "city",
        "where is",
        "location",
        "live in",
        "living in",
    ]):
        tables.add("LLM.City")

    if any(term in text for term in [
        "live in",
        "living in",
        "like to live",
        "lifestyle",
        "quality of life",
        "what's it like",
        "what is it like",
    ]):
        tables.update({
            "LLM.City",
            "LLM.CityClimate",
            "LLM.CityCostOfLiving",
            "LLM.CityTax",
        })

    return tables


# ---------------------------------------------------------
# BUILD SQL PROMPT
# ---------------------------------------------------------

def build_sql_prompt(
    question,
    history,
    context,
):
    conversation = format_history(history)

    relevant_tables = get_relevant_tables(
        question,
        history,
    )

    filtered_schema = [
        table
        for table in schema
        if table.get("table") in relevant_tables
    ]

    filtered_semantics = {
        **semantics,
        "relationships": [
            relationship
            for relationship in semantics.get(
                "relationships", []
            )
            if any(
                table in relationship["from"]
                or table in relationship["to"]
                for table in relevant_tables
            )
        ],
        "tables": {
            table: details
            for table, details
            in semantics.get(
                "tables", {}
            ).items()
            if table in relevant_tables
        },
    }

    session_context = format_context(context)

    return f"""
You are an expert BigQuery SQL generator for an NHL analytics database.

Your task is to convert the user's latest question into valid Google BigQuery SQL.

RULES:

- Return ONLY valid Google BigQuery SQL.
- Do not include markdown fences, explanations or commentary.
- Generate SELECT or WITH queries only.
- Use only tables and columns supplied in the database schema.
- Never invent table names or column names.
- Prefer LLM semantic views over underlying source tables.

- Treat ESTABLISHED SESSION CONTEXT as authoritative for the current player and the team or city currently being discussed.
- When a team is established in session context and the user's question refers contextually to that team, filter the query to that team.
- Do not confuse the team currently being discussed with the player's actual current NHL team.
- Use conversation history to resolve other references such as "him", "there", "that team" or "that city".
- Reuse an established player, team or city from session context when appropriate.
- Use canonical playerId and teamId when available.

- Prefer filtering a target table directly when it already contains the required player or team identifier.
- Do not add unnecessary joins.
- When a query joins multiple tables, always qualify every selected, filtered, grouped and ordered column with its table alias.
- Never use an unqualified column name in a multi-table query.
- Do not join LLM.Team solely to identify or filter a team when the target table already contains teamId, teamCode or teamName.
- Select only columns needed to answer the question.
- Do not create arbitrary scores, weights, similarity thresholds or rankings.
- Lower rank values are better unless the semantic definitions explicitly state otherwise.

- IMPORTANT: For questions about "my position", use ONLY the established player's position from ESTABLISHED SESSION CONTEXT.
- Never add or infer additional positions when answering a "my position" question.
- For example, if the established player's position is C, match C only. Do NOT also match LW or RW.
- LLM.TeamRoster.position may contain comma-separated positions such as "C,LW" or "C,RW".
- A multi-position roster player counts as a match when the established player's position appears in that comma-separated list.
- Use SPLIT(position, ',') and IN UNNEST(...) for this matching.
- Example: if the established player's position is C, use exactly: 'C' IN UNNEST(SPLIT(position, ','))
- Do not use POSITION() for positional matching.
- For current positional competition, always filter LLM.TeamRoster.isDepthChart = TRUE.

- For player-specific destination questions such as "Where is best for me?", "Where should I go?", "Which teams fit me?" or similar:
  - Use LLM.PlayerTeamFit as the primary source.
  - Treat the question as a multi-dimensional destination comparison.
  - Unless the user explicitly asks to consider teams requiring roster or cap-management moves, filter to canAffordCurrent = TRUE.
  - Return currentCapGap, playersAtPosition, incomeTaxRank, affordabilityRank, sunshineRank, distanceRank and roadTripRank when available.
  - Do not select a single best team unless the user has supplied priorities or weighting.
  - Do not create an overall score or arbitrary weighting.

DATABASE SCHEMA:

{json.dumps(filtered_schema, indent=2)}

SEMANTIC DEFINITIONS:

{json.dumps(filtered_semantics, indent=2)}

ESTABLISHED SESSION CONTEXT:

{session_context}

CONVERSATION HISTORY:

{conversation}

LATEST USER QUESTION:

{question}
"""


# ---------------------------------------------------------
# GENERATE SQL
# ---------------------------------------------------------

def generate_sql(
    question,
    history,
    context,
):
    prompt = build_sql_prompt(
        question,
        history,
        context,
    )

    models = [
        "gemini-3.7-flash",
        "gemini-3.8-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
    ]

    for model in models:
        try:
            print(
                f"\n[Generating SQL with {model}]"
            )

            response = client.models.generate_content(
                model=model,
                contents=prompt,
            )

            if not response.text:
                raise RuntimeError(
                    f"{model} returned an empty response."
                )

            return response.text.strip()

        except Exception as e:
            if not is_temporary_error(e):
                raise

            error_text = str(e)

            if "GenerateRequestsPerDayPerProjectPerModel-FreeTier" in error_text:
                reason = "daily free-tier quota exhausted"
            elif "429" in error_text or "RESOURCE_EXHAUSTED" in error_text:
                reason = "rate/quota limit"
            elif "503" in error_text:
                reason = "high demand / service unavailable"
            elif "504" in error_text or "deadline" in error_text.lower():
                reason = "request timed out"
            else:
                reason = str(e)[:200]

            print(
                f"[{model}: {reason} - trying fallback]"
            )

    raise RuntimeError(
        "All Gemini models are temporarily unavailable."
    )


# ---------------------------------------------------------
# VALIDATE SQL
# ---------------------------------------------------------

def validate_sql(sql):
    cleaned = sql.strip()

    cleaned = re.sub(
        r"^```(?:sql)?\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )

    cleaned = re.sub(
        r"\s*```$",
        "",
        cleaned,
    )

    cleaned = cleaned.strip()

    if not cleaned:
        raise ValueError(
            "Blocked: Gemini returned empty SQL."
        )

    cleaned = cleaned.rstrip().rstrip(";").strip()

    first_word = cleaned.split()[0].upper()

    if first_word not in {"SELECT", "WITH"}:
        raise ValueError(
            "Blocked: only SELECT queries are allowed."
        )

    if ";" in cleaned:
        raise ValueError(
            "Blocked: multiple SQL statements are not allowed."
        )

    blocked_words = [
        "INSERT",
        "UPDATE",
        "DELETE",
        "DROP",
        "CREATE",
        "ALTER",
        "MERGE",
        "TRUNCATE",
        "GRANT",
        "REVOKE",
    ]

    upper_sql = cleaned.upper()

    for word in blocked_words:
        if re.search(
            rf"\b{word}\b",
            upper_sql,
        ):
            raise ValueError(
                f"Blocked unsafe SQL keyword: {word}"
            )

    return cleaned


# ---------------------------------------------------------
# BIGQUERY DRY RUN
# ---------------------------------------------------------

def dry_run_query(sql):
    job_config = bigquery.QueryJobConfig(
        dry_run=True,
        use_query_cache=False,
    )

    query_job = bq_client.query(
        sql,
        job_config=job_config,
    )

    return query_job.total_bytes_processed


# ---------------------------------------------------------
# EXECUTE BIGQUERY
# ---------------------------------------------------------

def execute_query(sql):
    job_config = bigquery.QueryJobConfig(
        maximum_bytes_billed=MAX_BYTES_BILLED,
    )

    query_job = bq_client.query(
        sql,
        job_config=job_config,
    )

    return list(query_job.result())


# ---------------------------------------------------------
# GENERATE NATURAL-LANGUAGE ANSWER
# ---------------------------------------------------------

def generate_answer(
    question,
    rows,
    history,
    context,
):
    result_data = [
        dict(row)
        for row in rows
    ]

    conversation = format_history(history)
    session_context = format_context(context)

    prompt = f"""
You are an NHL analytics assistant.

Answer the user's latest question using ONLY the query results provided.

RULES:

- Give a concise, natural-language answer.
- Do not mention SQL, BigQuery, databases or the query.
- Do not invent information.
- Do not use outside NHL knowledge.
- Preserve all numbers accurately.
- Treat ESTABLISHED SESSION CONTEXT as authoritative for the current player and the team or city currently being discussed.
- Do not confuse the team currently being discussed with the player's actual current NHL team.
- Use the conversation history to understand the context of the question.
- The query results are the authoritative source for the answer.
- If the results do not contain enough information to answer the question, say so.
- Never state personal facts about the user or player unless they explicitly appear in the session context, conversation history or query results.

- Distinguish factual lookup questions from analytical or comparative questions.
- For analytical or comparative questions, interpret ALL relevant returned dimensions rather than answering from only one field.
- Translate rankings and metrics into plain-English advantages and disadvantages.
- Highlight meaningful strengths and weaknesses rather than mechanically listing every returned value.
- Explain meaningful trade-offs between the strongest relevant options.
- Do not create an overall score, weighting or ranking unless one is explicitly present in the results or supplied by the user.
- Do not describe one option as objectively best when different dimensions favour different options and the user's priorities are unknown.
- If priorities are needed to determine what "best" means, explain the trade-offs and ask what matters most to the user.

- When comparing player destination options:
  - Lower rank numbers are better.
  - A larger positive currentCapGap means greater current cap flexibility.
  - Fewer playersAtPosition means less basic positional competition, but does not prove greater playing opportunity.
  - incomeTaxRank is a location tax comparison, not the player's actual effective tax rate.
  - affordabilityRank is a cost-of-living comparison.
  - sunshineRank is a climate comparison.
  - distanceRank and roadTripRank are travel comparisons.
  - Compare cap flexibility, positional competition, tax, cost of living, climate and travel when those fields are present.
  - State the meaningful advantages and disadvantages of the leading options.
  - Do not merely repeat the returned values.
  - If different options lead on different dimensions, explain that there is no single best option without knowing the user's priorities.
  - Do not assume a team with insufficient current cap space is impossible as a destination; it only means the team cannot accommodate the current cap hit using the cap space shown without other roster or cap-management changes.

ESTABLISHED SESSION CONTEXT:

{session_context}

CONVERSATION HISTORY:

{conversation}

LATEST USER QUESTION:

{question}

QUERY RESULTS:

{json.dumps(result_data, indent=2, default=str)}
"""

    models = [
        "gemini-3.5-flash-lite",
        "gemini-3.7-flash",
        "gemini-3.8-flash",
        "gemini-3.6-flash",
    ]

    for model in models:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
            )

            if not response.text:
                continue

            return response.text.strip()

        except Exception as e:
            if not is_temporary_error(e):
                raise

    return None


# ---------------------------------------------------------
# PROCESS ONE QUESTION
# ---------------------------------------------------------

def process_question(
    question,
    history,
    context,
):
    # ---------------------------------------------
    # DETERMINISTIC CONTEXT CHECK
    # ---------------------------------------------

    context_answer = handle_context(
        question,
        context,
    )

    if context_answer:
        return context_answer

    # ---------------------------------------------
    # GENERATE SQL
    # ---------------------------------------------

    sql = generate_sql(
        question,
        history,
        context,
    )


    # ---------------------------------------------
    # VALIDATE SQL
    # ---------------------------------------------

    sql = validate_sql(sql)

    print("\nSQL:")
    print(sql)

    # ---------------------------------------------
    # BIGQUERY DRY RUN
    # ---------------------------------------------

    bytes_processed = dry_run_query(sql)

    mb_processed = (
        bytes_processed / (1024 * 1024)
    )

    print(
        f"\nEstimated scan: "
        f"{mb_processed:.3f} MB"
    )

    # ---------------------------------------------
    # COST SAFETY CHECK
    # ---------------------------------------------

    if bytes_processed > MAX_BYTES_PROCESSED:
        raise ValueError(
            "Query blocked: estimated processing "
            "exceeds the 100 MB prototype limit."
        )

    # ---------------------------------------------
    # EXECUTE AUTOMATICALLY
    # ---------------------------------------------

    rows = execute_query(sql)

    if not rows:
        return "I couldn't find any matching data."

    # ---------------------------------------------
    # NATURAL-LANGUAGE ANSWER
    # ---------------------------------------------

    answer = generate_answer(
        question,
        rows,
        history,
        context,
    )

    if answer:
        return answer

    return (
        "I found the data, but Gemini was temporarily "
        f"unavailable to format the answer: "
        f"{[dict(row) for row in rows]}"
    )


# ---------------------------------------------------------
# MAIN CHAT LOOP
# ---------------------------------------------------------

def main():
    print("\nPacey32 NHL Data Assistant")
    print("--------------------------")
    print("Type 'exit' to quit.")

    history = []
    context = new_context()

    while True:
        question = input(
            "\nYou: "
        ).strip()

        if not question:
            continue

        if question.lower() in {
            "exit",
            "quit",
            "q",
        }:
            print("\nGoodbye.")
            break

        try:
            answer = process_question(
                question,
                history,
                context,
            )

            print(
                f"\nAssistant: {answer}"
            )

            history.append(
                {
                    "question": question,
                    "answer": answer,
                }
            )

        except RuntimeError as e:
            print(
                f"\nAssistant: {e}"
            )

        except ValueError as e:
            print(
                f"\nSafety error: {e}"
            )

        except Exception as e:
            print(
                f"\nError: {e}"
            )


# ---------------------------------------------------------
# RUN
# ---------------------------------------------------------

if __name__ == "__main__":
    main()