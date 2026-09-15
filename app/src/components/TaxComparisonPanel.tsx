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
    local_tax_usd: number;
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

    includeLocalTax: boolean;

    onSalaryInputChange: (
        value: string
    ) => void;

    onCalculate: () => void;

    onQuickSalary: (
        salary: number
    ) => void;

    onIncludeLocalTaxChange: (
        value: boolean
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
    includeLocalTax,
    onSalaryInputChange,
    onCalculate,
    onQuickSalary,
    onIncludeLocalTaxChange,
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

    const localTaxApplies =
        selectedTeam !== null &&
        selectedTeam.local_tax_usd > 0;

    return (
        <div className="w-full min-w-0 max-w-full space-y-8">

            {/* SALARY */}
            <div className="min-w-0">
                <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                    NHL Salary
                </p>

                <p className="mt-1 text-sm text-slate-400">
                    Compare estimated take-home pay
                    across all 32 NHL teams.
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">

                    <div className="relative w-full sm:w-auto">
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
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-8 pr-4 text-white outline-none focus:border-slate-500 sm:w-56"
                        />
                    </div>

                    <button
                        onClick={onCalculate}
                        className="w-full rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 sm:w-auto"
                    >
                        Calculate
                    </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
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
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-slate-400 sm:p-6">
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
                        <div className="min-w-0">
                            <p className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-500">
                                Selected Team
                            </p>

                            <div className="w-full min-w-0 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:p-6">

                                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">

                                    <div className="flex min-w-0 items-center gap-4">

                                        {selectedTeam.team_logo && (
                                            <img
                                                src={
                                                    selectedTeam.team_logo
                                                }
                                                alt=""
                                                className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16"
                                            />
                                        )}

                                        <div className="min-w-0">
                                            <p className="text-sm text-slate-500">
                                                {
                                                    selectedTeam.city_name
                                                }
                                            </p>

                                            <h3 className="break-words text-xl font-semibold text-white sm:text-2xl">
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

                                    <div className="text-left sm:text-right">
                                        <p className="text-xs uppercase tracking-wide text-slate-500">
                                            NHL Take-Home Rank
                                        </p>

                                        <p className="text-3xl font-bold text-white sm:text-4xl">
                                            #
                                            {
                                                selectedTeam.take_home_rank
                                            }
                                        </p>
                                    </div>
                                </div>


                                <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

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


                                {/* RESIDENCY ASSUMPTION */}
                                <div className="mt-7 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">

                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-white">
                                                Live within team city
                                            </p>

                                            <p className="mt-1 text-sm text-slate-500">
                                                Include applicable resident
                                                city/local income taxes.
                                            </p>

                                            {includeLocalTax &&
                                                localTaxApplies && (
                                                <p className="mt-2 text-sm text-slate-400">
                                                    Current local tax estimate:{" "}
                                                    <span className="font-medium text-white">
                                                        {formatMoney(
                                                            selectedTeam.local_tax_usd
                                                        )}
                                                    </span>
                                                </p>
                                            )}

                                            {!includeLocalTax && (
                                                <p className="mt-2 text-sm text-slate-500">
                                                    Local resident tax excluded
                                                    from this comparison.
                                                </p>
                                            )}
                                        </div>


                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={
                                                includeLocalTax
                                            }
                                            onClick={() =>
                                                onIncludeLocalTaxChange(
                                                    !includeLocalTax
                                                )
                                            }
                                            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                                                includeLocalTax
                                                    ? "bg-slate-200"
                                                    : "bg-slate-700"
                                            }`}
                                        >
                                            <span
                                                className={`absolute top-1 h-5 w-5 rounded-full bg-slate-950 transition-all ${
                                                    includeLocalTax
                                                        ? "left-6"
                                                        : "left-1"
                                                }`}
                                            />
                                        </button>

                                    </div>
                                </div>


                                <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-2">

                                    <div className="min-w-0">
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

                                            {selectedTeam.local_tax_usd >
                                                0 && (
                                                <TaxRow
                                                    label={`${selectedTeam.city_name} local`}
                                                    value={
                                                        selectedTeam.local_tax_usd
                                                    }
                                                />
                                            )}

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


                                    <div className="min-w-0 rounded-xl border border-slate-800 p-4 sm:p-5">

                                        <p className="text-sm text-slate-500">
                                            Take-home vs NHL average
                                        </p>

                                        <p
                                            className={`mt-2 break-words text-2xl font-bold sm:text-3xl ${
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

                                        <p className="mt-1 break-words text-xl font-semibold">
                                            {formatMoney(
                                                selectedTeam.nhl_average_take_home_usd
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>


                        {/* NHL COMPARISON */}
                        <div className="min-w-0">
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
                                <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1 sm:inline-flex sm:w-fit">

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
                                                className={`rounded-lg px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
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


                            <div className="w-full min-w-0 rounded-2xl border border-slate-800 bg-slate-950/50">

                                {/* MOBILE RANKING */}
                                <div className="p-3 sm:hidden">

                                    <MobileTeamRanking
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


                                {/* DESKTOP / TABLET CHART */}
                                <div className="hidden px-4 pb-6 pt-8 sm:block sm:px-5">

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
                            federal,
                            state/provincial and,
                            where applicable,
                            resident city/local tax
                            rules and the 2025-26
                            NHL regular-season
                            schedule. Away-game
                            taxation is approximated
                            using game-location
                            salary allocation.
                            Local resident taxes can
                            be excluded using the
                            residency assumption
                            above. Excludes payroll
                            taxes, individual
                            deductions, detailed
                            residency and tax-credit
                            strategies, contract
                            structuring and other
                            player-specific
                            circumstances.
                        </div>
                    </>
                )}
        </div>
    );
}


function MobileTeamRanking({
    teams,
    metric,
    selectedTeamCode,
}: {
    teams: TaxTeam[];
    metric: ChartMetric;
    selectedTeamCode: string;
}) {
    const maxValue =
        Math.max(
            ...teams.map((team) =>
                Math.abs(
                    getMetricValue(
                        team,
                        metric
                    )
                )
            ),
            1
        );

    return (
        <div className="space-y-1">

            {teams.map(
                (team, index) => {
                    const value =
                        getMetricValue(
                            team,
                            metric
                        );

                    const selected =
                        team.team_code ===
                        selectedTeamCode;

                    const width =
                        Math.max(
                            4,
                            (
                                Math.abs(
                                    value
                                ) /
                                maxValue
                            ) *
                                100
                        );

                    return (
                        <div
                            key={
                                team.team_code
                            }
                            className={`rounded-xl border p-3 ${
                                selected
                                    ? "border-slate-500 bg-slate-800/80"
                                    : "border-transparent bg-slate-950/30"
                            }`}
                        >
                            <div className="flex min-w-0 items-center gap-3">

                                <span className="w-5 shrink-0 text-center text-xs text-slate-600">
                                    {index + 1}
                                </span>

                                {team.team_logo && (
                                    <img
                                        src={
                                            team.team_logo
                                        }
                                        alt={
                                            team.team_name
                                        }
                                        className="h-8 w-8 shrink-0 object-contain"
                                    />
                                )}

                                <div className="min-w-0 flex-1">

                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p
                                                className={`truncate text-sm font-semibold ${
                                                    selected
                                                        ? "text-white"
                                                        : "text-slate-300"
                                                }`}
                                            >
                                                {
                                                    team.team_code
                                                }
                                            </p>

                                            <p className="truncate text-xs text-slate-600">
                                                {
                                                    team.city_name
                                                }
                                            </p>
                                        </div>

                                        <p
                                            className={`shrink-0 text-sm font-semibold ${
                                                metric ===
                                                    "vs-average" &&
                                                value > 0
                                                    ? "text-emerald-400"
                                                    : metric ===
                                                          "vs-average" &&
                                                      value < 0
                                                    ? "text-red-400"
                                                    : selected
                                                    ? "text-white"
                                                    : "text-slate-300"
                                            }`}
                                        >
                                            {formatChartValue(
                                                value,
                                                metric
                                            )}
                                        </p>
                                    </div>

                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                                        <div
                                            className={`h-full rounded-full ${
                                                selected
                                                    ? "bg-slate-200"
                                                    : metric ===
                                                          "vs-average" &&
                                                      value >=
                                                          0
                                                    ? "bg-emerald-700"
                                                    : metric ===
                                                          "vs-average" &&
                                                      value <
                                                          0
                                                    ? "bg-red-800"
                                                    : "bg-slate-600"
                                            }`}
                                            style={{
                                                width: `${width}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }
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
            <div className="w-full min-w-0">

                {/* POSITIVE HALF */}
                <div className="relative h-48">

                    <ChartGridLines />

                    <div className="absolute inset-0 grid grid-cols-[repeat(32,minmax(0,1fr))] gap-1">

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
                                        className="relative flex h-full min-w-0 items-end justify-center"
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
                                                className={`w-[70%] min-w-[4px] max-w-[32px] rounded-t-md transition-all duration-300 ${
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

                    <div className="absolute inset-0 grid grid-cols-[repeat(32,minmax(0,1fr))] gap-1">

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
                                        className="relative flex h-full min-w-0 items-start justify-center"
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
                                                className={`w-[70%] min-w-[4px] max-w-[32px] rounded-b-md transition-all duration-300 ${
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
        <div className="w-full min-w-0">

            {/* MAIN CHART */}
            <div className="relative h-80">

                <ChartGridLines />

                <div className="absolute inset-0 grid grid-cols-[repeat(32,minmax(0,1fr))] items-end gap-1">

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
                                    className="relative flex h-full min-w-0 items-end justify-center"
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
                                        className={`w-[70%] min-w-[4px] max-w-[32px] rounded-t-md transition-all duration-300 ${
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
        <div className="mt-3 grid grid-cols-[repeat(32,minmax(0,1fr))] gap-1">

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
                            className={`flex min-w-0 cursor-default flex-col items-center gap-1 rounded-lg px-0.5 py-2 transition ${
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
                                    className={`h-7 w-7 max-w-full object-contain transition ${
                                        selected ||
                                        hovered
                                            ? "scale-110"
                                            : ""
                                    }`}
                                />
                            )}

                            <span
                                className={`text-[9px] font-semibold ${
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

            <div className="flex min-w-0 items-center gap-3">

                {team.team_logo && (
                    <img
                        src={
                            team.team_logo
                        }
                        alt={
                            team.team_name
                        }
                        className="h-9 w-9 shrink-0 object-contain"
                    />
                )}

                <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                        Selected Team
                    </p>

                    <p className="break-words font-semibold text-white">
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
            2
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
        <div className="min-w-0 rounded-xl border border-slate-800 p-4">

            <p className="text-xs uppercase tracking-wide text-slate-500">
                {label}
            </p>

            <p className="mt-2 break-words text-xl font-semibold sm:text-2xl">
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
            className={`flex min-w-0 justify-between gap-4 ${
                strong
                    ? "font-semibold text-white"
                    : "text-slate-400"
            }`}
        >
            <span className="min-w-0 break-words">
                {label}
            </span>

            <span className="shrink-0">
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
    ).toFixed(2)}%`;
}