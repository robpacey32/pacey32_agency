from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt


# =========================================================
# CONFIG
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

INPUT_FILE = (
    BASE_DIR
    / "calibration_output"
    / "08_current_comparable_evidence.csv"
)

OUTPUT_DIR = (
    BASE_DIR
    / "calibration_output"
)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

RECENCY_HALF_LIFE_MONTHS = 4

MAX_RANK = 20

EXAMPLE_PLAYERS = {
    "mcdavid": 8478402,
    "hellebuyck": 8476945,
}

MARKET_TYPES = [
    "RFA_TO_RFA",
    "RFA_TO_UFA",
    "UFA_SIGNING",
]


# =========================================================
# HELPERS
# =========================================================

def kish_effective_sample_size(
    weights: np.ndarray,
) -> float:
    """
    Kish effective sample size:

        ESS = (sum(w)^2) / sum(w^2)

    Measures how concentrated the contract evidence is.
    """

    weights = np.asarray(
        weights,
        dtype=float,
    )

    weights = weights[
        np.isfinite(weights)
        & (weights > 0)
    ]

    if len(weights) == 0:
        return 0.0

    denominator = np.sum(
        weights ** 2
    )

    if denominator <= 0:
        return 0.0

    return float(
        np.sum(weights) ** 2
        / denominator
    )


def weighted_quantile(
    values: np.ndarray,
    weights: np.ndarray,
    quantile: float,
) -> float:
    """
    Weighted quantile using cumulative weights.
    """

    values = np.asarray(
        values,
        dtype=float,
    )

    weights = np.asarray(
        weights,
        dtype=float,
    )

    valid = (
        np.isfinite(values)
        & np.isfinite(weights)
        & (weights > 0)
    )

    values = values[valid]
    weights = weights[valid]

    if len(values) == 0:
        return np.nan

    order = np.argsort(values)

    values = values[order]
    weights = weights[order]

    cumulative = np.cumsum(
        weights
    )

    cutoff = (
        quantile
        * cumulative[-1]
    )

    index = np.searchsorted(
        cumulative,
        cutoff,
        side="left",
    )

    index = min(
        index,
        len(values) - 1,
    )

    return float(
        values[index]
    )


def similarity_weight(
    similarity: pd.Series,
    method: str,
) -> pd.Series:
    """
    Alternative transformations of Overall similarity.

    linear:
        current production behaviour
        similarity / 100

    squared:
        more strongly favours high-similarity players

    cubed:
        much stronger concentration on closest players

    relative:
        scales each comparable relative to the target's
        #1 comparable. Useful as a diagnostic only.
    """

    similarity_01 = (
        similarity
        .astype(float)
        .clip(
            lower=0,
            upper=100,
        )
        / 100.0
    )

    if method == "linear":
        return similarity_01

    if method == "squared":
        return similarity_01 ** 2

    if method == "cubed":
        return similarity_01 ** 3

    raise ValueError(
        f"Unknown similarity method: {method}"
    )


def add_weights(
    contracts: pd.DataFrame,
    similarity_method: str,
) -> pd.DataFrame:
    """
    Apply current v3 weighting:

        similarity weight
        ×
        4-month recency weight

    Market-status relevance is intentionally excluded here.
    This script is isolating comparable depth and similarity
    weighting first.
    """

    result = contracts.copy()

    result[
        "similarity_weight"
    ] = similarity_weight(
        result["overall_similarity"],
        similarity_method,
    )

    result[
        "recency_weight"
    ] = (
        0.5
        ** (
            result[
                "months_since_signing"
            ]
            / RECENCY_HALF_LIFE_MONTHS
        )
    )

    result[
        "contract_weight"
    ] = (
        result[
            "similarity_weight"
        ]
        * result[
            "recency_weight"
        ]
    )

    return result


# =========================================================
# LOAD DATA
# =========================================================

print(
    "\nLoading calibration export..."
)

df = pd.read_csv(
    INPUT_FILE
)

numeric_columns = [
    "target_playerId",
    "comparable_rank",
    "comparable_playerId",
    "overall_similarity",
    "playing_style_similarity",
    "production_similarity",
    "effectiveness_similarity",
    "usage_similarity",
    "trajectory_similarity",
    "models_available",
    "contract_id",
    "cap_pct_at_signing",
    "term",
    "months_since_signing",
]

for column in numeric_columns:
    if column in df.columns:
        df[column] = pd.to_numeric(
            df[column],
            errors="coerce",
        )


# =========================================================
# BASIC QA
# =========================================================

targets = (
    df[
        "target_playerId"
    ]
    .dropna()
    .nunique()
)

comparable_pairs = (
    df[
        [
            "target_playerId",
            "comparable_playerId",
        ]
    ]
    .drop_duplicates()
    .shape[0]
)

contract_rows = (
    df[
        "contract_id"
    ]
    .notna()
    .sum()
)

print(
    "\n========================================"
)
print(
    "08 CURRENT MODEL CALIBRATION"
)
print(
    "========================================"
)

print(
    f"Targets:             {targets:,}"
)

print(
    f"Comparable pairs:    {comparable_pairs:,}"
)

print(
    f"Contract rows:       {contract_rows:,}"
)

print(
    f"Recency half-life:   "
    f"{RECENCY_HALF_LIFE_MONTHS} months"
)


# =========================================================
# UNIQUE COMPARABLE DATA
# =========================================================

comparables = (
    df[
        [
            "target_playerId",
            "target_player",
            "target_position",
            "comparable_rank",
            "comparable_playerId",
            "comparable_player",
            "comparable_position",
            "overall_similarity",
            "playing_style_similarity",
            "production_similarity",
            "effectiveness_similarity",
            "usage_similarity",
            "trajectory_similarity",
            "models_available",
        ]
    ]
    .drop_duplicates(
        subset=[
            "target_playerId",
            "comparable_playerId",
        ]
    )
    .copy()
)


# =========================================================
# 1. SIMILARITY BY RANK
# =========================================================

rank_summary = (
    comparables
    .groupby(
        "comparable_rank"
    )[
        "overall_similarity"
    ]
    .agg(
        mean="mean",
        median="median",
        p25=lambda x:
            x.quantile(0.25),
        p75=lambda x:
            x.quantile(0.75),
        minimum="min",
        maximum="max",
        n="count",
    )
    .reset_index()
)

print(
    "\nSimilarity by comparable rank:"
)

print(
    rank_summary[
        [
            "comparable_rank",
            "mean",
            "median",
            "p25",
            "p75",
        ]
    ]
    .round(2)
    .to_string(
        index=False
    )
)

rank_summary.to_csv(
    OUTPUT_DIR
    / "08_similarity_by_rank.csv",
    index=False,
)


# =========================================================
# GRAPH 1
# LEAGUE-WIDE SIMILARITY DECAY
# =========================================================

fig, ax = plt.subplots(
    figsize=(10, 6)
)

ax.plot(
    rank_summary[
        "comparable_rank"
    ],
    rank_summary[
        "median"
    ],
    marker="o",
    label="Median",
)

ax.fill_between(
    rank_summary[
        "comparable_rank"
    ],
    rank_summary[
        "p25"
    ],
    rank_summary[
        "p75"
    ],
    alpha=0.2,
    label="25th–75th percentile",
)

for marker_rank in [
    5,
    10,
    15,
    20,
]:
    ax.axvline(
        marker_rank,
        linestyle="--",
        alpha=0.4,
    )

ax.set_title(
    "Overall Similarity by Comparable Rank"
)

ax.set_xlabel(
    "Comparable rank"
)

ax.set_ylabel(
    "Overall similarity (%)"
)

ax.set_xticks(
    range(
        1,
        MAX_RANK + 1,
    )
)

ax.legend()

fig.tight_layout()

fig.savefig(
    OUTPUT_DIR
    / "08_similarity_by_rank.png",
    dpi=160,
)

plt.close(fig)


# =========================================================
# CONTRACT EVIDENCE ONLY
# =========================================================

contracts = (
    df[
        df[
            "contract_id"
        ].notna()
    ]
    .copy()
)

contracts[
    "contract_market_type"
] = (
    contracts[
        "contract_market_type"
    ]
    .fillna("UNKNOWN")
)


# =========================================================
# 2. EVIDENCE DEPTH BY TOP N
# =========================================================

evidence_rows = []

for top_n in range(
    1,
    MAX_RANK + 1,
):
    subset = contracts[
        contracts[
            "comparable_rank"
        ] <= top_n
    ]

    grouped = subset.groupby(
        "target_playerId"
    )

    for target_id, group in grouped:
        evidence_rows.append(
            {
                "target_playerId":
                    target_id,

                "top_n":
                    top_n,

                "players_with_contracts":
                    group[
                        "comparable_playerId"
                    ].nunique(),

                "contracts":
                    group[
                        "contract_id"
                    ].nunique(),
            }
        )

evidence = pd.DataFrame(
    evidence_rows
)

evidence_summary = (
    evidence
    .groupby(
        "top_n"
    )
    .agg(
        median_players=(
            "players_with_contracts",
            "median",
        ),

        median_contracts=(
            "contracts",
            "median",
        ),

        p25_contracts=(
            "contracts",
            lambda x:
                x.quantile(0.25),
        ),

        p75_contracts=(
            "contracts",
            lambda x:
                x.quantile(0.75),
        ),
    )
    .reset_index()
)

print(
    "\nContract evidence by Top N:"
)

print(
    evidence_summary[
        evidence_summary[
            "top_n"
        ].isin(
            [
                1,
                3,
                5,
                10,
                15,
                20,
            ]
        )
    ]
    .round(2)
    .to_string(
        index=False
    )
)

evidence_summary.to_csv(
    OUTPUT_DIR
    / "08_evidence_by_top_n.csv",
    index=False,
)


# =========================================================
# GRAPH 2
# EVIDENCE DEPTH
# =========================================================

fig, ax = plt.subplots(
    figsize=(10, 6)
)

ax.plot(
    evidence_summary[
        "top_n"
    ],
    evidence_summary[
        "median_contracts"
    ],
    marker="o",
    label="Median contracts",
)

ax.fill_between(
    evidence_summary[
        "top_n"
    ],
    evidence_summary[
        "p25_contracts"
    ],
    evidence_summary[
        "p75_contracts"
    ],
    alpha=0.2,
    label="25th–75th percentile",
)

ax.set_title(
    "Historical Contract Evidence by Comparable Depth"
)

ax.set_xlabel(
    "Top N comparable players included"
)

ax.set_ylabel(
    "Historical contracts available"
)

ax.set_xticks(
    range(
        1,
        MAX_RANK + 1,
    )
)

ax.legend()

fig.tight_layout()

fig.savefig(
    OUTPUT_DIR
    / "08_evidence_by_top_n.png",
    dpi=160,
)

plt.close(fig)


# =========================================================
# 3. EFFECTIVE EVIDENCE BY SIMILARITY TRANSFORMATION
# =========================================================

weight_methods = [
    "linear",
    "squared",
    "cubed",
]

ess_rows = []

for method in weight_methods:
    weighted = add_weights(
        contracts,
        method,
    )

    for top_n in range(
        1,
        MAX_RANK + 1,
    ):
        subset = weighted[
            weighted[
                "comparable_rank"
            ] <= top_n
        ]

        for (
            target_id,
            group,
        ) in subset.groupby(
            "target_playerId"
        ):
            ess_rows.append(
                {
                    "target_playerId":
                        target_id,

                    "method":
                        method,

                    "top_n":
                        top_n,

                    "ess":
                        kish_effective_sample_size(
                            group[
                                "contract_weight"
                            ].to_numpy()
                        ),
                }
            )

ess = pd.DataFrame(
    ess_rows
)

ess_summary = (
    ess
    .groupby(
        [
            "method",
            "top_n",
        ]
    )[
        "ess"
    ]
    .median()
    .reset_index(
        name="median_ess"
    )
)

ess_summary.to_csv(
    OUTPUT_DIR
    / "08_effective_evidence.csv",
    index=False,
)


# =========================================================
# GRAPH 3
# EFFECTIVE SAMPLE SIZE
# =========================================================

fig, ax = plt.subplots(
    figsize=(10, 6)
)

for method in weight_methods:
    plot_data = ess_summary[
        ess_summary[
            "method"
        ] == method
    ]

    ax.plot(
        plot_data[
            "top_n"
        ],
        plot_data[
            "median_ess"
        ],
        marker="o",
        label=method,
    )

ax.set_title(
    "Effective Contract Evidence by Similarity Weighting"
)

ax.set_xlabel(
    "Top N comparable players included"
)

ax.set_ylabel(
    "Median effective sample size"
)

ax.set_xticks(
    range(
        1,
        MAX_RANK + 1,
    )
)

ax.legend(
    title="Similarity weight"
)

fig.tight_layout()

fig.savefig(
    OUTPUT_DIR
    / "08_effective_evidence.png",
    dpi=160,
)

plt.close(fig)


# =========================================================
# 4. CURRENT-MARKET MEDIAN BY TOP N
# =========================================================

valuation_rows = []

for method in weight_methods:
    weighted = add_weights(
        contracts,
        method,
    )

    for top_n in range(
        1,
        MAX_RANK + 1,
    ):
        subset = weighted[
            weighted[
                "comparable_rank"
            ] <= top_n
        ]

        for (
            target_id,
            group,
        ) in subset.groupby(
            "target_playerId"
        ):
            median = weighted_quantile(
                group[
                    "cap_pct_at_signing"
                ].to_numpy(),

                group[
                    "contract_weight"
                ].to_numpy(),

                0.50,
            )

            valuation_rows.append(
                {
                    "target_playerId":
                        target_id,

                    "method":
                        method,

                    "top_n":
                        top_n,

                    "cap_pct_median":
                        median,

                    "contracts":
                        group[
                            "contract_id"
                        ].nunique(),

                    "players":
                        group[
                            "comparable_playerId"
                        ].nunique(),
                }
            )

valuations = pd.DataFrame(
    valuation_rows
)


# =========================================================
# VALUATION STABILITY
# =========================================================

top20 = (
    valuations[
        valuations[
            "top_n"
        ] == 20
    ][
        [
            "target_playerId",
            "method",
            "cap_pct_median",
        ]
    ]
    .rename(
        columns={
            "cap_pct_median":
                "top20_cap_pct"
        }
    )
)

stability = valuations.merge(
    top20,
    on=[
        "target_playerId",
        "method",
    ],
    how="left",
)

stability[
    "difference_vs_top20"
] = (
    stability[
        "cap_pct_median"
    ]
    - stability[
        "top20_cap_pct"
    ]
).abs()

stability_summary = (
    stability
    .groupby(
        [
            "method",
            "top_n",
        ]
    )[
        "difference_vs_top20"
    ]
    .agg(
        median="median",
        p75=lambda x:
            x.quantile(0.75),
        p90=lambda x:
            x.quantile(0.90),
    )
    .reset_index()
)

stability_summary.to_csv(
    OUTPUT_DIR
    / "08_valuation_stability.csv",
    index=False,
)


# =========================================================
# GRAPH 4
# TOP-N VALUATION STABILITY
# =========================================================

fig, ax = plt.subplots(
    figsize=(10, 6)
)

for method in weight_methods:
    plot_data = (
        stability_summary[
            stability_summary[
                "method"
            ] == method
        ]
    )

    ax.plot(
        plot_data[
            "top_n"
        ],
        plot_data[
            "median"
        ],
        marker="o",
        label=method,
    )

ax.set_title(
    "Market-Value Stability as Comparable Depth Increases"
)

ax.set_xlabel(
    "Top N comparable players included"
)

ax.set_ylabel(
    "Median absolute cap-% difference vs Top 20"
)

ax.set_xticks(
    range(
        1,
        MAX_RANK + 1,
    )
)

ax.legend(
    title="Similarity weight"
)

fig.tight_layout()

fig.savefig(
    OUTPUT_DIR
    / "08_valuation_stability.png",
    dpi=160,
)

plt.close(fig)


# =========================================================
# 5. EXAMPLE PLAYER GRAPHS
# =========================================================

for label, player_id in EXAMPLE_PLAYERS.items():

    player_comparables = (
        comparables[
            comparables[
                "target_playerId"
            ] == player_id
        ]
        .sort_values(
            "comparable_rank"
        )
    )

    if player_comparables.empty:
        print(
            f"\nSkipping {label}: "
            "player not found in export."
        )
        continue

    player_name = (
        player_comparables[
            "target_player"
        ]
        .iloc[0]
    )

    # -----------------------------------------------------
    # EXAMPLE GRAPH A — SIMILARITY
    # -----------------------------------------------------

    fig, ax = plt.subplots(
        figsize=(11, 6)
    )

    ax.plot(
        player_comparables[
            "comparable_rank"
        ],
        player_comparables[
            "overall_similarity"
        ],
        marker="o",
    )

    for _, row in (
        player_comparables
        .head(10)
        .iterrows()
    ):
        ax.annotate(
            str(
                row[
                    "comparable_player"
                ]
            ),
            (
                row[
                    "comparable_rank"
                ],
                row[
                    "overall_similarity"
                ],
            ),
            xytext=(4, 5),
            textcoords="offset points",
            fontsize=8,
        )

    ax.set_title(
        f"{player_name}: Comparable Similarity"
    )

    ax.set_xlabel(
        "Comparable rank"
    )

    ax.set_ylabel(
        "Overall similarity (%)"
    )

    ax.set_xticks(
        range(
            1,
            MAX_RANK + 1,
        )
    )

    fig.tight_layout()

    fig.savefig(
        OUTPUT_DIR
        / f"08_{label}_similarity.png",
        dpi=160,
    )

    plt.close(fig)

    # -----------------------------------------------------
    # EXAMPLE GRAPH B — MARKET VALUE
    # -----------------------------------------------------

    player_values = (
        valuations[
            valuations[
                "target_playerId"
            ] == player_id
        ]
    )

    fig, ax = plt.subplots(
        figsize=(10, 6)
    )

    for method in weight_methods:
        plot_data = (
            player_values[
                player_values[
                    "method"
                ] == method
            ]
            .sort_values(
                "top_n"
            )
        )

        ax.plot(
            plot_data[
                "top_n"
            ],
            plot_data[
                "cap_pct_median"
            ],
            marker="o",
            label=method,
        )

    ax.set_title(
        f"{player_name}: Market Value vs Comparable Depth"
    )

    ax.set_xlabel(
        "Top N comparable players included"
    )

    ax.set_ylabel(
        "Weighted median cap %"
    )

    ax.set_xticks(
        range(
            1,
            MAX_RANK + 1,
        )
    )

    ax.legend(
        title="Similarity weight"
    )

    fig.tight_layout()

    fig.savefig(
        OUTPUT_DIR
        / f"08_{label}_market_value.png",
        dpi=160,
    )

    plt.close(fig)

    # -----------------------------------------------------
    # EXAMPLE GRAPH C — CONTRACT CONTRIBUTION
    # -----------------------------------------------------

    player_contracts = (
        contracts[
            contracts[
                "target_playerId"
            ] == player_id
        ]
        .copy()
    )

    if not player_contracts.empty:
        player_contracts = add_weights(
            player_contracts,
            "linear",
        )

        contribution = (
            player_contracts
            .groupby(
                [
                    "comparable_rank",
                    "comparable_player",
                ],
                as_index=False,
            )[
                "contract_weight"
            ]
            .sum()
            .sort_values(
                "comparable_rank"
            )
        )

        total_weight = (
            contribution[
                "contract_weight"
            ]
            .sum()
        )

        if total_weight > 0:
            contribution[
                "weight_share"
            ] = (
                contribution[
                    "contract_weight"
                ]
                / total_weight
                * 100
            )
        else:
            contribution[
                "weight_share"
            ] = 0.0

        fig, ax = plt.subplots(
            figsize=(12, 6)
        )

        ax.bar(
            contribution[
                "comparable_rank"
            ],
            contribution[
                "weight_share"
            ],
        )

        ax.set_title(
            f"{player_name}: Share of Current Contract Evidence"
        )

        ax.set_xlabel(
            "Comparable rank"
        )

        ax.set_ylabel(
            "Share of total contract weight (%)"
        )

        ax.set_xticks(
            contribution[
                "comparable_rank"
            ]
        )

        fig.tight_layout()

        fig.savefig(
            OUTPUT_DIR
            / f"08_{label}_evidence.png",
            dpi=160,
        )

        plt.close(fig)


# =========================================================
# SUMMARY
# =========================================================

print(
    "\nSelected stability results:"
)

selected_stability = (
    stability_summary[
        stability_summary[
            "top_n"
        ].isin(
            [
                3,
                5,
                10,
                15,
                20,
            ]
        )
    ]
)

print(
    selected_stability
    .round(3)
    .to_string(
        index=False
    )
)

print(
    "\n========================================"
)

print(
    "CALIBRATION OUTPUT COMPLETE"
)

print(
    "========================================"
)

print(
    f"Saved to: {OUTPUT_DIR}"
)

print(
    "\nGraphs:"
)

for filename in [
    "08_similarity_by_rank.png",
    "08_evidence_by_top_n.png",
    "08_effective_evidence.png",
    "08_valuation_stability.png",
    "08_mcdavid_similarity.png",
    "08_mcdavid_market_value.png",
    "08_mcdavid_evidence.png",
    "08_hellebuyck_similarity.png",
    "08_hellebuyck_market_value.png",
    "08_hellebuyck_evidence.png",
]:
    print(
        f"  {filename}"
    )