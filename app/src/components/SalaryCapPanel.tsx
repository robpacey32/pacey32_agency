"use client";

import { useMemo, useState } from "react";

import {
    ArrowDown,
    ArrowUp,
    BarChart3,
    CalendarDays,
    CircleDollarSign,
    Coins,
    FileText,
    Goal,
    Landmark,
    Shirt,
    Users,
    WalletCards,
} from "lucide-react";

export type Summary = {
    projected_cap_hit: number;
    projected_cap_space: number;
    current_cap_space: number;
    deadline_cap_space: number;
    dead_cap_space: number;
    cap_utilisation_pct: number;
    cap_space_rank: number;
    active_roster: number;
    contracts: number;
    average_age: number;

    forward_cap: number;
    defense_cap: number;
    goalie_cap: number;

    forward_cap_pct: number;
    defense_cap_pct: number;
    goalie_cap_pct: number;

    nhl_avg_projected_cap_space: number;
    nhl_avg_forward_cap: number;
    nhl_avg_defense_cap: number;
    nhl_avg_goalie_cap: number;
};

export type FutureRow = {
    year: number;
    season: string;
    forward_cap: number;
    defense_cap: number;
    goalie_cap: number;
    roster_cap: number;
    non_roster_cap: number;
    roster_players: number;
    nhl_avg_roster_cap: number;
};

export type Contract = {
    player: string;
    playerId?: number | null;
    headshot_url?: string | null;
    position: string | null;
    cap_hit: number | null;
    expiry_status: string | null;
    expiry_year: number | null;
    is_elc: boolean | null;
    term?: number | null;
    total_value?: number | null;
};

export type Expiry = {
    expiry_year: number;
    expiring_players: number;
    expiring_cap_hit: number;
    ufa_players: number;
    ufa_cap_hit: number;
    rfa_players: number;
    rfa_cap_hit: number;
    elc_players: number;
    elc_cap_hit: number;
};

export type PositionCounts = {
    forward_players: number;
    defense_players: number;
    goalie_players: number;

    nhl_avg_forward_players: number;
    nhl_avg_defense_players: number;
    nhl_avg_goalie_players: number;
};

export type SalaryCapData = {
    team: string;
    summary: Summary | null;
    future: FutureRow[];
    contracts: Contract[];
    expiries: Expiry[];
    positionCounts?: PositionCounts;
};

const F_COLOUR = "bg-blue-500";
const D_COLOUR = "bg-violet-500";
const G_COLOUR = "bg-cyan-500";

const F_TEXT = "text-blue-400";
const D_TEXT = "text-violet-400";
const G_TEXT = "text-cyan-400";

type SortField = "cap_hit" | "term" | "total_value";
type SortDirection = "asc" | "desc";

function money(value?: number | null) {
    if (value == null) return "—";

    const absolute = Math.abs(Number(value));

    if (absolute >= 1_000_000) {
        return `$${(absolute / 1_000_000).toFixed(1)}m`;
    }

    if (absolute >= 1_000) {
        return `$${Math.round(absolute / 1_000)}k`;
    }

    return `$${absolute.toLocaleString()}`;
}

function signedMoney(value?: number | null) {
    if (value == null) return "—";

    const numericValue = Number(value);

    if (numericValue === 0) return money(0);

    return `${numericValue > 0 ? "+" : "-"}${money(numericValue)}`;
}

function capSpaceMoney(value?: number | null) {
    if (value == null) return "—";

    const numericValue = Number(value);

    return numericValue < 0
        ? `-${money(numericValue)}`
        : money(numericValue);
}

function rankColour(rank: number) {
    const pct = (rank - 1) / 31;

    if (pct <= 0.2) return "text-emerald-400";
    if (pct <= 0.4) return "text-lime-400";
    if (pct <= 0.6) return "text-yellow-400";
    if (pct <= 0.8) return "text-orange-400";

    return "text-rose-400";
}

function rankBg(rank: number) {
    const pct = (rank - 1) / 31;

    if (pct <= 0.2) return "bg-emerald-500/10 border-emerald-500/30";
    if (pct <= 0.4) return "bg-lime-500/10 border-lime-500/30";
    if (pct <= 0.6) return "bg-yellow-500/10 border-yellow-500/30";
    if (pct <= 0.8) return "bg-orange-500/10 border-orange-500/30";

    return "bg-rose-500/10 border-rose-500/30";
}

function StatCard({
    label,
    value,
    sub,
    icon: Icon,
    accent = "text-sky-400",
}: {
    label: string;
    value: string;
    sub?: string;
    icon: any;
    accent?: string;
}) {
    return (
        <div className="@container rounded-2xl border border-slate-800 bg-slate-950/55 p-5">
            <div className="flex h-full flex-col items-start gap-4 @min-[240px]:flex-row">
                <div className={`shrink-0 rounded-xl bg-slate-900 p-3 ${accent}`}>
                    <Icon size={24} strokeWidth={1.8} />
                </div>

                <div className="min-w-0">
                    <p className="text-sm leading-5 text-slate-400">
                        {label}
                    </p>

                    <p className="mt-1 whitespace-nowrap text-2xl font-bold text-white">
                        {value}
                    </p>

                    {sub && (
                        <p className="mt-1 text-sm text-slate-500">
                            {sub}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function CapBar({
    label,
    logo,
    capHit,
    capSpace,
    capCeiling,
}: {
    label: string;
    logo?: string | null;
    capHit: number;
    capSpace: number;
    capCeiling: number;
}) {
    const utilisationPct =
        capCeiling > 0
            ? (Number(capHit) / Number(capCeiling)) * 100
            : 0;

    const overCap = utilisationPct > 100;

    const scaleMax = Math.max(
        105,
        Math.ceil(utilisationPct / 5) * 5
    );

    const committedWidth = Math.min(
        100,
        (utilisationPct / scaleMax) * 100
    );

    const capLimitPosition =
        (100 / scaleMax) * 100;

    const normalCommittedPct =
        Math.min(utilisationPct, 100);

    const normalCommittedWidth =
        (normalCommittedPct / scaleMax) * 100;

    const overageWidth =
        overCap
            ? ((utilisationPct - 100) / scaleMax) * 100
            : 0;

    return (
        <div>
            <div className="mb-2 flex items-end justify-between">
                <div>
                    {logo ? (
                        <img
                            src={logo}
                            alt={label}
                            className="h-12 w-12 object-contain"
                        />
                    ) : (
                        <p className="font-semibold text-white">
                            {label}
                        </p>
                    )}

                    <p
                        className={`mt-1 text-sm ${
                            Number(capSpace) < 0
                                ? "font-medium text-rose-400"
                                : "text-slate-500"
                        }`}
                    >
                        {capSpaceMoney(capSpace)} cap space
                    </p>
                </div>

                <div className="text-right">
                    <p className="font-semibold text-white">
                        {money(capCeiling)} cap
                    </p>

                    <p className="text-sm text-slate-500">
                        {money(capHit)} committed
                    </p>
                </div>
            </div>

            <div className="relative h-9 overflow-hidden rounded-lg bg-slate-800">
                <div
                    className="absolute inset-y-0 left-0 bg-blue-500"
                    style={{
                        width: `${normalCommittedWidth}%`,
                    }}
                />

                {overCap && (
                    <div
                        className="absolute inset-y-0 bg-rose-500"
                        style={{
                            left: `${capLimitPosition}%`,
                            width: `${overageWidth}%`,
                        }}
                    />
                )}

                <div
                    className="absolute inset-y-0 left-0 z-20 flex items-center justify-center text-xs font-bold text-white"
                    style={{
                        width: `${committedWidth}%`,
                    }}
                >
                    {utilisationPct.toFixed(1)}%
                </div>

                <div
                    className="absolute inset-y-0 z-30 w-[2px] bg-white"
                    style={{
                        left: `${capLimitPosition}%`,
                    }}
                />
            </div>

            {overCap && (
                <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                        100% cap limit
                    </span>

                    <span className="font-semibold text-rose-400">
                        {money(Math.abs(Number(capSpace)))} over cap
                    </span>
                </div>
            )}
        </div>
    );
}

function PositionSpendBar({
    label,
    spend,
    maxSpend,
    colour,
}: {
    label: string;
    spend: number;
    maxSpend: number;
    colour: string;
}) {
    const height =
        maxSpend > 0
            ? Math.max(
                  50,
                  (spend / maxSpend) * 150
              )
            : 50;

    return (
        <div
            className={`absolute left-1/2 top-1/2 flex w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border border-white/15 ${colour} text-lg font-bold text-white shadow-lg`}
            style={{
                height: `${height}px`,
            }}
        >
            {label}
        </div>
    );
}

function SortHeader({
    label,
    field,
    currentField,
    direction,
    onClick,
}: {
    label: string;
    field: SortField;
    currentField: SortField;
    direction: SortDirection;
    onClick: (field: SortField) => void;
}) {
    const active = field === currentField;

    return (
        <button
            type="button"
            onClick={() => onClick(field)}
            className={`flex items-center gap-1 text-left transition ${
                active
                    ? "text-blue-400"
                    : "text-slate-500 hover:text-slate-300"
            }`}
        >
            {label}

            {active &&
                (direction === "desc" ? (
                    <ArrowDown size={12} />
                ) : (
                    <ArrowUp size={12} />
                ))}
        </button>
    );
}

export default function SalaryCapPanel({
    data,
}: {
    data: SalaryCapData;
}) {
    const [sortField, setSortField] =
        useState<SortField>("cap_hit");

    const [sortDirection, setSortDirection] =
        useState<SortDirection>("desc");

    const sortedContracts = useMemo(() => {
        return [...(data.contracts ?? [])]
            .filter(
                (contract) =>
                    contract.cap_hit != null
            )
            .sort((a, b) => {
                const aValue =
                    Number(a[sortField] ?? 0);

                const bValue =
                    Number(b[sortField] ?? 0);

                return sortDirection === "desc"
                    ? bValue - aValue
                    : aValue - bValue;
            })
            .slice(0, 5);
    }, [
        data.contracts,
        sortField,
        sortDirection,
    ]);

    const summary = data.summary;

    if (!summary) {
        return (
            <div className="py-10 text-center text-slate-500">
                No salary cap data available.
            </div>
        );
    }

    const positionCounts =
        data.positionCounts ?? {
            forward_players: 0,
            defense_players: 0,
            goalie_players: 0,
            nhl_avg_forward_players: 0,
            nhl_avg_defense_players: 0,
            nhl_avg_goalie_players: 0,
        };

    const capCeiling =
        Number(summary.projected_cap_hit) +
        Number(summary.projected_cap_space);

    const nhlAvgCapHit =
        capCeiling -
        Number(summary.nhl_avg_projected_cap_space);

    /*
     * Explicit Number() conversion is important here because
     * BigQuery numeric results can arrive through JSON in forms
     * that are not always handled consistently as native JS numbers.
     */
    const forwardPlayers =
        Number(positionCounts.forward_players) || 0;

    const defensePlayers =
        Number(positionCounts.defense_players) || 0;

    const goaliePlayers =
        Number(positionCounts.goalie_players) || 0;

    const nhlAvgForwardPlayers =
        Number(positionCounts.nhl_avg_forward_players) || 0;

    const nhlAvgDefensePlayers =
        Number(positionCounts.nhl_avg_defense_players) || 0;

    const nhlAvgGoaliePlayers =
        Number(positionCounts.nhl_avg_goalie_players) || 0;

    const forwardCap =
        Number(summary.forward_cap) || 0;

    const defenseCap =
        Number(summary.defense_cap) || 0;

    const goalieCap =
        Number(summary.goalie_cap) || 0;

    const nhlAvgForwardCap =
        Number(summary.nhl_avg_forward_cap) || 0;

    const nhlAvgDefenseCap =
        Number(summary.nhl_avg_defense_cap) || 0;

    const nhlAvgGoalieCap =
        Number(summary.nhl_avg_goalie_cap) || 0;

    const forwardPerPlayer =
        forwardPlayers > 0
            ? forwardCap / forwardPlayers
            : 0;

    const defensePerPlayer =
        defensePlayers > 0
            ? defenseCap / defensePlayers
            : 0;

    const goaliePerPlayer =
        goaliePlayers > 0
            ? goalieCap / goaliePlayers
            : 0;

    const nhlForwardPerPlayer =
        nhlAvgForwardPlayers > 0
            ? nhlAvgForwardCap /
              nhlAvgForwardPlayers
            : 0;

    const nhlDefensePerPlayer =
        nhlAvgDefensePlayers > 0
            ? nhlAvgDefenseCap /
              nhlAvgDefensePlayers
            : 0;

    const nhlGoaliePerPlayer =
        nhlAvgGoaliePlayers > 0
            ? nhlAvgGoalieCap /
              nhlAvgGoaliePlayers
            : 0;

    const maxPositionSpend = Math.max(
        forwardPerPlayer,
        defensePerPlayer,
        goaliePerPlayer
    );

    const teamLogo =
        `https://assets.nhle.com/logos/nhl/svg/${data.team}_dark.svg`;

    function changeSort(
        field: SortField
    ) {
        if (field === sortField) {
            setSortDirection(
                sortDirection === "desc"
                    ? "asc"
                    : "desc"
            );
        } else {
            setSortField(field);
            setSortDirection("desc");
        }
    }

    return (
        <div className="space-y-6">
            {/* TOP KPI STRIP */}
            <div className="overflow-x-auto">
                <div className="grid min-w-[1200px] grid-cols-6 gap-4">
                    <div
                        className={`@container rounded-2xl border p-5 ${rankBg(
                            summary.cap_space_rank
                        )}`}
                    >
                        <div className="flex h-full flex-col items-start gap-4 @min-[240px]:flex-row">
                            <div
                                className={`shrink-0 rounded-xl bg-slate-900 p-3 ${rankColour(
                                    summary.cap_space_rank
                                )}`}
                            >
                                <WalletCards
                                    size={24}
                                    strokeWidth={1.8}
                                />
                            </div>

                            <div className="min-w-0">
                                <p className="text-sm leading-5 text-slate-400">
                                    Projected Cap Space
                                </p>

                                <p
                                    className={`mt-1 whitespace-nowrap text-4xl font-bold ${rankColour(
                                        summary.cap_space_rank
                                    )}`}
                                >
                                    {capSpaceMoney(
                                        summary.projected_cap_space
                                    )}
                                </p>

                                <p className="mt-2 text-sm text-slate-500">
                                    #{summary.cap_space_rank} in NHL
                                </p>
                            </div>
                        </div>
                    </div>

                    <StatCard
                        label="Projected Cap Hit"
                        value={money(
                            summary.projected_cap_hit
                        )}
                        icon={Coins}
                        accent="text-blue-400"
                    />

                    <StatCard
                        label="Cap Space Rank"
                        value={`#${summary.cap_space_rank}`}
                        sub="of 32 teams"
                        icon={BarChart3}
                        accent={rankColour(
                            summary.cap_space_rank
                        )}
                    />

                    <StatCard
                        label="Dead Cap"
                        value={money(
                            summary.dead_cap_space
                        )}
                        icon={Landmark}
                        accent="text-orange-400"
                    />

                    <StatCard
                        label="Cap Utilisation"
                        value={`${Number(
                            summary.cap_utilisation_pct
                        ).toFixed(1)}%`}
                        icon={CircleDollarSign}
                        accent="text-violet-400"
                    />

                    <StatCard
                        label="Active Roster"
                        value={String(
                            summary.active_roster
                        )}
                        icon={Users}
                        accent="text-cyan-400"
                    />
                </div>
            </div>

            {/* CAP POSITION + POSITIONAL SPEND */}
            <div className="overflow-x-auto">
                <div className="grid min-w-[1150px] grid-cols-2 gap-6">
                    {/* CAP POSITION */}
                    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                        <h3 className="text-xl font-bold text-white">
                            Cap Position
                        </h3>

                        <div className="mt-6 space-y-8">
                            <CapBar
                                label={data.team}
                                logo={teamLogo}
                                capHit={
                                    summary.projected_cap_hit
                                }
                                capSpace={
                                    summary.projected_cap_space
                                }
                                capCeiling={capCeiling}
                            />

                            <CapBar
                                label="NHL Average"
                                capHit={nhlAvgCapHit}
                                capSpace={
                                    summary.nhl_avg_projected_cap_space
                                }
                                capCeiling={capCeiling}
                            />
                        </div>

                        <div className="mt-6 flex gap-5 text-sm text-slate-400">
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-sm bg-blue-500" />
                                Committed
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-sm bg-slate-800 ring-1 ring-slate-600" />
                                Available
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-sm bg-rose-500" />
                                Over cap
                            </div>
                        </div>
                    </section>

                    {/* POSITIONAL SPEND */}
                    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white">
                                Positional Spend
                            </h3>

                            <p className="text-xs text-slate-500">
                                Average cap hit per roster player
                            </p>
                        </div>

                        <div className="relative mt-5 h-[205px] overflow-hidden rounded-[75px] border-2 border-slate-500/60 bg-slate-950/40">
                            <div className="absolute inset-y-0 left-1/4 border-l border-slate-500/40" />
                            <div className="absolute inset-y-0 left-1/2 border-l border-slate-500/60" />
                            <div className="absolute inset-y-0 left-3/4 border-l border-slate-500/40" />

                            <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-500/50" />

                            <div className="absolute inset-0 grid grid-cols-3">
                                <div className="relative">
                                    <PositionSpendBar
                                        label="G"
                                        spend={goaliePerPlayer}
                                        maxSpend={maxPositionSpend}
                                        colour={G_COLOUR}
                                    />
                                </div>

                                <div className="relative">
                                    <PositionSpendBar
                                        label="D"
                                        spend={defensePerPlayer}
                                        maxSpend={maxPositionSpend}
                                        colour={D_COLOUR}
                                    />
                                </div>

                                <div className="relative">
                                    <PositionSpendBar
                                        label="F"
                                        spend={forwardPerPlayer}
                                        maxSpend={maxPositionSpend}
                                        colour={F_COLOUR}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* TEAM POSITION VALUES */}
                        <div className="mt-5 grid grid-cols-3 divide-x divide-slate-800 text-center">
                            <div className="px-3">
                                <p className={`font-semibold ${G_TEXT}`}>
                                    Goalies
                                </p>

                                <p className="mt-1 text-xl font-bold text-white">
                                    {money(goaliePerPlayer)}
                                </p>

                                <p className="text-xs text-slate-500">
                                    {goaliePlayers} players
                                </p>

                                <p className="mt-2 text-xs text-slate-500">
                                    {money(goalieCap)} total
                                </p>
                            </div>

                            <div className="px-3">
                                <p className={`font-semibold ${D_TEXT}`}>
                                    Defence
                                </p>

                                <p className="mt-1 text-xl font-bold text-white">
                                    {money(defensePerPlayer)}
                                </p>

                                <p className="text-xs text-slate-500">
                                    {defensePlayers} players
                                </p>

                                <p className="mt-2 text-xs text-slate-500">
                                    {money(defenseCap)} total
                                </p>
                            </div>

                            <div className="px-3">
                                <p className={`font-semibold ${F_TEXT}`}>
                                    Forwards
                                </p>

                                <p className="mt-1 text-xl font-bold text-white">
                                    {money(forwardPerPlayer)}
                                </p>

                                <p className="text-xs text-slate-500">
                                    {forwardPlayers} players
                                </p>

                                <p className="mt-2 text-xs text-slate-500">
                                    {money(forwardCap)} total
                                </p>
                            </div>
                        </div>

                        {/* NHL AVERAGE COMPARISON */}
                        <div className="mt-5 border-t border-slate-800 pt-4">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                NHL Avg
                            </p>

                            <div className="grid grid-cols-[90px_repeat(3,minmax(0,1fr))] items-center gap-x-4 gap-y-2 text-xs">
                                {/* TOTAL */}
                                <span className="font-medium text-slate-500">
                                    Total
                                </span>

                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <span className="font-medium text-slate-300">
                                        {money(nhlAvgGoalieCap)}
                                    </span>

                                    <span className="text-slate-600">
                                        /
                                    </span>

                                    <span className="font-medium text-sky-400">
                                        {signedMoney(
                                            goalieCap -
                                                nhlAvgGoalieCap
                                        )}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <span className="font-medium text-slate-300">
                                        {money(nhlAvgDefenseCap)}
                                    </span>

                                    <span className="text-slate-600">
                                        /
                                    </span>

                                    <span className="font-medium text-sky-400">
                                        {signedMoney(
                                            defenseCap -
                                                nhlAvgDefenseCap
                                        )}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <span className="font-medium text-slate-300">
                                        {money(nhlAvgForwardCap)}
                                    </span>

                                    <span className="text-slate-600">
                                        /
                                    </span>

                                    <span className="font-medium text-sky-400">
                                        {signedMoney(
                                            forwardCap -
                                                nhlAvgForwardCap
                                        )}
                                    </span>
                                </div>

                                {/* PER PLAYER */}
                                <span className="whitespace-nowrap font-medium text-slate-500">
                                    Per Player
                                </span>

                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <span className="font-medium text-slate-300">
                                        {money(nhlGoaliePerPlayer)}
                                    </span>

                                    <span className="text-slate-600">
                                        /
                                    </span>

                                    <span className="font-medium text-sky-400">
                                        {signedMoney(
                                            goaliePerPlayer -
                                                nhlGoaliePerPlayer
                                        )}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <span className="font-medium text-slate-300">
                                        {money(nhlDefensePerPlayer)}
                                    </span>

                                    <span className="text-slate-600">
                                        /
                                    </span>

                                    <span className="font-medium text-sky-400">
                                        {signedMoney(
                                            defensePerPlayer -
                                                nhlDefensePerPlayer
                                        )}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <span className="font-medium text-slate-300">
                                        {money(nhlForwardPerPlayer)}
                                    </span>

                                    <span className="text-slate-600">
                                        /
                                    </span>

                                    <span className="font-medium text-sky-400">
                                        {signedMoney(
                                            forwardPerPlayer -
                                                nhlForwardPerPlayer
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* FUTURE COMMITMENTS */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">
                        Future Commitments
                    </h3>

                    <div className="flex gap-5 text-sm text-slate-400">
                        <span className="flex items-center gap-2">
                            <span
                                className={`h-3 w-3 rounded ${G_COLOUR}`}
                            />
                            Goalies
                        </span>

                        <span className="flex items-center gap-2">
                            <span
                                className={`h-3 w-3 rounded ${D_COLOUR}`}
                            />
                            Defence
                        </span>

                        <span className="flex items-center gap-2">
                            <span
                                className={`h-3 w-3 rounded ${F_COLOUR}`}
                            />
                            Forwards
                        </span>
                    </div>
                </div>

                <div className="mt-6 space-y-6">
                    {data.future.map((row) => {
                        const scale = Math.max(
                            capCeiling,
                            Number(row.roster_cap)
                        );

                        const gPct =
                            (Number(row.goalie_cap) /
                                scale) *
                            100;

                        const dPct =
                            (Number(row.defense_cap) /
                                scale) *
                            100;

                        const fPct =
                            (Number(row.forward_cap) /
                                scale) *
                            100;

                        return (
                            <div key={row.year}>
                                <div className="mb-2 flex justify-between">
                                    <div>
                                        <p className="font-semibold text-white">
                                            {row.season}
                                        </p>

                                        <p className="text-sm text-slate-500">
                                            {row.roster_players} roster players under contract
                                        </p>
                                    </div>

                                    <div className="text-right">
                                        <p className="font-semibold text-white">
                                            {money(
                                                row.roster_cap
                                            )}
                                        </p>

                                        <p className="text-sm text-slate-500">
                                            NHL avg{" "}
                                            {money(
                                                row.nhl_avg_roster_cap
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex h-9 overflow-hidden rounded-lg bg-slate-800">
                                    <div
                                        className={`${G_COLOUR} flex items-center justify-center text-xs font-semibold`}
                                        style={{
                                            width: `${gPct}%`,
                                        }}
                                    >
                                        {gPct > 6
                                            ? money(
                                                  row.goalie_cap
                                              )
                                            : ""}
                                    </div>

                                    <div
                                        className={`${D_COLOUR} flex items-center justify-center text-xs font-semibold`}
                                        style={{
                                            width: `${dPct}%`,
                                        }}
                                    >
                                        {dPct > 8
                                            ? money(
                                                  row.defense_cap
                                              )
                                            : ""}
                                    </div>

                                    <div
                                        className={`${F_COLOUR} flex items-center justify-center text-xs font-semibold`}
                                        style={{
                                            width: `${fPct}%`,
                                        }}
                                    >
                                        {fPct > 10
                                            ? money(
                                                  row.forward_cap
                                              )
                                            : ""}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* DECISIONS + CONTRACTS */}
            <div className="overflow-x-auto">
                <div className="grid min-w-[1000px] grid-cols-2 gap-6">
                    {/* CONTRACT DECISIONS */}
                    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                        <div className="flex items-center gap-3">
                            <CalendarDays className="text-orange-400" />

                            <h3 className="text-xl font-bold text-white">
                                Upcoming Contract Decisions
                            </h3>
                        </div>

                        <div className="mt-5 divide-y divide-slate-800">
                            {data.expiries.map(
                                (row) => (
                                    <div
                                        key={
                                            row.expiry_year
                                        }
                                        className="flex items-center justify-between py-4"
                                    >
                                        <div>
                                            <p className="font-semibold text-white">
                                                {row.expiry_year}
                                            </p>

                                            <p className="text-sm text-slate-500">
                                                {row.ufa_players} UFA ·{" "}
                                                {row.rfa_players} RFA ·{" "}
                                                {row.elc_players} ELC
                                            </p>
                                        </div>

                                        <div className="text-right">
                                            <p className="font-semibold text-white">
                                                {money(
                                                    row.expiring_cap_hit
                                                )}
                                            </p>

                                            <p className="text-sm text-slate-500">
                                                {row.expiring_players} players
                                            </p>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </section>

                    {/* LARGEST CONTRACTS */}
                    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                        <div className="flex items-center gap-3">
                            <FileText className="text-blue-400" />

                            <h3 className="text-xl font-bold text-white">
                                Largest Contracts
                            </h3>
                        </div>

                        <div className="mt-5">
                            <div className="grid grid-cols-[2fr_0.45fr_0.75fr_0.65fr_0.9fr] gap-3 border-b border-slate-800 pb-2 text-xs uppercase tracking-wide">
                                <span className="text-slate-500">
                                    Player
                                </span>

                                <span className="text-slate-500">
                                    Pos
                                </span>

                                <SortHeader
                                    label="AAV"
                                    field="cap_hit"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={changeSort}
                                />

                                <SortHeader
                                    label="Years"
                                    field="term"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={changeSort}
                                />

                                <SortHeader
                                    label="Total"
                                    field="total_value"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={changeSort}
                                />
                            </div>

                            {sortedContracts.map(
                                (contract) => (
                                    <div
                                        key={
                                            contract.player
                                        }
                                        className="grid grid-cols-[2fr_0.45fr_0.75fr_0.65fr_0.9fr] items-center gap-3 border-b border-slate-800 py-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            {contract.headshot_url ? (
                                                <img
                                                    src={
                                                        contract.headshot_url
                                                    }
                                                    alt={
                                                        contract.player
                                                    }
                                                    className="h-12 w-12 shrink-0 rounded-full bg-slate-800 object-cover object-top"
                                                />
                                            ) : (
                                                <div className="h-12 w-12 shrink-0 rounded-full bg-slate-800" />
                                            )}

                                            <div>
                                                <p className="font-semibold text-white">
                                                    {contract.player}
                                                </p>

                                                <p className="text-sm text-slate-500">
                                                    {contract.expiry_status ||
                                                        "—"}{" "}
                                                    {contract.expiry_year ||
                                                        ""}
                                                </p>
                                            </div>
                                        </div>

                                        <span className="text-slate-300">
                                            {contract.position ||
                                                "—"}
                                        </span>

                                        <span className="font-semibold text-blue-400">
                                            {money(
                                                contract.cap_hit
                                            )}
                                        </span>

                                        <span className="text-slate-300">
                                            {contract.term ??
                                                "—"}
                                        </span>

                                        <span className="font-semibold text-white">
                                            {money(
                                                contract.total_value
                                            )}
                                        </span>
                                    </div>
                                )
                            )}
                        </div>
                    </section>
                </div>
            </div>

            {/* ROSTER DETAILS */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <h3 className="text-xl font-bold text-white">
                    Roster & Cap Details
                </h3>

                <div className="mt-5 overflow-x-auto">
                    <div className="grid min-w-[900px] grid-cols-4 gap-4">
                        <StatCard
                            label="Average Age"
                            value={Number(
                                summary.average_age
                            ).toFixed(1)}
                            icon={Users}
                            accent="text-sky-400"
                        />

                        <StatCard
                            label="Active Roster"
                            value={String(
                                summary.active_roster
                            )}
                            icon={Shirt}
                            accent="text-blue-400"
                        />

                        <StatCard
                            label="Contracts"
                            value={String(
                                summary.contracts
                            )}
                            icon={FileText}
                            accent="text-violet-400"
                        />

                        <StatCard
                            label="Deadline Cap Space"
                            value={capSpaceMoney(
                                summary.deadline_cap_space
                            )}
                            icon={Goal}
                            accent="text-cyan-400"
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}