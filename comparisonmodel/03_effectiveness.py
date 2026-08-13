import pandas as pd
import numpy as np
from google.cloud import bigquery
from sklearn.preprocessing import StandardScaler


# ---------------------------------------------------------
# CONFIG
# ---------------------------------------------------------

PROJECT_ID = "pacey32-agency"

EFFECTIVENESS_FEATURES = [
    "weighted3_shooting_pct_close_left",
    "weighted3_shooting_pct_close_centre",
    "weighted3_shooting_pct_close_right",
    "weighted3_shooting_pct_medium_left",
    "weighted3_shooting_pct_medium_centre",
    "weighted3_shooting_pct_medium_right",
    "weighted3_shooting_pct_far_left",
    "weighted3_shooting_pct_far_centre",
    "weighted3_shooting_pct_far_right",
    "latest_faceoff_pct",
    "weighted3_faceoff_pct"
]


# ---------------------------------------------------------
# LOAD DATA
# ---------------------------------------------------------

def load_effectiveness_data():

    client = bigquery.Client(project=PROJECT_ID)

    query = """
    WITH profile AS (
        SELECT
            SAFE_CAST(playerId AS INT64) AS playerId,
            ANY_VALUE(player_name) AS player,
            ANY_VALUE(position) AS position,
            ANY_VALUE(shoots_catches) AS shoots_catches
        FROM `pacey32-agency.Comparison.01_PlayerProfile`
        WHERE SAFE_CAST(activeFlag AS INT64) = 1
        GROUP BY SAFE_CAST(playerId AS INT64)
    )

    SELECT
        p.playerId,
        p.player,
        p.position,
        p.shoots_catches,
        s.* EXCEPT(playerId)
    FROM profile p
    INNER JOIN `pacey32-agency.EventLocations.10_PlayerPerformanceLocationLatest` s
        ON p.playerId = SAFE_CAST(s.playerId AS INT64)
    WHERE s.latest_games_played >= 20
    """

    df = client.query(query).to_dataframe()

    return df.loc[:, ~df.columns.duplicated()]


# ---------------------------------------------------------
# PREPARE MODEL
# ---------------------------------------------------------

def prepare_effectiveness_model(df):

    missing = [
        c for c in EFFECTIVENESS_FEATURES
        if c not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing effectiveness features: {missing}"
        )

    df_compare = df.dropna(
        subset=["playerId", "position"]
    ).copy()

    X = df_compare[EFFECTIVENESS_FEATURES].copy()
    X = X.replace([np.inf, -np.inf], np.nan)
    X = X.fillna(X.median())

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    return df_compare, X_scaled, scaler


# ---------------------------------------------------------
# FIND COMPARABLES
# ---------------------------------------------------------

def find_effectiveness_comparables(player_id, n=10):

    df = load_effectiveness_data()
    df_compare, X_scaled, _ = prepare_effectiveness_model(df)

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
            "shoots_catches"
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

def explain_effectiveness(player1_id, player2_id):

    df = load_effectiveness_data()
    df_compare, X_scaled, _ = prepare_effectiveness_model(df)

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
        "feature": EFFECTIVENESS_FEATURES,
        "player1_value":
            df_compare.iloc[i1][EFFECTIVENESS_FEATURES].values,
        "player2_value":
            df_compare.iloc[i2][EFFECTIVENESS_FEATURES].values,
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

def effectiveness_features():
    return EFFECTIVENESS_FEATURES