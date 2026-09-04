import pandas as pd
import numpy as np
from google.cloud import bigquery
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity


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
    "points_per_60",
    "log_games_played"
]


# ---------------------------------------------------------
# LOAD DATA
# ---------------------------------------------------------

def load_production_data():

    client = bigquery.Client(project=PROJECT_ID)

    query = """
    WITH season_stats AS (

        SELECT
            SAFE_CAST(playerId AS INT64) AS playerId,
            season,

            SUM(games_played) AS games_played,
            SUM(goals) AS goals,
            SUM(assists) AS assists,
            SUM(points) AS points,
            SUM(toi_minutes) AS toi_minutes,

            ROUND(SAFE_DIVIDE(SUM(toi_minutes), SUM(games_played)), 2) AS avg_toi_minutes,

            ROUND(SAFE_DIVIDE(SUM(goals), SUM(games_played)), 3) AS goals_per_game,
            ROUND(SAFE_DIVIDE(SUM(assists), SUM(games_played)), 3) AS assists_per_game,
            ROUND(SAFE_DIVIDE(SUM(points), SUM(games_played)), 3) AS points_per_game,

            ROUND(SAFE_DIVIDE(SUM(goals) * 60, SUM(toi_minutes)), 2) AS goals_per_60,
            ROUND(SAFE_DIVIDE(SUM(assists) * 60, SUM(toi_minutes)), 2) AS assists_per_60,
            ROUND(SAFE_DIVIDE(SUM(points) * 60, SUM(toi_minutes)), 2) AS points_per_60

        FROM `pacey32-agency.Comparison.03_PlayerSeasonStats`

        WHERE seasonPart = 'RegularSeason'

        GROUP BY
            playerId,
            season
    ),

    latest_season AS (

        SELECT
            playerId,
            MAX(season) AS season

        FROM season_stats

        WHERE games_played > 0

        GROUP BY playerId
    ),

    profile AS (

        SELECT
            SAFE_CAST(playerId AS INT64) AS playerId,
            ANY_VALUE(player_name) AS player,
            ANY_VALUE(position) AS position

        FROM `pacey32-agency.Comparison.01_PlayerProfile`

        WHERE SAFE_CAST(activeFlag AS INT64) = 1

        GROUP BY
            SAFE_CAST(playerId AS INT64)
    )

    SELECT
        p.playerId,
        p.player,
        p.position,

        s.season,
        s.games_played,
        s.goals,
        s.assists,
        s.points,

        s.goals_per_game,
        s.assists_per_game,
        s.points_per_game,

        s.goals_per_60,
        s.assists_per_60,
        s.points_per_60,

        s.avg_toi_minutes,

        LN(1 + s.games_played) AS log_games_played

    FROM profile p

    INNER JOIN latest_season l
        ON p.playerId = l.playerId

    INNER JOIN season_stats s
        ON l.playerId = s.playerId
       AND l.season = s.season

    WHERE s.games_played > 0
    """

    df = client.query(query).to_dataframe()

    return df.loc[:, ~df.columns.duplicated()]


# ---------------------------------------------------------
# PREPARE MODEL
# ---------------------------------------------------------

def prepare_production_model(df):

    missing = [c for c in PRODUCTION_FEATURES if c not in df.columns]

    if missing:
        raise ValueError(f"Missing production features: {missing}")

    df_compare = df.dropna(
        subset=["playerId", "position"]
    ).copy()

    X = df_compare[PRODUCTION_FEATURES].copy()
    X = X.replace([np.inf, -np.inf], np.nan)
    X = X.fillna(X.median())

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    return df_compare, X_scaled, scaler


# ---------------------------------------------------------
# FIND COMPARABLES
# ---------------------------------------------------------

def find_production_comparables(player_id, n=10):

    df = load_production_data()
    df_compare, X_scaled, _ = prepare_production_model(df)

    idx = df_compare.index[
        df_compare["playerId"] == player_id
    ]

    if len(idx) == 0:
        raise ValueError(f"Player {player_id} not found")

    row = df_compare.index.get_loc(idx[0])
    target = df_compare.iloc[row]

    same_position = (
        df_compare["position"].eq(target["position"]).values
    )

    distances = np.sqrt(
        np.mean(
            (X_scaled - X_scaled[row]) ** 2,
            axis=1
        )
    )

    sims = np.exp(-distances)

    result = df_compare.loc[
        same_position,
        [
            "playerId",
            "player",
            "position",
            "season",
            "games_played",
            "goals",
            "assists",
            "points"
        ]
    ].copy()

    result["similarity"] = sims[same_position] * 100

    result = result[
        result["playerId"] != player_id
    ]

    result = (
        result
        .sort_values("similarity", ascending=False)
        .head(n)
        .reset_index(drop=True)
    )

    result.insert(0, "rank", range(1, len(result) + 1))

    return result


# ---------------------------------------------------------
# EXPLAIN COMPARISON
# ---------------------------------------------------------

def explain_production(player1_id, player2_id):

    df = load_production_data()
    df_compare, X_scaled, _ = prepare_production_model(df)

    idx1 = df_compare.index[
        df_compare["playerId"] == player1_id
    ]

    idx2 = df_compare.index[
        df_compare["playerId"] == player2_id
    ]

    if len(idx1) == 0:
        raise ValueError(f"Player {player1_id} not found")

    if len(idx2) == 0:
        raise ValueError(f"Player {player2_id} not found")

    i1 = df_compare.index.get_loc(idx1[0])
    i2 = df_compare.index.get_loc(idx2[0])

    result = pd.DataFrame({
        "feature": PRODUCTION_FEATURES,
        "player1_value": df_compare.iloc[i1][PRODUCTION_FEATURES].values,
        "player2_value": df_compare.iloc[i2][PRODUCTION_FEATURES].values,
        "standardised_difference": np.abs(
            X_scaled[i1] - X_scaled[i2]
        )
    })

    return result.sort_values(
        "standardised_difference"
    ).reset_index(drop=True)


# ---------------------------------------------------------
# MODEL INFO
# ---------------------------------------------------------

def production_features():
    return PRODUCTION_FEATURES