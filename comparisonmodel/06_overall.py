import importlib.util
import os
import pandas as pd
import numpy as np
from google.cloud import bigquery

PROJECT_ID = "pacey32-agency"

# ---------------------------------------------------------
# CONFIG
# ---------------------------------------------------------

MODEL_FILES = {
    "playing_style": "01_playing_style.py",
    "production": "02_production.py",
    "effectiveness": "03_effectiveness.py",
    "usage": "04_usage.py",
    "trajectory": "05_trajectory.py"
}

MODEL_WEIGHTS = {
    "playing_style": 1.0,
    "production": 1.0,
    "effectiveness": 1.0,
    "usage": 1.0,
    "trajectory": 1.0
}


# ---------------------------------------------------------
# LOAD MODEL FILE
# ---------------------------------------------------------

def _load_model(name):

    path = os.path.join(
        os.path.dirname(__file__),
        MODEL_FILES[name]
    )

    spec = importlib.util.spec_from_file_location(
        name,
        path
    )

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    return module


# ---------------------------------------------------------
# LOAD ALL MODELS
# ---------------------------------------------------------

def load_models():

    return {
        name: _load_model(name)
        for name in MODEL_FILES
    }


# ---------------------------------------------------------
# MODEL FUNCTION MAP
# ---------------------------------------------------------

def _model_functions(models):

    return {
        "playing_style": {
            "load": models["playing_style"].load_playing_style_data,
            "prepare": models["playing_style"].prepare_playing_style_model
        },

        "production": {
            "load": models["production"].load_production_data,
            "prepare": models["production"].prepare_production_model
        },

        "effectiveness": {
            "load": models["effectiveness"].load_effectiveness_data,
            "prepare": models["effectiveness"].prepare_effectiveness_model
        },

        "usage": {
            "load": models["usage"].load_usage_data,
            "prepare": models["usage"].prepare_usage_model
        },

        "trajectory": {
            "load": models["trajectory"].load_trajectory_data,
            "prepare": models["trajectory"].prepare_trajectory_model
        }
    }


# ---------------------------------------------------------
# CALCULATE ONE MODEL FOR ALL PLAYERS
# ---------------------------------------------------------

def _calculate_model_scores(player_id, model_name, functions):

    df = functions["load"]()
    prepared = functions["prepare"](df)

    df_compare = prepared[0].reset_index(drop=True).copy()
    X_scaled = np.asarray(prepared[1])

    if len(df_compare) != len(X_scaled):
        raise ValueError(
            f"{model_name}: dataframe has {len(df_compare)} rows "
            f"but matrix has {len(X_scaled)} rows"
        )

    player_ids = pd.to_numeric(
        df_compare["playerId"],
        errors="coerce"
    ).to_numpy()

    positions = np.flatnonzero(
        player_ids == int(player_id)
    )

    if len(positions) == 0:
        raise ValueError(
            f"Player {player_id} not found in {model_name} model"
        )

    row = int(positions[0])
    target_position = df_compare.iloc[row]["position"]

    distances = np.sqrt(
        np.mean(
            (X_scaled - X_scaled[row]) ** 2,
            axis=1
        )
    )

    similarity = np.exp(-distances) * 100

    result = df_compare[
        ["playerId", "player", "position"]
    ].copy()

    result[f"{model_name}_similarity"] = similarity

    result = result[
        (result["position"] == target_position) &
        (pd.to_numeric(result["playerId"], errors="coerce") != int(player_id))
    ].copy()

    return result.reset_index(drop=True)


# ---------------------------------------------------------
# CALCULATE ALL MODEL SCORES
# ---------------------------------------------------------

def calculate_all_similarities(player_id):

    models = load_models()
    functions = _model_functions(models)

    results = {}

    for name in MODEL_FILES:

        results[name] = _calculate_model_scores(
            player_id,
            name,
            functions[name]
        )

    return results


# ---------------------------------------------------------
# BUILD COMBINED PLAYER TABLE
# ---------------------------------------------------------

def build_overall_table(player_id):

    scores = calculate_all_similarities(player_id)
    combined = None

    for name, df in scores.items():

        similarity_col = f"{name}_similarity"
        temp = df[
            ["playerId", "player", "position", similarity_col]
        ].copy()

        # Rank within this individual model
        temp[f"{name}_rank"] = (
            temp[similarity_col]
            .rank(method="min", ascending=False)
            .astype("Int64")
        )

        if combined is None:
            combined = temp
        else:
            combined = combined.merge(
                temp[
                    [
                        "playerId",
                        similarity_col,
                        f"{name}_rank"
                    ]
                ],
                on="playerId",
                how="outer"
            )

    similarity_cols = [
        f"{name}_similarity"
        for name in MODEL_FILES
    ]

    combined["models_available"] = (
        combined[similarity_cols]
        .notna()
        .sum(axis=1)
    )

    weighted_sum = np.zeros(len(combined))
    weight_sum = np.zeros(len(combined))

    for name in MODEL_FILES:

        col = f"{name}_similarity"
        weight = MODEL_WEIGHTS[name]
        available = combined[col].notna()

        weighted_sum += (
            combined[col].fillna(0).values * weight
        )

        weight_sum += (
            available.astype(float).values * weight
        )

    combined["overall_similarity"] = np.divide(
        weighted_sum,
        weight_sum,
        out=np.full(len(combined), np.nan),
        where=weight_sum > 0
    )

    return combined

    # -----------------------------------------------------
    # OVERALL SIMILARITY
    #
    # Weighted average of available model similarities.
    # Currently all five models have equal weight.
    # -----------------------------------------------------

    weighted_sum = np.zeros(len(combined))
    weight_sum = np.zeros(len(combined))

    for name in MODEL_FILES:

        col = f"{name}_similarity"
        weight = MODEL_WEIGHTS[name]

        available = combined[col].notna()

        weighted_sum += (
            combined[col]
            .fillna(0)
            .values
            * weight
        )

        weight_sum += (
            available.astype(float).values
            * weight
        )

    combined["overall_similarity"] = np.divide(
        weighted_sum,
        weight_sum,
        out=np.full(
            len(combined),
            np.nan
        ),
        where=weight_sum > 0
    )

    return combined


# ---------------------------------------------------------
# OVERALL COMPARABLES
# ---------------------------------------------------------

def find_overall_comparables(
    player_id,
    n=20,
    require_all_models=True
):

    result = build_overall_table(player_id)

    contracts = load_current_contracts()
    result = result.merge(
        contracts,
        on="player",
        how="left"
        )

    if require_all_models:
        result = result[
            result["models_available"] == len(MODEL_FILES)
        ]

    result = (
        result
        .sort_values(
            "overall_similarity",
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

    return result[
        [
            "rank",
            "playerId",
            "player",
            "position",
            "current_aav",
            "current_contract_term",
            "current_contract_to",
            "current_contract_cap_pct",
            "overall_similarity",

            "playing_style_similarity",
            "playing_style_rank",

            "production_similarity",
            "production_rank",

            "effectiveness_similarity",
            "effectiveness_rank",

            "usage_similarity",
            "usage_rank",

            "trajectory_similarity",
            "trajectory_rank",

            "models_available"
        ]
    ]


# ---------------------------------------------------------
# INDIVIDUAL MODEL COMPARABLES
# ---------------------------------------------------------

def find_model_comparables(
    player_id,
    model_name,
    n=20
):

    if model_name not in MODEL_FILES:
        raise ValueError(
            f"model_name must be one of: "
            f"{list(MODEL_FILES.keys())}"
        )

    scores = calculate_all_similarities(player_id)

    result = scores[model_name].copy()

    similarity_col = (
        f"{model_name}_similarity"
    )

    result = (
        result
        .sort_values(
            similarity_col,
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
# ADD CONTRACT INFO
# ---------------------------------------------------------

def load_current_contracts():

    client = bigquery.Client(
        project=PROJECT_ID
    )

    query = """
    SELECT
        player,
        cap_hit AS current_aav,
        term AS current_contract_term,
        season_from AS current_contract_from,
        season_to AS current_contract_to,
        total_value AS current_contract_value,
        pct_cap_contract_start AS current_contract_cap_pct,
        expiry_status AS current_contract_expiry_status,
        expiry_year AS current_contract_expiry_year
    FROM `pacey32-agency.Cap.PlayerDetail`
    WHERE current_contract = TRUE
    QUALIFY ROW_NUMBER() OVER (
        PARTITION BY player
        ORDER BY scrape_datetime DESC
    ) = 1
    """

    return client.query(
        query
    ).to_dataframe()


# ---------------------------------------------------------
# ALL TOP 20 LISTS
# ---------------------------------------------------------

def find_all_comparables(
    player_id,
    n=20
):

    scores = calculate_all_similarities(player_id)

    output = {}

    for name, result in scores.items():

        similarity_col = (
            f"{name}_similarity"
        )

        result = (
            result
            .sort_values(
                similarity_col,
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

        output[name] = result

    overall = build_overall_table(player_id)

    overall = overall[
        overall["models_available"]
        == len(MODEL_FILES)
    ]

    overall = (
        overall
        .sort_values(
            "overall_similarity",
            ascending=False
        )
        .head(n)
        .reset_index(drop=True)
    )

    overall.insert(
        0,
        "rank",
        range(1, len(overall) + 1)
    )

    output["overall"] = overall

    return output