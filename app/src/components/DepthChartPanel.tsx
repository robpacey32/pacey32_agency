"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";

export type DepthChartPlayer = {
    team_code: string;
    team_name: string;

    player: string;
    playerId: number | null;
    headshot_url: string | null;

    position: string | null;
    depth_chart_position: string | null;
    depth_chart_line: number | null;

    leadership_role: string | null;
    sweater_number: number | null;
    age: number | null;

    cap_hit: number | null;
    term: number | null;
    total_value: number | null;

    expiry_status: string | null;
    expiry_year: number | null;

    agent: string | null;

    is_depth_chart: boolean;
    depth_group: string;
    position_sort: number;
    group_sort: number;
};

export type DepthChartData = {
    team: string;
    teamName: string | null;

    summary: {
        forwards: number;
        defence: number;
        goalies: number;
        nhlRoster: number;
        organisationalDepth: number;
        totalContracts: number;
    };

    forwards: DepthChartPlayer[];
    defence: DepthChartPlayer[];
    goalies: DepthChartPlayer[];
    organisationalDepth: DepthChartPlayer[];
};

type PositionCode =
    | "G"
    | "LD"
    | "RD"
    | "LW"
    | "C"
    | "RW";

const forwardPositions: PositionCode[] = [
    "LW",
    "C",
    "RW",
];

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

function primaryPosition(
    player: DepthChartPlayer
): string | null {
    if (
        player.is_depth_chart &&
        player.depth_chart_position
    ) {
        return player.depth_chart_position;
    }

    if (!player.position) {
        return null;
    }

    return player.position
        .split(",")[0]
        .trim()
        .toUpperCase();
}

function depthLabel(
    player: DepthChartPlayer
) {
    if (
        !player.is_depth_chart ||
        player.depth_chart_line == null
    ) {
        return null;
    }

    if (
        player.depth_chart_position === "LW" ||
        player.depth_chart_position === "C" ||
        player.depth_chart_position === "RW"
    ) {
        return `L${player.depth_chart_line}`;
    }

    if (
        player.depth_chart_position === "LD" ||
        player.depth_chart_position === "RD"
    ) {
        return `P${player.depth_chart_line}`;
    }

    if (player.depth_chart_position === "G") {
        return `G${player.depth_chart_line}`;
    }

    return null;
}

function leadershipLabel(
    leadershipRole?: string | null
) {
    if (!leadershipRole) return null;

    return leadershipRole === "Captain"
        ? "C"
        : "A";
}

function capHitColour(
    player: DepthChartPlayer,
    minRosterCap: number,
    maxRosterCap: number
) {
    if (player.cap_hit == null) {
        return "text-slate-400";
    }

    if (!player.is_depth_chart) {
        return "text-blue-400";
    }

    if (maxRosterCap === minRosterCap) {
        return "text-amber-400";
    }

    const ratio =
        (player.cap_hit - minRosterCap) /
        (maxRosterCap - minRosterCap);

    if (ratio >= 0.8) {
        return "text-red-400";
    }

    if (ratio >= 0.6) {
        return "text-orange-400";
    }

    if (ratio >= 0.4) {
        return "text-amber-400";
    }

    if (ratio >= 0.2) {
        return "text-lime-400";
    }

    return "text-green-400";
}

function expiryColour(
    expiryYear?: number | null
) {
    const currentYear =
        new Date().getFullYear();

    if (expiryYear === currentYear) {
        return "text-red-300";
    }

    return "text-slate-300";
}

function PlayerCard({
    player,
    minRosterCap,
    maxRosterCap,
}: {
    player: DepthChartPlayer;
    minRosterCap: number;
    maxRosterCap: number;
}) {
    const label = depthLabel(player);

    return (
        <div
            className={`overflow-hidden rounded-xl border bg-slate-950/65 ${
                player.is_depth_chart
                    ? "border-slate-700"
                    : "border-slate-800"
            }`}
        >
            <div className="p-3">
                <div className="flex items-start gap-3">
                    {player.headshot_url ? (
                        <img
                            src={player.headshot_url}
                            alt={player.player}
                            className="h-12 w-12 shrink-0 rounded-full bg-slate-800 object-cover object-top"
                        />
                    ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-500">
                            <UserRound size={21} />
                        </div>
                    )}

                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <p className="truncate text-sm font-semibold text-white">
                                        {player.player}
                                    </p>

                                    {leadershipLabel(
                                        player.leadership_role
                                    ) && (
                                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
                                            {leadershipLabel(
                                                player.leadership_role
                                            )}
                                        </span>
                                    )}
                                </div>

                                <p className="mt-0.5 text-xs text-slate-500">
                                    {player.sweater_number
                                        ? `#${player.sweater_number}`
                                        : "#"}
                                    {" · "}
                                    {player.position || "—"}
                                </p>
                            </div>

                            {label && (
                                <span className="shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-bold text-slate-400">
                                    {label}
                                </span>
                            )}
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-800 pt-2 text-xs">
                            <div>
                                <p className="text-slate-500">
                                    Cap
                                </p>

                                <p
                                    className={`mt-0.5 font-semibold ${capHitColour(
                                        player,
                                        minRosterCap,
                                        maxRosterCap
                                    )}`}
                                >
                                    {money(
                                        player.cap_hit
                                    )}
                                </p>
                            </div>

                            <div>
                                <p className="text-slate-500">
                                    Expiry
                                </p>

                                <p
                                    className={`mt-0.5 font-semibold ${expiryColour(
                                        player.expiry_year
                                    )}`}
                                >
                                    {player.expiry_status ||
                                        "—"}{" "}
                                    {player.expiry_year ||
                                        ""}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Divider() {
    return (
        <div className="py-1">
            <div className="border-t border-slate-600/70" />
        </div>
    );
}

function PositionColumn({
    position,
    rosterPlayers,
    depthPlayers,
    showDepth,
    minRosterCap,
    maxRosterCap,
}: {
    position: PositionCode;
    rosterPlayers: DepthChartPlayer[];
    depthPlayers: DepthChartPlayer[];
    showDepth: boolean;
    minRosterCap: number;
    maxRosterCap: number;
}) {
    const visibleCount =
        rosterPlayers.length +
        (showDepth
            ? depthPlayers.length
            : 0);

    return (
        <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white">
                    {position}
                </h3>

                <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-400">
                    {visibleCount}
                </span>
            </div>

            <div className="mt-4 space-y-3">
                {rosterPlayers.map(
                    (player) => (
                        <PlayerCard
                            key={`${player.player}-${player.playerId ?? "na"}-roster`}
                            player={player}
                            minRosterCap={
                                minRosterCap
                            }
                            maxRosterCap={
                                maxRosterCap
                            }
                        />
                    )
                )}

                {showDepth &&
                    rosterPlayers.length >
                        0 &&
                    depthPlayers.length >
                        0 && (
                        <Divider />
                    )}

                {showDepth &&
                    depthPlayers.map(
                        (player) => (
                            <PlayerCard
                                key={`${player.player}-${player.playerId ?? "na"}-depth`}
                                player={
                                    player
                                }
                                minRosterCap={
                                    minRosterCap
                                }
                                maxRosterCap={
                                    maxRosterCap
                                }
                            />
                        )
                    )}
            </div>
        </section>
    );
}

function DefenceArea({
    rosterLD,
    rosterRD,
    rosterD,
    depthLD,
    depthRD,
    depthD,
    showDepth,
    minRosterCap,
    maxRosterCap,
}: {
    rosterLD: DepthChartPlayer[];
    rosterRD: DepthChartPlayer[];
    rosterD: DepthChartPlayer[];
    depthLD: DepthChartPlayer[];
    depthRD: DepthChartPlayer[];
    depthD: DepthChartPlayer[];
    showDepth: boolean;
    minRosterCap: number;
    maxRosterCap: number;
}) {
    const maxRosterRows = Math.max(
        rosterLD.length,
        rosterRD.length
    );

    const maxDepthRows = Math.max(
        depthLD.length,
        depthRD.length
    );

    const hasRosterPlayers =
        rosterLD.length > 0 ||
        rosterRD.length > 0 ||
        rosterD.length > 0;

    const hasDepthPlayers =
        depthLD.length > 0 ||
        depthRD.length > 0 ||
        depthD.length > 0;

    return (
        <section className="col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="grid grid-cols-2 gap-4 border-b border-slate-800 pb-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">
                        LD
                    </h3>

                    <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-400">
                        {rosterLD.length +
                            (showDepth
                                ? depthLD.length
                                : 0)}
                    </span>
                </div>

                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">
                        RD
                    </h3>

                    <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-400">
                        {rosterRD.length +
                            (showDepth
                                ? depthRD.length
                                : 0)}
                    </span>
                </div>
            </div>

            <div className="mt-4 space-y-3">
                {Array.from({
                    length: maxRosterRows,
                }).map((_, index) => (
                    <div
                        key={`roster-row-${index}`}
                        className="grid grid-cols-2 gap-4"
                    >
                        <div>
                            {rosterLD[index] && (
                                <PlayerCard
                                    player={
                                        rosterLD[
                                            index
                                        ]
                                    }
                                    minRosterCap={
                                        minRosterCap
                                    }
                                    maxRosterCap={
                                        maxRosterCap
                                    }
                                />
                            )}
                        </div>

                        <div>
                            {rosterRD[index] && (
                                <PlayerCard
                                    player={
                                        rosterRD[
                                            index
                                        ]
                                    }
                                    minRosterCap={
                                        minRosterCap
                                    }
                                    maxRosterCap={
                                        maxRosterCap
                                    }
                                />
                            )}
                        </div>
                    </div>
                ))}

                {rosterD.length > 0 && (
                    <div className="space-y-3 px-[20%]">
                        {rosterD.map(
                            (player) => (
                                <PlayerCard
                                    key={`${player.player}-${player.playerId ?? "na"}-roster-d`}
                                    player={
                                        player
                                    }
                                    minRosterCap={
                                        minRosterCap
                                    }
                                    maxRosterCap={
                                        maxRosterCap
                                    }
                                />
                            )
                        )}
                    </div>
                )}

                {showDepth &&
                    hasRosterPlayers &&
                    hasDepthPlayers && (
                        <div className="grid grid-cols-2 gap-4 py-1">
                            <div className="border-t border-slate-600/70" />
                            <div className="border-t border-slate-600/70" />
                        </div>
                    )}

                {showDepth &&
                    Array.from({
                        length: maxDepthRows,
                    }).map(
                        (_, index) => (
                            <div
                                key={`depth-row-${index}`}
                                className="grid grid-cols-2 gap-4"
                            >
                                <div>
                                    {depthLD[
                                        index
                                    ] && (
                                        <PlayerCard
                                            player={
                                                depthLD[
                                                    index
                                                ]
                                            }
                                            minRosterCap={
                                                minRosterCap
                                            }
                                            maxRosterCap={
                                                maxRosterCap
                                            }
                                        />
                                    )}
                                </div>

                                <div>
                                    {depthRD[
                                        index
                                    ] && (
                                        <PlayerCard
                                            player={
                                                depthRD[
                                                    index
                                                ]
                                            }
                                            minRosterCap={
                                                minRosterCap
                                            }
                                            maxRosterCap={
                                                maxRosterCap
                                            }
                                        />
                                    )}
                                </div>
                            </div>
                        )
                    )}

                {showDepth &&
                    depthD.length > 0 && (
                        <div className="space-y-3 px-[20%]">
                            {depthD.map(
                                (player) => (
                                    <PlayerCard
                                        key={`${player.player}-${player.playerId ?? "na"}-depth-d`}
                                        player={
                                            player
                                        }
                                        minRosterCap={
                                            minRosterCap
                                        }
                                        maxRosterCap={
                                            maxRosterCap
                                        }
                                    />
                                )
                            )}
                        </div>
                    )}
            </div>
        </section>
    );
}

export default function DepthChartPanel({
    data,
}: {
    data: DepthChartData;
}) {
    const [showDepth, setShowDepth] =
        useState(true);

    const allPlayers = [
        ...data.forwards,
        ...data.defence,
        ...data.goalies,
        ...data.organisationalDepth,
    ];

    const rosterPlayers =
        allPlayers.filter(
            (player) =>
                player.is_depth_chart
        );

    const depthPlayers =
        allPlayers.filter(
            (player) =>
                !player.is_depth_chart
        );

    const rosterCapHits =
        rosterPlayers
            .map(
                (player) =>
                    player.cap_hit
            )
            .filter(
                (value): value is number =>
                    value != null
            );

    const minRosterCap =
        rosterCapHits.length > 0
            ? Math.min(...rosterCapHits)
            : 0;

    const maxRosterCap =
        rosterCapHits.length > 0
            ? Math.max(...rosterCapHits)
            : 0;

    const rosterByPosition = (
        position: string
    ) =>
        rosterPlayers
            .filter(
                (player) =>
                    primaryPosition(
                        player
                    ) === position
            )
            .sort(
                (a, b) =>
                    (a.depth_chart_line ??
                        99) -
                    (b.depth_chart_line ??
                        99)
            );

    const depthByPosition = (
        position: string
    ) =>
        depthPlayers
            .filter(
                (player) =>
                    primaryPosition(
                        player
                    ) === position
            )
            .sort(
                (a, b) =>
                    (b.cap_hit ?? 0) -
                    (a.cap_hit ?? 0)
            );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-end">
                <label className="flex cursor-pointer items-center gap-3">
                    <span className="text-sm font-medium text-slate-400">
                        Show organisational depth
                    </span>

                    <input
                        type="checkbox"
                        checked={showDepth}
                        onChange={(event) =>
                            setShowDepth(
                                event.target
                                    .checked
                            )
                        }
                        className="peer sr-only"
                    />

                    <div className="relative h-6 w-11 rounded-full bg-slate-700 transition-colors peer-checked:bg-blue-600 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-500">
                        <div
                            className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-200 ${
                                showDepth
                                    ? "left-6"
                                    : "left-1"
                            }`}
                        />
                    </div>
                </label>
            </div>

            <div className="overflow-x-auto">
                <div className="grid min-w-[1650px] grid-cols-6 gap-4">
                    <PositionColumn
                        position="G"
                        rosterPlayers={rosterByPosition(
                            "G"
                        )}
                        depthPlayers={depthByPosition(
                            "G"
                        )}
                        showDepth={
                            showDepth
                        }
                        minRosterCap={
                            minRosterCap
                        }
                        maxRosterCap={
                            maxRosterCap
                        }
                    />

                    <DefenceArea
                        rosterLD={rosterByPosition(
                            "LD"
                        )}
                        rosterRD={rosterByPosition(
                            "RD"
                        )}
                        rosterD={rosterByPosition(
                            "D"
                        )}
                        depthLD={depthByPosition(
                            "LD"
                        )}
                        depthRD={depthByPosition(
                            "RD"
                        )}
                        depthD={depthByPosition(
                            "D"
                        )}
                        showDepth={
                            showDepth
                        }
                        minRosterCap={
                            minRosterCap
                        }
                        maxRosterCap={
                            maxRosterCap
                        }
                    />

                    {forwardPositions.map(
                        (position) => (
                            <PositionColumn
                                key={
                                    position
                                }
                                position={
                                    position
                                }
                                rosterPlayers={rosterByPosition(
                                    position
                                )}
                                depthPlayers={depthByPosition(
                                    position
                                )}
                                showDepth={
                                    showDepth
                                }
                                minRosterCap={
                                    minRosterCap
                                }
                                maxRosterCap={
                                    maxRosterCap
                                }
                            />
                        )
                    )}
                </div>
            </div>
        </div>
    );
}