"use client";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import RinkMap, {
    RinkEvent,
} from "@/components/RinkMap";


type GoalieShotEvent = {
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

export type GoalieEventMappingData = {
    playerId: string;
    position: string | null;
    playerType: "goalie";
    benchmarkGroup: string | null;
    seasons: number[];
    benchmarks: BenchmarkRow[];
    shots: GoalieShotEvent[];

    summary: {
        shotsAgainst: number;
        saves: number;
        goalsAgainst: number;
        savePct: number | null;
        blockedAttempts: number;
        missedAttempts: number;
        totalAttempts: number;
    };
};

type Props = {
    data: GoalieEventMappingData;
};

type Tab =
    | "shotMap"
    | "saveProfile"
    | "shotTypes";

type SeasonPart =
    | "RegularSeason"
    | "Playoffs";


const ZONES = [
    {
        key: "close_left",
        label: "Close Left",
    },
    {
        key: "close_centre",
        label: "Close Centre",
    },
    {
        key: "close_right",
        label: "Close Right",
    },
    {
        key: "medium_left",
        label: "Medium Left",
    },
    {
        key: "medium_centre",
        label: "Medium Centre",
    },
    {
        key: "medium_right",
        label: "Medium Right",
    },
    {
        key: "far_left",
        label: "Far Left",
    },
    {
        key: "far_centre",
        label: "Far Centre",
    },
    {
        key: "far_right",
        label: "Far Right",
    },
];


function formatSeason(
    season: number | null
) {
    if (!season) {
        return "";
    }

    const value =
        String(season);

    if (
        value.length !== 8
    ) {
        return value;
    }

    return `${value.slice(
        0,
        4
    )}-${value.slice(
        6,
        8
    )}`;
}


function StatCard({
    label,
    value,
}: {
    label: string;
    value: string | number;
}) {
    return (
        <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-950/30 px-3 py-4 sm:px-4 sm:py-5">

            <p className="min-h-[2.5rem] break-words text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
                {label}
            </p>

            <p className="mt-2 whitespace-nowrap text-[clamp(1.25rem,5vw,1.875rem)] font-semibold leading-none text-white">
                {value}
            </p>

        </div>
    );
}


function numberValue(
    value: number | null | undefined
) {
    if (value == null) {
        return 0;
    }

    const result =
        Number(value);

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


function getDistanceBand(
    x: number,
    y: number
) {
    const distance =
        Math.sqrt(
            Math.pow(
                89 - x,
                2
            )
            + Math.pow(
                y,
                2
            )
        );

    if (
        distance <= 20
    ) {
        return "close";
    }

    if (
        distance <= 40
    ) {
        return "medium";
    }

    return "far";
}


function getSide(
    y: number
) {
    if (
        y > 10
    ) {
        return "left";
    }

    if (
        y < -10
    ) {
        return "right";
    }

    return "centre";
}


export default function GoalieEventMapping({
    data,
}: Props) {
    const [tab, setTab] =
        useState<Tab>("shotMap");

    const [seasonPart, setSeasonPart] =
        useState<SeasonPart>(
            "RegularSeason"
        );

    const [selectedSeasons, setSelectedSeasons] =
        useState<number[]>(
            data.seasons.length > 0
                ? [data.seasons[0]]
                : []
        );

    const [
        seasonMenuOpen,
        setSeasonMenuOpen,
    ] =
        useState(false);

    const seasonMenuRef =
        useRef<HTMLDivElement>(
            null
        );


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
                setSeasonMenuOpen(
                    false
                );
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
                    current.includes(
                        season
                    )
                ) {
                    if (
                        current.length
                        === 1
                    ) {
                        return current;
                    }

                    return current.filter(
                        value =>
                            value
                            !== season
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


    const filteredShots =
        useMemo(() => {
            return data.shots.filter(
                shot =>
                    shot.season != null
                    && selectedSeasons.includes(
                        shot.season
                    )
                    && shot.SeasonPart
                    === seasonPart
                    && (
                        shot.eventType
                        === "shot-on-goal"
                        || shot.eventType
                        === "goal"
                    )
            );
        }, [
            data.shots,
            selectedSeasons,
            seasonPart,
        ]);


    const saves =
        filteredShots.filter(
            shot =>
                shot.eventType
                === "shot-on-goal"
        ).length;


    const goalsAgainst =
        filteredShots.filter(
            shot =>
                shot.eventType
                === "goal"
        ).length;


    const shotsAgainst =
        saves
        + goalsAgainst;


    const savePct =
        shotsAgainst > 0
            ? saves
                / shotsAgainst
            : null;


    const rinkEvents: RinkEvent[] =
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
                            shot.eventType
                            === "goal"
                                ? "Goal Allowed"
                                : "Save"
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


    const zoneProfile =
        useMemo(() => {
            const zones =
                Object.fromEntries(
                    ZONES.map(
                        zone => [
                            zone.key,
                            {
                                shots: 0,
                                saves: 0,
                                goals: 0,
                            },
                        ]
                    )
                ) as Record<
                    string,
                    {
                        shots: number;
                        saves: number;
                        goals: number;
                    }
                >;


            filteredShots.forEach(
                shot => {
                    if (
                        shot.normalisedX == null
                        || shot.normalisedY == null
                    ) {
                        return;
                    }

                    const distance =
                        getDistanceBand(
                            shot.normalisedX,
                            shot.normalisedY
                        );

                    const side =
                        getSide(
                            shot.normalisedY
                        );

                    const key =
                        `${distance}_${side}`;

                    zones[
                        key
                    ].shots += 1;

                    if (
                        shot.eventType
                        === "shot-on-goal"
                    ) {
                        zones[
                            key
                        ].saves += 1;
                    }

                    if (
                        shot.eventType
                        === "goal"
                    ) {
                        zones[
                            key
                        ].goals += 1;
                    }
                }
            );

            return zones;
        }, [
            filteredShots,
        ]);


    const benchmarkZoneProfile =
        useMemo(() => {
            const zones =
                Object.fromEntries(
                    ZONES.map(
                        zone => [
                            zone.key,
                            {
                                shots: 0,
                                saves: 0,
                                goals: 0,
                            },
                        ]
                    )
                ) as Record<
                    string,
                    {
                        shots: number;
                        saves: number;
                        goals: number;
                    }
                >;

            (data.benchmarks ?? [])
                .filter(
                    row =>
                        selectedSeasons.includes(
                            Number(
                                row.season
                            )
                        )
                        && row.seasonPart
                        === seasonPart
                )
                .forEach(
                    row => {
                        if (
                            !zones[
                                row.zone_key
                            ]
                        ) {
                            return;
                        }

                        zones[
                            row.zone_key
                        ].shots +=
                            numberValue(
                                row.shots
                            );

                        zones[
                            row.zone_key
                        ].saves +=
                            numberValue(
                                row.saves
                            );

                        zones[
                            row.zone_key
                        ].goals +=
                            numberValue(
                                row.goals
                            );
                    }
                );

            return zones;
        }, [
            data.benchmarks,
            selectedSeasons,
            seasonPart,
        ]);


    const goalieZoneData =
        useMemo(() => {
            return ZONES.map(
                zone => {
                    const values =
                        zoneProfile[
                            zone.key
                        ];

                    const benchmark =
                        benchmarkZoneProfile[
                            zone.key
                        ];

                    return {
                        key:
                            zone.key,

                        label:
                            zone.label,

                        value:
                            values.shots > 0
                                ? values.saves
                                    / values.shots
                                : null,

                        shots:
                            values.shots,

                        saves:
                            values.saves,

                        goals:
                            values.goals,

                        benchmarkValue:
                            benchmark.shots > 0
                                ? benchmark.saves
                                    / benchmark.shots
                                : null,

                        benchmarkShots:
                            benchmark.shots,

                        benchmarkSaves:
                            benchmark.saves,

                        benchmarkGoals:
                            benchmark.goals,
                    };
                }
            );
        }, [
            zoneProfile,
            benchmarkZoneProfile,
        ]);


    const shotTypes =
        useMemo(() => {
            const grouped: Record<
                string,
                {
                    shots: number;
                    goals: number;
                    saves: number;
                }
            > = {};


            filteredShots.forEach(
                shot => {
                    const type =
                        shot.shotType
                        && shot.shotType
                        !== "n/a"
                            ? shot.shotType
                            : "Unknown";

                    if (
                        !grouped[
                            type
                        ]
                    ) {
                        grouped[
                            type
                        ] = {
                            shots: 0,
                            goals: 0,
                            saves: 0,
                        };
                    }

                    grouped[
                        type
                    ].shots += 1;

                    if (
                        shot.eventType
                        === "goal"
                    ) {
                        grouped[
                            type
                        ].goals += 1;
                    } else {
                        grouped[
                            type
                        ].saves += 1;
                    }
                }
            );


            return Object.entries(
                grouped
            )
                .map(
                    ([
                        type,
                        values,
                    ]) => ({
                        type,
                        ...values,

                        savePct:
                            values.shots > 0
                                ? values.saves
                                    / values.shots
                                : null,
                    })
                )
                .sort(
                    (a, b) =>
                        b.shots
                        - a.shots
                );
        }, [
            filteredShots,
        ]);


    return (
        <div className="w-full min-w-0 max-w-full space-y-5">

            {/* Tabs */}
            <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap">

                {[
                    [
                        "shotMap",
                        "Shot Map",
                    ],
                    [
                        "saveProfile",
                        "Save Profile",
                    ],
                    [
                        "shotTypes",
                        "Shot Types",
                    ],
                ].map(
                    ([
                        value,
                        label,
                    ]) => (
                        <button
                            key={
                                value
                            }
                            type="button"
                            onClick={() => setTab(value as Tab)}
                            className={`min-w-0 rounded-lg border px-2 py-2 text-xs font-medium transition sm:px-3 sm:text-sm ${
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
            <div className="flex min-w-0 flex-col gap-3 border-y border-slate-800 py-3 sm:flex-row sm:flex-wrap sm:items-center">

                <div
                    ref={
                        seasonMenuRef
                    }
                    className="relative w-full sm:w-auto"
                >
                    <button
                        type="button"
                        onClick={() =>
                            setSeasonMenuOpen(
                                value =>
                                    !value
                            )
                        }
                        className="flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 sm:w-auto sm:min-w-[180px]"
                    >

                        <span>
                            {selectedSeasons.length
                            === data.seasons.length
                                ? "All 3 Seasons"
                                : selectedSeasons.length
                                  === 1
                                    ? formatSeason(
                                        selectedSeasons[
                                            0
                                        ]
                                    )
                                    : `${selectedSeasons.length} Seasons`}
                        </span>

                        <span className="text-slate-500">
                            ▾
                        </span>

                    </button>


                    {seasonMenuOpen && (
                        <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-2xl sm:w-56">

                            <div className="mb-2 flex gap-2 border-b border-slate-800 pb-2">

                                <button
                                    type="button"
                                    onClick={() =>
                                        setSelectedSeasons(
                                            [
                                                ...data.seasons,
                                            ]
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
                                            data.seasons.length
                                            > 0
                                                ? [
                                                    data.seasons[
                                                        0
                                                    ],
                                                ]
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
                                        key={
                                            season
                                        }
                                        type="button"
                                        onClick={() =>
                                            toggleSeason(
                                                season
                                            )
                                        }
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800"
                                    >

                                        <span
                                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                                selectedSeasons.includes(
                                                    season
                                                )
                                                    ? "border-slate-400 bg-slate-700 text-white"
                                                    : "border-slate-600"
                                            }`}
                                        >
                                            {selectedSeasons.includes(
                                                season
                                            )
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


                <div className="grid w-full grid-cols-2 rounded-lg border border-slate-700 bg-slate-900 p-1 sm:flex sm:w-auto">

                    <button
                        type="button"
                        onClick={() =>
                            setSeasonPart(
                                "RegularSeason"
                            )
                        }
                        className={`rounded-md px-2 py-1.5 text-xs font-medium sm:px-3 ${
                            seasonPart
                            === "RegularSeason"
                                ? "bg-slate-700 text-white"
                                : "text-slate-400"
                        }`}
                    >
                        Regular Season
                    </button>


                    <button
                        type="button"
                        onClick={() =>
                            setSeasonPart(
                                "Playoffs"
                            )
                        }
                        className={`rounded-md px-2 py-1.5 text-xs font-medium sm:px-3 ${
                            seasonPart
                            === "Playoffs"
                                ? "bg-slate-700 text-white"
                                : "text-slate-400"
                        }`}
                    >
                        Playoffs
                    </button>

                </div>

            </div>


            {/* KPIs */}
            <div className="grid w-full min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">

                <StatCard
                    label="Shots Against"
                    value={
                        shotsAgainst
                    }
                />

                <StatCard
                    label="Saves"
                    value={
                        saves
                    }
                />

                <StatCard
                    label="Goals Against"
                    value={
                        goalsAgainst
                    }
                />

                <StatCard
                    label="Save %"
                    value={
                        savePct == null
                            ? "—"
                            : `${(
                                savePct
                                * 100
                            ).toFixed(
                                1
                            )}%`
                    }
                />

            </div>


            {/* SHOT MAP */}
            {tab === "shotMap" && (
                <div className="w-full min-w-0 max-w-full">
                    <RinkMap
                        title="Shots Faced"
                        events={
                            rinkEvents
                        }
                    />
                </div>
            )}


            {/* SAVE PROFILE */}
            {tab === "saveProfile" && (
                <>
                    <div className="w-full min-w-0 max-w-full">
                        <RinkMap
                            title="Save Profile by Location"
                            events={
                                rinkEvents
                            }
                            zoneOverlay={{
                                zones:
                                    goalieZoneData,

                                metricLabel:
                                    "Save %",

                                type:
                                    "goalie",
                            }}
                        />
                    </div>


                    <div className="grid w-full min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">

                        {goalieZoneData.map(
                            zone => (
                                <div
                                    key={
                                        zone.key
                                    }
                                    className="min-w-0 rounded-xl border border-slate-700 bg-slate-900/70 p-4"
                                >

                                    <div className="text-xs uppercase tracking-wide text-slate-500">
                                        {zone.label}
                                    </div>

                                    <div className="mt-2 text-xl font-semibold text-slate-100 sm:text-2xl">
                                        {zone.value == null
                                            ? "—"
                                            : `${(
                                                zone.value
                                                * 100
                                            ).toFixed(
                                                1
                                            )}%`}
                                    </div>

                                    <div className="mt-1 text-xs text-slate-500">
                                        {zone.saves} saves / {zone.shots} shots
                                    </div>


                                    <div className="mt-3 border-t border-slate-800 pt-3">

                                        <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
                                            <span className="min-w-0 text-slate-500">
                                                NHL Goalie Avg
                                            </span>

                                            <span className="shrink-0 font-medium text-slate-300">
                                                {zone.benchmarkValue == null
                                                    ? "—"
                                                    : `${(
                                                        zone.benchmarkValue * 100
                                                    ).toFixed(1)}%`}
                                            </span>
                                        </div>


                                        <div className="mt-1 flex min-w-0 items-center justify-between gap-3 text-xs">

                                            <span className="text-slate-500">
                                                Difference
                                            </span>

                                            <span
                                                className={`shrink-0 ${
                                                    zone.value != null
                                                    && zone.benchmarkValue != null
                                                    && zone.value > zone.benchmarkValue
                                                        ? "font-medium text-green-400"
                                                        : zone.value != null
                                                          && zone.benchmarkValue != null
                                                          && zone.value < zone.benchmarkValue
                                                            ? "font-medium text-red-400"
                                                            : "font-medium text-slate-400"
                                                }`}
                                            >
                                                {formatDifference(
                                                    zone.value,
                                                    zone.benchmarkValue
                                                )}
                                            </span>

                                        </div>

                                    </div>

                                </div>
                            )
                        )}

                    </div>
                </>
            )}


            {/* SHOT TYPES */}
            {tab === "shotTypes" && (
                <>
                    {/* Mobile */}
                    <div className="space-y-3 sm:hidden">

                        {shotTypes.map(
                            row => (
                                <div
                                    key={
                                        row.type
                                    }
                                    className="min-w-0 rounded-xl border border-slate-700 bg-slate-950/40 p-4"
                                >

                                    <div className="mb-3 text-sm font-semibold capitalize text-slate-200">
                                        {row.type}
                                    </div>

                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">

                                        <ShotTypeMetric
                                            label="Shots"
                                            value={String(
                                                row.shots
                                            )}
                                        />

                                        <ShotTypeMetric
                                            label="Saves"
                                            value={String(
                                                row.saves
                                            )}
                                        />

                                        <ShotTypeMetric
                                            label="Goals"
                                            value={String(
                                                row.goals
                                            )}
                                        />

                                        <ShotTypeMetric
                                            label="Save %"
                                            value={
                                                row.savePct == null
                                                    ? "—"
                                                    : `${(
                                                        row.savePct
                                                        * 100
                                                    ).toFixed(
                                                        1
                                                    )}%`
                                            }
                                        />

                                    </div>

                                </div>
                            )
                        )}

                    </div>


                    {/* Tablet / desktop */}
                    <div className="hidden w-full min-w-0 overflow-hidden rounded-xl border border-slate-700 sm:block">

                        <table className="w-full table-fixed text-sm">

                            <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">

                                <tr>

                                    <th className="w-[36%] px-4 py-3">
                                        Shot Type
                                    </th>

                                    <th className="w-[16%] px-4 py-3 text-right">
                                        Shots
                                    </th>

                                    <th className="w-[16%] px-4 py-3 text-right">
                                        Saves
                                    </th>

                                    <th className="w-[16%] px-4 py-3 text-right">
                                        Goals
                                    </th>

                                    <th className="w-[16%] px-4 py-3 text-right">
                                        Save %
                                    </th>

                                </tr>

                            </thead>


                            <tbody className="divide-y divide-slate-800">

                                {shotTypes.map(
                                    row => (
                                        <tr
                                            key={
                                                row.type
                                            }
                                            className="bg-slate-950/40 text-slate-300"
                                        >

                                            <td className="break-words px-4 py-3 capitalize">
                                                {row.type}
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                {row.shots}
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                {row.saves}
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                {row.goals}
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                {row.savePct == null
                                                    ? "—"
                                                    : `${(
                                                        row.savePct
                                                        * 100
                                                    ).toFixed(
                                                        1
                                                    )}%`}
                                            </td>

                                        </tr>
                                    )
                                )}

                            </tbody>

                        </table>

                    </div>
                </>
            )}

        </div>
    );
}


function ShotTypeMetric({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="min-w-0">

            <div className="text-[11px] uppercase tracking-wide text-slate-500">
                {label}
            </div>

            <div className="mt-0.5 break-words text-sm font-semibold text-slate-200">
                {value}
            </div>

        </div>
    );
}