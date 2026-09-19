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

    playing_style_similarity: number | null;
    production_similarity: number | null;
    effectiveness_similarity: number | null;
    usage_similarity: number | null;
    trajectory_similarity: number | null;

    models_available: number;
    trajectory_periods_available: number;

    headshot_url: string | null;

    comparison_detail?: unknown;
}

export interface ComparablePlayersData {
    source: "model" | "cache";
    playerId: number;
    player?: string | null;
    position?: string | null;
    comparables: ComparablePlayer[];
}

// ---------------------------------------------------------
// V3 EXPLANATION TYPES
// ---------------------------------------------------------

interface V3Feature {
    feature: string;
    label: string;
    description: string;

    targetRaw: number | null;
    comparableRaw: number | null;

    targetStandardised: number | null;
    comparableStandardised: number | null;

    difference: number | null;
    squaredDifference: number | null;
    distanceContributionPct: number | null;
}

interface V3Component {
    group?: string;
    component?: string;

    similarity: number | null;

    featuresAvailable: number;
    featuresRequired: number;

    features?: V3Feature[];

    meanSquaredDifference?: number | null;
    distance?: number | null;
}

interface V3TrajectoryPeriod {
    period: string;
    similarity: number | null;

    production?: number | null;
    role?: number | null;

    performance?: number | null;
    effectiveness?: number | null;

    components?: V3Component[];
}

interface V3ModelExplanation {
    similarity: number;

    components?: V3Component[];

    groupsAvailable?: number;
    groupsTotal?: number;

    periods?: V3TrajectoryPeriod[];

    periodsAvailable?: number;
}

interface SimilarityExplanationResponse {
    playerId: number;
    comparablePlayerId: number;
    comparablePlayer: string | null;

    model: ComparisonModel;

    similarity: number | null;
    available: boolean;

    explanation?: V3ModelExplanation;
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
            <div className="w-full min-w-0 max-w-full rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-slate-500 sm:p-6">
                No comparable players available.
            </div>
        );
    }

    return (
        <div className="w-full min-w-0 max-w-full space-y-4">

            {/* Header */}
            <div className="flex min-w-0 flex-col gap-3 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">

                <div className="min-w-0">
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

                <div className="shrink-0 text-xs text-slate-500">
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
            <div className="min-w-0 space-y-2">
                {data.comparables.map(
                    player => (
                        <ComparableRow
                            key={
                                player.comparable_playerId
                            }
                            targetPlayerId={
                                data.playerId
                            }
                            targetPlayer={
                                data.player ??
                                "Selected player"
                            }
                            player={
                                player
                            }
                        />
                    )
                )}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-1 gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap sm:justify-end sm:gap-x-5 sm:gap-y-2">

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
    targetPlayer,
    player,
}: {
    targetPlayerId: number;
    targetPlayer: string;
    player: ComparablePlayer;
}) {
    const [
        selectedModel,
        setSelectedModel,
    ] =
        useState<ComparisonModel | null>(
            null
        );

    const [
        explanation,
        setExplanation,
    ] =
        useState<SimilarityExplanationResponse | null>(
            null
        );

    const [
        loading,
        setLoading,
    ] =
        useState(false);

    const [
        error,
        setError,
    ] =
        useState<string | null>(
            null
        );

    async function openExplanation(
        model: ComparisonModel
    ) {
        if (
            selectedModel === model
        ) {
            setSelectedModel(
                null
            );

            setExplanation(
                null
            );

            setError(
                null
            );

            return;
        }

        setSelectedModel(
            model
        );

        setExplanation(
            null
        );

        setError(
            null
        );

        setLoading(
            true
        );

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
                result as SimilarityExplanationResponse
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load explanation"
            );
        } finally {
            setLoading(
                false
            );
        }
    }

    return (
        <div
            className="
                w-full
                min-w-0
                max-w-full
                overflow-hidden
                rounded-xl
                border border-slate-800
                bg-slate-950/30
                transition
                hover:border-slate-700
                hover:bg-slate-950/50
            "
        >
            <div className="min-w-0 px-3 py-3 sm:px-4">

                {/* Desktop */}
                <div className="hidden grid-cols-[48px_280px_1.4fr_repeat(5,1fr)] items-center gap-4 xl:grid">

                    <div className="text-xl font-bold text-slate-400">
                        {
                            player.comparable_rank
                        }
                    </div>

                    <PlayerIdentity
                        player={
                            player
                        }
                    />

                    <OverallMatch
                        value={
                            player.overall_similarity
                        }
                    />

                    <SimilarityMetric
                        value={
                            player.playing_style_similarity
                        }
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
                        value={
                            player.production_similarity
                        }
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
                        value={
                            player.effectiveness_similarity
                        }
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
                        value={
                            player.usage_similarity
                        }
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
                        value={
                            player.trajectory_similarity
                        }
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
                <div className="min-w-0 xl:hidden">

                    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 sm:grid-cols-[auto_minmax(0,1fr)_112px]">

                        <div className="pt-2 text-lg font-bold text-slate-500">
                            #
                            {
                                player.comparable_rank
                            }
                        </div>

                        <div className="min-w-0">
                            <PlayerIdentity
                                player={
                                    player
                                }
                            />
                        </div>

                        <div className="col-span-2 min-w-0 border-t border-slate-800 pt-3 sm:col-span-1 sm:border-0 sm:pt-0">
                            <OverallMatch
                                value={
                                    player.overall_similarity
                                }
                            />
                        </div>

                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:gap-3 md:grid-cols-5">

                        <MobileMetric
                            label="Style"
                            value={
                                player.playing_style_similarity
                            }
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
                            value={
                                player.production_similarity
                            }
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
                            value={
                                player.effectiveness_similarity
                            }
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
                            value={
                                player.usage_similarity
                            }
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
                            value={
                                player.trajectory_similarity
                            }
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
                <div className="min-w-0 border-t border-slate-800">

                    {loading && (
                        <div className="px-4 py-5 text-sm text-slate-500 sm:px-5 sm:py-6">
                            Loading explanation...
                        </div>
                    )}

                    {error && (
                        <div className="break-words px-4 py-5 text-sm text-rose-400 sm:px-5 sm:py-6">
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
                                targetPlayer={
                                    targetPlayer
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
    targetPlayer,
}: {
    explanation: SimilarityExplanationResponse;
    targetPlayer: string;
}) {
    const detail =
        explanation.explanation;

    const modelTitle =
        modelLabel(
            explanation.model
        );

    if (
        !explanation.available ||
        !detail
    ) {
        return (
            <div className="bg-slate-950/40 px-4 py-5 text-sm text-slate-500 sm:px-5 sm:py-6">
                {modelTitle} similarity is not
                available for this comparison.
            </div>
        );
    }

    const hasComponents =
        detail.components &&
        detail.components.length >
            0;

    const hasPeriods =
        detail.periods &&
        detail.periods.length >
            0;

    return (
        <div className="w-full min-w-0 max-w-full space-y-6 bg-slate-950/40 px-3 py-5 sm:px-5 sm:py-6">

            {/* Heading */}
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                <div className="min-w-0">

                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {
                            modelTitle
                        }{" "}
                        similarity
                    </div>

                    <div className="mt-1 break-words text-base font-semibold text-white sm:text-lg">
                        {
                            targetPlayer
                        }

                        <span className="mx-2 text-slate-600">
                            vs
                        </span>

                        {
                            explanation.comparablePlayer
                        }
                    </div>

                    <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                        {
                            modelDescription(
                                explanation.model
                            )
                        }
                    </div>

                </div>

                <div className="w-full shrink-0 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left sm:w-auto sm:px-5 sm:text-right">

                    <div className="text-xs uppercase tracking-wide text-slate-500">
                        Similarity
                    </div>

                    <div
                        className={`mt-1 text-3xl font-bold ${scoreTextClass(
                            detail.similarity
                        )}`}
                    >
                        {
                            detail.similarity.toFixed(
                                1
                            )
                        }
                        %
                    </div>

                </div>

            </div>

            {/* Standard component models */}
            {hasComponents && (
                <div className="min-w-0">

                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Model components
                    </div>

                    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">

                        {detail.components!.map(
                            (
                                component,
                                index
                            ) => (
                                <ComponentCard
                                    key={
                                        component.group ??
                                        component.component ??
                                        index
                                    }
                                    component={
                                        component
                                    }
                                />
                            )
                        )}

                    </div>

                    {detail.groupsTotal !=
                        null && (
                        <div className="mt-3 text-xs text-slate-500">
                            {
                                detail.groupsAvailable ??
                                0
                            }{" "}
                            of{" "}
                            {
                                detail.groupsTotal
                            }{" "}
                            model groups
                            available
                        </div>
                    )}

                </div>
            )}

            {/* Trajectory */}
            {hasPeriods && (
                <div className="min-w-0">

                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Trajectory periods
                    </div>

                    <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">

                        {detail.periods!.map(
                            period => (
                                <TrajectoryPeriodCard
                                    key={
                                        period.period
                                    }
                                    period={
                                        period
                                    }
                                />
                            )
                        )}

                    </div>

                    <div className="mt-3 text-xs text-slate-500">
                        {
                            detail.periodsAvailable ??
                            detail.periods!
                                .length
                        }{" "}
                        trajectory period
                        {(
                            detail.periodsAvailable ??
                            detail.periods!
                                .length
                        ) === 1
                            ? ""
                            : "s"}{" "}
                        available
                    </div>

                </div>
            )}

            {/* Summary */}
            <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">

                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Model result
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">

                    <CalculationMetric
                        label="Similarity"
                        value={`${detail.similarity.toFixed(
                            1
                        )}%`}
                    />

                    <CalculationMetric
                        label="Match"
                        value={
                            matchLabel(
                                detail.similarity
                            )
                        }
                    />

                </div>

                <div className="mt-4 text-xs leading-5 text-slate-500">
                    The model score is calculated
                    from the available statistical
                    components shown above. Higher
                    scores indicate a closer
                    statistical match.
                </div>

            </div>

        </div>
    );
}

// ---------------------------------------------------------
// COMPONENT CARD
// ---------------------------------------------------------

function ComponentCard({
    component,
}: {
    component: V3Component;
}) {
    const [
        expanded,
        setExpanded,
    ] =
        useState(false);

    const available =
        component.similarity != null;

    const features =
        component.features ?? [];

    const componentName =
        component.group ??
        component.component ??
        "component";

    const hasDetail =
        features.length > 0;

    return (
        <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/30">

            {/* Component summary */}
            <button
                type="button"
                onClick={() => {
                    if (hasDetail) {
                        setExpanded(
                            value => !value
                        );
                    }
                }}
                disabled={!hasDetail}
                className={`
                    w-full
                    min-w-0
                    p-4
                    text-left
                    ${
                        hasDetail
                            ? "cursor-pointer transition hover:bg-slate-900/60"
                            : "cursor-default"
                    }
                `}
            >
                <div className="flex min-w-0 items-start justify-between gap-4">

                    <div className="min-w-0">

                        <div className="flex items-center gap-2">

                            <div className="text-sm font-medium text-slate-200">
                                {
                                    groupLabel(
                                        componentName
                                    )
                                }
                            </div>

                            {hasDetail && (
                                <span className="text-xs text-slate-600">
                                    {expanded
                                        ? "−"
                                        : "+"}
                                </span>
                            )}

                        </div>

                        <div className="mt-1 text-xs text-slate-600">
                            {
                                component.featuresAvailable
                            }{" "}
                            /{" "}
                            {
                                component.featuresRequired
                            }{" "}
                            features available
                        </div>

                    </div>

                    <div
                        className={`shrink-0 text-xl font-bold ${
                            available
                                ? scoreTextClass(
                                      component.similarity!
                                  )
                                : "text-slate-600"
                        }`}
                    >
                        {available
                            ? `${component.similarity!.toFixed(
                                  1
                              )}%`
                            : "N/A"}
                    </div>

                </div>

                {available && (
                    <div className="mt-3">
                        <SimilarityBar
                            value={
                                component.similarity!
                            }
                        />
                    </div>
                )}

                {hasDetail && (
                    <div className="mt-3 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">
                        {expanded
                            ? "Hide feature detail"
                            : "Show feature detail"}
                    </div>
                )}

            </button>

            {/* Expanded feature detail */}
            {expanded && hasDetail && (
                <div className="border-t border-slate-800 px-4 pb-4 pt-4">

                    <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                        Feature comparison
                    </div>

                    <div className="space-y-5">

                        {features.map(
                            feature => (
                                <FeatureComparison
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

                    {available &&
                        component.distance != null && (
                            <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-800 pt-4 min-[420px]:grid-cols-2">

                                <CalculationMetric
                                    label="RMS Distance"
                                    value={
                                        component.distance.toFixed(
                                            3
                                        )
                                    }
                                />

                                <CalculationMetric
                                    label="Mean Squared Difference"
                                    value={
                                        component.meanSquaredDifference !=
                                        null
                                            ? component.meanSquaredDifference.toFixed(
                                                  3
                                              )
                                            : "N/A"
                                    }
                                />

                            </div>
                        )}

                </div>
            )}

        </div>
    );
}

// ---------------------------------------------------------
// FEATURE COMPARISON
// ---------------------------------------------------------

function FeatureComparison({
    feature,
}: {
    feature: V3Feature;
}) {
    const hasValues =
        feature.targetRaw != null &&
        feature.comparableRaw != null;

    const hasStandardised =
        feature.targetStandardised != null &&
        feature.comparableStandardised != null;

    const featureSimilarity =
        hasStandardised
            ? Math.exp(
                  -Math.abs(
                      feature.comparableStandardised! -
                          feature.targetStandardised!
                  )
              ) * 100
            : null;

    return (
        <div className="min-w-0">

            <div className="flex min-w-0 items-start justify-between gap-3">

                <div className="min-w-0">

                    <div className="text-xs font-medium text-slate-300">
                        {feature.label}
                    </div>

                    <div className="mt-0.5 text-[11px] leading-4 text-slate-600">
                        {feature.description}
                    </div>

                </div>

                {featureSimilarity != null && (
                    <div
                        className={`shrink-0 text-sm font-semibold ${scoreTextClass(
                            featureSimilarity
                        )}`}
                    >
                        {featureSimilarity.toFixed(
                            1
                        )}
                        %
                    </div>
                )}

            </div>

            {hasValues ? (
                <div className="mt-3">

                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">

                        <FeatureValue
                            value={
                                feature.targetRaw!
                            }
                            align="left"
                        />

                        <div className="text-[10px] uppercase tracking-wide text-slate-700">
                            vs
                        </div>

                        <FeatureValue
                            value={
                                feature.comparableRaw!
                            }
                            align="right"
                        />

                    </div>

                    {hasStandardised && (
                        <StandardisedScale
                            target={
                                feature.targetStandardised!
                            }
                            comparable={
                                feature.comparableStandardised!
                            }
                        />
                    )}

                    {featureSimilarity != null && (
                        <div className="mt-3">

                            <div className="mb-1 flex items-center justify-between gap-3 text-[10px] text-slate-600">

                                <span>
                                    Feature similarity
                                </span>

                                <span>
                                    {featureSimilarity.toFixed(
                                        1
                                    )}
                                    %
                                </span>

                            </div>

                            <SimilarityBar
                                value={
                                    featureSimilarity
                                }
                            />

                        </div>
                    )}

                    {feature.distanceContributionPct !=
                        null && (
                        <div className="mt-2 text-[10px] text-slate-600">
                            Share of component difference:{" "}
                            {feature.distanceContributionPct.toFixed(
                                1
                            )}
                            %
                        </div>
                    )}

                </div>
            ) : (
                <div className="mt-2 text-xs text-slate-600">
                    Feature not available for both players.
                </div>
            )}

        </div>
    );
}

function FeatureValue({
    value,
    align,
}: {
    value: number;
    align: "left" | "right";
}) {
    return (
        <div
            className={
                align === "left"
                    ? "text-left"
                    : "text-right"
            }
        >
            <div className="text-sm font-semibold text-slate-200">
                {
                    formatFeatureValue(
                        value
                    )
                }
            </div>
        </div>
    );
}

function StandardisedScale({
    target,
    comparable,
}: {
    target: number;
    comparable: number;
}) {
    const MIN_Z =
        -3;

    const MAX_Z =
        3;

    function position(
        value: number
    ) {
        const clamped =
            Math.max(
                MIN_Z,
                Math.min(
                    MAX_Z,
                    value
                )
            );

        return (
            ((clamped -
                MIN_Z) /
                (MAX_Z -
                    MIN_Z)) *
            100
        );
    }

    const targetPosition =
        position(
            target
        );

    const comparablePosition =
        position(
            comparable
        );

    return (
        <div className="mt-3">

            <div className="relative h-5">

                <div className="absolute left-0 right-0 top-2 h-px bg-slate-700" />

                <div className="absolute left-1/2 top-0 h-4 w-px bg-slate-600" />

                <div
                    className="absolute top-0 h-4 w-1 -translate-x-1/2 rounded-full bg-white"
                    style={{
                        left:
                            `${targetPosition}%`,
                    }}
                    title={`Target z-score: ${target.toFixed(
                        2
                    )}`}
                />

                <div
                    className="absolute top-1 h-3 w-1 -translate-x-1/2 rounded-full bg-slate-400"
                    style={{
                        left:
                            `${comparablePosition}%`,
                    }}
                    title={`Comparable z-score: ${comparable.toFixed(
                        2
                    )}`}
                />

            </div>

            <div className="flex justify-between text-[9px] text-slate-700">
                <span>
                    -3σ
                </span>

                <span>
                    Population average
                </span>

                <span>
                    +3σ
                </span>
            </div>

            <div className="mt-1 flex justify-between gap-3 text-[10px] text-slate-600">

                <span>
                    Target z{" "}
                    {
                        target.toFixed(
                            2
                        )
                    }
                </span>

                <span className="text-right">
                    Comparable z{" "}
                    {
                        comparable.toFixed(
                            2
                        )
                    }
                </span>

            </div>

        </div>
    );
}

// ---------------------------------------------------------
// TRAJECTORY PERIOD
// ---------------------------------------------------------

function TrajectoryPeriodCard({
    period,
}: {
    period: V3TrajectoryPeriod;
}) {
    const metrics =
        trajectoryMetrics(
            period
        );

    const components =
        period.components ?? [];

    return (
        <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/30 p-4">

            <div className="flex min-w-0 items-start justify-between gap-4">

                <div>
                    <div className="text-sm font-medium text-slate-200">
                        {
                            periodLabel(
                                period.period
                            )
                        }
                    </div>

                    <div className="mt-1 text-xs text-slate-600">
                        Development similarity
                    </div>
                </div>

                <div
                    className={`shrink-0 text-xl font-bold ${
                        period.similarity !=
                        null
                            ? scoreTextClass(
                                  period.similarity
                              )
                            : "text-slate-600"
                    }`}
                >
                    {period.similarity !=
                    null
                        ? `${period.similarity.toFixed(
                              1
                          )}%`
                        : "N/A"}
                </div>

            </div>

            {period.similarity !=
                null && (
                <div className="mt-3">
                    <SimilarityBar
                        value={
                            period.similarity
                        }
                    />
                </div>
            )}

            {metrics.length >
                0 && (
                <div className="mt-4 space-y-2 border-t border-slate-800 pt-3">

                    {metrics.map(
                        metric => (
                            <div
                                key={
                                    metric.label
                                }
                                className="flex items-center justify-between gap-3"
                            >
                                <span className="text-xs text-slate-500">
                                    {
                                        metric.label
                                    }
                                </span>

                                <span
                                    className={`text-sm font-semibold ${scoreTextClass(
                                        metric.value
                                    )}`}
                                >
                                    {
                                        metric.value.toFixed(
                                            1
                                        )
                                    }
                                    %
                                </span>
                            </div>
                        )
                    )}

                </div>
            )}

            {components.length >
                0 && (
                <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">

                    {components.map(
                        (
                            component,
                            index
                        ) => (
                            <ComponentCard
                                key={
                                    component.component ??
                                    component.group ??
                                    index
                                }
                                component={
                                    component
                                }
                            />
                        )
                    )}

                </div>
            )}

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
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">

            <PlayerHeadshot
                player={
                    player
                }
            />

            <div className="min-w-0">

                <div className="truncate text-sm font-semibold text-white sm:text-base">
                    {
                        player.comparable_player
                    }
                </div>

                <div className="mt-0.5 text-xs text-slate-500">
                    {
                        player.comparable_position
                    }
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
    const [
        imageError,
        setImageError,
    ] =
        useState(false);

    const showImage =
        player.headshot_url &&
        !imageError;

    return (
        <div
            className="
                relative
                h-12 w-12
                shrink-0
                overflow-hidden
                rounded-full
                border border-slate-700
                bg-slate-800
                sm:h-14 sm:w-14
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
                        setImageError(
                            true
                        )
                    }
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-300">
                    {
                        initials(
                            player.comparable_player
                        )
                    }
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
        <div className="min-w-0">

            <div className="text-xl font-bold text-white">
                {
                    value.toFixed(
                        1
                    )
                }
                %
            </div>

            <div className="mt-1">
                <SimilarityBar
                    value={
                        value
                    }
                    large
                />
            </div>

            <div
                className={`mt-1 text-xs font-medium ${scoreTextClass(
                    value
                )}`}
            >
                {
                    matchLabel(
                        value
                    )
                }
            </div>

        </div>
    );
}

// ---------------------------------------------------------
// MODEL SCORE
// ---------------------------------------------------------

function SimilarityMetric({
    value,
    active,
    onClick,
}: {
    value: number | null;
    active: boolean;
    onClick: () => void;
}) {
    const available =
        value != null;

    return (
        <button
            type="button"
            onClick={
                available
                    ? onClick
                    : undefined
            }
            disabled={
                !available
            }
            className={`
                min-w-0
                rounded-lg
                px-2 py-2
                text-left
                transition
                ${
                    active
                        ? "bg-slate-800/80 ring-1 ring-slate-600"
                        : available
                        ? "hover:bg-slate-900"
                        : "cursor-default opacity-50"
                }
            `}
            title={
                available
                    ? "Click to explain this score"
                    : "Model not available"
            }
        >

            <div
                className={`text-sm font-semibold ${
                    available
                        ? scoreTextClass(
                              value
                          )
                        : "text-slate-600"
                }`}
            >
                {available
                    ? `${value.toFixed(
                          1
                      )}%`
                    : "N/A"}
            </div>

            {available && (
                <div className="mt-2">
                    <SimilarityBar
                        value={
                            value
                        }
                    />
                </div>
            )}

        </button>
    );
}

function MobileMetric({
    label,
    value,
    active,
    onClick,
}: {
    label: string;
    value: number | null;
    active: boolean;
    onClick: () => void;
}) {
    const available =
        value != null;

    return (
        <button
            type="button"
            onClick={
                available
                    ? onClick
                    : undefined
            }
            disabled={
                !available
            }
            className={`
                min-w-0
                rounded-lg
                border
                p-3
                text-left
                transition
                ${
                    active
                        ? "border-slate-600 bg-slate-800/70"
                        : available
                        ? "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                        : "cursor-default border-slate-800 bg-slate-900/20 opacity-50"
                }
            `}
        >

            <div className="truncate text-[10px] uppercase tracking-wide text-slate-500">
                {
                    label
                }
            </div>

            <div
                className={`mt-1 font-semibold ${
                    available
                        ? scoreTextClass(
                              value
                          )
                        : "text-slate-600"
                }`}
            >
                {available
                    ? `${value.toFixed(
                          1
                      )}%`
                    : "N/A"}
            </div>

            {available && (
                <div className="mt-2">
                    <SimilarityBar
                        value={
                            value
                        }
                    />
                </div>
            )}

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
                w-full
                min-w-0
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
// CALCULATION METRIC
// ---------------------------------------------------------

function CalculationMetric({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="min-w-0">

            <div className="text-[10px] uppercase tracking-wide text-slate-600">
                {
                    label
                }
            </div>

            <div className="mt-1 break-words text-lg font-semibold text-slate-200">
                {
                    value
                }
            </div>

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
        <div className="flex min-w-0 items-center gap-2">

            <div
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${className}`}
            />

            <span>
                {
                    label
                }
            </span>

        </div>
    );
}

// ---------------------------------------------------------
// LABEL HELPERS
// ---------------------------------------------------------

function modelLabel(
    model: ComparisonModel
) {
    switch (model) {
        case "playing_style":
            return "Playing Style";

        case "production":
            return "Production";

        case "effectiveness":
            return "Effectiveness";

        case "usage":
            return "Usage";

        case "trajectory":
            return "Trajectory";
    }
}

function modelDescription(
    model: ComparisonModel
) {
    switch (model) {
        case "playing_style":
            return "How similarly the players play, based on the statistical profile of their style of play.";

        case "production":
            return "How similar the players are in the results they produce.";

        case "effectiveness":
            return "How similarly effective the players are within the situations measured by the model.";

        case "usage":
            return "How similarly the players are deployed and used by their teams.";

        case "trajectory":
            return "How similarly the players' performance and roles have developed over recent seasons.";
    }
}

function groupLabel(
    group: string
) {
    const labels:
        Record<
            string,
            string
        > = {
        shot_location:
            "Shot Location",
        shot_volume:
            "Shot Volume",
        faceoffs:
            "Faceoffs",
        discipline:
            "Discipline",
        puck_management:
            "Puck Management",
        physical:
            "Physical",

        scoring:
            "Scoring",
        playmaking:
            "Playmaking",

        shooting:
            "Shooting Effectiveness",
        overall_effectiveness:
            "Overall Effectiveness",
        location_effectiveness:
            "Location Effectiveness",

        ice_time_role:
            "Ice Time / Role",
        shift_usage:
            "Shift Usage",
        faceoff_usage:
            "Faceoff Usage",

        deployment:
            "Deployment",
        workload:
            "Workload",

        production:
            "Production Development",
        performance:
            "Performance Development",
        effectiveness:
            "Effectiveness Development",
        role:
            "Role Development",
    };

    return (
        labels[group] ??
        titleCase(
            group
        )
    );
}

function periodLabel(
    period: string
) {
    if (
        period ===
        "recent"
    ) {
        return "Recent Trajectory";
    }

    if (
        period ===
        "previous"
    ) {
        return "Previous Trajectory";
    }

    return titleCase(
        period
    );
}

function trajectoryMetrics(
    period: V3TrajectoryPeriod
) {
    const metrics: {
        label: string;
        value: number;
    }[] = [];

    if (
        period.production !=
        null
    ) {
        metrics.push({
            label:
                "Production Development",
            value:
                period.production,
        });
    }

    if (
        period.performance !=
        null
    ) {
        metrics.push({
            label:
                "Performance Development",
            value:
                period.performance,
        });
    }

    if (
        period.effectiveness !=
        null
    ) {
        metrics.push({
            label:
                "Effectiveness Development",
            value:
                period.effectiveness,
        });
    }

    if (
        period.role !=
        null
    ) {
        metrics.push({
            label:
                "Role Development",
            value:
                period.role,
        });
    }

    return metrics;
}

function titleCase(
    value: string
) {
    return value
        .replace(
            /_/g,
            " "
        )
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );
}

function formatFeatureValue(
    value: number
) {
    const absolute =
        Math.abs(
            value
        );

    if (absolute >= 100) {
        return value.toFixed(
            1
        );
    }

    if (absolute >= 10) {
        return value.toFixed(
            2
        );
    }

    if (absolute >= 1) {
        return value.toFixed(
            3
        );
    }

    return value.toFixed(
        4
    );
}

// ---------------------------------------------------------
// PLAYER HELPERS
// ---------------------------------------------------------

function initials(
    name: string
) {
    return name
        .split(" ")
        .filter(Boolean)
        .map(
            part =>
                part[0]
        )
        .join("")
        .slice(
            0,
            2
        )
        .toUpperCase();
}