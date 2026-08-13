import pandas as pd
import numpy as np
from google.cloud import bigquery
from sklearn.preprocessing import StandardScaler


# ---------------------------------------------------------
# CONFIG
# ---------------------------------------------------------

PROJECT_ID = "pacey32-agency"

TRAJECTORY_FEATURES_1YR = [
    "points_per_game_change_1yr",
    "goals_per_game_change_1yr",
    "assists_per_game_change_1yr",
    "avg_toi_change_1yr"
]

TRAJECTORY_FEATURES_2YR = [
    "points_per_game_change_2yr",
    "goals_per_game_change_2yr",
    "assists_per_game_change_2yr",
    "avg_toi_change_2yr"
]

TRAJECTORY_FEATURES = TRAJECTORY_FEATURES_1YR + TRAJECTORY_FEATURES_2YR


# ---------------------------------------------------------
# LOAD DATA
# ---------------------------------------------------------

def load_trajectory_data():

    client = bigquery.Client(project=PROJECT_ID)

    query = """
    WITH profile AS (
        SELECT
            SAFE_CAST(playerId AS INT64) AS playerId,
            ANY_VALUE(player_name) AS player,
            ANY_VALUE(position) AS position
        FROM `pacey32-agency.Comparison.01_PlayerProfile`
        WHERE SAFE_CAST(activeFlag AS INT64) = 1
        GROUP BY SAFE_CAST(playerId AS INT64)
    ),

    trajectory AS (
        SELECT
            SAFE_CAST(playerId AS INT64) AS playerId,

            last1_season,
            last2_season,
            last3_season,

            last1_games,
            last2_games,
            last3_games,

            last1_goals_per_game,
            last2_goals_per_game,
            last3_goals_per_game,

            last1_assists_per_game,
            last2_assists_per_game,
            last3_assists_per_game,

            last1_points_per_game,
            last2_points_per_game,
            last3_points_per_game,

            last1_avg_toi,
            last2_avg_toi,
            last3_avg_toi

        FROM `pacey32-agency.Comparison.06_PlayerTrajectoryLatest`
        WHERE seasonPart = 'RegularSeason'
    )

    SELECT
        p.playerId,
        p.player,
        p.position,

        t.last1_season,
        t.last2_season,
        t.last3_season,

        t.last1_games,
        t.last2_games,
        t.last3_games,

        t.last1_points_per_game - t.last2_points_per_game AS points_per_game_change_1yr,
        t.last1_goals_per_game - t.last2_goals_per_game AS goals_per_game_change_1yr,
        t.last1_assists_per_game - t.last2_assists_per_game AS assists_per_game_change_1yr,
        t.last1_avg_toi - t.last2_avg_toi AS avg_toi_change_1yr,

        t.last2_points_per_game - t.last3_points_per_game AS points_per_game_change_2yr,
        t.last2_goals_per_game - t.last3_goals_per_game AS goals_per_game_change_2yr,
        t.last2_assists_per_game - t.last3_assists_per_game AS assists_per_game_change_2yr,
        t.last2_avg_toi - t.last3_avg_toi AS avg_toi_change_2yr,

        CASE
            WHEN t.last3_season IS NOT NULL THEN 3
            WHEN t.last2_season IS NOT NULL THEN 2
            WHEN t.last1_season IS NOT NULL THEN 1
            ELSE 0
        END AS trajectory_seasons

    FROM profile p
    INNER JOIN trajectory t
        ON p.playerId = t.playerId

    WHERE t.last1_games >= 20
    """

    return client.query(query).to_dataframe()


# ---------------------------------------------------------
# PREPARE MODEL
# ---------------------------------------------------------

def prepare_trajectory_model(df):

    df = df.copy()

    for feature in TRAJECTORY_FEATURES:
        df[feature] = pd.to_numeric(df[feature], errors="coerce")

    # Scale using the real observed values only.
    # Missing historical seasons remain missing.
    means = df[TRAJECTORY_FEATURES].mean()
    stds = df[TRAJECTORY_FEATURES].std().replace(0, 1)

    X_scaled = (df[TRAJECTORY_FEATURES] - means) / stds

    return df, X_scaled, means, stds


# ---------------------------------------------------------
# FIND COMPARABLES
# ---------------------------------------------------------

def find_trajectory_comparables(player_id, n=10):

    df = load_trajectory_data()
    df_compare, X_scaled, _, _ = prepare_trajectory_model(df)

    matches = df_compare.index[df_compare["playerId"] == player_id].tolist()

    if not matches:
        raise ValueError(f"Player {player_id} not found")

    target_idx = matches[0]
    target = df_compare.loc[target_idx]

    if target["trajectory_seasons"] < 2:
        raise ValueError(
            f"{target['player']} only has {int(target['trajectory_seasons'])} season(s); "
            "there is not enough NHL history to calculate trajectory similarity."
        )

    results = []

    for idx, candidate in df_compare.iterrows():

        if candidate["playerId"] == player_id:
            continue

        if candidate["position"] != target["position"]:
            continue

        # Only compare features genuinely observed for BOTH players
        available_features = [
            f for f in TRAJECTORY_FEATURES
            if pd.notna(X_scaled.loc[target_idx, f])
            and pd.notna(X_scaled.loc[idx, f])
        ]

        # Require at least the four 1-year trajectory dimensions
        if len(available_features) < 4:
            continue

        differences = (
            X_scaled.loc[target_idx, available_features]
            - X_scaled.loc[idx, available_features]
        )

        distance = np.sqrt(np.mean(differences ** 2))
        similarity = np.exp(-distance) * 100

        results.append({
            "playerId": candidate["playerId"],
            "player": candidate["player"],
            "position": candidate["position"],
            "trajectory_seasons": candidate["trajectory_seasons"],
            "features_compared": len(available_features),
            "similarity": similarity
        })

    result = pd.DataFrame(results)

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

def explain_trajectory(player1_id, player2_id):

    df = load_trajectory_data()
    df_compare, X_scaled, _, _ = prepare_trajectory_model(df)

    idx1 = df_compare.index[df_compare["playerId"] == player1_id].tolist()
    idx2 = df_compare.index[df_compare["playerId"] == player2_id].tolist()

    if not idx1:
        raise ValueError(f"Player {player1_id} not found")

    if not idx2:
        raise ValueError(f"Player {player2_id} not found")

    i1 = idx1[0]
    i2 = idx2[0]

    available_features = [
        f for f in TRAJECTORY_FEATURES
        if pd.notna(X_scaled.loc[i1, f])
        and pd.notna(X_scaled.loc[i2, f])
    ]

    if len(available_features) < 4:
        raise ValueError(
            "These players do not have enough shared NHL history "
            "for a trajectory comparison."
        )

    result = pd.DataFrame({
        "feature": available_features,
        "player1_value": df_compare.loc[i1, available_features].values,
        "player2_value": df_compare.loc[i2, available_features].values,
        "standardised_difference": np.abs(
            X_scaled.loc[i1, available_features].values
            - X_scaled.loc[i2, available_features].values
        )
    })

    return (
        result
        .sort_values("standardised_difference")
        .reset_index(drop=True)
    )


# ---------------------------------------------------------
# MODEL INFO
# ---------------------------------------------------------

def trajectory_features():
    return TRAJECTORY_FEATURES