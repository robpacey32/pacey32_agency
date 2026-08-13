import pandas as pd
import numpy as np
from google.cloud import bigquery
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity


# ---------------------------------------------------------
# CONFIG
# ---------------------------------------------------------

PROJECT_ID = "pacey32-agency"


# ---------------------------------------------------------
# FEATURES
# ---------------------------------------------------------

feature_groups = {

    "shot_location_latest": [
        f"latest_shot_pct_{z}_{s}"
        for z in ["close", "medium", "far"]
        for s in ["left", "centre", "right"]
    ],

    "shot_location_weighted3": [
        f"weighted3_shot_pct_{z}_{s}"
        for z in ["close", "medium", "far"]
        for s in ["left", "centre", "right"]
    ],

    "shot_volume": [
        "latest_shots_per_game",
        "latest_shots_per_60",
        "weighted3_shots_per_game",
        "weighted3_shots_per_60"
    ],

    "faceoffs": [
        "latest_faceoffs_per_game",
        "latest_faceoffs_per_60",
        "weighted3_faceoffs_per_game",
        "weighted3_faceoffs_per_60"
    ],

    "discipline": [
        "latest_penalties_per_game",
        "latest_penalties_per_60",
        "weighted3_penalties_per_game",
        "weighted3_penalties_per_60"
    ],

    "puck_management": [
        "latest_giveaways_per_game",
        "latest_giveaways_per_60",
        "latest_takeaways_per_game",
        "latest_takeaways_per_60",
        "weighted3_giveaways_per_game",
        "weighted3_giveaways_per_60",
        "weighted3_takeaways_per_game",
        "weighted3_takeaways_per_60"
    ],

    "physical": [
        "latest_hits_per_game",
        "latest_hits_per_60",
        "weighted3_hits_per_game",
        "weighted3_hits_per_60"
    ]
}

STYLE_FEATURES = [c for cols in feature_groups.values() for c in cols]


# ---------------------------------------------------------
# LOAD DATA
# ---------------------------------------------------------

def load_playing_style_data():

    client = bigquery.Client(project=PROJECT_ID)

    sql_profile = """
    SELECT
        playerId,
        ANY_VALUE(player_name) AS player,
        ANY_VALUE(position) AS position,
        ANY_VALUE(shoots_catches) AS shoots_catches
    FROM `pacey32-agency.Comparison.01_PlayerProfile`
    WHERE activeFlag = 1
    GROUP BY playerId
    """

    sql_location = """
    SELECT *
    FROM `pacey32-agency.EventLocations.10_PlayerPerformanceLocationLatest`
    """

    df_players = client.query(sql_profile).to_dataframe()
    df_location = client.query(sql_location).to_dataframe()

    df_players["playerId"] = pd.to_numeric(df_players["playerId"], errors="coerce").astype("Int64")
    df_location["playerId"] = pd.to_numeric(df_location["playerId"], errors="coerce").astype("Int64")

    df = df_players.merge(
        df_location.drop(columns=["player"], errors="ignore"),
        on="playerId",
        how="left"
    )

    return df


# ---------------------------------------------------------
# PREPARE MODEL
# ---------------------------------------------------------

def prepare_playing_style_model(df):

    missing = [c for c in STYLE_FEATURES if c not in df.columns]

    if missing:
        raise ValueError(f"Missing playing-style features: {missing}")

    df_compare = df.dropna(subset=["playerId", "position"]).copy()

    X = df_compare[STYLE_FEATURES].copy()
    X = X.replace([np.inf, -np.inf], np.nan)
    X = X.fillna(X.median())

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    return df_compare, X_scaled, scaler


# ---------------------------------------------------------
# FIND COMPARABLES
# ---------------------------------------------------------

def find_playing_style_comparables(player_id, n=10):

    df = load_playing_style_data()
    df_compare, X_scaled, _ = prepare_playing_style_model(df)

    idx = df_compare.index[df_compare["playerId"] == player_id]

    if len(idx) == 0:
        raise ValueError(f"Player {player_id} not found")

    row = df_compare.index.get_loc(idx[0])
    target = df_compare.iloc[row]

    same_position = df_compare["position"].eq(target["position"]).values

    sims = cosine_similarity(
        X_scaled[row].reshape(1, -1),
        X_scaled
    )[0]

    result = df_compare.loc[
        same_position,
        ["playerId", "player", "position", "shoots_catches"]
    ].copy()

    result["similarity"] = sims[same_position] * 100

    result = result[result["playerId"] != player_id]

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

def explain_playing_style(player1_id, player2_id):

    df = load_playing_style_data()
    df_compare, X_scaled, _ = prepare_playing_style_model(df)

    idx1 = df_compare.index[df_compare["playerId"] == player1_id]
    idx2 = df_compare.index[df_compare["playerId"] == player2_id]

    if len(idx1) == 0:
        raise ValueError(f"Player {player1_id} not found")

    if len(idx2) == 0:
        raise ValueError(f"Player {player2_id} not found")

    i1 = df_compare.index.get_loc(idx1[0])
    i2 = df_compare.index.get_loc(idx2[0])

    result = pd.DataFrame({
        "feature": STYLE_FEATURES,
        "player1_value": df_compare.iloc[i1][STYLE_FEATURES].values,
        "player2_value": df_compare.iloc[i2][STYLE_FEATURES].values,
        "standardised_difference": np.abs(X_scaled[i1] - X_scaled[i2])
    })

    return result.sort_values("standardised_difference").reset_index(drop=True)


# ---------------------------------------------------------
# MODEL INFO
# ---------------------------------------------------------

def playing_style_features():
    return feature_groups