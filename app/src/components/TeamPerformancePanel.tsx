"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { Trophy } from "lucide-react";

export type TeamPerformanceSeason = {
    seasonId: number;
    season_label: string;

    team_code: string;
    team_name: string;

    games_played: number;
    wins: number;
    losses: number;
    ot_losses: number;
    points: number;

    point_pctg: number;
    point_pctg_change: number | null;

    goals_for: number;
    goals_against: number;
    goal_differential: number;
    goal_differential_change: number | null;

    nhl_avg_goals_for: number | null;
    nhl_avg_goals_against: number | null;

    division_rank: number;
    conference_rank: number;
    league_rank: number;
    league_rank_change: number | null;

    home_point_pctg: number;
    road_point_pctg: number;

    l10_games_played: number;
    l10_wins: number;
    l10_losses: number;
    l10_ot_losses: number;
    l10_point_pctg: number;
    l10_goal_differential: number;

    streak_code: string | null;
    streak_count: number | null;

    power_play_pct: number | null;
    penalty_kill_pct: number | null;

    nhl_avg_power_play_pct: number | null;
    nhl_avg_penalty_kill_pct: number | null;

    playoff_result: string | null;
};

export type TeamPerformanceData = {
    team: string;
    seasons: TeamPerformanceSeason[];
};

type Props = {
    data: TeamPerformanceData;
};

function pct(value: number | null | undefined) {
    if (value == null) return "—";
    return `${(value * 100).toFixed(1)}%`;
}

function signed(value: number | null | undefined) {
    if (value == null) return "—";
    return value > 0 ? `+${value}` : String(value);
}

function ordinal(value: number | null | undefined) {
    if (value == null) return "—";

    const mod10 = value % 10;
    const mod100 = value % 100;

    if (mod10 === 1 && mod100 !== 11) return `${value}st`;
    if (mod10 === 2 && mod100 !== 12) return `${value}nd`;
    if (mod10 === 3 && mod100 !== 13) return `${value}rd`;

    return `${value}th`;
}

function changeColour(value: number | null | undefined) {
    if (value == null || value === 0) {
        return "text-slate-400";
    }

    return value > 0
        ? "text-green-400"
        : "text-red-400";
}

function playoffColour(result: string | null) {
    switch (result) {
        case "Missed Playoffs":
            return "text-slate-500";

        case "First Round":
            return "text-emerald-200";

        case "Second Round":
            return "text-emerald-300";

        case "Conference Final":
            return "text-emerald-400";

        case "Stanley Cup Final":
            return "text-green-400";

        case "Stanley Cup Winner":
            return "text-yellow-400";

        default:
            return "text-slate-400";
    }
}

function Panel({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                {title}
            </h3>

            {children}
        </div>
    );
}

function Stat({
    label,
    value,
    detail,
    valueClassName = "text-white",
}: {
    label: string;
    value: string;
    detail?: React.ReactNode;
    valueClassName?: string;
}) {
    return (
        <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
            </div>

            <div className={`mt-2 text-2xl font-bold ${valueClassName}`}>
                {value}
            </div>

            {detail && (
                <div className="mt-1 text-xs text-slate-400">
                    {detail}
                </div>
            )}
        </div>
    );
}

const tooltipStyle = {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
};

export default function TeamPerformancePanel({
    data,
}: Props) {
    if (!data?.seasons?.length) {
        return (
            <div className="text-sm text-slate-400">
                No team performance data available.
            </div>
        );
    }

    const seasons = [...data.seasons].sort(
        (a, b) => a.seasonId - b.seasonId
    );

    const latest = data.seasons[0];

    const pointChange =
        latest.point_pctg_change != null
            ? latest.point_pctg_change * 100
            : null;

    const chartData = seasons.map((season) => ({
        season: season.season_label,

        pointPct: season.point_pctg * 100,

        goalsFor: season.goals_for,
        goalsAgainst: season.goals_against,
        nhlAvgGoals: season.nhl_avg_goals_for,

        leagueRank: season.league_rank,
        divisionRank: season.division_rank,

        powerPlay:
            season.power_play_pct != null
                ? season.power_play_pct * 100
                : null,

        penaltyKill:
            season.penalty_kill_pct != null
                ? season.penalty_kill_pct * 100
                : null,

        avgPowerPlay:
            season.nhl_avg_power_play_pct != null
                ? season.nhl_avg_power_play_pct * 100
                : null,

        avgPenaltyKill:
            season.nhl_avg_penalty_kill_pct != null
                ? season.nhl_avg_penalty_kill_pct * 100
                : null,

        homePct: season.home_point_pctg * 100,
        roadPct: season.road_point_pctg * 100,
    }));

    return (
        <div className="space-y-5">

            <div className="grid min-w-[950px] grid-cols-5 gap-4 overflow-x-auto">
                <Stat
                    label="Points %"
                    value={pct(latest.point_pctg)}
                    detail={
                        pointChange != null ? (
                            <span className={changeColour(pointChange)}>
                                {pointChange > 0 ? "+" : ""}
                                {pointChange.toFixed(1)} pts vs last season
                            </span>
                        ) : (
                            "Current season"
                        )
                    }
                />

                <Stat
                    label="League Rank"
                    value={ordinal(latest.league_rank)}
                    detail={`${ordinal(latest.division_rank)} in division`}
                />

                <Stat
                    label="Goal Differential"
                    value={signed(latest.goal_differential)}
                    valueClassName={
                        latest.goal_differential > 0
                            ? "text-green-400"
                            : latest.goal_differential < 0
                              ? "text-red-400"
                              : "text-white"
                    }
                    detail={`${latest.goals_for} GF · ${latest.goals_against} GA`}
                />

                <Stat
                    label="Last 10"
                    value={`${latest.l10_wins}-${latest.l10_losses}-${latest.l10_ot_losses}`}
                    detail={`${pct(latest.l10_point_pctg)} points % · GD ${signed(latest.l10_goal_differential)}`}
                />

                <Stat
                    label="Playoffs"
                    value={latest.playoff_result ?? "—"}
                    valueClassName={playoffColour(
                        latest.playoff_result
                    )}
                    detail={latest.season_label}
                />
            </div>

            <div className="grid min-w-[1000px] grid-cols-3 gap-5 overflow-x-auto">

                <Panel title="Points % Trend">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#1e293b"
                                />

                                <XAxis
                                    dataKey="season"
                                    tick={{
                                        fill: "#94a3b8",
                                        fontSize: 12,
                                    }}
                                />

                                <YAxis
                                    domain={[
                                        "dataMin - 5",
                                        "dataMax + 5",
                                    ]}
                                    tickFormatter={(value) =>
                                        `${value.toFixed(0)}%`
                                    }
                                    tick={{
                                        fill: "#94a3b8",
                                        fontSize: 12,
                                    }}
                                />

                                <Tooltip
                                    formatter={(value) =>
                                        `${Number(value).toFixed(1)}%`
                                    }
                                    contentStyle={tooltipStyle}
                                />

                                <Line
                                    type="monotone"
                                    dataKey="pointPct"
                                    name="Points %"
                                    stroke="#60a5fa"
                                    strokeWidth={3}
                                    dot={{ r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>

                <Panel title="Goals For vs Against">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#1e293b"
                                />

                                <XAxis
                                    dataKey="season"
                                    tick={{
                                        fill: "#94a3b8",
                                        fontSize: 12,
                                    }}
                                />

                                <YAxis
                                    tick={{
                                        fill: "#94a3b8",
                                        fontSize: 12,
                                    }}
                                />

                                <Tooltip contentStyle={tooltipStyle} />
                                <Legend />

                                <Line
                                    type="monotone"
                                    dataKey="goalsFor"
                                    name="Goals For"
                                    stroke="#4ade80"
                                    strokeWidth={2.5}
                                />

                                <Line
                                    type="monotone"
                                    dataKey="goalsAgainst"
                                    name="Goals Against"
                                    stroke="#f87171"
                                    strokeWidth={2.5}
                                />

                                <Line
                                    type="monotone"
                                    dataKey="nhlAvgGoals"
                                    name="NHL Avg"
                                    stroke="#94a3b8"
                                    strokeWidth={1.5}
                                    strokeDasharray="4 5"
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>

                <Panel title="League & Division Rank">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#1e293b"
                                />

                                <XAxis
                                    dataKey="season"
                                    tick={{
                                        fill: "#94a3b8",
                                        fontSize: 12,
                                    }}
                                />

                                <YAxis
                                    yAxisId="league"
                                    reversed
                                    domain={[1, 32]}
                                    tick={{
                                        fill: "#94a3b8",
                                        fontSize: 12,
                                    }}
                                    label={{
                                        value: "NHL",
                                        angle: -90,
                                        position: "insideLeft",
                                        fill: "#64748b",
                                    }}
                                />

                                <YAxis
                                    yAxisId="division"
                                    orientation="right"
                                    reversed
                                    domain={[1, 8]}
                                    allowDecimals={false}
                                    tick={{
                                        fill: "#94a3b8",
                                        fontSize: 12,
                                    }}
                                    label={{
                                        value: "Division",
                                        angle: 90,
                                        position: "insideRight",
                                        fill: "#64748b",
                                    }}
                                />

                                <Tooltip
                                    formatter={(value, name) => [
                                        ordinal(Number(value)),
                                        name,
                                    ]}
                                    contentStyle={tooltipStyle}
                                />

                                <Legend />

                                <Line
                                    yAxisId="league"
                                    type="monotone"
                                    dataKey="leagueRank"
                                    name="NHL Rank"
                                    stroke="#c084fc"
                                    strokeWidth={3}
                                    dot={{ r: 4 }}
                                />

                                <Line
                                    yAxisId="division"
                                    type="monotone"
                                    dataKey="divisionRank"
                                    name="Division Rank"
                                    stroke="#38bdf8"
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>
            </div>

            <div className="grid min-w-[1000px] grid-cols-3 gap-5 overflow-x-auto">

                <Panel title="Special Teams">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#1e293b"
                                />

                                <XAxis
                                    dataKey="season"
                                    tick={{
                                        fill: "#94a3b8",
                                        fontSize: 12,
                                    }}
                                />

                                <YAxis
                                    tickFormatter={(value) =>
                                        `${value}%`
                                    }
                                    tick={{
                                        fill: "#94a3b8",
                                        fontSize: 12,
                                    }}
                                />

                                <Tooltip
                                    formatter={(value) =>
                                        `${Number(value).toFixed(1)}%`
                                    }
                                    contentStyle={tooltipStyle}
                                />

                                <Legend />

                                <Line
                                    type="monotone"
                                    dataKey="powerPlay"
                                    name="Power Play"
                                    stroke="#60a5fa"
                                    strokeWidth={2.5}
                                />

                                <Line
                                    type="monotone"
                                    dataKey="avgPowerPlay"
                                    name="NHL Avg PP"
                                    stroke="#60a5fa"
                                    strokeWidth={1}
                                    strokeDasharray="3 5"
                                    dot={false}
                                />

                                <Line
                                    type="monotone"
                                    dataKey="penaltyKill"
                                    name="Penalty Kill"
                                    stroke="#f59e0b"
                                    strokeWidth={2.5}
                                />

                                <Line
                                    type="monotone"
                                    dataKey="avgPenaltyKill"
                                    name="NHL Avg PK"
                                    stroke="#f59e0b"
                                    strokeWidth={1}
                                    strokeDasharray="3 5"
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>

                <Panel title="Home vs Away Points %">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#1e293b"
                                />

                                <XAxis
                                    dataKey="season"
                                    tick={{
                                        fill: "#94a3b8",
                                        fontSize: 12,
                                    }}
                                />

                                <YAxis
                                    tickFormatter={(value) =>
                                        `${value}%`
                                    }
                                    tick={{
                                        fill: "#94a3b8",
                                        fontSize: 12,
                                    }}
                                />

                                <Tooltip
                                    formatter={(value) =>
                                        `${Number(value).toFixed(1)}%`
                                    }
                                    contentStyle={tooltipStyle}
                                />

                                <Legend />

                                <Line
                                    type="monotone"
                                    dataKey="homePct"
                                    name="Home"
                                    stroke="#4ade80"
                                    strokeWidth={2}
                                />

                                <Line
                                    type="monotone"
                                    dataKey="roadPct"
                                    name="Away"
                                    stroke="#38bdf8"
                                    strokeWidth={2}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>

                <Panel title="Playoff Results">
                    <div className="space-y-3">
                        {[...seasons]
                            .reverse()
                            .map((season) => {
                                const winner =
                                    season.playoff_result ===
                                    "Stanley Cup Winner";

                                return (
                                    <div
                                        key={season.seasonId}
                                        className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3"
                                    >
                                        <span className="text-sm font-medium text-slate-400">
                                            {season.season_label}
                                        </span>

                                        <span
                                            className={`flex items-center gap-2 text-sm font-semibold ${playoffColour(
                                                season.playoff_result
                                            )}`}
                                        >
                                            {winner && (
                                                <Trophy
                                                    size={16}
                                                    strokeWidth={2}
                                                />
                                            )}

                                            {season.playoff_result ?? "—"}
                                        </span>
                                    </div>
                                );
                            })}
                    </div>
                </Panel>
            </div>
        </div>
    );
}