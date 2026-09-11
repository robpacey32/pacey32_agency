"use client";

import { useState } from "react";

type ComparisonModel =
    | "playing_style"
    | "production"
    | "effectiveness"
    | "usage"
    | "trajectory";

// ---------------------------------------------------------
// COMPARABLE PLAYER TYPES
// ---------------------------------------------------------

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

// ---------------------------------------------------------
// EXPLANATION TYPES
// ---------------------------------------------------------

interface SimilarityExplanationFeature {
    feature: string;
    label: string;
    description: string;

    targetRaw: number | null;
    comparableRaw: number | null;

    targetModelValue: number | null;
    comparableModelValue: number | null;

    targetStandardised: number | null;
    comparableStandardised: number | null;

    difference: number | null;
    squaredDifference: number | null;
    distanceContributionPct: number | null;
}

interface SimilarityExplanation {
    model: ComparisonModel;
    title: string;
    description: string;

    target: {
        playerId: number;
        player: string;
    };

    comparable: {
        playerId: number;
        player: string;
    };

    featureCount: number;

    meanSquaredDifference: number;
    distance: number;
    similarity: number;

    formula: string;

    features: SimilarityExplanationFeature[];
}

// ---------------------------------------------------------
// PANEL
// ---------------------------------------------------------

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

                    <div className="mt-1 text-xs text-slate-600">
                        Click any model score to see how it was calculated.
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
                        targetPlayerId={data.playerId}
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
    targetPlayerId,
    player,
}: {
    targetPlayerId: number;
    player: ComparablePlayer;
}) {
    const [selectedModel, setSelectedModel] =
        useState<ComparisonModel | null>(null);

    const [explanation, setExplanation] =
        useState<SimilarityExplanation | null>(null);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);

    async function openExplanation(
        model: ComparisonModel
    ) {
        if (
            selectedModel === model &&
            explanation
        ) {
            setSelectedModel(null);
            setExplanation(null);
            setError(null);
            return;
        }

        setSelectedModel(model);
        setExplanation(null);
        setError(null);
        setLoading(true);

        try {
            const response =
                await fetch(
                    `/api/comparable-players/explain?playerId=${targetPlayerId}&comparablePlayerId=${player.comparable_playerId}&model=${model}`
                );

            const result =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error ??
                    "Failed to load explanation"
                );
            }

            setExplanation(
                result as SimilarityExplanation
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load explanation"
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div
            className="
                rounded-xl
                border border-slate-800
                bg-slate-950/30
                transition
                hover:border-slate-700
                hover:bg-slate-950/50
            "
        >
            <div className="px-4 py-3">

                {/* Desktop */}
                <div className="hidden grid-cols-[48px_280px_1.4fr_repeat(5,1fr)] items-center gap-4 xl:grid">

                    <div className="text-xl font-bold text-slate-400">
                        {player.comparable_rank}
                    </div>

                    <PlayerIdentity
                        player={player}
                    />

                    <OverallMatch
                        value={player.overall_similarity}
                    />

                    <SimilarityMetric
                        value={player.playing_style_similarity}
                        rank={player.playing_style_rank}
                        active={
                            selectedModel ===
                            "playing_style"
                        }
                        onClick={() =>
                            openExplanation(
                                "playing_style"
                            )
                        }
                    />

                    <SimilarityMetric
                        value={player.production_similarity}
                        rank={player.production_rank}
                        active={
                            selectedModel ===
                            "production"
                        }
                        onClick={() =>
                            openExplanation(
                                "production"
                            )
                        }
                    />

                    <SimilarityMetric
                        value={player.effectiveness_similarity}
                        rank={player.effectiveness_rank}
                        active={
                            selectedModel ===
                            "effectiveness"
                        }
                        onClick={() =>
                            openExplanation(
                                "effectiveness"
                            )
                        }
                    />

                    <SimilarityMetric
                        value={player.usage_similarity}
                        rank={player.usage_rank}
                        active={
                            selectedModel ===
                            "usage"
                        }
                        onClick={() =>
                            openExplanation(
                                "usage"
                            )
                        }
                    />

                    <SimilarityMetric
                        value={player.trajectory_similarity}
                        rank={player.trajectory_rank}
                        active={
                            selectedModel ===
                            "trajectory"
                        }
                        onClick={() =>
                            openExplanation(
                                "trajectory"
                            )
                        }
                    />

                </div>

                {/* Tablet / Mobile */}
                <div className="xl:hidden">

                    <div className="flex items-start gap-3">

                        <div className="pt-2 text-lg font-bold text-slate-500">
                            #{player.comparable_rank}
                        </div>

                        <div className="min-w-0 flex-1">
                            <PlayerIdentity
                                player={player}
                            />
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
                            active={
                                selectedModel ===
                                "playing_style"
                            }
                            onClick={() =>
                                openExplanation(
                                    "playing_style"
                                )
                            }
                        />

                        <MobileMetric
                            label="Production"
                            value={player.production_similarity}
                            rank={player.production_rank}
                            active={
                                selectedModel ===
                                "production"
                            }
                            onClick={() =>
                                openExplanation(
                                    "production"
                                )
                            }
                        />

                        <MobileMetric
                            label="Effectiveness"
                            value={player.effectiveness_similarity}
                            rank={player.effectiveness_rank}
                            active={
                                selectedModel ===
                                "effectiveness"
                            }
                            onClick={() =>
                                openExplanation(
                                    "effectiveness"
                                )
                            }
                        />

                        <MobileMetric
                            label="Usage"
                            value={player.usage_similarity}
                            rank={player.usage_rank}
                            active={
                                selectedModel ===
                                "usage"
                            }
                            onClick={() =>
                                openExplanation(
                                    "usage"
                                )
                            }
                        />

                        <MobileMetric
                            label="Trajectory"
                            value={player.trajectory_similarity}
                            rank={player.trajectory_rank}
                            active={
                                selectedModel ===
                                "trajectory"
                            }
                            onClick={() =>
                                openExplanation(
                                    "trajectory"
                                )
                            }
                        />

                    </div>

                </div>
            </div>

            {selectedModel && (
                <div className="border-t border-slate-800">

                    {loading && (
                        <div className="px-5 py-6 text-sm text-slate-500">
                            Calculating explanation...
                        </div>
                    )}

                    {error && (
                        <div className="px-5 py-6 text-sm text-rose-400">
                            {error}
                        </div>
                    )}

                    {!loading &&
                        !error &&
                        explanation && (
                            <SimilarityExplanationPanel
                                explanation={
                                    explanation
                                }
                            />
                        )}

                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------
// EXPLANATION
// ---------------------------------------------------------

function SimilarityExplanationPanel({
    explanation,
}: {
    explanation: SimilarityExplanation;
}) {
    const sortedFeatures =
        [...explanation.features].sort(
            (a, b) =>
                (b.distanceContributionPct ?? 0) -
                (a.distanceContributionPct ?? 0)
        );

    return (
        <div className="space-y-6 bg-slate-950/40 px-5 py-6">

            {/* Explanation heading */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {explanation.title} similarity
                    </div>

                    <div className="mt-1 text-lg font-semibold text-white">
                        {explanation.target.player}
                        <span className="mx-2 text-slate-600">
                            vs
                        </span>
                        {explanation.comparable.player}
                    </div>

                    <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                        {explanation.description}
                    </div>
                </div>

                <div className="shrink-0 rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-3 text-right">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                        Similarity
                    </div>

                    <div
                        className={`mt-1 text-3xl font-bold ${scoreTextClass(
                            explanation.similarity
                        )}`}
                    >
                        {explanation.similarity.toFixed(
                            1
                        )}
                        %
                    </div>
                </div>

            </div>

            {/* Feature values */}
            <div>
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Feature comparison
                </div>

                <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                    {explanation.features.map(
                        (feature) => (
                            <FeatureComparison
                                key={
                                    feature.feature
                                }
                                feature={
                                    feature
                                }
                                targetName={
                                    explanation.target
                                        .player
                                }
                                comparableName={
                                    explanation
                                        .comparable
                                        .player
                                }
                            />
                        )
                    )}
                </div>
            </div>

            {/* Contribution */}
            <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    What drives the difference?
                </div>

                <div className="mb-4 text-xs text-slate-500">
                    Share of the total squared statistical
                    distance contributed by each metric.
                </div>

                <div className="space-y-3">
                    {sortedFeatures.map(
                        (feature) => (
                            <ContributionBar
                                key={
                                    feature.feature
                                }
                                feature={
                                    feature
                                }
                            />
                        )
                    )}
                </div>
            </div>

            {/* Calculation */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">

                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Calculation
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">

                    <CalculationMetric
                        label="Mean squared difference"
                        value={explanation.meanSquaredDifference.toFixed(
                            4
                        )}
                    />

                    <CalculationMetric
                        label="RMS distance"
                        value={explanation.distance.toFixed(
                            4
                        )}
                    />

                    <CalculationMetric
                        label="Similarity"
                        value={`${explanation.similarity.toFixed(
                            1
                        )}%`}
                    />

                </div>

                <div className="mt-4 rounded-lg bg-slate-950/70 px-4 py-3 font-mono text-sm text-slate-300">
                    similarity = e
                    <sup>
                        −
                        {explanation.distance.toFixed(
                            4
                        )}
                    </sup>
                    {" × 100 = "}
                    <span
                        className={scoreTextClass(
                            explanation.similarity
                        )}
                    >
                        {explanation.similarity.toFixed(
                            1
                        )}
                        %
                    </span>
                </div>

            </div>

        </div>
    );
}

// ---------------------------------------------------------
// FEATURE VISUAL
// ---------------------------------------------------------

function FeatureComparison({
    feature,
    targetName,
    comparableName,
}: {
    feature: SimilarityExplanationFeature;
    targetName: string;
    comparableName: string;
}) {
    const target =
        feature.targetStandardised ?? 0;

    const comparable =
        feature.comparableStandardised ?? 0;

    const targetPosition =
        zPosition(target);

    const comparablePosition =
        zPosition(comparable);

    const left =
        Math.min(
            targetPosition,
            comparablePosition
        );

    const width =
        Math.max(
            1,
            Math.abs(
                comparablePosition -
                targetPosition
            )
        );

    return (
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3">

            <div className="grid gap-3">

                <div>
                    <div className="text-sm font-medium text-slate-200">
                        {feature.label}
                    </div>

                    <div
                        className="mt-0.5 truncate text-[11px] text-slate-600"
                        title={
                            feature.description
                        }
                    >
                        {feature.description}
                    </div>
                </div>

                <div className="grid grid-cols-[90px_1fr_90px] items-center gap-3">

                    <div className="text-right text-sm">
                        <div className="font-semibold text-sky-300">
                            {formatFeatureValue(
                                feature.targetRaw
                            )}
                        </div>

                        <div className="truncate text-[10px] text-slate-600">
                            {shortName(
                                targetName
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="relative h-6">

                            <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-700" />

                            <div className="absolute left-1/2 top-0 h-6 w-px bg-slate-600" />

                            <div
                                className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-500"
                                style={{
                                    left:
                                        `${left}%`,
                                    width:
                                        `${width}%`,
                                }}
                            />

                            <div
                                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400 ring-2 ring-slate-950"
                                style={{
                                    left:
                                        `${targetPosition}%`,
                                }}
                                title={`${targetName}: z=${target.toFixed(
                                    2
                                )}`}
                            />

                            <div
                                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-400 ring-2 ring-slate-950"
                                style={{
                                    left:
                                        `${comparablePosition}%`,
                                }}
                                title={`${comparableName}: z=${comparable.toFixed(
                                    2
                                )}`}
                            />

                        </div>

                        <div className="mt-1 flex justify-between text-[9px] text-slate-700">
                            <span>-3σ</span>
                            <span>Avg</span>
                            <span>+3σ</span>
                        </div>
                    </div>

                    <div className="text-sm">
                        <div className="font-semibold text-violet-300">
                            {formatFeatureValue(
                                feature.comparableRaw
                            )}
                        </div>

                        <div className="truncate text-[10px] text-slate-600">
                            {shortName(
                                comparableName
                            )}
                        </div>
                    </div>

                </div>

            </div>

        </div>
    );
}

// ---------------------------------------------------------
// CONTRIBUTION
// ---------------------------------------------------------

function ContributionBar({
    feature,
}: {
    feature: SimilarityExplanationFeature;
}) {
    const contribution =
        Math.max(
            0,
            Math.min(
                100,
                feature.distanceContributionPct ??
                0
            )
        );

    return (
        <div className="grid grid-cols-[170px_1fr_60px] items-center gap-3">

            <div className="truncate text-xs text-slate-400">
                {feature.label}
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                    className="h-full rounded-full bg-slate-500"
                    style={{
                        width:
                            `${contribution}%`,
                    }}
                />
            </div>

            <div className="text-right text-xs font-medium text-slate-300">
                {contribution.toFixed(
                    1
                )}
                %
            </div>

        </div>
    );
}

function CalculationMetric({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-600">
                {label}
            </div>

            <div className="mt-1 text-lg font-semibold text-slate-200">
                {value}
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

            <PlayerHeadshot
                player={player}
            />

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
                    src={
                        player.headshot_url!
                    }
                    alt={
                        player.comparable_player
                    }
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
    active,
    onClick,
}: {
    value: number;
    rank: number;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`
                min-w-0
                rounded-lg
                px-2 py-2
                text-left
                transition
                ${
                    active
                        ? "bg-slate-800/80 ring-1 ring-slate-600"
                        : "hover:bg-slate-900"
                }
            `}
            title="Click to explain this score"
        >

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
                <SimilarityBar
                    value={value}
                />
            </div>

        </button>
    );
}

function MobileMetric({
    label,
    value,
    rank,
    active,
    onClick,
}: {
    label: string;
    value: number;
    rank: number;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`
                rounded-lg
                border
                p-3
                text-left
                transition
                ${
                    active
                        ? "border-slate-600 bg-slate-800/70"
                        : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                }
            `}
        >

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
                <SimilarityBar
                    value={value}
                />
            </div>

        </button>
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
// EXPLANATION HELPERS
// ---------------------------------------------------------

function zPosition(
    value: number
) {
    const clamped =
        Math.max(
            -3,
            Math.min(
                3,
                value
            )
        );

    return (
        ((clamped + 3) / 6) *
        100
    );
}

function formatFeatureValue(
    value: number | null
) {
    if (value == null) {
        return "—";
    }

    const absolute =
        Math.abs(value);

    if (absolute >= 100) {
        return value.toFixed(0);
    }

    if (absolute >= 10) {
        return value.toFixed(1);
    }

    return value.toFixed(2);
}

function shortName(
    name: string
) {
    const parts =
        name.split(" ");

    return (
        parts[
            parts.length - 1
        ] ?? name
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