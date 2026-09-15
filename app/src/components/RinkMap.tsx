"use client";

export type RinkEvent = {
    normalisedX: number | null;
    normalisedY: number | null;
    eventType?: string | null;
    label?: string | null;
};

export type RinkZone = {
    key: string;
    label: string;
    value: number | null;
    benchmarkValue?: number | null;
    shots?: number;
    goals?: number;
    saves?: number;
};

export type RinkZoneOverlay = {
    zones: RinkZone[];
    metricLabel: string;
    type?: "shooting" | "goalie";
};

type RinkMapProps = {
    events: RinkEvent[];
    title?: string;
    height?: number;
    zoneOverlay?: RinkZoneOverlay | null;
};

type FaceoffLocation = {
    x: number;
    y: number;
    wins: number;
    losses: number;
};


export default function RinkMap({
    events,
    title,
    height,
    zoneOverlay = null,
}: RinkMapProps) {

    const rinkWidth = 200;
    const rinkHeight = 85;

    const validEvents = events.filter(
        event =>
            event.normalisedX != null
            && event.normalisedY != null
    );


    const eventTypes =
        new Set(
            validEvents
                .map(event => event.eventType)
                .filter((value): value is string => value != null)
        );


    const isFaceoffMap =
        validEvents.length > 0
        && [...eventTypes].every(
            type =>
                type === "win"
                || type === "loss"
        );


    const isPhysicalMap =
        eventTypes.has("hit-given")
        || eventTypes.has("hit-received")
        || eventTypes.has("takeaway")
        || eventTypes.has("giveaway");


    const isPenaltyMap =
        eventTypes.has("penalty-drawn")
        || eventTypes.has("penalty-committed");


    const isGoalieMap =
        zoneOverlay?.type === "goalie";


    function markerStyle(
        eventType?: string | null
    ) {
        switch (eventType) {
            case "goal":
                return {
                    fill: "#ef4444",
                    stroke: "#ffffff",
                    radius: 2.2,
                };

            case "shot-on-goal":
                return {
                    fill: "#3b82f6",
                    stroke: "#ffffff",
                    radius: 1.7,
                };

            case "blocked-shot":
                return {
                    fill: "#f59e0b",
                    stroke: "#ffffff",
                    radius: 1.6,
                };

            case "missed-shot":
                return {
                    fill: "#94a3b8",
                    stroke: "#ffffff",
                    radius: 1.6,
                };

            case "win":
            case "hit-given":
            case "takeaway":
            case "penalty-drawn":
                return {
                    fill: "#22c55e",
                    stroke: "#ffffff",
                    radius: 1.8,
                };

            case "loss":
            case "hit-received":
            case "giveaway":
            case "penalty-committed":
                return {
                    fill: "#ef4444",
                    stroke: "#ffffff",
                    radius: 1.8,
                };

            default:
                return {
                    fill: "#64748b",
                    stroke: "#ffffff",
                    radius: 1.6,
                };
        }
    }


    const faceoffLocations =
        isFaceoffMap
            ? Array.from(
                validEvents.reduce(
                    (
                        map,
                        event
                    ) => {
                        const x =
                            Math.round(
                                event.normalisedX as number
                            );

                        const y =
                            Math.round(
                                event.normalisedY as number
                            );

                        const key =
                            `${x}:${y}`;

                        const existing =
                            map.get(key)
                            ?? {
                                x,
                                y,
                                wins: 0,
                                losses: 0,
                            };

                        if (
                            event.eventType === "win"
                        ) {
                            existing.wins += 1;
                        }

                        if (
                            event.eventType === "loss"
                        ) {
                            existing.losses += 1;
                        }

                        map.set(
                            key,
                            existing
                        );

                        return map;
                    },
                    new Map<string, FaceoffLocation>()
                ).values()
            )
            : [];


    const zonePositions = [
        {
            key: "far_right",
            x: 37,
            y: -26,
        },
        {
            key: "far_centre",
            x: 37,
            y: 0,
        },
        {
            key: "far_left",
            x: 37,
            y: 26,
        },

        {
            key: "medium_right",
            x: 60,
            y: -26,
        },
        {
            key: "medium_centre",
            x: 55,
            y: 0,
        },
        {
            key: "medium_left",
            x: 60,
            y: 26,
        },

        {
            key: "close_right",
            x: 80,
            y: -15,
        },
        {
            key: "close_centre",
            x: 78,
            y: 0,
        },
        {
            key: "close_left",
            x: 80,
            y: 15,
        },
    ];


    return (
        <div className="w-full min-w-0 max-w-full">

            {title && (
                <div className="mb-3 flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">

                    <div className="text-sm font-semibold text-slate-200">
                        {title}
                    </div>

                    {zoneOverlay && (
                        <div className="text-xs text-slate-500">
                            Zones: {zoneOverlay.metricLabel}
                        </div>
                    )}

                </div>
            )}


            <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950">

                <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-800 px-3 py-2 text-[10px] font-medium uppercase tracking-wide sm:px-5 sm:text-xs">

                    <div className="min-w-0 text-slate-500">
                        ← Defensive Zone
                    </div>

                    <div className="min-w-0 text-right text-slate-400">
                        Offensive Zone →
                    </div>

                </div>


                <div
                    className={
                        height == null
                            ? "h-[180px] min-[420px]:h-[210px] sm:h-[280px] md:h-[340px] lg:h-[420px]"
                            : undefined
                    }
                    style={
                        height != null
                            ? {
                                height,
                            }
                            : undefined
                    }
                >
                    <svg
                        viewBox="-102 -44.5 204 89"
                        className="block h-full w-full"
                        preserveAspectRatio="xMidYMid meet"
                    >

                        {/* Ice */}
                        <rect
                            x={-100}
                            y={-42.5}
                            width={rinkWidth}
                            height={rinkHeight}
                            rx={14}
                            fill="#f8fafc"
                            stroke="#64748b"
                            strokeWidth={1}
                        />


                        {/* Centre red line */}
                        <line
                            x1={0}
                            y1={-42.5}
                            x2={0}
                            y2={42.5}
                            stroke="#ef4444"
                            strokeWidth={0.8}
                        />


                        {/* Blue lines */}
                        <line
                            x1={-25}
                            y1={-42.5}
                            x2={-25}
                            y2={42.5}
                            stroke="#2563eb"
                            strokeWidth={1}
                        />

                        <line
                            x1={25}
                            y1={-42.5}
                            x2={25}
                            y2={42.5}
                            stroke="#2563eb"
                            strokeWidth={1}
                        />


                        {/* Goal lines */}
                        <line
                            x1={-89}
                            y1={-37}
                            x2={-89}
                            y2={37}
                            stroke="#ef4444"
                            strokeWidth={0.6}
                        />

                        <line
                            x1={89}
                            y1={-37}
                            x2={89}
                            y2={37}
                            stroke="#ef4444"
                            strokeWidth={0.6}
                        />


                        {/* Centre circle */}
                        <circle
                            cx={0}
                            cy={0}
                            r={15}
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth={0.6}
                        />

                        <circle
                            cx={0}
                            cy={0}
                            r={1}
                            fill="#2563eb"
                        />


                        {/* Offensive faceoff circles */}
                        <circle
                            cx={69}
                            cy={22}
                            r={15}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth={0.6}
                        />

                        <circle
                            cx={69}
                            cy={-22}
                            r={15}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth={0.6}
                        />


                        {/* Defensive faceoff circles */}
                        <circle
                            cx={-69}
                            cy={22}
                            r={15}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth={0.6}
                        />

                        <circle
                            cx={-69}
                            cy={-22}
                            r={15}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth={0.6}
                        />


                        {/* End-zone faceoff dots */}
                        {[
                            [-69, -22],
                            [-69, 22],
                            [69, -22],
                            [69, 22],
                        ].map(
                            ([x, y]) => (
                                <circle
                                    key={`${x}-${y}`}
                                    cx={x}
                                    cy={y}
                                    r={1}
                                    fill="#ef4444"
                                />
                            )
                        )}


                        {/* Neutral-zone faceoff dots */}
                        {[
                            [-20, -22],
                            [-20, 22],
                            [20, -22],
                            [20, 22],
                        ].map(
                            ([x, y]) => (
                                <circle
                                    key={`${x}-${y}`}
                                    cx={x}
                                    cy={y}
                                    r={1}
                                    fill="#ef4444"
                                />
                            )
                        )}


                        {/* Goals */}
                        <path
                            d="M -89 -3 L -92 -3 L -92 3 L -89 3"
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth={0.8}
                        />

                        <path
                            d="M 89 -3 L 92 -3 L 92 3 L 89 3"
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth={0.8}
                        />


                        {/* Zone boundaries */}
                        {zoneOverlay && (
                            <g>

                                {/* Close / Medium */}
                                <circle
                                    cx={89}
                                    cy={0}
                                    r={20}
                                    fill="none"
                                    stroke="#334155"
                                    strokeWidth={0.65}
                                    strokeDasharray="2 2"
                                    opacity={0.8}
                                />

                                {/* Medium / Far */}
                                <circle
                                    cx={89}
                                    cy={0}
                                    r={40}
                                    fill="none"
                                    stroke="#334155"
                                    strokeWidth={0.65}
                                    strokeDasharray="2 2"
                                    opacity={0.8}
                                />

                                {/* Right / Centre */}
                                <line
                                    x1={-100}
                                    y1={-10}
                                    x2={100}
                                    y2={-10}
                                    stroke="#334155"
                                    strokeWidth={0.65}
                                    strokeDasharray="2 2"
                                    opacity={0.8}
                                />

                                {/* Centre / Left */}
                                <line
                                    x1={-100}
                                    y1={10}
                                    x2={100}
                                    y2={10}
                                    stroke="#334155"
                                    strokeWidth={0.65}
                                    strokeDasharray="2 2"
                                    opacity={0.8}
                                />

                            </g>
                        )}


                        {/* Standard event markers */}
                        {!isFaceoffMap
                        && !isGoalieMap
                        && validEvents.map(
                            (
                                event,
                                index
                            ) => {
                                const style =
                                    markerStyle(
                                        event.eventType
                                    );

                                return (
                                    <circle
                                        key={index}
                                        cx={event.normalisedX as number}
                                        cy={event.normalisedY as number}
                                        r={style.radius}
                                        fill={style.fill}
                                        stroke={style.stroke}
                                        strokeWidth={0.35}
                                        opacity={0.78}
                                    >
                                        <title>
                                            {event.label
                                                ?? event.eventType
                                                ?? "Event"}
                                        </title>
                                    </circle>
                                );
                            }
                        )}


                        {/* Faceoff win/loss donuts */}
                        {isFaceoffMap && faceoffLocations.map(
                            location => {
                                const total =
                                    location.wins
                                    + location.losses;

                                const winPct =
                                    total > 0
                                        ? location.wins
                                            / total
                                        : 0;

                                const radius =
                                    5;

                                const circumference =
                                    2
                                    * Math.PI
                                    * radius;

                                const winLength =
                                    circumference
                                    * winPct;

                                return (
                                    <g
                                        key={
                                            `${location.x}-${location.y}`
                                        }
                                    >

                                        <title>
                                            {`Faceoffs: ${total}
Wins: ${location.wins}
Losses: ${location.losses}
Win %: ${(
    winPct
    * 100
).toFixed(1)}%`}
                                        </title>


                                        {/* White backing */}
                                        <circle
                                            cx={location.x}
                                            cy={location.y}
                                            r={6.1}
                                            fill="#f8fafc"
                                            stroke="#334155"
                                            strokeWidth={0.4}
                                        />


                                        {/* Loss ring */}
                                        <circle
                                            cx={location.x}
                                            cy={location.y}
                                            r={5}
                                            fill="none"
                                            stroke="#ef4444"
                                            strokeWidth={3}
                                        />


                                        {/* Win ring */}
                                        {winLength > 0 && (
                                            <circle
                                                cx={location.x}
                                                cy={location.y}
                                                r={5}
                                                fill="none"
                                                stroke="#22c55e"
                                                strokeWidth={3}
                                                strokeDasharray={`${winLength} ${circumference - winLength}`}
                                                strokeLinecap="butt"
                                                transform={`rotate(-90 ${location.x} ${location.y})`}
                                            />
                                        )}


                                        {/* Centre */}
                                        <circle
                                            cx={location.x}
                                            cy={location.y}
                                            r={3.25}
                                            fill="#0f172a"
                                        />


                                        <text
                                            x={location.x}
                                            y={location.y + 0.9}
                                            textAnchor="middle"
                                            fontSize={3}
                                            fontWeight={700}
                                            fill="#ffffff"
                                            pointerEvents="none"
                                        >
                                            {`${(
                                                winPct
                                                * 100
                                            ).toFixed(0)}%`}
                                        </text>

                                    </g>
                                );
                            }
                        )}


                        {/* Zone values */}
                        {zoneOverlay && zonePositions.map(
                            position => {
                                const zone =
                                    zoneOverlay.zones.find(
                                        item =>
                                            item.key
                                            === position.key
                                    );

                                if (!zone) {
                                    return null;
                                }

                                const shots =
                                    zone.shots
                                    ?? 0;

                                const goals =
                                    zone.goals
                                    ?? 0;

                                const saves =
                                    zone.saves
                                    ?? 0;

                                const benchmarkValue =
                                    zone.benchmarkValue
                                    ?? null;

                                const comparisonFill =
                                    zone.value != null
                                    && benchmarkValue != null
                                        ? zone.value > benchmarkValue
                                            ? "#14532d"
                                            : zone.value < benchmarkValue
                                              ? "#78350f"
                                              : "#0f172a"
                                        : "#0f172a";


                                /* Goalie save-profile donut */
                                if (isGoalieMap) {
                                    const savePct =
                                        shots > 0
                                            ? saves
                                                / shots
                                            : 0;

                                    const radius =
                                        5;

                                    const circumference =
                                        2
                                        * Math.PI
                                        * radius;

                                    const saveLength =
                                        circumference
                                        * savePct;

                                    return (
                                        <g
                                            key={
                                                position.key
                                            }
                                        >

                                            <title>
                                                {`${zone.label}
Shots Faced: ${shots}
Saves: ${saves}
Goals Allowed: ${goals}
Save %: ${(
    savePct
    * 100
).toFixed(1)}%${
    benchmarkValue != null
        ? `\nNHL Avg: ${(benchmarkValue * 100).toFixed(1)}%`
        : ""
}`}
                                            </title>


                                            {/* White backing */}
                                            <circle
                                                cx={position.x}
                                                cy={position.y}
                                                r={6.1}
                                                fill="#f8fafc"
                                                stroke="#334155"
                                                strokeWidth={0.4}
                                            />


                                            {/* Goals allowed ring */}
                                            <circle
                                                cx={position.x}
                                                cy={position.y}
                                                r={radius}
                                                fill="none"
                                                stroke="#ef4444"
                                                strokeWidth={3}
                                            />


                                            {/* Saves ring */}
                                            {saveLength > 0 && (
                                                <circle
                                                    cx={position.x}
                                                    cy={position.y}
                                                    r={radius}
                                                    fill="none"
                                                    stroke="#22c55e"
                                                    strokeWidth={3}
                                                    strokeDasharray={`${saveLength} ${circumference - saveLength}`}
                                                    strokeLinecap="butt"
                                                    transform={`rotate(-90 ${position.x} ${position.y})`}
                                                />
                                            )}


                                            {/* Centre - performance vs NHL average */}
                                            <circle
                                                cx={position.x}
                                                cy={position.y}
                                                r={3.25}
                                                fill={comparisonFill}
                                            />


                                            <text
                                                x={position.x}
                                                y={position.y + 0.9}
                                                textAnchor="middle"
                                                fontSize={2.8}
                                                fontWeight={700}
                                                fill="#ffffff"
                                                pointerEvents="none"
                                            >
                                                {shots > 0
                                                    ? `${(
                                                        savePct
                                                        * 100
                                                    ).toFixed(0)}%`
                                                    : "—"}
                                            </text>

                                        </g>
                                    );
                                }


                                /* Skater shooting badge */
                                const shootingPct =
                                    shots > 0
                                        ? goals
                                            / shots
                                        : 0;

                                return (
                                    <g
                                        key={
                                            position.key
                                        }
                                    >

                                        <title>
                                            {`${zone.label}
Shot Attempts: ${shots}
Goals: ${goals}
Shooting %: ${(
    shootingPct
    * 100
).toFixed(1)}%${
    benchmarkValue != null
        ? `\nNHL Avg: ${(benchmarkValue * 100).toFixed(1)}%`
        : ""
}`}
                                        </title>


                                        <rect
                                            x={
                                                position.x
                                                - 8
                                            }
                                            y={
                                                position.y
                                                - 4
                                            }
                                            width={16}
                                            height={8}
                                            rx={2}
                                            fill={comparisonFill}
                                            stroke="#475569"
                                            strokeWidth={0.25}
                                            opacity={0.58}
                                        />


                                        <text
                                            x={position.x}
                                            y={
                                                position.y
                                                + 0.9
                                            }
                                            textAnchor="middle"
                                            fontSize={3.4}
                                            fontWeight={700}
                                            fill="#ffffff"
                                            pointerEvents="none"
                                        >
                                            {zone.value == null
                                                ? "—"
                                                : `${(
                                                    zone.value
                                                    * 100
                                                ).toFixed(1)}%`}
                                        </text>

                                    </g>
                                );
                            }
                        )}

                    </svg>
                </div>
            </div>


            {/* Shooting / goalie legend */}
            {!isFaceoffMap
            && !isPhysicalMap
            && !isPenaltyMap && (
                <div className="mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">

                    {isGoalieMap ? (
                        <>
                            <div className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
                                Save
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                                Goal Allowed
                            </div>

                            <div className="text-slate-500">
                                Centre value = save %
                            </div>

                            <div className="text-slate-500 sm:border-l sm:border-slate-700 sm:pl-4">
                                Centre colour = vs NHL goalie average
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
                                Non-Goal Shot
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                                Goal
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
                                Blocked
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-400" />
                                Missed
                            </div>

                            {zoneOverlay && (
                                <>
                                    <div className="text-slate-500 sm:border-l sm:border-slate-700 sm:pl-4">
                                        Zone values: {
                                            zoneOverlay.metricLabel
                                        }
                                    </div>

                                    <div className="text-slate-500">
                                        Zone colour = vs NHL position average
                                    </div>
                                </>
                            )}
                        </>
                    )}

                </div>
            )}


            {/* Faceoff legend */}
            {isFaceoffMap && (
                <div className="mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">

                    <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
                        Won
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                        Lost
                    </div>

                    <div className="text-slate-500">
                        Centre value = faceoff win %
                    </div>

                </div>
            )}


            {/* Physical / possession legend */}
            {isPhysicalMap && (
                <div className="mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">

                    {eventTypes.has("hit-given") && (
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
                            Hit Given
                        </div>
                    )}

                    {eventTypes.has("hit-received") && (
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                            Hit Received
                        </div>
                    )}

                    {eventTypes.has("takeaway") && (
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
                            Takeaway
                        </div>
                    )}

                    {eventTypes.has("giveaway") && (
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                            Giveaway
                        </div>
                    )}

                </div>
            )}


            {/* Penalty legend */}
            {isPenaltyMap && (
                <div className="mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">

                    <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
                        Penalty Drawn
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                        Penalty Committed
                    </div>

                </div>
            )}

        </div>
    );
}