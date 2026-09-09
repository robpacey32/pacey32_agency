"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RinkMap, { RinkEvent } from "@/components/RinkMap";


type ShotEvent = {
    gameID: string | null;
    game_date: string | null;
    season: number | null;
    SeasonPart: string | null;
    period: string | null;
    eventType: string | null;
    eventOwnerTeamCode: string | null;
    normalisedX: number | null;
    normalisedY: number | null;
    shotType: string | null;
};

type FaceoffEvent = {
    gameID: string | null;
    game_date: string | null;
    season: number | null;
    SeasonPart: string | null;
    period: string | null;
    winningPlayer: string | null;
    losingPlayer: string | null;
    result: "win" | "loss";
    normalisedX: number | null;
    normalisedY: number | null;
};

type PhysicalEvent = {
    gameID: string | null;
    game_date: string | null;
    season: number | null;
    SeasonPart: string | null;
    period: string | null;
    eventType: string | null;
    playerId: string | null;
    hittingPlayerId: string | null;
    hitteePlayerId: string | null;
    playerRole:
        | "hit-given"
        | "hit-received"
        | "takeaway"
        | "giveaway"
        | null;
    normalisedX: number | null;
    normalisedY: number | null;
};

type PenaltyEvent = {
    gameID: string | null;
    game_date: string | null;
    season: number | null;
    SeasonPart: string | null;
    period: string | null;
    eventType: string | null;
    reason: string | null;
    duration: string | null;
    playerRole: "committed" | "drawn";
    normalisedX: number | null;
    normalisedY: number | null;
};

type PerformanceRow = {
    playerId: string;
    player: string | null;
    season: number;
    seasonPart: string | null;
    games_played: number | null;
    toi_minutes: number | null;
    [key: string]: string | number | null;
};

type BenchmarkRow = {
    season: number;
    seasonPart: string | null;
    benchmark_group: string;
    zone_key: string;
    shots: number | null;
    goals: number | null;
    saves: number | null;
    shooting_pct: number | null;
    save_pct: number | null;
};

export type SkaterEventMappingData = {
    playerId: string;
    position: string | null;
    playerType: "skater";
    benchmarkGroup: string | null;
    seasons: number[];
    benchmarks: BenchmarkRow[];
    performance: PerformanceRow[];
    shots: ShotEvent[];
    faceoffs: FaceoffEvent[];
    physicalEvents: PhysicalEvent[];
    penalties: PenaltyEvent[];
};

type Props = {
    data: SkaterEventMappingData;
};

type Tab =
    | "shooting"
    | "faceoffs"
    | "physical"
    | "penalties";

type SeasonPart =
    | "RegularSeason"
    | "Playoffs";

type ZoneMetric =
    | "shotShare"
    | "goalShare"
    | "shootingPct";


const ZONES = [
    { key: "close_left", label: "Close Left" },
    { key: "close_centre", label: "Close Centre" },
    { key: "close_right", label: "Close Right" },
    { key: "medium_left", label: "Medium Left" },
    { key: "medium_centre", label: "Medium Centre" },
    { key: "medium_right", label: "Medium Right" },
    { key: "far_left", label: "Far Left" },
    { key: "far_centre", label: "Far Centre" },
    { key: "far_right", label: "Far Right" },
];


function formatSeason(
    season: number | null
) {
    if (!season) {
        return "";
    }

    const value = String(season);

    if (value.length !== 8) {
        return value;
    }

    return `${value.slice(0, 4)}-${value.slice(6, 8)}`;
}


function StatCard({
    label,
    value,
    detail,
}: {
    label: string;
    value: string | number;
    detail?: string;
}) {
    return (
        <div className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">
                {label}
            </div>

            <div className="mt-1 text-xl font-semibold text-slate-100">
                {value}
            </div>

            {detail && (
                <div className="mt-1 text-xs text-slate-500">
                    {detail}
                </div>
            )}
        </div>
    );
}


function numberValue(
    value: string | number | null | undefined
) {
    if (
        value == null
        || value === ""
    ) {
        return 0;
    }

    const result = Number(value);

    return Number.isFinite(result)
        ? result
        : 0;
}


function formatDifference(
    playerValue: number | null,
    benchmarkValue: number | null
) {
    if (
        playerValue == null
        || benchmarkValue == null
    ) {
        return "—";
    }

    const difference =
        (playerValue - benchmarkValue)
        * 100;

    return `${difference >= 0 ? "+" : ""}${difference.toFixed(1)}pp`;
}


export default function SkaterEventMapping({
    data,
}: Props) {
    const [tab, setTab] =
        useState<Tab>("shooting");

    const [seasonPart, setSeasonPart] =
        useState<SeasonPart>("RegularSeason");

    const [selectedSeasons, setSelectedSeasons] =
        useState<number[]>(
            data.seasons.length > 0
                ? [data.seasons[0]]
                : []
        );

    const [seasonMenuOpen, setSeasonMenuOpen] =
        useState(false);

    const seasonMenuRef =
        useRef<HTMLDivElement>(null);

    const [showShotsOnGoal, setShowShotsOnGoal] =
        useState(true);

    const [showGoals, setShowGoals] =
        useState(true);

    const [showMisses, setShowMisses] =
        useState(false);

    const [showBlocks, setShowBlocks] =
        useState(false);

    const [showShootingZones, setShowShootingZones] =
        useState(false);

    const [zoneMetric, setZoneMetric] =
        useState<ZoneMetric>("shotShare");


    useEffect(() => {
        setSelectedSeasons(
            data.seasons.length > 0
                ? [data.seasons[0]]
                : []
        );
    }, [
        data.playerId,
        data.seasons,
    ]);


    useEffect(() => {
        function handleClickOutside(
            event: MouseEvent
        ) {
            if (
                seasonMenuRef.current
                && !seasonMenuRef.current.contains(event.target as Node)
            ) {
                setSeasonMenuOpen(false);
            }
        }

        document.addEventListener(
            "mousedown",
            handleClickOutside
        );

        return () => {
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );
        };
    }, []);


    function toggleSeason(
        season: number
    ) {
        setSelectedSeasons(
            current => {
                if (
                    current.includes(season)
                ) {
                    if (
                        current.length === 1
                    ) {
                        return current;
                    }

                    return current.filter(
                        value =>
                            value !== season
                    );
                }

                return [
                    ...current,
                    season,
                ].sort(
                    (a, b) =>
                        b - a
                );
            }
        );
    }


    function inSelectedPeriod(
        event: {
            season: number | null;
            SeasonPart: string | null;
        }
    ) {
        return (
            event.season != null
            && selectedSeasons.includes(event.season)
            && event.SeasonPart === seasonPart
        );
    }


    const selectedPerformance =
        useMemo(() => {
            return data.performance.filter(
                row =>
                    selectedSeasons.includes(
                        Number(row.season)
                    )
                    && row.seasonPart === seasonPart
            );
        }, [
            data.performance,
            selectedSeasons,
            seasonPart,
        ]);


    const gamesPlayed =
        useMemo(() => {
            return selectedPerformance.reduce(
                (total, row) =>
                    total
                    + numberValue(
                        row.games_played
                    ),
                0
            );
        }, [
            selectedPerformance,
        ]);


    const toiMinutes =
        useMemo(() => {
            return selectedPerformance.reduce(
                (total, row) =>
                    total
                    + numberValue(
                        row.toi_minutes
                    ),
                0
            );
        }, [
            selectedPerformance,
        ]);


    const filteredShots =
        useMemo(() => {
            return data.shots.filter(
                shot => {
                    if (
                        !inSelectedPeriod(
                            shot
                        )
                    ) {
                        return false;
                    }

                    if (
                        shot.eventType === "shot-on-goal"
                    ) {
                        return showShotsOnGoal;
                    }

                    if (
                        shot.eventType === "goal"
                    ) {
                        return showGoals;
                    }

                    if (
                        shot.eventType === "missed-shot"
                    ) {
                        return showMisses;
                    }

                    if (
                        shot.eventType === "blocked-shot"
                    ) {
                        return showBlocks;
                    }

                    return false;
                }
            );
        }, [
            data.shots,
            selectedSeasons,
            seasonPart,
            showShotsOnGoal,
            showGoals,
            showMisses,
            showBlocks,
        ]);


    const allSelectedShots =
        useMemo(() => {
            return data.shots.filter(
                shot =>
                    inSelectedPeriod(
                        shot
                    )
            );
        }, [
            data.shots,
            selectedSeasons,
            seasonPart,
        ]);


    const shotSummary =
        useMemo(() => {
            const nonGoalShots =
                allSelectedShots.filter(
                    shot =>
                        shot.eventType === "shot-on-goal"
                ).length;

            const goals =
                allSelectedShots.filter(
                    shot =>
                        shot.eventType === "goal"
                ).length;

            const shots =
                nonGoalShots
                + goals;

            return {
                shots,
                goals,

                shootingPct:
                    shots > 0
                        ? goals / shots
                        : null,

                shotsPer60:
                    toiMinutes > 0
                        ? shots / toiMinutes * 60
                        : null,
            };
        }, [
            allSelectedShots,
            toiMinutes,
        ]);


    const selectedBenchmarks =
        useMemo(() => {
            return (data.benchmarks ?? []).filter(
                row =>
                    selectedSeasons.includes(
                        Number(row.season)
                    )
                    && row.seasonPart === seasonPart
            );
        }, [
            data.benchmarks,
            selectedSeasons,
            seasonPart,
        ]);


    const benchmarkZoneData =
        useMemo(() => {
            const counts =
                Object.fromEntries(
                    ZONES.map(
                        zone => [
                            zone.key,
                            {
                                shots: 0,
                                goals: 0,
                            },
                        ]
                    )
                ) as Record<
                    string,
                    {
                        shots: number;
                        goals: number;
                    }
                >;

            selectedBenchmarks.forEach(
                row => {
                    if (!counts[row.zone_key]) {
                        return;
                    }

                    counts[row.zone_key].shots +=
                        numberValue(
                            row.shots
                        );

                    counts[row.zone_key].goals +=
                        numberValue(
                            row.goals
                        );
                }
            );

            const totalShots =
                Object.values(
                    counts
                ).reduce(
                    (total, zone) =>
                        total + zone.shots,
                    0
                );

            const totalGoals =
                Object.values(
                    counts
                ).reduce(
                    (total, zone) =>
                        total + zone.goals,
                    0
                );

            return ZONES.map(
                zone => {
                    const values =
                        counts[zone.key];

                    let value:
                        number | null = null;

                    if (
                        zoneMetric === "shotShare"
                    ) {
                        value =
                            totalShots > 0
                                ? values.shots
                                    / totalShots
                                : null;
                    }

                    if (
                        zoneMetric === "goalShare"
                    ) {
                        value =
                            totalGoals > 0
                                ? values.goals
                                    / totalGoals
                                : null;
                    }

                    if (
                        zoneMetric === "shootingPct"
                    ) {
                        value =
                            values.shots > 0
                                ? values.goals
                                    / values.shots
                                : null;
                    }

                    return {
                        key:
                            zone.key,

                        value,

                        shots:
                            values.shots,

                        goals:
                            values.goals,
                    };
                }
            );
        }, [
            selectedBenchmarks,
            zoneMetric,
        ]);


    const zoneData =
        useMemo(() => {
            const counts =
                Object.fromEntries(
                    ZONES.map(
                        zone => [
                            zone.key,
                            {
                                shots: 0,
                                goals: 0,
                            },
                        ]
                    )
                ) as Record<
                    string,
                    {
                        shots: number;
                        goals: number;
                    }
                >;


            allSelectedShots.forEach(
                shot => {
                    if (
                        shot.normalisedX == null
                        || shot.normalisedY == null
                    ) {
                        return;
                    }

                    const distance =
                        Math.sqrt(
                            Math.pow(
                                89 - shot.normalisedX,
                                2
                            )
                            + Math.pow(
                                shot.normalisedY,
                                2
                            )
                        );

                    const distanceZone =
                        distance <= 20
                            ? "close"
                            : distance <= 40
                            ? "medium"
                            : "far";

                    const sideZone =
                        shot.normalisedY > 10
                            ? "left"
                            : shot.normalisedY < -10
                            ? "right"
                            : "centre";

                    const key =
                        `${distanceZone}_${sideZone}`;

                    counts[key].shots += 1;

                    if (
                        shot.eventType === "goal"
                    ) {
                        counts[key].goals += 1;
                    }
                }
            );


            const totalShots =
                Object.values(
                    counts
                ).reduce(
                    (total, zone) =>
                        total
                        + zone.shots,
                    0
                );

            const totalGoals =
                Object.values(
                    counts
                ).reduce(
                    (total, zone) =>
                        total
                        + zone.goals,
                    0
                );


            return ZONES.map(
                zone => {
                    const {
                        shots,
                        goals,
                    } =
                        counts[zone.key];

                    let value:
                        number | null = null;

                    if (
                        zoneMetric === "shotShare"
                    ) {
                        value =
                            totalShots > 0
                                ? shots
                                    / totalShots
                                : null;
                    }

                    if (
                        zoneMetric === "goalShare"
                    ) {
                        value =
                            totalGoals > 0
                                ? goals
                                    / totalGoals
                                : null;
                    }

                    if (
                        zoneMetric === "shootingPct"
                    ) {
                        value =
                            shots > 0
                                ? goals
                                    / shots
                                : null;
                    }

                    const benchmark =
                        benchmarkZoneData.find(
                            item =>
                                item.key === zone.key
                        );

                    return {
                        ...zone,
                        value,
                        shots,
                        goals,

                        benchmarkValue:
                            benchmark?.value
                            ?? null,

                        benchmarkShots:
                            benchmark?.shots
                            ?? 0,

                        benchmarkGoals:
                            benchmark?.goals
                            ?? 0,
                    };
                }
            );
        }, [
            allSelectedShots,
            zoneMetric,
            benchmarkZoneData,
        ]);


    const filteredFaceoffs =
        useMemo(() => {
            return data.faceoffs.filter(
                faceoff =>
                    inSelectedPeriod(
                        faceoff
                    )
            );
        }, [
            data.faceoffs,
            selectedSeasons,
            seasonPart,
        ]);


    const faceoffWins =
        filteredFaceoffs.filter(
            faceoff =>
                faceoff.result === "win"
        ).length;

    const faceoffPct =
        filteredFaceoffs.length > 0
            ? faceoffWins
                / filteredFaceoffs.length
            : null;


    const selectedPhysical =
        useMemo(() => {
            return data.physicalEvents.filter(
                event =>
                    inSelectedPeriod(
                        event
                    )
            );
        }, [
            data.physicalEvents,
            selectedSeasons,
            seasonPart,
        ]);


    const hitsGiven =
        selectedPhysical.filter(
            event =>
                event.playerRole === "hit-given"
        );

    const hitsReceived =
        selectedPhysical.filter(
            event =>
                event.playerRole === "hit-received"
        );

    const takeaways =
        selectedPhysical.filter(
            event =>
                event.playerRole === "takeaway"
        );

    const giveaways =
        selectedPhysical.filter(
            event =>
                event.playerRole === "giveaway"
        );


    const possessionStats =
        useMemo(() => {
            const takeawayCount =
                takeaways.length;

            const giveawayCount =
                giveaways.length;

            return {
                takeawayCount,

                giveawayCount,

                takeawaysPerGame:
                    gamesPlayed > 0
                        ? takeawayCount
                            / gamesPlayed
                        : null,

                giveawaysPerGame:
                    gamesPlayed > 0
                        ? giveawayCount
                            / gamesPlayed
                        : null,

                takeawaysPer60:
                    toiMinutes > 0
                        ? takeawayCount
                            / toiMinutes
                            * 60
                        : null,

                giveawaysPer60:
                    toiMinutes > 0
                        ? giveawayCount
                            / toiMinutes
                            * 60
                        : null,

                ratio:
                    giveawayCount > 0
                        ? takeawayCount
                            / giveawayCount
                        : null,
            };
        }, [
            takeaways.length,
            giveaways.length,
            gamesPlayed,
            toiMinutes,
        ]);


    const selectedPenalties =
        useMemo(() => {
            return data.penalties.filter(
                penalty =>
                    inSelectedPeriod(
                        penalty
                    )
            );
        }, [
            data.penalties,
            selectedSeasons,
            seasonPart,
        ]);


    const penaltiesDrawn =
        selectedPenalties.filter(
            penalty =>
                penalty.playerRole === "drawn"
        );

    const penaltiesCommitted =
        selectedPenalties.filter(
            penalty =>
                penalty.playerRole === "committed"
        );


    const penaltyStats =
        useMemo(() => {
            const drawn =
                penaltiesDrawn.length;

            const committed =
                penaltiesCommitted.length;

            return {
                drawn,

                committed,

                drawnPerGame:
                    gamesPlayed > 0
                        ? drawn / gamesPlayed
                        : null,

                committedPerGame:
                    gamesPlayed > 0
                        ? committed / gamesPlayed
                        : null,

                drawnPer60:
                    toiMinutes > 0
                        ? drawn
                            / toiMinutes
                            * 60
                        : null,

                committedPer60:
                    toiMinutes > 0
                        ? committed
                            / toiMinutes
                            * 60
                        : null,

                ratio:
                    committed > 0
                        ? drawn / committed
                        : null,
            };
        }, [
            penaltiesDrawn.length,
            penaltiesCommitted.length,
            gamesPlayed,
            toiMinutes,
        ]);


    const shootingRinkEvents: RinkEvent[] =
        useMemo(() => {
            return filteredShots.map(
                shot => ({
                    normalisedX:
                        shot.normalisedX,

                    normalisedY:
                        shot.normalisedY,

                    eventType:
                        shot.eventType,

                    label:
                        `${
                            shot.eventType ?? "Shot"
                        }${
                            shot.shotType
                                ? ` · ${shot.shotType}`
                                : ""
                        }${
                            shot.game_date
                                ? ` · ${shot.game_date}`
                                : ""
                        }`,
                })
            );
        }, [
            filteredShots,
        ]);


    const faceoffRinkEvents: RinkEvent[] =
        useMemo(() => {
            return filteredFaceoffs.map(
                faceoff => ({
                    normalisedX:
                        faceoff.normalisedX,

                    normalisedY:
                        faceoff.normalisedY,

                    eventType:
                        faceoff.result,

                    label:
                        `${
                            faceoff.result === "win"
                                ? "Faceoff Win"
                                : "Faceoff Loss"
                        }${
                            faceoff.game_date
                                ? ` · ${faceoff.game_date}`
                                : ""
                        }`,
                })
            );
        }, [
            filteredFaceoffs,
        ]);


    const physicalRinkEvents: RinkEvent[] =
        useMemo(() => {
            return selectedPhysical.map(
                event => ({
                    normalisedX:
                        event.normalisedX,

                    normalisedY:
                        event.normalisedY,

                    eventType:
                        event.playerRole,

                    label:
                        `${
                            event.playerRole === "hit-given"
                                ? "Hit Given"
                                : event.playerRole === "hit-received"
                                  ? "Hit Received"
                                  : event.playerRole === "takeaway"
                                    ? "Takeaway"
                                    : "Giveaway"
                        }${
                            event.game_date
                                ? ` · ${event.game_date}`
                                : ""
                        }`,
                })
            );
        }, [
            selectedPhysical,
        ]);


    const penaltyRinkEvents: RinkEvent[] =
        useMemo(() => {
            return selectedPenalties.map(
                penalty => ({
                    normalisedX:
                        penalty.normalisedX,

                    normalisedY:
                        penalty.normalisedY,

                    eventType:
                        penalty.playerRole === "drawn"
                            ? "penalty-drawn"
                            : "penalty-committed",

                    label:
                        `${
                            penalty.playerRole === "drawn"
                                ? "Penalty Drawn"
                                : "Penalty Committed"
                        }${
                            penalty.reason
                                ? ` · ${penalty.reason}`
                                : ""
                        }${
                            penalty.game_date
                                ? ` · ${penalty.game_date}`
                                : ""
                        }`,
                })
            );
        }, [
            selectedPenalties,
        ]);


    const benchmarkLabel =
        data.benchmarkGroup === "Defence"
            ? "NHL Defence Avg"
            : "NHL Forward Avg";


    return (
        <div className="space-y-5">

            {/* Main tabs */}
            <div className="flex flex-wrap gap-2">
                {[
                    ["shooting", "Shooting"],
                    ["faceoffs", "Faceoffs"],
                    ["physical", "Physical & Possession"],
                    ["penalties", "Penalties"],
                ].map(
                    ([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setTab(value as Tab)}
                            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                tab === value
                                    ? "border-slate-500 bg-slate-700 text-white"
                                    : "border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800"
                            }`}
                        >
                            {label}
                        </button>
                    )
                )}
            </div>


            {/* Global filters */}
            <div className="flex flex-wrap items-center gap-3 border-y border-slate-800 py-3">

                <div
                    ref={seasonMenuRef}
                    className="relative"
                >
                    <button
                        type="button"
                        onClick={() =>
                            setSeasonMenuOpen(
                                value => !value
                            )
                        }
                        className="flex min-w-[180px] items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200"
                    >
                        <span>
                            {selectedSeasons.length === data.seasons.length
                                ? "All 3 Seasons"
                                : selectedSeasons.length === 1
                                  ? formatSeason(selectedSeasons[0])
                                  : `${selectedSeasons.length} Seasons`}
                        </span>

                        <span className="text-slate-500">
                            ▾
                        </span>
                    </button>

                    {seasonMenuOpen && (
                        <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-2xl">

                            <div className="mb-2 flex gap-2 border-b border-slate-800 pb-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setSelectedSeasons(
                                            [...data.seasons]
                                        )
                                    }
                                    className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
                                >
                                    Select All
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setSelectedSeasons(
                                            data.seasons.length > 0
                                                ? [data.seasons[0]]
                                                : []
                                        )
                                    }
                                    className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
                                >
                                    Latest Only
                                </button>
                            </div>

                            {data.seasons.map(
                                season => (
                                    <button
                                        key={season}
                                        type="button"
                                        onClick={() =>
                                            toggleSeason(
                                                season
                                            )
                                        }
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800"
                                    >
                                        <span
                                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                                                selectedSeasons.includes(season)
                                                    ? "border-slate-400 bg-slate-700 text-white"
                                                    : "border-slate-600"
                                            }`}
                                        >
                                            {selectedSeasons.includes(season)
                                                ? "✓"
                                                : ""}
                                        </span>

                                        {formatSeason(
                                            season
                                        )}
                                    </button>
                                )
                            )}
                        </div>
                    )}
                </div>


                <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-1">
                    <button
                        type="button"
                        onClick={() =>
                            setSeasonPart("RegularSeason")
                        }
                        className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                            seasonPart === "RegularSeason"
                                ? "bg-slate-700 text-white"
                                : "text-slate-400"
                        }`}
                    >
                        Regular Season
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setSeasonPart("Playoffs")
                        }
                        className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                            seasonPart === "Playoffs"
                                ? "bg-slate-700 text-white"
                                : "text-slate-400"
                        }`}
                    >
                        Playoffs
                    </button>
                </div>


                <div className="text-xs text-slate-500">
                    {gamesPlayed > 0
                        ? `${gamesPlayed} GP · ${toiMinutes.toFixed(0)} TOI`
                        : ""}
                </div>
            </div>


            {/* SHOOTING */}
            {tab === "shooting" && (
                <>
                    <div className="grid min-w-[620px] grid-cols-4 gap-3 overflow-x-auto">
                        <StatCard
                            label="Shots"
                            value={shotSummary.shots}
                        />

                        <StatCard
                            label="Goals"
                            value={shotSummary.goals}
                        />

                        <StatCard
                            label="Shooting %"
                            value={
                                shotSummary.shootingPct == null
                                    ? "—"
                                    : `${(
                                        shotSummary.shootingPct * 100
                                    ).toFixed(1)}%`
                            }
                        />

                        <StatCard
                            label="Shots / 60"
                            value={
                                shotSummary.shotsPer60 == null
                                    ? "—"
                                    : shotSummary.shotsPer60.toFixed(2)
                            }
                        />
                    </div>


                    <div className="flex flex-wrap gap-2">
                        {[
                            [
                                "Non-Goal Shots",
                                showShotsOnGoal,
                                setShowShotsOnGoal,
                            ],
                            [
                                "Goals",
                                showGoals,
                                setShowGoals,
                            ],
                            [
                                "Missed",
                                showMisses,
                                setShowMisses,
                            ],
                            [
                                "Blocked",
                                showBlocks,
                                setShowBlocks,
                            ],
                        ].map(
                            ([
                                label,
                                active,
                                setter,
                            ]) => (
                                <button
                                    key={label as string}
                                    type="button"
                                    onClick={() =>
                                        (setter as (value: boolean) => void)(
                                            !(active as boolean)
                                        )
                                    }
                                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                                        active
                                            ? "border-slate-500 bg-slate-700 text-white"
                                            : "border-slate-700 bg-slate-900 text-slate-500"
                                    }`}
                                >
                                    {active
                                        ? "✓ "
                                        : ""}
                                    {label as string}
                                </button>
                            )
                        )}

                        <button
                            type="button"
                            onClick={() =>
                                setShowShootingZones(
                                    value => !value
                                )
                            }
                            className={`rounded-lg border px-3 py-1.5 text-xs ${
                                showShootingZones
                                    ? "border-slate-500 bg-slate-700 text-white"
                                    : "border-slate-700 bg-slate-900 text-slate-500"
                            }`}
                        >
                            {showShootingZones
                                ? "✓ "
                                : ""}
                            Shooting Zones
                        </button>
                    </div>


                    {showShootingZones && (
                        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3">

                            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                Zone Metric
                            </div>

                            <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-1">
                                {[
                                    ["shotShare", "Shot Share"],
                                    ["goalShare", "Goal Share"],
                                    ["shootingPct", "Shooting %"],
                                ].map(
                                    ([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setZoneMetric(value as ZoneMetric)}
                                            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                                                zoneMetric === value
                                                    ? "bg-slate-700 text-white"
                                                    : "text-slate-400"
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    )}


                    <RinkMap
                        title="Shot Location"
                        events={shootingRinkEvents}
                        zoneOverlay={
                            showShootingZones
                                ? {
                                    zones: zoneData,
                                    metricLabel:
                                        zoneMetric === "shotShare"
                                            ? "Shot Share"
                                            : zoneMetric === "goalShare"
                                              ? "Goal Share"
                                              : "Shooting %",
                                }
                                : null
                        }
                    />


                    {showShootingZones && (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">

                            <div className="mb-4">
                                <div className="text-sm font-semibold text-slate-200">
                                    Shooting Zone Profile
                                </div>

                                <div className="mt-1 text-xs text-slate-500">
                                    Distribution and efficiency by attacking-zone location
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <div className="grid min-w-[720px] grid-cols-3 gap-3">
                                    {zoneData.map(
                                        zone => (
                                            <div
                                                key={zone.key}
                                                className="rounded-xl border border-slate-700 bg-slate-900/70 p-4"
                                            >
                                                <div className="text-xs uppercase tracking-wide text-slate-500">
                                                    {zone.label}
                                                </div>

                                                <div className="mt-2 text-2xl font-semibold text-slate-100">
                                                    {zone.value == null
                                                        ? "—"
                                                        : `${(
                                                            zone.value * 100
                                                        ).toFixed(1)}%`}
                                                </div>

                                                <div className="mt-3 border-t border-slate-800 pt-3">

                                                    <div className="flex items-center justify-between gap-3 text-xs">
                                                        <span className="text-slate-500">
                                                            {benchmarkLabel}
                                                        </span>

                                                        <span className="font-medium text-slate-300">
                                                            {zone.benchmarkValue == null
                                                                ? "—"
                                                                : `${(
                                                                    zone.benchmarkValue * 100
                                                                ).toFixed(1)}%`}
                                                        </span>
                                                    </div>

                                                    <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                                                        <span className="text-slate-500">
                                                            Difference
                                                        </span>

                                                        <span
                                                            className={
                                                                zone.value != null
                                                                && zone.benchmarkValue != null
                                                                && zone.value > zone.benchmarkValue
                                                                    ? "font-medium text-green-400"
                                                                    : zone.value != null
                                                                      && zone.benchmarkValue != null
                                                                      && zone.value < zone.benchmarkValue
                                                                        ? "font-medium text-red-400"
                                                                        : "font-medium text-slate-400"
                                                            }
                                                        >
                                                            {formatDifference(
                                                                zone.value,
                                                                zone.benchmarkValue
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div className="mt-2 text-xs text-slate-600">
                                                        {zone.goals} goals · {zone.shots} attempts
                                                    </div>

                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>

                        </div>
                    )}
                </>
            )}


            {/* FACEOFFS */}
            {tab === "faceoffs" && (
                <>
                    <div className="grid min-w-[460px] grid-cols-3 gap-3 overflow-x-auto">
                        <StatCard
                            label="Faceoffs"
                            value={filteredFaceoffs.length}
                        />

                        <StatCard
                            label="Wins"
                            value={faceoffWins}
                        />

                        <StatCard
                            label="Faceoff %"
                            value={
                                faceoffPct == null
                                    ? "—"
                                    : `${(
                                        faceoffPct * 100
                                    ).toFixed(1)}%`
                            }
                        />
                    </div>

                    <RinkMap
                        title="Faceoff Locations"
                        events={faceoffRinkEvents}
                    />
                </>
            )}


            {/* PHYSICAL & POSSESSION */}
            {tab === "physical" && (
                <>
                    <div>
                        <div className="mb-3 text-sm font-semibold text-slate-200">
                            Hits
                        </div>

                        <div className="grid min-w-[500px] grid-cols-2 gap-3 overflow-x-auto">
                            <StatCard
                                label="Hits Given"
                                value={hitsGiven.length}
                                detail="Green on rink"
                            />

                            <StatCard
                                label="Hits Received"
                                value={hitsReceived.length}
                                detail="Red on rink"
                            />
                        </div>
                    </div>


                    <div>
                        <div className="mb-3 text-sm font-semibold text-slate-200">
                            Possession
                        </div>

                        <div className="grid min-w-[900px] grid-cols-7 gap-3 overflow-x-auto">
                            <StatCard
                                label="Takeaways"
                                value={possessionStats.takeawayCount}
                            />

                            <StatCard
                                label="Giveaways"
                                value={possessionStats.giveawayCount}
                            />

                            <StatCard
                                label="TA / Game"
                                value={
                                    possessionStats.takeawaysPerGame == null
                                        ? "—"
                                        : possessionStats.takeawaysPerGame.toFixed(2)
                                }
                            />

                            <StatCard
                                label="GA / Game"
                                value={
                                    possessionStats.giveawaysPerGame == null
                                        ? "—"
                                        : possessionStats.giveawaysPerGame.toFixed(2)
                                }
                            />

                            <StatCard
                                label="TA / 60"
                                value={
                                    possessionStats.takeawaysPer60 == null
                                        ? "—"
                                        : possessionStats.takeawaysPer60.toFixed(2)
                                }
                            />

                            <StatCard
                                label="GA / 60"
                                value={
                                    possessionStats.giveawaysPer60 == null
                                        ? "—"
                                        : possessionStats.giveawaysPer60.toFixed(2)
                                }
                            />

                            <StatCard
                                label="TA:GA Ratio"
                                value={
                                    possessionStats.ratio == null
                                        ? "—"
                                        : possessionStats.ratio.toFixed(2)
                                }
                            />
                        </div>
                    </div>


                    <RinkMap
                        title="Physical & Possession Locations"
                        events={physicalRinkEvents}
                    />
                </>
            )}


            {/* PENALTIES */}
            {tab === "penalties" && (
                <>
                    <div className="grid min-w-[900px] grid-cols-7 gap-3 overflow-x-auto">
                        <StatCard
                            label="Drawn"
                            value={penaltyStats.drawn}
                        />

                        <StatCard
                            label="Committed"
                            value={penaltyStats.committed}
                        />

                        <StatCard
                            label="Drawn / Game"
                            value={
                                penaltyStats.drawnPerGame == null
                                    ? "—"
                                    : penaltyStats.drawnPerGame.toFixed(2)
                            }
                        />

                        <StatCard
                            label="Committed / Game"
                            value={
                                penaltyStats.committedPerGame == null
                                    ? "—"
                                    : penaltyStats.committedPerGame.toFixed(2)
                            }
                        />

                        <StatCard
                            label="Drawn / 60"
                            value={
                                penaltyStats.drawnPer60 == null
                                    ? "—"
                                    : penaltyStats.drawnPer60.toFixed(2)
                            }
                        />

                        <StatCard
                            label="Committed / 60"
                            value={
                                penaltyStats.committedPer60 == null
                                    ? "—"
                                    : penaltyStats.committedPer60.toFixed(2)
                            }
                        />

                        <StatCard
                            label="Drawn:Committed"
                            value={
                                penaltyStats.ratio == null
                                    ? "—"
                                    : penaltyStats.ratio.toFixed(2)
                            }
                        />
                    </div>


                    <RinkMap
                        title="Penalty Locations"
                        events={penaltyRinkEvents}
                    />
                </>
            )}

        </div>
    );
}