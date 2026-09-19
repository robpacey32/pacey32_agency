from pathlib import Path

from google.cloud import bigquery
import matplotlib.pyplot as plt
import pandas as pd


# =========================================================
# CONFIG
# =========================================================

PROJECT_ID = "pacey32-agency"

CONTRACT_FEATURE_TABLE = (
    "pacey32-agency."
    "Comparison.15_ContractModelFeatures"
)

MIN_PRIOR_CONTRACTS = 50

# Full half-life search.
RECENCY_HALF_LIVES = [
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    12,
    18,
    24,
    36,
    60,
]

# Smaller set used for detailed stability diagnostics.
STABILITY_HALF_LIVES = [
    4,
    6,
    8,
    12,
    24,
    60,
]

OUTPUT_DIR = (
    Path(__file__).resolve().parent
    / "calibration_output"
)


# =========================================================
# BIGQUERY
# =========================================================

client = bigquery.Client(
    project=PROJECT_ID
)


def load_contracts() -> pd.DataFrame:

    query = f"""
        SELECT
            *

        FROM `{CONTRACT_FEATURE_TABLE}`

        WHERE cap_pct_at_signing IS NOT NULL
          AND cap_pct_at_signing > 0

          AND signed_date IS NOT NULL
          AND signing_age IS NOT NULL
          AND term IS NOT NULL

          AND last1_games IS NOT NULL
          AND last1_games > 0

        ORDER BY
            signed_date,
            contract_id
    """

    df = client.query(
        query
    ).to_dataframe()

    df["signed_date"] = pd.to_datetime(
        df["signed_date"]
    )

    return df


# =========================================================
# BACKTEST ELIGIBILITY
# =========================================================

def create_backtest_population(
    df: pd.DataFrame,
) -> pd.DataFrame:

    df = df.copy()

    prior_contract_counts = []

    for _, target in df.iterrows():

        # Strictly earlier dates only.
        #
        # Same-day contracts cannot predict one another.

        prior_count = (
            df["signed_date"]
            < target["signed_date"]
        ).sum()

        prior_contract_counts.append(
            prior_count
        )

    df["prior_contract_count"] = (
        prior_contract_counts
    )

    df["backtest_eligible"] = (
        df["prior_contract_count"]
        >= MIN_PRIOR_CONTRACTS
    )

    return df


# =========================================================
# AUDIT
# =========================================================

def print_audit(
    df: pd.DataFrame,
) -> None:

    eligible = df[
        df["backtest_eligible"]
    ].copy()

    print()
    print("=" * 70)
    print(
        "CONTRACT BACKTEST DATASET"
    )
    print("=" * 70)

    print(
        f"Total contracts: "
        f"{len(df):,}"
    )

    print(
        f"Backtest eligible: "
        f"{len(eligible):,}"
    )

    print(
        f"Excluded for insufficient history: "
        f"{len(df) - len(eligible):,}"
    )

    print()

    print(
        "Full date range:",
        df["signed_date"]
        .min()
        .date(),
        "to",
        df["signed_date"]
        .max()
        .date(),
    )

    if len(eligible) > 0:

        print(
            "Backtest date range:",
            eligible[
                "signed_date"
            ]
            .min()
            .date(),
            "to",
            eligible[
                "signed_date"
            ]
            .max()
            .date(),
        )

    print()

    print(
        "Eligible contracts by market type:"
    )

    print(
        eligible[
            "contract_market_type"
        ]
        .value_counts()
        .to_string()
    )

    print()

    print(
        "Eligible contracts by signing year:"
    )

    print(
        eligible
        .groupby(
            "signing_year"
        )
        .size()
        .to_string()
    )

    print()

    print(
        "Actual cap % distribution:"
    )

    print(
        eligible[
            "cap_pct_at_signing"
        ]
        .describe(
            percentiles=[
                0.10,
                0.25,
                0.50,
                0.75,
                0.90,
                0.95,
                0.99,
            ]
        )
        .round(2)
        .to_string()
    )

    print()
    print("=" * 70)


# =========================================================
# ERROR METRICS
# =========================================================

def calculate_metrics(
    results: pd.DataFrame,
    prediction_column: str,
) -> dict:

    valid = results[
        results[
            prediction_column
        ].notna()
    ].copy()

    if len(valid) == 0:

        return {
            "n": 0,
            "mae": float("nan"),
            "rmse": float("nan"),
            "bias": float("nan"),
        }

    errors = (
        valid[
            prediction_column
        ]
        - valid[
            "cap_pct_at_signing"
        ]
    )

    return {
        "n":
            len(valid),

        "mae":
            errors.abs().mean(),

        "rmse":
            (errors ** 2).mean()
            ** 0.5,

        "bias":
            errors.mean(),
    }


def print_metrics(
    name: str,
    results: pd.DataFrame,
    prediction_column: str,
) -> None:

    metrics = calculate_metrics(
        results,
        prediction_column,
    )

    print()
    print(name)
    print("-" * 70)

    print(
        f"N:    "
        f"{metrics['n']:,}"
    )

    print(
        f"MAE:  "
        f"{metrics['mae']:.3f} "
        f"cap points"
    )

    print(
        f"RMSE: "
        f"{metrics['rmse']:.3f} "
        f"cap points"
    )

    print(
        f"Bias: "
        f"{metrics['bias']:+.3f} "
        f"cap points"
    )


# =========================================================
# BASELINE 0
#
# Mean of every contract signed BEFORE the target.
# =========================================================

def run_baseline_0(
    df: pd.DataFrame,
) -> pd.DataFrame:

    results = df.copy()

    predictions = []

    for _, target in results.iterrows():

        if not target[
            "backtest_eligible"
        ]:
            predictions.append(
                None
            )
            continue

        history = df[
            df["signed_date"]
            < target["signed_date"]
        ]

        if len(history) == 0:
            predictions.append(
                None
            )
            continue

        prediction = history[
            "cap_pct_at_signing"
        ].mean()

        predictions.append(
            prediction
        )

    results[
        "baseline_0_prediction"
    ] = predictions

    return results


# =========================================================
# BASELINE 1
#
# Mean of historical contracts with the SAME
# contract market type.
# =========================================================

def run_baseline_1(
    df: pd.DataFrame,
) -> pd.DataFrame:

    results = df.copy()

    predictions = []

    for _, target in results.iterrows():

        if not target[
            "backtest_eligible"
        ]:
            predictions.append(
                None
            )
            continue

        history = df[
            (
                df["signed_date"]
                < target[
                    "signed_date"
                ]
            )
            &
            (
                df[
                    "contract_market_type"
                ]
                ==
                target[
                    "contract_market_type"
                ]
            )
        ]

        if len(history) == 0:
            predictions.append(
                None
            )
            continue

        prediction = history[
            "cap_pct_at_signing"
        ].mean()

        predictions.append(
            prediction
        )

    results[
        "baseline_1_prediction"
    ] = predictions

    return results


# =========================================================
# RECENCY WEIGHTS
# =========================================================

def calculate_recency_weights(
    history: pd.DataFrame,
    target_date: pd.Timestamp,
    half_life_months: int,
) -> pd.Series:

    age_days = (
        target_date
        - history[
            "signed_date"
        ]
    ).dt.days

    age_months = (
        age_days
        / 30.4375
    )

    weights = (
        0.5
        **
        (
            age_months
            / half_life_months
        )
    )

    return weights


def calculate_effective_sample_size(
    weights: pd.Series,
) -> float:

    total_weight = (
        weights.sum()
    )

    squared_weight_sum = (
        (weights ** 2).sum()
    )

    if (
        total_weight <= 0
        or squared_weight_sum <= 0
    ):
        return float("nan")

    # Kish effective sample size.
    return (
        total_weight ** 2
        / squared_weight_sum
    )


# =========================================================
# BASELINE 2
#
# Historical contracts with the SAME market type,
# weighted by contract recency.
#
# Recency is measured relative to the historical target
# signing date, never today's date.
# =========================================================

def run_baseline_2(
    df: pd.DataFrame,
    half_life_months: int,
) -> pd.DataFrame:

    results = df.copy()

    predictions = []
    effective_sample_sizes = []
    historical_contract_counts = []

    for _, target in results.iterrows():

        if not target[
            "backtest_eligible"
        ]:

            predictions.append(
                None
            )

            effective_sample_sizes.append(
                None
            )

            historical_contract_counts.append(
                None
            )

            continue

        history = df[
            (
                df["signed_date"]
                < target[
                    "signed_date"
                ]
            )
            &
            (
                df[
                    "contract_market_type"
                ]
                ==
                target[
                    "contract_market_type"
                ]
            )
        ].copy()

        historical_contract_counts.append(
            len(history)
        )

        if len(history) == 0:

            predictions.append(
                None
            )

            effective_sample_sizes.append(
                None
            )

            continue

        weights = (
            calculate_recency_weights(
                history,
                target[
                    "signed_date"
                ],
                half_life_months,
            )
        )

        total_weight = (
            weights.sum()
        )

        if total_weight <= 0:

            predictions.append(
                None
            )

            effective_sample_sizes.append(
                None
            )

            continue

        prediction = (
            (
                history[
                    "cap_pct_at_signing"
                ]
                * weights
            ).sum()
            / total_weight
        )

        effective_sample_size = (
            calculate_effective_sample_size(
                weights
            )
        )

        predictions.append(
            prediction
        )

        effective_sample_sizes.append(
            effective_sample_size
        )

    prediction_column = (
        f"baseline_2_"
        f"{half_life_months}m"
    )

    ess_column = (
        f"baseline_2_"
        f"{half_life_months}m_ess"
    )

    history_count_column = (
        f"baseline_2_"
        f"{half_life_months}m_history_n"
    )

    results[
        prediction_column
    ] = predictions

    results[
        ess_column
    ] = effective_sample_sizes

    results[
        history_count_column
    ] = historical_contract_counts

    return results


# =========================================================
# SEGMENT METRICS
# =========================================================

def print_segment_metrics(
    results: pd.DataFrame,
    prediction_column: str,
) -> None:

    print()
    print(
        "By contract market type"
    )
    print("-" * 70)

    for market_type in sorted(
        results[
            "contract_market_type"
        ]
        .dropna()
        .unique()
    ):

        subset = results[
            results[
                "contract_market_type"
            ]
            == market_type
        ]

        metrics = calculate_metrics(
            subset,
            prediction_column,
        )

        print(
            f"{market_type:<15} "
            f"N={metrics['n']:>4,}  "
            f"MAE={metrics['mae']:.3f}  "
            f"RMSE={metrics['rmse']:.3f}  "
            f"Bias={metrics['bias']:+.3f}"
        )


# =========================================================
# RECENCY CALIBRATION
# =========================================================

def run_recency_calibration(
    results: pd.DataFrame,
):

    summary_rows = []

    print()
    print("=" * 70)
    print(
        "BASELINE 2 — "
        "MARKET TYPE + RECENCY"
    )
    print("=" * 70)

    for half_life in (
        RECENCY_HALF_LIVES
    ):

        prediction_column = (
            f"baseline_2_"
            f"{half_life}m"
        )

        ess_column = (
            f"baseline_2_"
            f"{half_life}m_ess"
        )

        results = run_baseline_2(
            results,
            half_life,
        )

        metrics = calculate_metrics(
            results,
            prediction_column,
        )

        eligible_ess = (
            results.loc[
                results[
                    prediction_column
                ].notna(),
                ess_column,
            ]
            .dropna()
        )

        summary_rows.append({
            "half_life_months":
                half_life,

            "n":
                metrics["n"],

            "mae":
                metrics["mae"],

            "rmse":
                metrics["rmse"],

            "bias":
                metrics["bias"],

            "mean_ess":
                eligible_ess.mean(),

            "median_ess":
                eligible_ess.median(),
        })

    summary = pd.DataFrame(
        summary_rows
    ).sort_values(
        "half_life_months"
    ).reset_index(
        drop=True
    )

    print()
    print(
        summary[
            [
                "half_life_months",
                "n",
                "mae",
                "rmse",
                "bias",
                "mean_ess",
                "median_ess",
            ]
        ]
        .round({
            "mae": 3,
            "rmse": 3,
            "bias": 3,
            "mean_ess": 1,
            "median_ess": 1,
        })
        .to_string(
            index=False
        )
    )

    best_row = (
        summary
        .sort_values(
            [
                "mae",
                "rmse",
            ]
        )
        .iloc[0]
    )

    best_half_life = int(
        best_row[
            "half_life_months"
        ]
    )

    best_column = (
        f"baseline_2_"
        f"{best_half_life}m"
    )

    print()
    print(
        f"Lowest MAE half-life: "
        f"{best_half_life} months"
    )

    print_metrics(
        "Best recency model — Overall",
        results,
        best_column,
    )

    print_segment_metrics(
        results,
        best_column,
    )

    return (
        results,
        summary,
    )


# =========================================================
# YEAR-BY-YEAR STABILITY
# =========================================================

def create_year_stability_table(
    results: pd.DataFrame,
) -> pd.DataFrame:

    rows = []

    eligible = results[
        results[
            "backtest_eligible"
        ]
    ].copy()

    years = sorted(
        eligible[
            "signing_year"
        ]
        .dropna()
        .unique()
    )

    for year in years:

        year_data = eligible[
            eligible[
                "signing_year"
            ]
            == year
        ]

        for half_life in (
            STABILITY_HALF_LIVES
        ):

            prediction_column = (
                f"baseline_2_"
                f"{half_life}m"
            )

            ess_column = (
                f"baseline_2_"
                f"{half_life}m_ess"
            )

            metrics = (
                calculate_metrics(
                    year_data,
                    prediction_column,
                )
            )

            rows.append({
                "signing_year":
                    int(year),

                "half_life_months":
                    half_life,

                "n":
                    metrics["n"],

                "mae":
                    metrics["mae"],

                "rmse":
                    metrics["rmse"],

                "bias":
                    metrics["bias"],

                "mean_ess":
                    year_data[
                        ess_column
                    ].mean(),

                "median_ess":
                    year_data[
                        ess_column
                    ].median(),
            })

    return pd.DataFrame(
        rows
    )


def print_year_stability(
    stability: pd.DataFrame,
) -> None:

    print()
    print("=" * 70)
    print(
        "RECENCY STABILITY BY SIGNING YEAR"
    )
    print("=" * 70)

    mae_table = (
        stability
        .pivot(
            index="signing_year",
            columns="half_life_months",
            values="mae",
        )
        .sort_index()
    )

    mae_table.columns = [
        f"{int(column)}m"
        for column
        in mae_table.columns
    ]

    print()
    print(
        "MAE by signing year"
    )
    print("-" * 70)

    print(
        mae_table
        .round(3)
        .to_string()
    )

    bias_table = (
        stability
        .pivot(
            index="signing_year",
            columns="half_life_months",
            values="bias",
        )
        .sort_index()
    )

    bias_table.columns = [
        f"{int(column)}m"
        for column
        in bias_table.columns
    ]

    print()
    print(
        "Bias by signing year"
    )
    print("-" * 70)

    print(
        bias_table
        .round(3)
        .to_string()
    )


# =========================================================
# EFFECTIVE EVIDENCE SUMMARY
# =========================================================

def print_evidence_summary(
    summary: pd.DataFrame,
) -> None:

    evidence = summary[
        summary[
            "half_life_months"
        ].isin(
            STABILITY_HALF_LIVES
        )
    ].copy()

    print()
    print("=" * 70)
    print(
        "EFFECTIVE CONTRACT EVIDENCE"
    )
    print("=" * 70)

    print()
    print(
        evidence[
            [
                "half_life_months",
                "mean_ess",
                "median_ess",
            ]
        ]
        .round({
            "mean_ess": 1,
            "median_ess": 1,
        })
        .to_string(
            index=False
        )
    )

    print()
    print(
        "ESS = effective number of equally weighted "
        "contracts represented by the recency weights."
    )


# =========================================================
# CHART 1
# HALF-LIFE VS ERROR
# =========================================================

def create_error_chart(
    summary: pd.DataFrame,
) -> Path:

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_path = (
        OUTPUT_DIR
        / "10_recency_error.png"
    )

    fig, ax = plt.subplots(
        figsize=(10, 6)
    )

    ax.plot(
        summary[
            "half_life_months"
        ],
        summary["mae"],
        marker="o",
        label="MAE",
    )

    ax.plot(
        summary[
            "half_life_months"
        ],
        summary["rmse"],
        marker="o",
        label="RMSE",
    )

    ax.set_title(
        "Contract Recency Half-Life Calibration"
    )

    ax.set_xlabel(
        "Recency Half-Life (Months)"
    )

    ax.set_ylabel(
        "Cap % Prediction Error"
    )

    ax.legend()

    ax.grid(
        True,
        alpha=0.25,
    )

    fig.tight_layout()

    fig.savefig(
        output_path,
        dpi=160,
        bbox_inches="tight",
    )

    plt.close(
        fig
    )

    return output_path


# =========================================================
# CHART 2
# YEAR-BY-YEAR MAE
# =========================================================

def create_year_chart(
    stability: pd.DataFrame,
) -> Path:

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_path = (
        OUTPUT_DIR
        / "10_recency_by_year.png"
    )

    fig, ax = plt.subplots(
        figsize=(12, 7)
    )

    for half_life in (
        STABILITY_HALF_LIVES
    ):

        subset = stability[
            stability[
                "half_life_months"
            ]
            == half_life
        ].sort_values(
            "signing_year"
        )

        ax.plot(
            subset[
                "signing_year"
            ],
            subset["mae"],
            marker="o",
            label=f"{half_life}m",
        )

    ax.set_title(
        "Recency Model Stability by Signing Year"
    )

    ax.set_xlabel(
        "Signing Year"
    )

    ax.set_ylabel(
        "MAE — Cap % Points"
    )

    ax.legend(
        title="Half-Life"
    )

    ax.grid(
        True,
        alpha=0.25,
    )

    fig.tight_layout()

    fig.savefig(
        output_path,
        dpi=160,
        bbox_inches="tight",
    )

    plt.close(
        fig
    )

    return output_path


# =========================================================
# CHART 3
# EFFECTIVE SAMPLE SIZE
# =========================================================

def create_evidence_chart(
    summary: pd.DataFrame,
) -> Path:

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_path = (
        OUTPUT_DIR
        / "10_recency_evidence.png"
    )

    evidence = summary[
        summary[
            "half_life_months"
        ].isin(
            STABILITY_HALF_LIVES
        )
    ].sort_values(
        "half_life_months"
    )

    fig, ax = plt.subplots(
        figsize=(10, 6)
    )

    ax.plot(
        evidence[
            "half_life_months"
        ],
        evidence[
            "median_ess"
        ],
        marker="o",
        label=(
            "Median effective "
            "contract count"
        ),
    )

    ax.plot(
        evidence[
            "half_life_months"
        ],
        evidence[
            "mean_ess"
        ],
        marker="o",
        label=(
            "Mean effective "
            "contract count"
        ),
    )

    ax.set_title(
        "Effective Contract Evidence "
        "by Recency Half-Life"
    )

    ax.set_xlabel(
        "Recency Half-Life (Months)"
    )

    ax.set_ylabel(
        "Effective Contract Count"
    )

    ax.legend()

    ax.grid(
        True,
        alpha=0.25,
    )

    fig.tight_layout()

    fig.savefig(
        output_path,
        dpi=160,
        bbox_inches="tight",
    )

    plt.close(
        fig
    )

    return output_path


# =========================================================
# SAVE TABLES
# =========================================================

def save_calibration_tables(
    summary: pd.DataFrame,
    stability: pd.DataFrame,
) -> None:

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    summary.to_csv(
        OUTPUT_DIR
        / "10_recency_summary.csv",
        index=False,
    )

    stability.to_csv(
        OUTPUT_DIR
        / "10_recency_by_year.csv",
        index=False,
    )


# =========================================================
# MAIN
# =========================================================

def main():

    print(
        "Loading contract model features..."
    )

    contracts = load_contracts()

    contracts = (
        create_backtest_population(
            contracts
        )
    )

    print_audit(
        contracts
    )


    # =====================================================
    # BASELINE 0
    # =====================================================

    print()
    print("=" * 70)
    print(
        "BASELINE 0 — "
        "ALL PRIOR CONTRACTS"
    )
    print("=" * 70)

    results = run_baseline_0(
        contracts
    )

    print_metrics(
        "Overall",
        results,
        "baseline_0_prediction",
    )

    print_segment_metrics(
        results,
        "baseline_0_prediction",
    )


    # =====================================================
    # BASELINE 1
    # =====================================================

    print()
    print("=" * 70)
    print(
        "BASELINE 1 — "
        "CONTRACT MARKET TYPE"
    )
    print("=" * 70)

    results = run_baseline_1(
        results
    )

    print_metrics(
        "Overall",
        results,
        "baseline_1_prediction",
    )

    print_segment_metrics(
        results,
        "baseline_1_prediction",
    )


    # =====================================================
    # BASELINE 2
    # =====================================================

    (
        results,
        recency_summary,
    ) = run_recency_calibration(
        results
    )


    # =====================================================
    # STABILITY
    # =====================================================

    stability = (
        create_year_stability_table(
            results
        )
    )

    print_year_stability(
        stability
    )


    # =====================================================
    # EFFECTIVE EVIDENCE
    # =====================================================

    print_evidence_summary(
        recency_summary
    )


    # =====================================================
    # SAVE OUTPUT
    # =====================================================

    save_calibration_tables(
        recency_summary,
        stability,
    )

    error_chart = create_error_chart(
        recency_summary
    )

    year_chart = create_year_chart(
        stability
    )

    evidence_chart = (
        create_evidence_chart(
            recency_summary
        )
    )

    print()
    print("=" * 70)
    print(
        "CALIBRATION OUTPUT SAVED"
    )
    print("=" * 70)

    print(
        error_chart
    )

    print(
        year_chart
    )

    print(
        evidence_chart
    )

    print(
        OUTPUT_DIR
        / "10_recency_summary.csv"
    )

    print(
        OUTPUT_DIR
        / "10_recency_by_year.csv"
    )


if __name__ == "__main__":
    main()