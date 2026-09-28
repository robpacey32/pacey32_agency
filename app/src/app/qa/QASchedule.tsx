"use client";

import {
    useMemo,
    useState,
} from "react";

type Cadence =
    | "Weekly"
    | "Monthly"
    | "Quarterly"
    | "Annual"
    | "Manual";

type ScheduleItem = {
    name: string;
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

const schedule: ScheduleItem[] = [
    // ---------------------------------------------------------
    // WEEKLY
    // ---------------------------------------------------------

    {
        name: "Cap",
        cadence: "Weekly",
        dayOfWeek: 1,
        hour: 6,
        minute: 30,
    },
    {
        name: "Travel",
        cadence: "Weekly",
        dayOfWeek: 1,
        hour: 9,
        minute: 0,
        description: "Current season",
    },
    {
        name: "Full Agency QA",
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
        cadence: "Monthly",
        dayOfMonth: 1,
        hour: 5,
        minute: 20,
    },
    {
        name: "Travel",
        cadence: "Monthly",
        dayOfMonth: 1,
        hour: 10,
        minute: 0,
        description: "5-year history",
    },
    {
        name: "Organisation",
        cadence: "Monthly",
        dayOfMonth: 2,
        hour: 7,
        minute: 0,
        description: "Organisation detail",
    },
    {
        name: "Player",
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
        cadence: "Quarterly",
        months: [0, 3, 6, 9],
        dayOfMonth: 1,
        hour: 7,
        minute: 0,
    },
    {
        name: "Geo POIs",
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
        name: "City Reference",
        cadence: "Annual",
        months: [8],
        dayOfMonth: 1,
        hour: 7,
        minute: 0,
    },
    {
        name: "Weather",
        cadence: "Annual",
        months: [8],
        dayOfMonth: 1,
        hour: 7,
        minute: 30,
    },
    {
        name: "City Summary",
        cadence: "Annual",
        months: [8],
        dayOfMonth: 1,
        hour: 8,
        minute: 0,
    },
    {
        name: "Player Residential Areas",
        cadence: "Annual",
        months: [8],
        dayOfMonth: 2,
        hour: 7,
        minute: 0,
    },
    {
        name: "Geo Arena + Practice",
        cadence: "Annual",
        months: [8],
        dayOfMonth: 2,
        hour: 8,
        minute: 0,
    },
    {
        name: "Organisation LLM",
        cadence: "Annual",
        months: [8],
        dayOfMonth: 2,
        hour: 9,
        minute: 0,
    },
    {
        name: "Retired Numbers",
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
        cadence: "Manual",
    },
    {
        name: "AHL Logos",
        cadence: "Manual",
    },
    {
        name: "Tax Rules",
        cadence: "Manual",
    },
];

const cadenceOrder: Cadence[] = [
    "Weekly",
    "Monthly",
    "Quarterly",
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
    return new Intl.DateTimeFormat(
        "en-GB",
        {
            timeZone: "UTC",
            weekday: "short",
        }
    )
        .format(date)
        .toUpperCase();
}

function formatDayDate(date: Date) {
    return new Intl.DateTimeFormat(
        "en-GB",
        {
            timeZone: "UTC",
            day: "numeric",
            month: "short",
        }
    ).format(date);
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
                    <div className="mt-4 grid gap-3 md:grid-cols-5">
                        {cadenceOrder.map(
                            (cadence) => {
                                const items =
                                    schedule.filter(
                                        (item) =>
                                            item.cadence ===
                                            cadence
                                    );

                                const style =
                                    cadenceStyles[
                                        cadence
                                    ];

                                return (
                                    <div
                                        key={
                                            cadence
                                        }
                                        className={`rounded-lg border p-4 ${style.border} ${style.background}`}
                                    >
                                        <div className="mb-4 flex items-center gap-2">
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

                                        <div className="space-y-3">
                                            {items.map(
                                                (
                                                    item,
                                                    index
                                                ) => (
                                                    <div
                                                        key={`${item.name}-${index}`}
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
                                    </div>
                                );
                            }
                        )}
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
                                className={`min-h-[180px] p-3 ${
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

                                {day.runs
                                    .length ===
                                0 ? (
                                    <div className="text-sm text-neutral-600">
                                        No runs
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {day.runs.map(
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
                                                        key={`${item.name}-${index}`}
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
                        )
                    )}
                </div>
            </section>
        </div>
    );
}