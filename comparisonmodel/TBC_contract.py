import pandas as pd
import numpy as np
from google.cloud import bigquery
from sklearn.preprocessing import StandardScaler


# ---------------------------------------------------------
# CONFIG
# ---------------------------------------------------------

PROJECT_ID = "pacey32-agency"

PRODUCTION_FEATURES = [
    "goals_per_game",
    "assists_per_game",
    "points_per_game",
    "goals_per_60",
    "assists_per_60",
    "points_per_60"
]

MIN_GAMES = 20


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def season_start_year(season):

    if pd.isna(season):
        return np.nan

    try:
        return int(str(season)[:4])
    except:
        return np.nan


def contract_start_year(season_from):

    if pd.isna(season_from):
        return np.nan

    try:
        return int(str(season_from)[:4])
    except:
        return np.nan


# ---------------------------------------------------------
# LOAD TARGET / HISTORICAL PRODUCTION
# ---------------------------------------------------------

def load_production_data():

    client = bigquery.Client(project=PROJECT_ID)

    query = f"""
    WITH profile AS (
        SELECT
            SAFE_CAST(playerId AS INT64) AS playerId,
            ANY_VALUE(player_name) AS player,
            ANY_VALUE(position) AS position,
            ANY_VALUE(age) AS age
        FROM `pacey32-agency.Comparison.01_PlayerProfile`
        GROUP BY SAFE_CAST(playerId AS INT64)
    ),

    stats AS (
        SELECT
            SAFE_CAST(playerId AS INT64) AS playerId,
            season,
            games_played,
            goals,
            assists,
            points,
            goals_per_game,
            assists_per_game,
            points_per_game,
            goals_per_60,
            assists_per_60,
            points_per_60
        FROM `pacey32-agency.Comparison.03_PlayerSeasonStats`
        WHERE seasonPart = 'RegularSeason'
          AND games_played >= {MIN_GAMES}
    )

    SELECT
        p.playerId,
        p.player,
        p.position,
        p.age,
        s.*
        EXCEPT(playerId)

    FROM profile p
    INNER JOIN stats s
        ON p.playerId = s.playerId
    """

    df = client.query(query).to_dataframe()

    df["season_start_year"] = (
        df["season"]
        .astype(str)
        .str[:4]
        .astype(int)
    )

    return df


# ---------------------------------------------------------
# LOAD CONTRACTS
# ---------------------------------------------------------

def load_contract_data():

    client = bigquery.Client(project=PROJECT_ID)

    query = """
    SELECT
        player,
        player_url,

        age AS current_age,
        position AS contract_position,

        contract_number,
        current_contract,

        season_from,
        season_to,

        cap_hit,
        term,
        total_value,

        signing_status,
        signing_age,

        expiry_status,
        expiry_year,
        expiry_age,

        signed_date,
        pct_cap_contract_start,

        signing_GM,
        signing_agent,
        offer_sheet

    FROM `pacey32-agency.Cap.PlayerDetail`

    WHERE cap_hit IS NOT NULL
      AND term IS NOT NULL
      AND signing_age IS NOT NULL
      AND season_from IS NOT NULL
    """

    df = client.query(query).to_dataframe()

    numeric = [
        "cap_hit",
        "term",
        "total_value",
        "signing_age",
        "expiry_year",
        "expiry_age",
        "pct_cap_contract_start"
    ]

    for col in numeric:
        df[col] = pd.to_numeric(
            df[col],
            errors="coerce"
        )

    df["contract_start_year"] = (
        df["season_from"]
        .astype(str)
        .str[:4]
        .astype(int)
    )

    return df


# ---------------------------------------------------------
# CURRENT TARGET SEASON
# ---------------------------------------------------------

def get_target_player(production, player_id):

    player = production[
        production["playerId"] == player_id
    ].copy()

    if player.empty:
        raise ValueError(
            f"Player {player_id} not found"
        )

    player = (
        player
        .sort_values(
            "season_start_year",
            ascending=False
        )
        .iloc[0]
    )

    return player


# ---------------------------------------------------------
# MATCH CONTRACTS TO PRE-CONTRACT PRODUCTION
# ---------------------------------------------------------

def build_historical_contract_dataset():

    production = load_production_data()
    contracts = load_contract_data()

    # Join by player name because PlayerDetail currently
    # does not contain NHL playerId.
    merged = contracts.merge(
        production,
        on="player",
        how="inner"
    )

    # Contract beginning 2019-20 should normally use
    # the player's 2018-19 production.
    merged["seasons_before_contract"] = (
        merged["contract_start_year"]
        - merged["season_start_year"]
    )

    # Keep the latest available season BEFORE the contract.
    eligible = merged[
        merged["seasons_before_contract"] >= 1
    ].copy()

    eligible["production_gap"] = (
        eligible["seasons_before_contract"] - 1
    )

    eligible = (
        eligible
        .sort_values([
            "player",
            "contract_number",
            "production_gap",
            "season_start_year"
        ])
        .drop_duplicates(
            subset=[
                "player",
                "contract_number",
                "season_from",
                "season_to"
            ],
            keep="first"
        )
        .reset_index(drop=True)
    )

    return eligible


# ---------------------------------------------------------
# PREPARE PRODUCTION SCALING
# ---------------------------------------------------------

def prepare_production_scaler(production):

    X = production[
        PRODUCTION_FEATURES
    ].copy()

    X = X.replace(
        [np.inf, -np.inf],
        np.nan
    )

    X = X.fillna(X.median())

    scaler = StandardScaler()
    scaler.fit(X)

    return scaler


# ---------------------------------------------------------
# CONTRACT COMPARABLES
# ---------------------------------------------------------

def find_contract_comparables(player_id, n=15):

    production = load_production_data()
    target = get_target_player(
        production,
        player_id
    )

    contracts = build_historical_contract_dataset()

    # Same position
    contracts = contracts[
        contracts["position"] == target["position"]
    ].copy()

    # We need all production fields available.
    contracts = contracts.dropna(
        subset=PRODUCTION_FEATURES
    )

    if contracts.empty:
        raise ValueError(
            "No historical contract comparables found"
        )

    # -----------------------------------------------------
    # Scale using historical NHL production population
    # -----------------------------------------------------

    scaler = prepare_production_scaler(
        production
    )

    target_X = pd.DataFrame(
        [target[PRODUCTION_FEATURES].values],
        columns=PRODUCTION_FEATURES
    )

    target_scaled = scaler.transform(
        target_X
    )[0]

    contract_X = contracts[
        PRODUCTION_FEATURES
    ]

    contract_scaled = scaler.transform(
        contract_X
    )

    # -----------------------------------------------------
    # Production similarity AT CONTRACT SIGNING
    # -----------------------------------------------------

    distances = np.sqrt(
        np.mean(
            (
                contract_scaled
                - target_scaled
            ) ** 2,
            axis=1
        )
    )

    contracts["production_similarity"] = (
        np.exp(-distances) * 100
    )

    # -----------------------------------------------------
    # AGE SIMILARITY
    # -----------------------------------------------------

    contracts["age_difference"] = (
        contracts["signing_age"]
        - target["age"]
    ).abs()

    contracts["age_similarity"] = (
        np.exp(
            -contracts["age_difference"] / 3
        ) * 100
    )

    # -----------------------------------------------------
    # CONTRACT RELEVANCE
    #
    # Production is primary.
    # Age modifies relevance.
    # -----------------------------------------------------

    contracts["contract_relevance"] = (
        contracts["production_similarity"]
        * (
            contracts["age_similarity"]
            / 100
        )
    )

    # -----------------------------------------------------
    # OUTPUT
    # -----------------------------------------------------

    columns = [
        "playerId",
        "player",
        "position",

        "season",
        "games_played",
        "goals",
        "assists",
        "points",

        "goals_per_game",
        "assists_per_game",
        "points_per_game",

        "goals_per_60",
        "assists_per_60",
        "points_per_60",

        "production_similarity",

        "signing_age",
        "age_difference",

        "season_from",
        "season_to",

        "cap_hit",
        "term",
        "total_value",
        "pct_cap_contract_start",

        "signing_status",
        "expiry_status",

        "signed_date",

        "production_gap",

        "contract_relevance"
    ]

    result = (
        contracts[columns]
        .sort_values(
            "contract_relevance",
            ascending=False
        )
        .head(n)
        .reset_index(drop=True)
    )

    result.insert(
        0,
        "rank",
        range(1, len(result) + 1)
    )

    return result


# ---------------------------------------------------------
# EXPLAIN CONTRACT COMPARABLE
# ---------------------------------------------------------

def explain_contract_comparable(
    player_id,
    comparable_player,
    season_from
):

    production = load_production_data()
    target = get_target_player(
        production,
        player_id
    )

    contracts = build_historical_contract_dataset()

    comp = contracts[
        (contracts["player"] == comparable_player)
        & (contracts["season_from"] == season_from)
    ]

    if comp.empty:
        raise ValueError(
            "Comparable contract not found"
        )

    comp = comp.iloc[0]

    scaler = prepare_production_scaler(
        production
    )

    target_values = pd.DataFrame(
        [target[PRODUCTION_FEATURES].values],
        columns=PRODUCTION_FEATURES
    )

    comp_values = pd.DataFrame(
        [comp[PRODUCTION_FEATURES].values],
        columns=PRODUCTION_FEATURES
    )

    target_scaled = scaler.transform(
        target_values
    )[0]

    comp_scaled = scaler.transform(
        comp_values
    )[0]

    result = pd.DataFrame({
        "feature":
            PRODUCTION_FEATURES,

        "target_value":
            target[PRODUCTION_FEATURES].values,

        "comparable_value":
            comp[PRODUCTION_FEATURES].values,

        "standardised_difference":
            np.abs(
                target_scaled
                - comp_scaled
            )
    })

    return (
        result
        .sort_values(
            "standardised_difference"
        )
        .reset_index(drop=True)
    )


# ---------------------------------------------------------
# MARKET SUMMARY
# ---------------------------------------------------------

def contract_market_summary(player_id, n=15):

    comps = find_contract_comparables(
        player_id,
        n
    )

    weights = comps[
        "contract_relevance"
    ].values

    def weighted_average(column):

        values = pd.to_numeric(
            comps[column],
            errors="coerce"
        ).values

        valid = (
            ~np.isnan(values)
            & ~np.isnan(weights)
        )

        if not valid.any():
            return np.nan

        return np.average(
            values[valid],
            weights=weights[valid]
        )

    return pd.DataFrame({
        "metric": [
            "Comparable contracts",
            "Weighted cap hit",
            "Weighted term",
            "Weighted total value",
            "Weighted % of cap"
        ],

        "value": [
            len(comps),
            weighted_average("cap_hit"),
            weighted_average("term"),
            weighted_average(
                "total_value"
            ),
            weighted_average(
                "pct_cap_contract_start"
            )
        ]
    })


# ---------------------------------------------------------
# MODEL INFO
# ---------------------------------------------------------

def contract_features():

    return PRODUCTION_FEATURES