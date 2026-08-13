import pandas as pd
import numpy as np
from google.cloud import bigquery
from sklearn.preprocessing import StandardScaler


# ---------------------------------------------------------
# CONFIG
# ---------------------------------------------------------

PROJECT_ID = "pacey32-agency"

USAGE_FEATURES = [
    # Ice time / role
    "latest_avg_toi_minutes",
    "weighted3_avg_toi_minutes",
    "latest_team_toi_percentile",
    "weighted3_team_toi_percentile",

    # Shift usage
    "latest_shifts_per_game",
    "weighted3_shifts_per_game",
    "latest_seconds_per_shift",
    "weighted3_seconds_per_shift",

    # Faceoff usage
    "latest_faceoffs_per_game",
    "latest_faceoffs_per_60",
    "weighted3_faceoffs_per_game",
    "weighted3_faceoffs_per_60"
]


# ---------------------------------------------------------
# LOAD DATA
# ---------------------------------------------------------

def load_usage_data():

    client = bigquery.Client(project=PROJECT_ID)

    query = """
    WITH usage AS (
        SELECT
            SAFE_CAST(playerId AS INT64) AS playerId,

            last1_games AS latest_games_played,

            last1_avg_toi AS latest_avg_toi_minutes,
            SAFE_DIVIDE(
                last1_avg_toi * 0.70 +
                COALESCE(last2_avg_toi, 0) * 0.20 +
                COALESCE(last3_avg_toi, 0) * 0.10,
                0.70 +
                IF(last2_avg_toi IS NOT NULL, 0.20, 0) +
                IF(last3_avg_toi IS NOT NULL, 0.10, 0)
            ) AS weighted3_avg_toi_minutes,

            last1_shifts_per_game AS latest_shifts_per_game,
            SAFE_DIVIDE(
                last1_shifts_per_game * 0.70 +
                COALESCE(last2_shifts_per_game, 0) * 0.20 +
                COALESCE(last3_shifts_per_game, 0) * 0.10,
                0.70 +
                IF(last2_shifts_per_game IS NOT NULL, 0.20, 0) +
                IF(last3_shifts_per_game IS NOT NULL, 0.10, 0)
            ) AS weighted3_shifts_per_game,

            last1_seconds_per_shift AS latest_seconds_per_shift,
            SAFE_DIVIDE(
                last1_seconds_per_shift * 0.70 +
                COALESCE(last2_seconds_per_shift, 0) * 0.20 +
                COALESCE(last3_seconds_per_shift, 0) * 0.10,
                0.70 +
                IF(last2_seconds_per_shift IS NOT NULL, 0.20, 0) +
                IF(last3_seconds_per_shift IS NOT NULL, 0.10, 0)
            ) AS weighted3_seconds_per_shift,

            last1_team_toi_percentile AS latest_team_toi_percentile,
            SAFE_DIVIDE(
                last1_team_toi_percentile * 0.70 +
                COALESCE(last2_team_toi_percentile, 0) * 0.20 +
                COALESCE(last3_team_toi_percentile, 0) * 0.10,
                0.70 +
                IF(last2_team_toi_percentile IS NOT NULL, 0.20, 0) +
                IF(last3_team_toi_percentile IS NOT NULL, 0.10, 0)
            ) AS weighted3_team_toi_percentile

        FROM `pacey32-agency.Comparison.06_PlayerTrajectoryLatest`
        WHERE seasonPart = 'RegularSeason'
    ),

    profile AS (
        SELECT
            SAFE_CAST(playerId AS INT64) AS playerId,
            ANY_VALUE(player_name) AS player,
            ANY_VALUE(position) AS position
        FROM `pacey32-agency.Comparison.01_PlayerProfile`
        WHERE SAFE_CAST(activeFlag AS INT64) = 1
        GROUP BY SAFE_CAST(playerId AS INT64)
    )

    SELECT
        p.playerId,
        p.player,
        p.position,

        u.latest_avg_toi_minutes,
        u.weighted3_avg_toi_minutes,

        u.latest_team_toi_percentile,
        u.weighted3_team_toi_percentile,

        u.latest_shifts_per_game,
        u.weighted3_shifts_per_game,

        u.latest_seconds_per_shift,
        u.weighted3_seconds_per_shift,

        e.latest_faceoffs_per_game,
        e.latest_faceoffs_per_60,
        e.weighted3_faceoffs_per_game,
        e.weighted3_faceoffs_per_60

    FROM profile p

    INNER JOIN usage u
        ON p.playerId = u.playerId

    INNER JOIN `pacey32-agency.EventLocations.10_PlayerPerformanceLocationLatest` e
        ON p.playerId = SAFE_CAST(e.playerId AS INT64)

    WHERE u.latest_games_played >= 20
      AND e.latest_games_played >= 20
    """

    df = client.query(query).to_dataframe()

    return df.loc[:, ~df.columns.duplicated()]


# ---------------------------------------------------------
# PREPARE MODEL
# ---------------------------------------------------------

def prepare_usage_model(df):

    missing = [
        c for c in USAGE_FEATURES
        if c not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing usage features: {missing}"
        )

    df_compare = df.dropna(
        subset=["playerId", "position"]
    ).copy()

    X = df_compare[USAGE_FEATURES].copy()
    X = X.replace([np.inf, -np.inf], np.nan)
    X = X.fillna(X.median())

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    return df_compare, X_scaled, scaler


# ---------------------------------------------------------
# FIND COMPARABLES
# ---------------------------------------------------------

def find_usage_comparables(player_id, n=10):

    df = load_usage_data()
    df_compare, X_scaled, _ = prepare_usage_model(df)

    idx = df_compare.index[
        df_compare["playerId"] == player_id
    ]

    if len(idx) == 0:
        raise ValueError(
            f"Player {player_id} not found"
        )

    row = df_compare.index.get_loc(idx[0])
    target = df_compare.iloc[row]

    same_position = (
        df_compare["position"]
        .eq(target["position"])
        .values
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
            "latest_avg_toi_minutes",
            "latest_team_toi_percentile",
            "latest_shifts_per_game",
            "latest_seconds_per_shift"
        ]
    ].copy()

    result["similarity"] = (
        sims[same_position] * 100
    )

    result = result[
        result["playerId"] != player_id
    ]

    result = (
        result
        .sort_values(
            "similarity",
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
# EXPLAIN COMPARISON
# ---------------------------------------------------------

def explain_usage(player1_id, player2_id):

    df = load_usage_data()
    df_compare, X_scaled, _ = prepare_usage_model(df)

    idx1 = df_compare.index[
        df_compare["playerId"] == player1_id
    ]

    idx2 = df_compare.index[
        df_compare["playerId"] == player2_id
    ]

    if len(idx1) == 0:
        raise ValueError(
            f"Player {player1_id} not found"
        )

    if len(idx2) == 0:
        raise ValueError(
            f"Player {player2_id} not found"
        )

    i1 = df_compare.index.get_loc(idx1[0])
    i2 = df_compare.index.get_loc(idx2[0])

    result = pd.DataFrame({
        "feature": USAGE_FEATURES,
        "player1_value":
            df_compare.iloc[i1][USAGE_FEATURES].values,
        "player2_value":
            df_compare.iloc[i2][USAGE_FEATURES].values,
        "standardised_difference":
            np.abs(X_scaled[i1] - X_scaled[i2])
    })

    return (
        result
        .sort_values("standardised_difference")
        .reset_index(drop=True)
    )


# ---------------------------------------------------------
# MODEL INFO
# ---------------------------------------------------------

def usage_features():
    return USAGE_FEATURES