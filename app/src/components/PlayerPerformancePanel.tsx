"use client";

import {
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


export type PlayerPerformanceSeason = {
    season:
        | number
        | string;

    seasonPart: string;

    playerId: number;
    team_code:
        | string
        | null;

    games_played:
        | number
        | null;

    goals:
        | number
        | null;

    assists:
        | number
        | null;

    points:
        | number
        | null;

    toi_minutes:
        | number
        | null;

    avg_toi_minutes:
        | number
        | null;

    goals_per_game:
        | number
        | null;

    assists_per_game:
        | number
        | null;

    points_per_game:
        | number
        | null;

    goals_per_60:
        | number
        | null;

    assists_per_60:
        | number
        | null;

    points_per_60:
        | number
        | null;

    team_points_rank:
        | number
        | null;

    team_goals_rank:
        | number
        | null;

    team_assists_rank:
        | number
        | null;

    league_points_rank:
        | number
        | null;

    league_goals_rank:
        | number
        | null;

    league_assists_rank:
        | number
        | null;

    team_games_played_rank:
        | number
        | null;

    team_toi_rank:
        | number
        | null;

    team_avg_toi_rank:
        | number
        | null;

    team_goals_per_game_rank:
        | number
        | null;

    team_assists_per_game_rank:
        | number
        | null;

    team_points_per_game_rank:
        | number
        | null;

    team_goals_per_60_rank:
        | number
        | null;

    team_points_per_60_rank:
        | number
        | null;
};


export type PlayerPerformanceData = {
    playerId: number;

    seasons:
        PlayerPerformanceSeason[];
};


type Props = {
    data: PlayerPerformanceData;
};


type MetricKey =
    | "points"
    | "goals"
    | "assists"
    | "points_per_game"
    | "points_per_60"
    | "avg_toi_minutes";


type MetricDefinition = {
    key: MetricKey;
    shortLabel: string;
    label: string;
};


const METRICS:
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


export default function PlayerPerformancePanel({
    data,
}: Props) {
    const [
        selectedMetric,
        setSelectedMetric,
    ] =
        useState<MetricKey>(
            "points"
        );

    const seasons =
        useMemo(
            () =>
                [...data.seasons]
                    .filter(
                        (season) =>
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
        METRICS.find(
            (metric) =>
                metric.key ===
                selectedMetric
        ) ?? METRICS[0];

    const chartData =
        seasons.map(
            (season) => ({
                season:
                    formatSeason(
                        season.season
                    ),
                value:
                    season[
                        selectedMetric
                    ] ?? 0,
            })
        );

    if (!latest) {
        return (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
                No regular-season performance data available.
            </div>
        );
    }

    return (
        <div className="space-y-5">

            {/* CURRENT SEASON */}

            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">

                <div className="flex items-center justify-between gap-4">

                    <div>
                        <div className="text-sm font-semibold text-white">
                            Current Season
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                            {formatSeason(
                                latest.season
                            )}

                            {latest.team_code
                                ? ` · ${latest.team_code}`
                                : ""}
                        </div>
                    </div>

                </div>

                <div className="mt-5 grid grid-cols-6 gap-3">

                    <HeadlineMetric
                        label="GP"
                        value={
                            latest.games_played ??
                            0
                        }
                    />

                    <HeadlineMetric
                        label="G"
                        value={
                            latest.goals ??
                            0
                        }
                    />

                    <HeadlineMetric
                        label="A"
                        value={
                            latest.assists ??
                            0
                        }
                    />

                    <HeadlineMetric
                        label="P"
                        value={
                            latest.points ??
                            0
                        }
                        highlight
                    />

                    <HeadlineMetric
                        label="P/GP"
                        value={formatDecimal(
                            latest.points_per_game,
                            2
                        )}
                    />

                    <HeadlineMetric
                        label="P/60"
                        value={formatDecimal(
                            latest.points_per_60,
                            2
                        )}
                    />

                </div>

            </section>


            {/* RELATIVE PERFORMANCE */}

            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">

                <div className="text-sm font-semibold text-white">
                    Relative Performance
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">

                    <RankMetric
                        icon={
                            <Trophy
                                size={18}
                            />
                        }
                        label="Team Points Rank"
                        value={
                            latest.team_points_rank
                        }
                    />

                    <RankMetric
                        icon={
                            <BarChart3
                                size={18}
                            />
                        }
                        label="League Points Rank"
                        value={
                            latest.league_points_rank
                        }
                    />

                    <RankMetric
                        icon={
                            <Clock3
                                size={18}
                            />
                        }
                        label="Team TOI Rank"
                        value={
                            latest.team_avg_toi_rank ??
                            latest.team_toi_rank
                        }
                    />

                    <RankMetric
                        icon={
                            <Target
                                size={18}
                            />
                        }
                        label="Team Goals Rank"
                        value={
                            latest.team_goals_rank
                        }
                    />

                    <RankMetric
                        icon={
                            <Activity
                                size={18}
                            />
                        }
                        label="Team P/GP Rank"
                        value={
                            latest.team_points_per_game_rank
                        }
                    />

                    <RankMetric
                        icon={
                            <TrendingUp
                                size={18}
                            />
                        }
                        label="Team P/60 Rank"
                        value={
                            latest.team_points_per_60_rank
                        }
                    />

                </div>

            </section>


            {/* TRAJECTORY */}

            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">

                <div className="flex items-start justify-between gap-5">

                    <div>
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
                        onChange={
                            setSelectedMetric
                        }
                    />

                </div>


                {/* CHART */}

                <div className="mt-6 h-[300px] w-full">

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
                                right: 10,
                                bottom: 0,
                                left: -10,
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
                                        11,
                                }}
                                tickLine={
                                    false
                                }
                                axisLine={{
                                    stroke:
                                        "#334155",
                                }}
                            />

                            <YAxis
                                stroke="#64748b"
                                tick={{
                                    fill:
                                        "#94a3b8",
                                    fontSize:
                                        11,
                                }}
                                tickLine={
                                    false
                                }
                                axisLine={
                                    false
                                }
                                width={48}
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

                <div className="mt-5 border-t border-slate-800 pt-5">

                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Season History
                    </div>

                    <div className="grid grid-cols-2 gap-2">

                        {[...seasons]
                            .reverse()
                            .map(
                                (
                                    season
                                ) => (
                                    <SeasonRow
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
                    ? "rounded-xl border border-slate-600 bg-slate-800/80 p-4"
                    : "rounded-xl border border-slate-800 bg-slate-950/40 p-4"
            }
        >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </div>

            <div
                className={
                    highlight
                        ? "mt-2 text-2xl font-bold text-white"
                        : "mt-2 text-xl font-semibold text-white"
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
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">

            <div className="flex items-center gap-2 text-slate-500">

                {icon}

                <div className="text-[10px] font-semibold uppercase tracking-wide">
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


function MetricSelector({
    value,
    onChange,
}: {
    value: MetricKey;

    onChange: (
        value: MetricKey
    ) => void;
}) {
    return (
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">

            {METRICS.map(
                (metric) => (
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
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
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


function SeasonRow({
    season,
}: {
    season:
        PlayerPerformanceSeason;
}) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3">

            <div>
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

            <div className="flex items-center gap-5 text-right">

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
        <div className="min-w-12">

            <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                {label}
            </div>

            <div className="mt-1 text-sm font-semibold text-slate-200">
                {value}
            </div>

        </div>
    );
}


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


function formatMetricValue(
    metric: MetricKey,
    value: number
) {
    if (
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
        "avg_toi_minutes"
    ) {
        return `${value.toFixed(
            1
        )} min`;
    }

    return Math.round(
        value
    ).toString();
}


function formatDecimal(
    value:
        | number
        | null,
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