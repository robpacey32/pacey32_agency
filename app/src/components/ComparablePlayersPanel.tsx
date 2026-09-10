"use client";

import { useState } from "react";

export interface ComparablePlayer {
    comparable_rank: number;
    comparable_playerId: number;
    comparable_player: string;
    comparable_position: string;

    overall_similarity: number;

    playing_style_similarity: number;
    playing_style_rank: number;

    production_similarity: number;
    production_rank: number;

    effectiveness_similarity: number;
    effectiveness_rank: number;

    usage_similarity: number;
    usage_rank: number;

    trajectory_similarity: number;
    trajectory_rank: number;

    models_available: number;

    current_aav: number | null;
    current_contract_term: number | null;
    current_contract_to: string | null;
    current_contract_cap_pct: number | null;

    headshot_url: string | null;
}

export interface ComparablePlayersData {
    source: "model" | "cache";
    playerId: number;
    player?: string;
    position?: string;
    comparables: ComparablePlayer[];
}

export default function ComparablePlayersPanel({
    data,
}: {
    data: ComparablePlayersData;
}) {
    if (!data.comparables.length) {
        return (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-slate-500">
                No comparable players available.
            </div>
        );
    }

    return (
        <div className="space-y-4">

            {/* Header */}
            <div className="flex flex-col gap-3 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">

                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Comparable Players
                    </div>

                    <div className="mt-1 text-sm text-slate-400">
                        Similarity across playing style, production,
                        effectiveness, usage and trajectory.
                    </div>
                </div>

                <div className="text-xs text-slate-500">
                    Higher score = closer statistical match
                </div>

            </div>

            {/* Column headings */}
            <div className="hidden grid-cols-[48px_280px_1.4fr_repeat(5,1fr)] gap-4 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500 xl:grid">

                <div>#</div>
                <div>Player</div>
                <div>Overall Match</div>

                <div className="text-center">
                    Playing Style
                </div>

                <div className="text-center">
                    Production
                </div>

                <div className="text-center">
                    Effectiveness
                </div>

                <div className="text-center">
                    Usage
                </div>

                <div className="text-center">
                    Trajectory
                </div>

            </div>

            {/* Players */}
            <div className="space-y-2">
                {data.comparables.map((player) => (
                    <ComparableRow
                        key={player.comparable_playerId}
                        player={player}
                    />
                ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-end gap-x-5 gap-y-2 border-t border-slate-800 pt-4 text-xs text-slate-500">

                <LegendDot
                    className="bg-emerald-400"
                    label="80–100 Very close"
                />

                <LegendDot
                    className="bg-lime-400"
                    label="60–79 Close"
                />

                <LegendDot
                    className="bg-yellow-400"
                    label="40–59 Moderate"
                />

                <LegendDot
                    className="bg-orange-400"
                    label="20–39 Distant"
                />

                <LegendDot
                    className="bg-rose-500"
                    label="0–19 Very distant"
                />

            </div>

        </div>
    );
}

// ---------------------------------------------------------
// PLAYER ROW
// ---------------------------------------------------------

function ComparableRow({
    player,
}: {
    player: ComparablePlayer;
}) {
    return (
        <div
            className="
                rounded-xl
                border border-slate-800
                bg-slate-950/30
                px-4 py-3
                transition
                hover:border-slate-700
                hover:bg-slate-950/50
            "
        >
            {/* Desktop */}
            <div className="hidden grid-cols-[48px_280px_1.4fr_repeat(5,1fr)] items-center gap-4 xl:grid">

                <div className="text-xl font-bold text-slate-400">
                    {player.comparable_rank}
                </div>

                <PlayerIdentity player={player} />

                <OverallMatch
                    value={player.overall_similarity}
                />

                <SimilarityMetric
                    value={player.playing_style_similarity}
                    rank={player.playing_style_rank}
                />

                <SimilarityMetric
                    value={player.production_similarity}
                    rank={player.production_rank}
                />

                <SimilarityMetric
                    value={player.effectiveness_similarity}
                    rank={player.effectiveness_rank}
                />

                <SimilarityMetric
                    value={player.usage_similarity}
                    rank={player.usage_rank}
                />

                <SimilarityMetric
                    value={player.trajectory_similarity}
                    rank={player.trajectory_rank}
                />

            </div>

            {/* Tablet / Mobile */}
            <div className="xl:hidden">

                <div className="flex items-start gap-3">

                    <div className="pt-2 text-lg font-bold text-slate-500">
                        #{player.comparable_rank}
                    </div>

                    <div className="min-w-0 flex-1">
                        <PlayerIdentity player={player} />
                    </div>

                    <div className="w-28">
                        <OverallMatch
                            value={player.overall_similarity}
                        />
                    </div>

                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">

                    <MobileMetric
                        label="Style"
                        value={player.playing_style_similarity}
                        rank={player.playing_style_rank}
                    />

                    <MobileMetric
                        label="Production"
                        value={player.production_similarity}
                        rank={player.production_rank}
                    />

                    <MobileMetric
                        label="Effectiveness"
                        value={player.effectiveness_similarity}
                        rank={player.effectiveness_rank}
                    />

                    <MobileMetric
                        label="Usage"
                        value={player.usage_similarity}
                        rank={player.usage_rank}
                    />

                    <MobileMetric
                        label="Trajectory"
                        value={player.trajectory_similarity}
                        rank={player.trajectory_rank}
                    />

                </div>

            </div>
        </div>
    );
}

// ---------------------------------------------------------
// PLAYER
// ---------------------------------------------------------

function PlayerIdentity({
    player,
}: {
    player: ComparablePlayer;
}) {
    return (
        <div className="flex min-w-0 items-center gap-3">

            <PlayerHeadshot player={player} />

            <div className="min-w-0">

                <div className="truncate text-base font-semibold text-white">
                    {player.comparable_player}
                </div>

                <div className="mt-0.5 text-xs text-slate-500">
                    {player.comparable_position}
                </div>

                <div className="mt-1 truncate text-xs text-slate-400">
                    {contractText(player)}
                </div>

            </div>

        </div>
    );
}

function PlayerHeadshot({
    player,
}: {
    player: ComparablePlayer;
}) {
    const [imageError, setImageError] =
        useState(false);

    const showImage =
        player.headshot_url &&
        !imageError;

    return (
        <div
            className="
                relative
                h-14 w-14
                shrink-0
                overflow-hidden
                rounded-full
                border border-slate-700
                bg-slate-800
            "
        >
            {showImage ? (
                <img
                    src={player.headshot_url!}
                    alt={player.comparable_player}
                    className="h-full w-full object-cover object-top"
                    onError={() =>
                        setImageError(true)
                    }
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-300">
                    {initials(
                        player.comparable_player
                    )}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------
// OVERALL
// ---------------------------------------------------------

function OverallMatch({
    value,
}: {
    value: number;
}) {
    return (
        <div>

            <div className="text-xl font-bold text-white">
                {value.toFixed(1)}%
            </div>

            <div className="mt-1">
                <SimilarityBar
                    value={value}
                    large
                />
            </div>

            <div
                className={`mt-1 text-xs font-medium ${scoreTextClass(
                    value
                )}`}
            >
                {matchLabel(value)}
            </div>

        </div>
    );
}

// ---------------------------------------------------------
// MODEL SCORE
// ---------------------------------------------------------

function SimilarityMetric({
    value,
    rank,
}: {
    value: number;
    rank: number;
}) {
    return (
        <div className="min-w-0">

            <div className="flex items-baseline justify-between gap-2">

                <span
                    className={`text-sm font-semibold ${scoreTextClass(
                        value
                    )}`}
                >
                    {value.toFixed(1)}%
                </span>

                <span className="text-[11px] text-slate-600">
                    #{rank}
                </span>

            </div>

            <div className="mt-2">
                <SimilarityBar value={value} />
            </div>

        </div>
    );
}

function MobileMetric({
    label,
    value,
    rank,
}: {
    label: string;
    value: number;
    rank: number;
}) {
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">

            <div className="text-[10px] uppercase tracking-wide text-slate-500">
                {label}
            </div>

            <div className="mt-1 flex items-baseline justify-between gap-2">

                <span
                    className={`font-semibold ${scoreTextClass(
                        value
                    )}`}
                >
                    {value.toFixed(1)}%
                </span>

                <span className="text-[10px] text-slate-600">
                    #{rank}
                </span>

            </div>

            <div className="mt-2">
                <SimilarityBar value={value} />
            </div>

        </div>
    );
}

// ---------------------------------------------------------
// 0–100 SPECTRUM
// ---------------------------------------------------------

function SimilarityBar({
    value,
    large = false,
}: {
    value: number;
    large?: boolean;
}) {
    const safeValue =
        Math.max(
            0,
            Math.min(
                100,
                value
            )
        );

    return (
        <div
            className={`
                relative
                overflow-hidden
                rounded-full
                bg-slate-800
                ${large ? "h-2.5" : "h-2"}
            `}
        >
            <div
                className={`
                    h-full
                    rounded-full
                    ${scoreBackgroundClass(
                        value
                    )}
                `}
                style={{
                    width:
                        `${safeValue}%`,
                }}
            />
        </div>
    );
}

// ---------------------------------------------------------
// COLOUR SCALE
// ---------------------------------------------------------

function scoreBackgroundClass(
    value: number
) {
    if (value >= 80) {
        return "bg-emerald-400";
    }

    if (value >= 60) {
        return "bg-lime-400";
    }

    if (value >= 40) {
        return "bg-yellow-400";
    }

    if (value >= 20) {
        return "bg-orange-400";
    }

    return "bg-rose-500";
}

function scoreTextClass(
    value: number
) {
    if (value >= 80) {
        return "text-emerald-400";
    }

    if (value >= 60) {
        return "text-lime-400";
    }

    if (value >= 40) {
        return "text-yellow-400";
    }

    if (value >= 20) {
        return "text-orange-400";
    }

    return "text-rose-400";
}

function matchLabel(
    value: number
) {
    if (value >= 80) {
        return "Very close match";
    }

    if (value >= 60) {
        return "Close match";
    }

    if (value >= 40) {
        return "Moderate match";
    }

    if (value >= 20) {
        return "Distant match";
    }

    return "Very distant match";
}

// ---------------------------------------------------------
// LEGEND
// ---------------------------------------------------------

function LegendDot({
    className,
    label,
}: {
    className: string;
    label: string;
}) {
    return (
        <div className="flex items-center gap-2">

            <div
                className={`h-2.5 w-2.5 rounded-full ${className}`}
            />

            <span>
                {label}
            </span>

        </div>
    );
}

// ---------------------------------------------------------
// FORMATTERS
// ---------------------------------------------------------

function contractText(
    player: ComparablePlayer
) {
    const parts: string[] = [];

    if (
        player.current_aav != null
    ) {
        parts.push(
            `${money(
                player.current_aav
            )} AAV`
        );
    }

    if (
        player.current_contract_term != null
    ) {
        parts.push(
            `${player.current_contract_term} years`
        );
    }

    if (
        player.current_contract_to
    ) {
        parts.push(
            `through ${player.current_contract_to}`
        );
    }

    if (
        player.current_contract_cap_pct != null
    ) {
        parts.push(
            `${player.current_contract_cap_pct.toFixed(
                2
            )}% cap`
        );
    }

    return parts.join(" · ");
}

function money(
    value: number
) {
    if (
        value >= 1_000_000
    ) {
        return `$${(
            value /
            1_000_000
        ).toFixed(2)}m`;
    }

    if (
        value >= 1_000
    ) {
        return `$${(
            value /
            1_000
        ).toFixed(0)}k`;
    }

    return `$${value.toLocaleString()}`;
}

function initials(
    name: string
) {
    return name
        .split(" ")
        .filter(Boolean)
        .map(
            (part) =>
                part[0]
        )
        .join("")
        .slice(0, 2)
        .toUpperCase();
}