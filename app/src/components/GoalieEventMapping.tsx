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
        <div className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3">

            <div className="text-xs uppercase tracking-wide text-slate-500">
                {label}
            </div>

            <div className="mt-1 text-xl font-semibold text-slate-100">
                {value}
            </div>

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
        <div className="space-y-5">

            {/* Tabs */}
            <div className="flex flex-wrap gap-2">

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
                    ref={
                        seasonMenuRef
                    }
                    className="relative"
                >
                    <button
                        type="button"
                        onClick={() =>
                            setSeasonMenuOpen(
                                value =>
                                    !value
                            )
                        }
                        className="flex min-w-[180px] items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200"
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
                        <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-2xl">

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
                                            className={`flex h-4 w-4 items-center justify-center rounded border ${
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


                <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-1">

                    <button
                        type="button"
                        onClick={() =>
                            setSeasonPart(
                                "RegularSeason"
                            )
                        }
                        className={`rounded-md px-3 py-1.5 text-xs font-medium ${
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
                        className={`rounded-md px-3 py-1.5 text-xs font-medium ${
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
            <div className="grid min-w-[620px] grid-cols-4 gap-3 overflow-x-auto">

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
                <RinkMap
                    title="Shots Faced"
                    events={
                        rinkEvents
                    }
                />
            )}


            {/* SAVE PROFILE */}
            {tab === "saveProfile" && (
                <>
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


                    <div className="overflow-x-auto">

                        <div className="grid min-w-[720px] grid-cols-3 gap-3">

                            {goalieZoneData.map(
                                zone => (
                                    <div
                                        key={
                                            zone.key
                                        }
                                        className="rounded-xl border border-slate-700 bg-slate-900/70 p-4"
                                    >

                                        <div className="text-xs uppercase tracking-wide text-slate-500">
                                            {zone.label}
                                        </div>

                                        <div className="mt-2 text-2xl font-semibold text-slate-100">
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

                                            <div className="flex items-center justify-between gap-3 text-xs">
                                                <span className="text-slate-500">
                                                    NHL Goalie Avg
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

                                        </div>

                                    </div>
                                )
                            )}

                        </div>

                    </div>
                </>
            )}


            {/* SHOT TYPES */}
            {tab === "shotTypes" && (
                <div className="overflow-x-auto rounded-xl border border-slate-700">

                    <table className="min-w-[640px] w-full text-sm">

                        <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">

                            <tr>

                                <th className="px-4 py-3">
                                    Shot Type
                                </th>

                                <th className="px-4 py-3 text-right">
                                    Shots
                                </th>

                                <th className="px-4 py-3 text-right">
                                    Saves
                                </th>

                                <th className="px-4 py-3 text-right">
                                    Goals
                                </th>

                                <th className="px-4 py-3 text-right">
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

                                        <td className="px-4 py-3 capitalize">
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
            )}

        </div>
    );
}