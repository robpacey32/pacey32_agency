"use client";

import {
    useMemo,
    useState,
} from "react";

type Layer =
    | "NHL Source"
    | "Agency";

type Cadence =
    | "Daily"
    | "Weekly"
    | "Monthly"
    | "Quarterly"
    | "Seasonal"
    | "Annual"
    | "Manual";

type ScheduleItem = {
    name: string;
    layer: Layer;
    cadence: Cadence;
    description?: string;

    // UTC schedule information
    months?: number[];
    dayOfMonth?: number;
    dayOfWeek?: number;
    hour?: number;
    minute?: number;
};

type CalendarDay = {
    date: Date;
    dateKey: string;
    isToday: boolean;
    runs: ScheduleItem[];
};

const layers: Layer[] = [
    "NHL Source",
    "Agency",
];

const schedule: ScheduleItem[] = [
    // =========================================================
    // NHL SOURCE
    // =========================================================

    // ---------------------------------------------------------
    // DAILY
    // ---------------------------------------------------------

    {
        name: "Roster",
        layer: "NHL Source",
        cadence: "Daily",
        hour: 8,
        minute: 0,
    },
    {
        name: "PlayerLanding",
        layer: "NHL Source",
        cadence: "Daily",
        hour: 8,
        minute: 0,
    },
    {
        name: "Boxscore",
        layer: "NHL Source",
        cadence: "Daily",
        hour: 8,
        minute: 0,
    },
    {
        name: "GameAction",
        layer: "NHL Source",
        cadence: "Daily",
        hour: 8,
        minute: 0,
    },
    {
        name: "Standings",
        layer: "NHL Source",
        cadence: "Daily",
        hour: 8,
        minute: 0,
    },
    {
        name: "TeamSummary",
        layer: "NHL Source",
        cadence: "Daily",
        hour: 8,
        minute: 0,
    },
    {
        name: "Full NHL QA",
        layer: "NHL Source",
        cadence: "Daily",
        hour: 8,
        minute: 0,
    },

    // ---------------------------------------------------------
    // MONTHLY
    // ---------------------------------------------------------

    {
        name: "Schedule",
        layer: "NHL Source",
        cadence: "Monthly",
        dayOfMonth: 2,
        hour: 6,
        minute: 0,
    },

    // ---------------------------------------------------------
    // SEASONAL
    // ---------------------------------------------------------

    {
        name: "Playoffs",
        layer: "NHL Source",
        cadence: "Seasonal",
        months: [3, 4, 5, 6],
        dayOfWeek: 1,
        hour: 6,
        minute: 0,
        description: "Mondays, April–July",
    },

    // ---------------------------------------------------------
    // ANNUAL
    // ---------------------------------------------------------

    {
        name: "Team",
        layer: "NHL Source",
        cadence: "Annual",
        months: [8],
        dayOfMonth: 1,
        hour: 6,
        minute: 0,
    },

    // =========================================================
    // AGENCY
    // =========================================================

    // ---------------------------------------------------------
    // WEEKLY
    // ---------------------------------------------------------

    {
        name: "Cap",
        layer: "Agency",
        cadence: "Weekly",
        dayOfWeek: 1,
        hour: 6,
        minute: 30,
        description: "Local Mac",
    },
    {
        name: "Travel",
        layer: "Agency",
        cadence: "Weekly",
        dayOfWeek: 1,
        hour: 9,
        minute: 0,
        description: "Current season",
    },
    {
        name: "Full Agency QA",
        layer: "Agency",
        cadence: "Weekly",
        dayOfWeek: 1,
        hour: 12,
        minute: 0,
    },

    // ---------------------------------------------------------
    // MONTHLY
    // ---------------------------------------------------------

    {
        name: "Tax",
        layer: "Agency",
        cadence: "Monthly",
        dayOfMonth: 1,
        hour: 5,
        minute: 20,
    },
    {
        name: "Travel",
        layer: "Agency",
        cadence: "Monthly",
        dayOfMonth: 1,
        hour: 10,
        minute: 0,
        description: "5-year history",
    },
    {
        name: "Organisation",
        layer: "Agency",
        cadence: "Monthly",
        dayOfMonth: 2,
        hour: 7,
        minute: 0,
        description: "Organisation detail",
    },
    {
        name: "Player",
        layer: "Agency",
        cadence: "Monthly",
        dayOfMonth: 3,
        hour: 7,
        minute: 0,
        description: "Birthplaces",
    },

    // ---------------------------------------------------------
    // QUARTERLY
    // ---------------------------------------------------------

    {
        name: "Cost of Living",
        layer: "Agency",
        cadence: "Quarterly",
        months: [0, 3, 6, 9],
        dayOfMonth: 1,
        hour: 7,
        minute: 0,
    },
    {
        name: "Geo POIs",
        layer: "Agency",
        cadence: "Quarterly",
        months: [0, 3, 6, 9],
        dayOfMonth: 1,
        hour: 8,
        minute: 0,
    },

    // ---------------------------------------------------------
    // ANNUAL
    // ---------------------------------------------------------

    {
        name: "Tax Brackets",
        layer: "Agency",
        cadence: "Annual",
        months: [0],
        dayOfMonth: 1,
        hour: 6,
        minute: 0,
        description: "GitHub",
    },
    {
        name: "City Reference",
        layer: "Agency",
        cadence: "Annual",
        months: [8],
        dayOfMonth: 1,
        hour: 7,
        minute: 0,
    },
    {
        name: "Weather",
        layer: "Agency",
        cadence: "Annual",
        months: [8],
        dayOfMonth: 1,
        hour: 7,
        minute: 30,
    },
    {
        name: "City Summary",
        layer: "Agency",
        cadence: "Annual",
        months: [8],
        dayOfMonth: 1,
        hour: 8,
        minute: 0,
    },
    {
        name: "Player Residential Areas",
        layer: "Agency",
        cadence: "Annual",
        months: [8],
        dayOfMonth: 2,
        hour: 7,
        minute: 0,
    },
    {
        name: "Geo Arena + Practice",
        layer: "Agency",
        cadence: "Annual",
        months: [8],
        dayOfMonth: 2,
        hour: 8,
        minute: 0,
    },
    {
        name: "Organisation LLM",
        layer: "Agency",
        cadence: "Annual",
        months: [8],
        dayOfMonth: 2,
        hour: 9,
        minute: 0,
    },
    {
        name: "Retired Numbers",
        layer: "Agency",
        cadence: "Annual",
        months: [8],
        dayOfMonth: 3,
        hour: 8,
        minute: 0,
    },

    // ---------------------------------------------------------
    // MANUAL
    // ---------------------------------------------------------

    {
        name: "Comparison Model",
        layer: "Agency",
        cadence: "Manual",
    },
    {
        name: "AHL Logos",
        layer: "Agency",
        cadence: "Manual",
    },
    {
        name: "Tax Rules",
        layer: "Agency",
        cadence: "Manual",
    },
];

const cadenceOrder: Cadence[] = [
    "Daily",
    "Weekly",
    "Monthly",
    "Quarterly",
    "Seasonal",
    "Annual",
    "Manual",
];

const cadenceStyles: Record<
    Cadence,
    {
        text: string;
        dot: string;
        border: string;
        background: string;
    }
> = {
    Daily: {
        text: "text-sky-100",
        dot: "bg-sky-100",
        border: "border-sky-600/60",
        background: "bg-sky-950/20",
    },

    Weekly: {
        text: "text-sky-200",
        dot: "bg-sky-200",
        border: "border-sky-700/60",
        background: "bg-sky-950/20",
    },

    Monthly: {
        text: "text-sky-400",
        dot: "bg-sky-400",
        border: "border-sky-800/60",
        background: "bg-sky-950/20",
    },

    Quarterly: {
        text: "text-sky-600",
        dot: "bg-sky-600",
        border: "border-sky-900/60",
        background: "bg-sky-950/20",
    },

    Seasonal: {
        text: "text-sky-700",
        dot: "bg-sky-700",
        border: "border-sky-900/80",
        background: "bg-sky-950/20",
    },

    Annual: {
        text: "text-sky-800",
        dot: "bg-sky-800",
        border: "border-sky-950",
        background: "bg-sky-950/20",
    },

    Manual: {
        text: "text-neutral-500",
        dot: "bg-neutral-600",
        border: "border-neutral-800",
        background: "bg-neutral-950",
    },
};

function getDateKey(date: Date) {
    return [
        date.getUTCFullYear(),
        String(
            date.getUTCMonth() + 1
        ).padStart(2, "0"),
        String(
            date.getUTCDate()
        ).padStart(2, "0"),
    ].join("-");
}

function isScheduledOnDate(
    item: ScheduleItem,
    date: Date
) {
    if (item.cadence === "Manual") {
        return false;
    }

    if (item.cadence === "Daily") {
        return true;
    }

    if (item.cadence === "Weekly") {
        return (
            item.dayOfWeek ===
            date.getUTCDay()
        );
    }

    if (item.cadence === "Monthly") {
        return (
            item.dayOfMonth ===
            date.getUTCDate()
        );
    }

    if (
        item.months &&
        item.dayOfWeek !== undefined
    ) {
        return (
            item.months.includes(
                date.getUTCMonth()
            ) &&
            item.dayOfWeek ===
                date.getUTCDay()
        );
    }

    if (
        item.months &&
        item.dayOfMonth !== undefined
    ) {
        return (
            item.months.includes(
                date.getUTCMonth()
            ) &&
            item.dayOfMonth ===
                date.getUTCDate()
        );
    }

    return false;
}

function formatTime(item: ScheduleItem) {
    const hour = String(
        item.hour ?? 0
    ).padStart(2, "0");

    const minute = String(
        item.minute ?? 0
    ).padStart(2, "0");

    return `${hour}:${minute}`;
}

function formatDayName(date: Date) {
    const days = [
        "SUN",
        "MON",
        "TUE",
        "WED",
        "THU",
        "FRI",
        "SAT",
    ];

    return days[date.getUTCDay()];
}

function formatDayDate(date: Date) {
    const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ];

    return `${date.getUTCDate()} ${
        months[date.getUTCMonth()]
    }`;
}

export default function QASchedule() {
    const [
        timelineOpen,
        setTimelineOpen,
    ] = useState(false);

    const calendarDays =
        useMemo<CalendarDay[]>(() => {
            const now = new Date();

            const today = new Date(
                Date.UTC(
                    now.getUTCFullYear(),
                    now.getUTCMonth(),
                    now.getUTCDate()
                )
            );

            const days: CalendarDay[] = [];

            // Today -2 through Today +4
            for (
                let offset = -2;
                offset <= 4;
                offset++
            ) {
                const date = new Date(
                    today
                );

                date.setUTCDate(
                    date.getUTCDate() +
                        offset
                );

                const runs = schedule
                    .filter((item) =>
                        isScheduledOnDate(
                            item,
                            date
                        )
                    )
                    .sort(
                        (a, b) =>
                            (a.hour ?? 0) *
                                60 +
                            (a.minute ?? 0) -
                            ((b.hour ?? 0) *
                                60 +
                                (b.minute ??
                                    0))
                    );

                days.push({
                    date,
                    dateKey:
                        getDateKey(date),
                    isToday:
                        offset === 0,
                    runs,
                });
            }

            return days;
        }, []);

    return (
        <div className="space-y-8">
            {/* -------------------------------------------------
                DATA REFRESH TIMELINE
            ------------------------------------------------- */}

            <section>
                <button
                    type="button"
                    onClick={() =>
                        setTimelineOpen(
                            (open) => !open
                        )
                    }
                    aria-expanded={
                        timelineOpen
                    }
                    className="flex w-full items-center gap-3 text-left"
                >
                    <span
                        className={`
                            inline-block
                            text-lg
                            text-neutral-500
                            transition-transform
                            duration-200
                            ${
                                timelineOpen
                                    ? "rotate-90"
                                    : ""
                            }
                        `}
                    >
                        &gt;
                    </span>

                    <h2 className="text-xl font-semibold">
                        Data Refresh Timeline
                    </h2>
                </button>

                {timelineOpen && (
                    <div className="mt-4">
                        <div className="grid gap-3 md:grid-cols-7">
                            {cadenceOrder.map(
                                (cadence) => {
                                    const style =
                                        cadenceStyles[
                                            cadence
                                        ];

                                    return (
                                        <div
                                            key={
                                                cadence
                                            }
                                            className={`rounded-lg border ${style.border} ${style.background}`}
                                        >
                                            <div className="flex items-center gap-2 border-b border-neutral-800 p-4">
                                                <span
                                                    className={`h-2.5 w-2.5 rounded-full ${style.dot}`}
                                                />

                                                <div
                                                    className={`text-sm font-semibold ${style.text}`}
                                                >
                                                    {
                                                        cadence
                                                    }
                                                </div>
                                            </div>

                                            <div className="p-4">
                                                {layers.map(
                                                    (
                                                        layer,
                                                        layerIndex
                                                    ) => {
                                                        const items =
                                                            schedule.filter(
                                                                (
                                                                    item
                                                                ) =>
                                                                    item.cadence ===
                                                                        cadence &&
                                                                    item.layer ===
                                                                        layer
                                                            );

                                                        return (
                                                            <div
                                                                key={
                                                                    layer
                                                                }
                                                                className={
                                                                    layerIndex >
                                                                    0
                                                                        ? "mt-4 border-t border-neutral-800 pt-4"
                                                                        : ""
                                                                }
                                                            >
                                                                <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                                                    {
                                                                        layer
                                                                    }
                                                                </div>

                                                                {items.length ===
                                                                0 ? (
                                                                    <div className="text-xs text-neutral-700">
                                                                        No runs
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-3">
                                                                        {items.map(
                                                                            (
                                                                                item,
                                                                                index
                                                                            ) => (
                                                                                <div
                                                                                    key={`${item.layer}-${item.name}-${index}`}
                                                                                >
                                                                                    <div
                                                                                        className={`text-sm font-medium ${style.text}`}
                                                                                    >
                                                                                        {
                                                                                            item.name
                                                                                        }
                                                                                    </div>

                                                                                    {item.description && (
                                                                                        <div className="mt-0.5 text-xs text-neutral-500">
                                                                                            {
                                                                                                item.description
                                                                                            }
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* -------------------------------------------------
                7-DAY SCHEDULE
            ------------------------------------------------- */}

            <section>
                <div className="mb-4 flex items-end justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold">
                            7-Day Schedule
                        </h2>

                        <p className="mt-1 text-sm text-neutral-500">
                            Two days back,
                            today and four
                            days ahead
                        </p>
                    </div>

                    <div className="text-xs text-neutral-500">
                        Times shown in UTC
                    </div>
                </div>

                <div className="grid overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 md:grid-cols-7">
                    {calendarDays.map(
                        (
                            day,
                            dayIndex
                        ) => (
                            <div
                                key={
                                    day.dateKey
                                }
                                className={`min-h-[260px] p-3 ${
                                    dayIndex >
                                    0
                                        ? "border-t border-neutral-800 md:border-l md:border-t-0"
                                        : ""
                                } ${
                                    day.isToday
                                        ? "bg-neutral-900"
                                        : ""
                                }`}
                            >
                                <div className="mb-4 border-b border-neutral-800 pb-3">
                                    <div
                                        className={`text-xs font-semibold tracking-wide ${
                                            day.isToday
                                                ? "text-white"
                                                : "text-neutral-500"
                                        }`}
                                    >
                                        {day.isToday
                                            ? "TODAY"
                                            : formatDayName(
                                                  day.date
                                              )}
                                    </div>

                                    <div
                                        className={`mt-1 text-lg font-semibold ${
                                            day.isToday
                                                ? "text-white"
                                                : "text-neutral-300"
                                        }`}
                                    >
                                        {formatDayDate(
                                            day.date
                                        )}
                                    </div>
                                </div>

                                {layers.map(
                                    (
                                        layer,
                                        layerIndex
                                    ) => {
                                        const runs =
                                            day.runs.filter(
                                                (
                                                    item
                                                ) =>
                                                    item.layer ===
                                                    layer
                                            );

                                        return (
                                            <div
                                                key={
                                                    layer
                                                }
                                                className={
                                                    layerIndex >
                                                    0
                                                        ? "mt-4 border-t border-neutral-800 pt-4"
                                                        : ""
                                                }
                                            >
                                                <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                                    {
                                                        layer
                                                    }
                                                </div>

                                                {runs.length ===
                                                0 ? (
                                                    <div className="text-xs text-neutral-700">
                                                        No runs
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {runs.map(
                                                            (
                                                                item,
                                                                index
                                                            ) => {
                                                                const style =
                                                                    cadenceStyles[
                                                                        item
                                                                            .cadence
                                                                    ];

                                                                return (
                                                                    <div
                                                                        key={`${item.layer}-${item.name}-${index}`}
                                                                        className="min-w-0"
                                                                    >
                                                                        <div className="flex items-start gap-2">
                                                                            <span
                                                                                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                                                                            />

                                                                            <div className="min-w-0">
                                                                                <div className="text-xs text-neutral-500">
                                                                                    {formatTime(
                                                                                        item
                                                                                    )}
                                                                                </div>

                                                                                <div
                                                                                    className={`text-sm font-medium leading-tight ${style.text}`}
                                                                                >
                                                                                    {
                                                                                        item.name
                                                                                    }
                                                                                </div>

                                                                                {item.description && (
                                                                                    <div className="mt-0.5 text-xs leading-tight text-neutral-600">
                                                                                        {
                                                                                            item.description
                                                                                        }
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                )}
                            </div>
                        )
                    )}
                </div>
            </section>
        </div>
    );
}