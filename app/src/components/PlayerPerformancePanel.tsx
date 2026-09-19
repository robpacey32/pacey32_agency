"use client";

import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Activity,
    BarChart3,
    Clock3,
    Target,
    TrendingUp,
    Trophy,
} from "lucide-react";

import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";


// ---------------------------------------------------------
// TYPES
// ---------------------------------------------------------

export type PlayerPerformanceSeason = {
    season:
        | number
        | string;

    seasonPart: string;

    playerId: number;

    team_code?:
        | string
        | null;

    player?:
        | string
        | null;

    games_played:
        | number
        | null;

    toi_minutes:
        | number
        | null;

    // SKATER

    goals?:
        | number
        | null;

    assists?:
        | number
        | null;

    points?:
        | number
        | null;

    avg_toi_minutes?:
        | number
        | null;

    goals_per_game?:
        | number
        | null;

    assists_per_game?:
        | number
        | null;

    points_per_game?:
        | number
        | null;

    goals_per_60?:
        | number
        | null;

    assists_per_60?:
        | number
        | null;

    points_per_60?:
        | number
        | null;

    team_points_rank?:
        | number
        | null;

    team_goals_rank?:
        | number
        | null;

    team_assists_rank?:
        | number
        | null;

    league_points_rank?:
        | number
        | null;

    league_goals_rank?:
        | number
        | null;

    league_assists_rank?:
        | number
        | null;

    team_games_played_rank?:
        | number
        | null;

    team_toi_rank?:
        | number
        | null;

    team_avg_toi_rank?:
        | number
        | null;

    team_goals_per_game_rank?:
        | number
        | null;

    team_assists_per_game_rank?:
        | number
        | null;

    team_points_per_game_rank?:
        | number
        | null;

    team_goals_per_60_rank?:
        | number
        | null;

    team_points_per_60_rank?:
        | number
        | null;

    // GOALIE

    shots_against?:
        | number
        | null;

    saves?:
        | number
        | null;

    goals_against?:
        | number
        | null;

    save_pct?:
        | number
        | null;

    gaa?:
        | number
        | null;
};


export type PlayerPerformanceData = {
    playerId: number;

    position?:
        | string
        | null;

    playerType?:
        | "skater"
        | "goalie";

    seasons:
        PlayerPerformanceSeason[];
};


type Props = {
    data: PlayerPerformanceData;
};


// ---------------------------------------------------------
// METRICS
// ---------------------------------------------------------

type SkaterMetricKey =
    | "points"
    | "goals"
    | "assists"
    | "points_per_game"
    | "points_per_60"
    | "avg_toi_minutes";


type GoalieMetricKey =
    | "save_pct"
    | "gaa"
    | "saves"
    | "shots_against"
    | "goals_against"
    | "toi_minutes";


type MetricKey =
    | SkaterMetricKey
    | GoalieMetricKey;


type MetricDefinition = {
    key: MetricKey;
    shortLabel: string;
    label: string;
};


const SKATER_METRICS:
    MetricDefinition[] = [
        {
            key: "points",
            shortLabel: "Points",
            label: "Points",
        },
        {
            key: "goals",
            shortLabel: "Goals",
            label: "Goals",
        },
        {
            key: "assists",
            shortLabel: "Assists",
            label: "Assists",
        },
        {
            key:
                "points_per_game",
            shortLabel: "P/GP",
            label:
                "Points per Game",
        },
        {
            key:
                "points_per_60",
            shortLabel: "P/60",
            label:
                "Points per 60",
        },
        {
            key:
                "avg_toi_minutes",
            shortLabel: "TOI",
            label:
                "Average TOI",
        },
    ];


const GOALIE_METRICS:
    MetricDefinition[] = [
        {
            key: "save_pct",
            shortLabel: "SV%",
            label:
                "Save Percentage",
        },
        {
            key: "gaa",
            shortLabel: "GAA",
            label:
                "Goals Against Average",
        },
        {
            key: "saves",
            shortLabel: "Saves",
            label: "Saves",
        },
        {
            key:
                "shots_against",
            shortLabel: "SA",
            label:
                "Shots Against",
        },
        {
            key:
                "goals_against",
            shortLabel: "GA",
            label:
                "Goals Against",
        },
        {
            key:
                "toi_minutes",
            shortLabel: "TOI",
            label:
                "Time on Ice",
        },
    ];


// ---------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------

export default function PlayerPerformancePanel({
    data,
}: Props) {
    const isGoalie =
        data.playerType ===
            "goalie" ||
        data.position
            ?.toUpperCase() ===
            "G";

    const metrics =
        isGoalie
            ? GOALIE_METRICS
            : SKATER_METRICS;

    const [
        selectedMetric,
        setSelectedMetric,
    ] =
        useState<MetricKey>(
            isGoalie
                ? "save_pct"
                : "points"
        );

    /*
    Reset the selected metric when
    switching between a skater and goalie.
    */
    useEffect(() => {
        setSelectedMetric(
            isGoalie
                ? "save_pct"
                : "points"
        );
    }, [
        isGoalie,
        data.playerId,
    ]);

    const seasons =
        useMemo(
            () =>
                [...data.seasons]
                    .filter(
                        season =>
                            season.seasonPart ===
                            "RegularSeason"
                    )
                    .sort(
                        (a, b) =>
                            Number(
                                a.season
                            ) -
                            Number(
                                b.season
                            )
                    ),
            [data.seasons]
        );

    const latest =
        seasons.length
            ? seasons[
                  seasons.length - 1
              ]
            : null;

    const metricDefinition =
        metrics.find(
            metric =>
                metric.key ===
                selectedMetric
        ) ?? metrics[0];

    const chartData =
        seasons.map(
            season => ({
                season:
                    formatSeason(
                        season.season
                    ),

                value:
                    getMetricValue(
                        season,
                        selectedMetric
                    ),
            })
        );

    if (!latest) {
        return (
            <div className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400 sm:p-6">
                No regular-season performance data available.
            </div>
        );
    }

    return (
        <div className="w-full min-w-0 max-w-full space-y-5">

            {/* CURRENT SEASON */}

            <section className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">

                <div className="flex min-w-0 items-center justify-between gap-4">

                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                            Current Season
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                            {formatSeason(
                                latest.season
                            )}

                            {!isGoalie &&
                            latest.team_code
                                ? ` · ${latest.team_code}`
                                : ""}
                        </div>
                    </div>

                </div>

                {isGoalie ? (
                    <GoalieHeadlineMetrics
                        season={
                            latest
                        }
                    />
                ) : (
                    <SkaterHeadlineMetrics
                        season={
                            latest
                        }
                    />
                )}

            </section>


            {/* SKATER RELATIVE PERFORMANCE */}

            {!isGoalie && (
                <section className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">

                    <div className="text-sm font-semibold text-white">
                        Relative Performance
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">

                        <RankMetric
                            icon={
                                <Trophy
                                    size={
                                        18
                                    }
                                />
                            }
                            label="Team Points Rank"
                            value={
                                latest.team_points_rank ??
                                null
                            }
                        />

                        <RankMetric
                            icon={
                                <BarChart3
                                    size={
                                        18
                                    }
                                />
                            }
                            label="League Points Rank"
                            value={
                                latest.league_points_rank ??
                                null
                            }
                        />

                        <RankMetric
                            icon={
                                <Clock3
                                    size={
                                        18
                                    }
                                />
                            }
                            label="Team TOI Rank"
                            value={
                                latest.team_avg_toi_rank ??
                                latest.team_toi_rank ??
                                null
                            }
                        />

                        <RankMetric
                            icon={
                                <Target
                                    size={
                                        18
                                    }
                                />
                            }
                            label="Team Goals Rank"
                            value={
                                latest.team_goals_rank ??
                                null
                            }
                        />

                        <RankMetric
                            icon={
                                <Activity
                                    size={
                                        18
                                    }
                                />
                            }
                            label="Team P/GP Rank"
                            value={
                                latest.team_points_per_game_rank ??
                                null
                            }
                        />

                        <RankMetric
                            icon={
                                <TrendingUp
                                    size={
                                        18
                                    }
                                />
                            }
                            label="Team P/60 Rank"
                            value={
                                latest.team_points_per_60_rank ??
                                null
                            }
                        />

                    </div>

                </section>
            )}


            {/* TRAJECTORY */}

            <section className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">

                <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-5">

                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                            Career Trajectory
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                            Regular-season performance by season
                        </div>
                    </div>

                    <MetricSelector
                        value={
                            selectedMetric
                        }
                        metrics={
                            metrics
                        }
                        onChange={
                            setSelectedMetric
                        }
                    />

                </div>


                {/* CHART */}

                <div className="mt-6 h-[250px] w-full min-w-0 overflow-hidden sm:h-[280px] lg:h-[300px]">

                    <ResponsiveContainer
                        width="100%"
                        height="100%"
                    >
                        <LineChart
                            data={
                                chartData
                            }
                            margin={{
                                top: 10,
                                right: 5,
                                bottom: 0,
                                left: -20,
                            }}
                        >

                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#1e293b"
                                vertical={
                                    false
                                }
                            />

                            <XAxis
                                dataKey="season"
                                stroke="#64748b"
                                tick={{
                                    fill:
                                        "#94a3b8",
                                    fontSize:
                                        10,
                                }}
                                tickLine={
                                    false
                                }
                                axisLine={{
                                    stroke:
                                        "#334155",
                                }}
                                minTickGap={
                                    16
                                }
                            />

                            <YAxis
                                stroke="#64748b"
                                tick={{
                                    fill:
                                        "#94a3b8",
                                    fontSize:
                                        10,
                                }}
                                tickLine={
                                    false
                                }
                                axisLine={
                                    false
                                }
                                width={42}
                                tickFormatter={
                                    value =>
                                        formatAxisValue(
                                            selectedMetric,
                                            Number(
                                                value
                                            )
                                        )
                                }
                            />

                            <Tooltip
                                content={
                                    <PerformanceTooltip
                                        metricLabel={
                                            metricDefinition.label
                                        }
                                        metric={
                                            selectedMetric
                                        }
                                    />
                                }
                            />

                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke="#60a5fa"
                                strokeWidth={
                                    3
                                }
                                connectNulls={
                                    false
                                }
                                dot={{
                                    r: 4,
                                    fill:
                                        "#60a5fa",
                                    stroke:
                                        "#0f172a",
                                    strokeWidth:
                                        2,
                                }}
                                activeDot={{
                                    r: 6,
                                }}
                            />

                        </LineChart>
                    </ResponsiveContainer>

                </div>


                {/* SEASON HISTORY */}

                <div className="mt-5 min-w-0 border-t border-slate-800 pt-5">

                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Season History
                    </div>

                    <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">

                        {[...seasons]
                            .reverse()
                            .map(
                                season =>
                                    isGoalie ? (
                                        <GoalieSeasonRow
                                            key={`${season.season}-${season.playerId}`}
                                            season={
                                                season
                                            }
                                        />
                                    ) : (
                                        <SkaterSeasonRow
                                            key={`${season.season}-${season.team_code}`}
                                            season={
                                                season
                                            }
                                        />
                                    )
                            )}

                    </div>

                </div>

            </section>

        </div>
    );
}


// ---------------------------------------------------------
// CURRENT SEASON
// ---------------------------------------------------------

function SkaterHeadlineMetrics({
    season,
}: {
    season:
        PlayerPerformanceSeason;
}) {
    return (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

            <HeadlineMetric
                label="GP"
                value={
                    season.games_played ??
                    0
                }
            />

            <HeadlineMetric
                label="G"
                value={
                    season.goals ??
                    0
                }
            />

            <HeadlineMetric
                label="A"
                value={
                    season.assists ??
                    0
                }
            />

            <HeadlineMetric
                label="P"
                value={
                    season.points ??
                    0
                }
                highlight
            />

            <HeadlineMetric
                label="P/GP"
                value={formatDecimal(
                    season.points_per_game,
                    2
                )}
            />

            <HeadlineMetric
                label="P/60"
                value={formatDecimal(
                    season.points_per_60,
                    2
                )}
            />

        </div>
    );
}


function GoalieHeadlineMetrics({
    season,
}: {
    season:
        PlayerPerformanceSeason;
}) {
    return (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

            <HeadlineMetric
                label="GP"
                value={
                    season.games_played ??
                    0
                }
            />

            <HeadlineMetric
                label="SV%"
                value={formatSavePct(
                    season.save_pct
                )}
                highlight
            />

            <HeadlineMetric
                label="GAA"
                value={formatDecimal(
                    season.gaa,
                    2
                )}
            />

            <HeadlineMetric
                label="Saves"
                value={
                    season.saves ??
                    0
                }
            />

            <HeadlineMetric
                label="SA"
                value={
                    season.shots_against ??
                    0
                }
            />

            <HeadlineMetric
                label="TOI"
                value={formatMinutes(
                    season.toi_minutes
                )}
            />

        </div>
    );
}


// ---------------------------------------------------------
// HEADLINE / RANK
// ---------------------------------------------------------

function HeadlineMetric({
    label,
    value,
    highlight = false,
}: {
    label: string;

    value:
        | string
        | number;

    highlight?: boolean;
}) {
    return (
        <div
            className={
                highlight
                    ? "min-w-0 rounded-xl border border-slate-600 bg-slate-800/80 p-3 sm:p-4"
                    : "min-w-0 rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:p-4"
            }
        >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </div>

            <div
                className={
                    highlight
                        ? "mt-2 break-words text-xl font-bold text-white sm:text-2xl"
                        : "mt-2 break-words text-lg font-semibold text-white sm:text-xl"
                }
            >
                {value}
            </div>
        </div>
    );
}


function RankMetric({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;

    label: string;

    value:
        | number
        | null;
}) {
    return (
        <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:p-4">

            <div className="flex min-w-0 items-center gap-2 text-slate-500">

                <div className="shrink-0">
                    {icon}
                </div>

                <div className="min-w-0 text-[10px] font-semibold uppercase tracking-wide">
                    {label}
                </div>

            </div>

            <div className="mt-3 text-xl font-bold text-white">
                {value != null
                    ? `#${value}`
                    : "—"}
            </div>

        </div>
    );
}


// ---------------------------------------------------------
// METRIC SELECTOR
// ---------------------------------------------------------

function MetricSelector({
    value,
    metrics,
    onChange,
}: {
    value: MetricKey;

    metrics:
        MetricDefinition[];

    onChange: (
        value: MetricKey
    ) => void;
}) {
    return (
        <div className="grid w-full min-w-0 grid-cols-2 gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1 min-[420px]:grid-cols-3 sm:flex sm:w-auto sm:flex-wrap">

            {metrics.map(
                metric => (
                    <button
                        key={
                            metric.key
                        }
                        type="button"
                        onClick={() =>
                            onChange(
                                metric.key
                            )
                        }
                        className={`min-w-0 rounded-md px-2 py-2 text-xs font-semibold transition sm:px-3 sm:py-1.5 ${
                            value ===
                            metric.key
                                ? "bg-slate-700 text-white"
                                : "text-slate-500 hover:text-slate-300"
                        }`}
                    >
                        {
                            metric.shortLabel
                        }
                    </button>
                )
            )}

        </div>
    );
}


// ---------------------------------------------------------
// SEASON ROWS
// ---------------------------------------------------------

function SkaterSeasonRow({
    season,
}: {
    season:
        PlayerPerformanceSeason;
}) {
    return (
        <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3 sm:px-4">

            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">

                <div className="min-w-0">

                    <div className="text-sm font-semibold text-white">
                        {formatSeason(
                            season.season
                        )}
                    </div>

                    <div className="mt-0.5 text-xs text-slate-500">
                        {season.team_code ??
                            "—"}
                        {" · "}
                        {season.games_played ??
                            0}{" "}
                        GP
                    </div>

                </div>

                <div className="grid min-w-0 grid-cols-4 gap-2 sm:flex sm:items-center sm:gap-5 sm:text-right">

                    <SeasonStat
                        label="P"
                        value={
                            season.points ??
                            0
                        }
                    />

                    <SeasonStat
                        label="P/GP"
                        value={formatDecimal(
                            season.points_per_game,
                            2
                        )}
                    />

                    <SeasonStat
                        label="P/60"
                        value={formatDecimal(
                            season.points_per_60,
                            2
                        )}
                    />

                    <SeasonStat
                        label="TOI"
                        value={formatDecimal(
                            season.avg_toi_minutes,
                            1
                        )}
                    />

                </div>

            </div>

        </div>
    );
}


function GoalieSeasonRow({
    season,
}: {
    season:
        PlayerPerformanceSeason;
}) {
    return (
        <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3 sm:px-4">

            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">

                <div className="min-w-0">

                    <div className="text-sm font-semibold text-white">
                        {formatSeason(
                            season.season
                        )}
                    </div>

                    <div className="mt-0.5 text-xs text-slate-500">
                        {season.games_played ??
                            0}{" "}
                        GP
                    </div>

                </div>

                <div className="grid min-w-0 grid-cols-4 gap-2 sm:flex sm:items-center sm:gap-5 sm:text-right">

                    <SeasonStat
                        label="SV%"
                        value={formatSavePct(
                            season.save_pct
                        )}
                    />

                    <SeasonStat
                        label="GAA"
                        value={formatDecimal(
                            season.gaa,
                            2
                        )}
                    />

                    <SeasonStat
                        label="Saves"
                        value={
                            season.saves ??
                            0
                        }
                    />

                    <SeasonStat
                        label="SA"
                        value={
                            season.shots_against ??
                            0
                        }
                    />

                </div>

            </div>

        </div>
    );
}


function SeasonStat({
    label,
    value,
}: {
    label: string;

    value:
        | number
        | string;
}) {
    return (
        <div className="min-w-0 sm:min-w-12">

            <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                {label}
            </div>

            <div className="mt-1 break-words text-sm font-semibold text-slate-200">
                {value}
            </div>

        </div>
    );
}


// ---------------------------------------------------------
// TOOLTIP
// ---------------------------------------------------------

function PerformanceTooltip({
    active,
    payload,
    metricLabel,
    metric,
}: {
    active?: boolean;

    payload?: Array<{
        value:
            | number
            | string;

        payload?: {
            season?: string;
        };
    }>;

    metricLabel: string;

    metric: MetricKey;
}) {
    if (
        !active ||
        !payload?.length
    ) {
        return null;
    }

    const value =
        payload[0].value;

    const season =
        payload[0].payload
            ?.season;

    return (
        <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 shadow-xl">

            {season && (
                <div className="text-xs font-semibold text-white">
                    {season}
                </div>
            )}

            <div className="mt-1 text-xs text-slate-400">
                {metricLabel}:{" "}
                {formatMetricValue(
                    metric,
                    Number(value)
                )}
            </div>

        </div>
    );
}


// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function getMetricValue(
    season:
        PlayerPerformanceSeason,
    metric: MetricKey
): number | null {
    const value =
        season[metric];

    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    const numeric =
        Number(value);

    return Number.isFinite(
        numeric
    )
        ? numeric
        : null;
}


function formatMetricValue(
    metric: MetricKey,
    value: number
) {
    if (
        metric ===
        "save_pct"
    ) {
        return formatSavePct(
            value
        );
    }

    if (
        metric === "gaa" ||
        metric ===
            "points_per_game" ||
        metric ===
            "points_per_60"
    ) {
        return value.toFixed(
            2
        );
    }

    if (
        metric ===
            "avg_toi_minutes" ||
        metric ===
            "toi_minutes"
    ) {
        return `${value.toFixed(
            1
        )} min`;
    }

    return Math.round(
        value
    ).toLocaleString();
}


function formatAxisValue(
    metric: MetricKey,
    value: number
) {
    if (
        metric ===
        "save_pct"
    ) {
        return value.toFixed(
            3
        );
    }

    if (
        metric === "gaa" ||
        metric ===
            "points_per_game" ||
        metric ===
            "points_per_60"
    ) {
        return value.toFixed(
            2
        );
    }

    return Math.round(
        value
    ).toString();
}


function formatSavePct(
    value:
        | number
        | null
        | undefined
) {
    if (
        value === null ||
        value === undefined
    ) {
        return "—";
    }

    return Number(
        value
    ).toFixed(
        3
    );
}


function formatMinutes(
    value:
        | number
        | null
        | undefined
) {
    if (
        value === null ||
        value === undefined
    ) {
        return "—";
    }

    return Number(
        value
    ).toLocaleString(
        undefined,
        {
            maximumFractionDigits:
                0,
        }
    );
}


function formatDecimal(
    value:
        | number
        | null
        | undefined,
    places: number
) {
    if (
        value === null ||
        value === undefined
    ) {
        return "0";
    }

    return Number(
        value
    ).toFixed(
        places
    );
}


function formatSeason(
    value:
        | number
        | string
) {
    const season =
        String(value);

    if (
        season.length !== 8
    ) {
        return season;
    }

    return `${season.slice(
        0,
        4
    )}/${season.slice(6)}`;
}