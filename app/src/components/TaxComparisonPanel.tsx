"use client";

import { useMemo, useState } from "react";

type TaxTeam = {
    team_code: string;
    team_name: string;
    city_name: string;
    team_logo: string | null;

    home_country_code: string;
    home_state_province: string;
    home_jurisdiction_id: string;

    salary_usd: number;

    federal_tax_usd: number;
    home_jurisdiction_tax_usd: number;
    incremental_away_tax_usd: number;
    quebec_federal_abatement_usd: number;

    estimated_total_tax_usd: number;
    effective_tax_rate: number;
    estimated_take_home_usd: number;

    take_home_rank: number;

    nhl_average_take_home_usd: number;
    vs_nhl_average_usd: number;
    vs_nhl_average_pct: number;
};

type Props = {
    teams: TaxTeam[];
    selectedTeamCode: string;
    salaryInput: string;
    loading: boolean;
    error: string | null;

    onSalaryInputChange: (
        value: string
    ) => void;

    onCalculate: () => void;

    onQuickSalary: (
        salary: number
    ) => void;
};

type ChartMetric =
    | "take-home"
    | "tax"
    | "rate"
    | "vs-average";

const quickSalaries = [
    1_000_000,
    2_500_000,
    5_000_000,
    7_500_000,
    10_000_000,
];

const chartOptions: {
    id: ChartMetric;
    label: string;
}[] = [
    {
        id: "take-home",
        label: "Take Home",
    },
    {
        id: "tax",
        label: "Tax",
    },
    {
        id: "rate",
        label: "Effective Rate",
    },
    {
        id: "vs-average",
        label: "vs NHL Avg",
    },
];

export default function TaxComparisonPanel({
    teams,
    selectedTeamCode,
    salaryInput,
    loading,
    error,
    onSalaryInputChange,
    onCalculate,
    onQuickSalary,
}: Props) {
    const [
        chartMetric,
        setChartMetric,
    ] =
        useState<ChartMetric>(
            "take-home"
        );

    const selectedTeam =
        teams.find(
            (team) =>
                team.team_code ===
                selectedTeamCode
        ) ?? null;

    const sortedTeams =
        useMemo(() => {
            return [...teams].sort(
                (a, b) =>
                    getMetricValue(
                        b,
                        chartMetric
                    ) -
                    getMetricValue(
                        a,
                        chartMetric
                    )
            );
        }, [
            teams,
            chartMetric,
        ]);

    return (
        <div className="space-y-8">

            {/* SALARY */}
            <div>
                <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                    NHL Salary
                </p>

                <p className="mt-1 text-sm text-slate-400">
                    Compare estimated take-home pay
                    across all 32 NHL teams.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">

                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                            $
                        </span>

                        <input
                            type="text"
                            value={salaryInput}
                            onChange={(event) =>
                                onSalaryInputChange(
                                    event.target.value
                                )
                            }
                            onKeyDown={(event) => {
                                if (
                                    event.key ===
                                    "Enter"
                                ) {
                                    onCalculate();
                                }
                            }}
                            className="w-56 rounded-xl border border-slate-700 bg-slate-950 py-3 pl-8 pr-4 text-white outline-none focus:border-slate-500"
                        />
                    </div>

                    <button
                        onClick={onCalculate}
                        className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
                    >
                        Calculate
                    </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                    {quickSalaries.map(
                        (salary) => (
                            <button
                                key={salary}
                                onClick={() =>
                                    onQuickSalary(
                                        salary
                                    )
                                }
                                className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-400 transition hover:border-slate-600 hover:text-white"
                            >
                                {formatCompactMoney(
                                    salary
                                )}
                            </button>
                        )
                    )}
                </div>
            </div>


            {loading && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-6 text-slate-400">
                    Calculating tax comparison...
                </div>
            )}


            {error && (
                <div className="rounded-xl border border-red-900 bg-red-950/20 p-4 text-red-400">
                    {error}
                </div>
            )}


            {!loading &&
                !error &&
                selectedTeam && (
                    <>
                        {/* SELECTED TEAM */}
                        <div>
                            <p className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-500">
                                Selected Team
                            </p>

                            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-6">

                                <div className="flex items-start justify-between gap-6">

                                    <div className="flex items-center gap-4">

                                        {selectedTeam.team_logo && (
                                            <img
                                                src={
                                                    selectedTeam.team_logo
                                                }
                                                alt=""
                                                className="h-16 w-16 object-contain"
                                            />
                                        )}

                                        <div>
                                            <p className="text-sm text-slate-500">
                                                {
                                                    selectedTeam.city_name
                                                }
                                            </p>

                                            <h3 className="text-2xl font-semibold text-white">
                                                {
                                                    selectedTeam.team_name
                                                }
                                            </h3>

                                            <p className="mt-1 text-sm text-slate-400">
                                                {
                                                    selectedTeam.home_state_province
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <p className="text-xs uppercase tracking-wide text-slate-500">
                                            NHL Take-Home Rank
                                        </p>

                                        <p className="text-4xl font-bold text-white">
                                            #
                                            {
                                                selectedTeam.take_home_rank
                                            }
                                        </p>
                                    </div>
                                </div>


                                <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                                    <TaxMetric
                                        label="Gross Salary"
                                        value={formatCompactMoney(
                                            selectedTeam.salary_usd
                                        )}
                                    />

                                    <TaxMetric
                                        label="Estimated Tax"
                                        value={formatCompactMoney(
                                            selectedTeam.estimated_total_tax_usd
                                        )}
                                    />

                                    <TaxMetric
                                        label="Effective Rate"
                                        value={formatPercent(
                                            selectedTeam.effective_tax_rate
                                        )}
                                    />

                                    <TaxMetric
                                        label="Take Home"
                                        value={formatCompactMoney(
                                            selectedTeam.estimated_take_home_usd
                                        )}
                                    />
                                </div>


                                <div className="mt-7 grid gap-6 lg:grid-cols-2">

                                    <div>
                                        <p className="mb-4 text-sm font-medium text-slate-400">
                                            Tax Breakdown
                                        </p>

                                        <div className="space-y-3">

                                            <TaxRow
                                                label="Federal"
                                                value={
                                                    selectedTeam.federal_tax_usd
                                                }
                                            />

                                            <TaxRow
                                                label="Home state / province"
                                                value={
                                                    selectedTeam.home_jurisdiction_tax_usd
                                                }
                                            />

                                            <TaxRow
                                                label="Away / jock tax"
                                                value={
                                                    selectedTeam.incremental_away_tax_usd
                                                }
                                            />

                                            {selectedTeam.quebec_federal_abatement_usd >
                                                0 && (
                                                <TaxRow
                                                    label="Quebec federal abatement"
                                                    value={
                                                        -selectedTeam.quebec_federal_abatement_usd
                                                    }
                                                />
                                            )}

                                            <div className="border-t border-slate-800 pt-3">
                                                <TaxRow
                                                    label="Total"
                                                    value={
                                                        selectedTeam.estimated_total_tax_usd
                                                    }
                                                    strong
                                                />
                                            </div>
                                        </div>
                                    </div>


                                    <div className="rounded-xl border border-slate-800 p-5">

                                        <p className="text-sm text-slate-500">
                                            Take-home vs NHL average
                                        </p>

                                        <p
                                            className={`mt-2 text-3xl font-bold ${
                                                selectedTeam.vs_nhl_average_usd >=
                                                0
                                                    ? "text-emerald-400"
                                                    : "text-red-400"
                                            }`}
                                        >
                                            {selectedTeam.vs_nhl_average_usd >=
                                            0
                                                ? "+"
                                                : ""}

                                            {formatMoney(
                                                selectedTeam.vs_nhl_average_usd
                                            )}
                                        </p>

                                        <p className="mt-5 text-sm text-slate-500">
                                            NHL average take home
                                        </p>

                                        <p className="mt-1 text-xl font-semibold">
                                            {formatMoney(
                                                selectedTeam.nhl_average_take_home_usd
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>


                        {/* NHL COMPARISON */}
                        <div>
                            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

                                <div>
                                    <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                                        NHL Comparison
                                    </p>

                                    <p className="mt-1 text-sm text-slate-400">
                                        All 32 teams ranked by the selected measure.
                                    </p>
                                </div>


                                {/* METRIC SELECTOR */}
                                <div className="inline-flex w-fit rounded-xl border border-slate-800 bg-slate-950 p-1">

                                    {chartOptions.map(
                                        (
                                            option
                                        ) => (
                                            <button
                                                key={
                                                    option.id
                                                }
                                                onClick={() =>
                                                    setChartMetric(
                                                        option.id
                                                    )
                                                }
                                                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                                                    chartMetric ===
                                                    option.id
                                                        ? "bg-slate-700 text-white"
                                                        : "text-slate-500 hover:text-slate-300"
                                                }`}
                                            >
                                                {
                                                    option.label
                                                }
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>


                            {/* COLUMN CHART */}
                            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/50">

                                <div className="min-w-[1450px] px-7 pb-6 pt-8">

                                    <ColumnChart
                                        teams={
                                            sortedTeams
                                        }
                                        metric={
                                            chartMetric
                                        }
                                        selectedTeamCode={
                                            selectedTeamCode
                                        }
                                    />

                                </div>
                            </div>
                        </div>


                        {/* METHODOLOGY */}
                        <div className="border-t border-slate-800 pt-5 text-xs leading-5 text-slate-500">
                            Estimate based on 2026
                            federal and
                            state/provincial tax
                            rules and the 2025-26
                            NHL regular-season
                            schedule. Away-game
                            taxation is approximated
                            using game-location
                            salary allocation.
                            Excludes local and
                            payroll taxes,
                            individual deductions,
                            residency strategies,
                            contract structuring and
                            other player-specific
                            circumstances.
                        </div>
                    </>
                )}
        </div>
    );
}


function ColumnChart({
    teams,
    metric,
    selectedTeamCode,
}: {
    teams: TaxTeam[];
    metric: ChartMetric;
    selectedTeamCode: string;
}) {
    const [
        hoveredTeam,
        setHoveredTeam,
    ] =
        useState<string | null>(
            null
        );

    const values =
        teams.map((team) =>
            getMetricValue(
                team,
                metric
            )
        );

    const maxValue =
        Math.max(
            ...values.map(
                (value) =>
                    Math.abs(value)
            ),
            1
        );

    const selectedTeam =
        teams.find(
            (team) =>
                team.team_code ===
                selectedTeamCode
        ) ?? null;

    const isVsAverage =
        metric ===
        "vs-average";


    if (isVsAverage) {
        return (
            <div>

                {/* POSITIVE HALF */}
                <div className="relative h-48">

                    <ChartGridLines />

                    <div className="absolute inset-0 grid grid-cols-[repeat(32,minmax(42px,1fr))] gap-2">

                        {teams.map(
                            (team) => {
                                const value =
                                    getMetricValue(
                                        team,
                                        metric
                                    );

                                const height =
                                    value > 0
                                        ? Math.max(
                                              (
                                                  value /
                                                  maxValue
                                              ) *
                                                  100,
                                              2
                                          )
                                        : 0;

                                const selected =
                                    team.team_code ===
                                    selectedTeamCode;

                                const hovered =
                                    hoveredTeam ===
                                    team.team_code;

                                return (
                                    <div
                                        key={
                                            team.team_code
                                        }
                                        className="relative flex h-full items-end justify-center"
                                        onMouseEnter={() =>
                                            setHoveredTeam(
                                                team.team_code
                                            )
                                        }
                                        onMouseLeave={() =>
                                            setHoveredTeam(
                                                null
                                            )
                                        }
                                    >
                                        {(selected ||
                                            hovered) &&
                                            value >
                                                0 && (
                                                <ChartValueLabel
                                                    value={formatChartValue(
                                                        value,
                                                        metric
                                                    )}
                                                    positive
                                                />
                                            )}

                                        {value >
                                            0 && (
                                            <div
                                                className={`w-[32px] rounded-t-md transition-all duration-300 ${
                                                    selected
                                                        ? "bg-slate-200"
                                                        : "bg-emerald-700 hover:bg-emerald-600"
                                                }`}
                                                style={{
                                                    height: `${height}%`,
                                                }}
                                            />
                                        )}
                                    </div>
                                );
                            }
                        )}

                    </div>
                </div>


                {/* ZERO LINE */}
                <div className="h-px bg-slate-500" />


                {/* NEGATIVE HALF */}
                <div className="relative h-48">

                    <ChartGridLines />

                    <div className="absolute inset-0 grid grid-cols-[repeat(32,minmax(42px,1fr))] gap-2">

                        {teams.map(
                            (team) => {
                                const value =
                                    getMetricValue(
                                        team,
                                        metric
                                    );

                                const height =
                                    value < 0
                                        ? Math.max(
                                              (
                                                  Math.abs(
                                                      value
                                                  ) /
                                                  maxValue
                                              ) *
                                                  100,
                                              2
                                          )
                                        : 0;

                                const selected =
                                    team.team_code ===
                                    selectedTeamCode;

                                const hovered =
                                    hoveredTeam ===
                                    team.team_code;

                                return (
                                    <div
                                        key={
                                            team.team_code
                                        }
                                        className="relative flex h-full items-start justify-center"
                                        onMouseEnter={() =>
                                            setHoveredTeam(
                                                team.team_code
                                            )
                                        }
                                        onMouseLeave={() =>
                                            setHoveredTeam(
                                                null
                                            )
                                        }
                                    >
                                        {value <
                                            0 && (
                                            <div
                                                className={`w-[32px] rounded-b-md transition-all duration-300 ${
                                                    selected
                                                        ? "bg-slate-200"
                                                        : "bg-red-800 hover:bg-red-700"
                                                }`}
                                                style={{
                                                    height: `${height}%`,
                                                }}
                                            />
                                        )}

                                        {(selected ||
                                            hovered) &&
                                            value <
                                                0 && (
                                                <ChartValueLabel
                                                    value={formatChartValue(
                                                        value,
                                                        metric
                                                    )}
                                                    negative
                                                />
                                            )}
                                    </div>
                                );
                            }
                        )}

                    </div>
                </div>


                <TeamLogoAxis
                    teams={
                        teams
                    }
                    selectedTeamCode={
                        selectedTeamCode
                    }
                    hoveredTeam={
                        hoveredTeam
                    }
                    setHoveredTeam={
                        setHoveredTeam
                    }
                />


                {selectedTeam && (
                    <SelectedChartSummary
                        team={
                            selectedTeam
                        }
                        metric={
                            metric
                        }
                    />
                )}

            </div>
        );
    }


    return (
        <div>

            {/* MAIN CHART */}
            <div className="relative h-80">

                <ChartGridLines />

                <div className="absolute inset-0 grid grid-cols-[repeat(32,minmax(42px,1fr))] items-end gap-2">

                    {teams.map(
                        (team) => {
                            const value =
                                getMetricValue(
                                    team,
                                    metric
                                );

                            const height =
                                Math.max(
                                    (
                                        value /
                                        maxValue
                                    ) *
                                        100,
                                    2
                                );

                            const selected =
                                team.team_code ===
                                selectedTeamCode;

                            const hovered =
                                hoveredTeam ===
                                team.team_code;

                            return (
                                <div
                                    key={
                                        team.team_code
                                    }
                                    className="relative flex h-full items-end justify-center"
                                    onMouseEnter={() =>
                                        setHoveredTeam(
                                            team.team_code
                                        )
                                    }
                                    onMouseLeave={() =>
                                        setHoveredTeam(
                                            null
                                        )
                                    }
                                >
                                    {(selected ||
                                        hovered) && (
                                        <ChartValueLabel
                                            value={formatChartValue(
                                                value,
                                                metric
                                            )}
                                            positive
                                        />
                                    )}

                                    <div
                                        className={`w-[32px] rounded-t-md transition-all duration-300 ${
                                            selected
                                                ? "bg-slate-200"
                                                : "bg-slate-700 hover:bg-slate-600"
                                        }`}
                                        style={{
                                            height: `${height}%`,
                                        }}
                                    />
                                </div>
                            );
                        }
                    )}

                </div>
            </div>


            {/* BASELINE */}
            <div className="h-px bg-slate-600" />


            <TeamLogoAxis
                teams={
                    teams
                }
                selectedTeamCode={
                    selectedTeamCode
                }
                hoveredTeam={
                    hoveredTeam
                }
                setHoveredTeam={
                    setHoveredTeam
                }
            />


            {selectedTeam && (
                <SelectedChartSummary
                    team={
                        selectedTeam
                    }
                    metric={
                        metric
                    }
                />
            )}

        </div>
    );
}


function TeamLogoAxis({
    teams,
    selectedTeamCode,
    hoveredTeam,
    setHoveredTeam,
}: {
    teams: TaxTeam[];
    selectedTeamCode: string;
    hoveredTeam: string | null;
    setHoveredTeam: (
        value: string | null
    ) => void;
}) {
    return (
        <div className="mt-3 grid grid-cols-[repeat(32,minmax(42px,1fr))] gap-2">

            {teams.map(
                (team) => {
                    const selected =
                        team.team_code ===
                        selectedTeamCode;

                    const hovered =
                        hoveredTeam ===
                        team.team_code;

                    return (
                        <div
                            key={
                                team.team_code
                            }
                            className={`flex cursor-default flex-col items-center gap-1 rounded-lg px-1 py-2 transition ${
                                selected
                                    ? "bg-slate-800"
                                    : hovered
                                    ? "bg-slate-900"
                                    : ""
                            }`}
                            onMouseEnter={() =>
                                setHoveredTeam(
                                    team.team_code
                                )
                            }
                            onMouseLeave={() =>
                                setHoveredTeam(
                                    null
                                )
                            }
                            title={
                                team.team_name
                            }
                        >
                            {team.team_logo && (
                                <img
                                    src={
                                        team.team_logo
                                    }
                                    alt={
                                        team.team_name
                                    }
                                    className={`h-8 w-8 object-contain transition ${
                                        selected ||
                                        hovered
                                            ? "scale-110"
                                            : ""
                                    }`}
                                />
                            )}

                            <span
                                className={`text-[10px] font-semibold ${
                                    selected
                                        ? "text-white"
                                        : hovered
                                        ? "text-slate-300"
                                        : "text-slate-500"
                                }`}
                            >
                                {
                                    team.team_code
                                }
                            </span>
                        </div>
                    );
                }
            )}

        </div>
    );
}


function ChartGridLines() {
    return (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">

            <div className="border-t border-dashed border-slate-800" />

            <div className="border-t border-dashed border-slate-800" />

            <div className="border-t border-dashed border-slate-800" />

            <div className="border-t border-dashed border-slate-800" />

            <div />

        </div>
    );
}


function ChartValueLabel({
    value,
    positive = false,
    negative = false,
}: {
    value: string;
    positive?: boolean;
    negative?: boolean;
}) {
    return (
        <div
            className={`pointer-events-none absolute z-20 whitespace-nowrap rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-semibold text-white shadow-xl ${
                positive
                    ? "-top-8"
                    : negative
                    ? "top-full mt-2"
                    : ""
            }`}
        >
            {value}
        </div>
    );
}


function SelectedChartSummary({
    team,
    metric,
}: {
    team: TaxTeam;
    metric: ChartMetric;
}) {
    const value =
        getMetricValue(
            team,
            metric
        );

    return (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-4">

            <div className="flex items-center gap-3">

                {team.team_logo && (
                    <img
                        src={
                            team.team_logo
                        }
                        alt={
                            team.team_name
                        }
                        className="h-9 w-9 object-contain"
                    />
                )}

                <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                        Selected Team
                    </p>

                    <p className="font-semibold text-white">
                        {
                            team.team_name
                        }
                    </p>
                </div>
            </div>


            <div className="text-right">

                <p className="text-xs uppercase tracking-wide text-slate-500">
                    {getMetricLabel(
                        metric
                    )}
                </p>

                <p className="text-xl font-semibold text-white">
                    {formatChartValue(
                        value,
                        metric
                    )}
                </p>

            </div>

        </div>
    );
}


function getMetricLabel(
    metric: ChartMetric
) {
    switch (metric) {
        case "tax":
            return "Estimated Tax";

        case "rate":
            return "Effective Rate";

        case "vs-average":
            return "vs NHL Average";

        case "take-home":
        default:
            return "Take Home";
    }
}


function getMetricValue(
    team: TaxTeam,
    metric: ChartMetric
) {
    switch (metric) {
        case "tax":
            return team.estimated_total_tax_usd;

        case "rate":
            return (
                team.effective_tax_rate *
                100
            );

        case "vs-average":
            return team.vs_nhl_average_usd;

        case "take-home":
        default:
            return team.estimated_take_home_usd;
    }
}


function formatChartValue(
    value: number,
    metric: ChartMetric
) {
    if (metric === "rate") {
        return `${value.toFixed(
            1
        )}%`;
    }

    if (
        metric ===
        "vs-average"
    ) {
        return `${
            value > 0 ? "+" : ""
        }${formatCompactMoney(
            value
        )}`;
    }

    return formatCompactMoney(
        value
    );
}


function TaxMetric({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-xl border border-slate-800 p-4">

            <p className="text-xs uppercase tracking-wide text-slate-500">
                {label}
            </p>

            <p className="mt-2 text-2xl font-semibold">
                {value}
            </p>

        </div>
    );
}


function TaxRow({
    label,
    value,
    strong = false,
}: {
    label: string;
    value: number;
    strong?: boolean;
}) {
    return (
        <div
            className={`flex justify-between gap-4 ${
                strong
                    ? "font-semibold text-white"
                    : "text-slate-400"
            }`}
        >
            <span>
                {label}
            </span>

            <span>
                {value < 0
                    ? "-"
                    : ""}

                {formatMoney(
                    Math.abs(value)
                )}
            </span>
        </div>
    );
}


function formatMoney(
    value: number
) {
    return new Intl.NumberFormat(
        "en-US",
        {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
        }
    ).format(value);
}


function formatCompactMoney(
    value: number
) {
    return new Intl.NumberFormat(
        "en-US",
        {
            style: "currency",
            currency: "USD",
            notation: "compact",
            maximumFractionDigits: 2,
        }
    ).format(value);
}


function formatPercent(
    value: number
) {
    return `${(
        value * 100
    ).toFixed(1)}%`;
}