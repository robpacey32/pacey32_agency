"use client";

import dynamic from "next/dynamic";

import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    MapPin,
    Plane,
    Route,
    Trophy,
} from "lucide-react";

import {
    useMemo,
    useState,
} from "react";


const TravelMap =
    dynamic(
        () =>
            import(
                "@/components/TravelMap"
            ),
        {
            ssr: false,
        }
    );


export type TravelSummary = {
    season: number;
    team_id: number;
    team_abbrev: string;
    team_name: string;

    total_games: number;
    home_games: number;
    away_games: number;

    travel_legs: number;
    return_home_legs: number;
    road_trip_count: number;

    total_distance_km: number;
    total_distance_miles: number;

    average_leg_km: number;
    median_leg_km: number;

    longest_leg_km: number;
    shortest_nonzero_leg_km: number;

    legs_over_500km: number;
    legs_over_1000km: number;
    legs_over_2000km: number;
    legs_over_3000km: number;

    season_start_trips: number;
    home_to_away_trips: number;
    away_to_away_trips: number;
    return_home_between_trips: number;
    return_home_for_home_games: number;

    distance_rank: number;
    road_trip_rank: number;
    longest_leg_rank: number;

    nhl_avg_average_leg_km?: number | null;
    nhl_avg_median_leg_km?: number | null;
    nhl_avg_travel_legs?: number | null;
    nhl_avg_legs_over_500km?: number | null;
    nhl_avg_legs_over_1000km?: number | null;
    nhl_avg_legs_over_2000km?: number | null;
    nhl_avg_legs_over_3000km?: number | null;
};


export type TravelLeg = {
    season: number;

    leg_sequence: number;
    leg_type: string;

    game_id:
        | number
        | null;

    game_date:
        | string
        | null;

    opponent_team_abbrev:
        | string
        | null;

    opponent_team_name:
        | string
        | null;

    is_home: boolean;
    is_away: boolean;

    road_trip_id:
        | number
        | null;

    travel_from_city:
        | string
        | null;

    travel_from_state_province:
        | string
        | null;

    travel_from_country:
        | string
        | null;

    travel_from_latitude:
        | number
        | null;

    travel_from_longitude:
        | number
        | null;

    travel_to_city:
        | string
        | null;

    travel_to_state_province:
        | string
        | null;

    travel_to_country:
        | string
        | null;

    travel_to_latitude:
        | number
        | null;

    travel_to_longitude:
        | number
        | null;

    travel_reason:
        | string
        | null;

    travel_km: number;
    travel_miles: number;

    involves_travel: boolean;

    team_home_city:
        | string
        | null;

    team_home_latitude:
        | number
        | null;

    team_home_longitude:
        | number
        | null;
};


export type TravelData = {
    team: string;
    summary: TravelSummary;
    history: TravelSummary[];
    legs: TravelLeg[];
};


type Props = {
    data: TravelData;
};


type MapMode =
    | "routes"
    | "longest"
    | "frequency";


type DistanceUnit =
    | "miles"
    | "km";


type SortKey =
    | "date"
    | "games"
    | "miles";


type SortDirection =
    | "asc"
    | "desc";


export type RoadTrip = {
    id: number;
    legs: TravelLeg[];
    cities: string[];
    miles: number;
    km: number;
    games: number;

    startDate:
        | string
        | null;

    endDate:
        | string
        | null;
};


export default function TravelPanel({
    data,
}: Props) {
    const {
        summary,
        history,
        legs,
    } = data;


    const [
        distanceUnit,
        setDistanceUnit,
    ] =
        useState<DistanceUnit>(
            "miles"
        );


    const [
        mapMode,
        setMapMode,
    ] =
        useState<MapMode>(
            "routes"
        );


    const [
        sortKey,
        setSortKey,
    ] =
        useState<SortKey>(
            "miles"
        );


    const [
        sortDirection,
        setSortDirection,
    ] =
        useState<SortDirection>(
            "desc"
        );


    const [
        currentPage,
        setCurrentPage,
    ] =
        useState(1);


    const pageSize =
        10;


    const distanceSuffix =
        distanceUnit ===
        "miles"
            ? "mi"
            : "km";


    const roadTrips =
        useMemo(
            () =>
                buildRoadTrips(
                    legs
                ),
            [legs]
        );


    const longestTrip =
        useMemo(
            () =>
                roadTrips.length
                    ? [
                          ...roadTrips,
                      ].sort(
                          (
                              a,
                              b
                          ) =>
                              b.miles -
                              a.miles
                      )[0]
                    : null,
            [roadTrips]
        );


    const sortedRoadTrips =
        useMemo(() => {
            const sorted =
                [...roadTrips];

            sorted.sort(
                (
                    a,
                    b
                ) => {
                    let comparison =
                        0;

                    if (
                        sortKey ===
                        "games"
                    ) {
                        comparison =
                            a.games -
                            b.games;
                    }

                    if (
                        sortKey ===
                        "miles"
                    ) {
                        comparison =
                            a.miles -
                            b.miles;
                    }

                    if (
                        sortKey ===
                        "date"
                    ) {
                        comparison =
                            dateSortValue(
                                a.startDate
                            ) -
                            dateSortValue(
                                b.startDate
                            );
                    }

                    return sortDirection ===
                        "asc"
                        ? comparison
                        : -comparison;
                }
            );

            return sorted;

        }, [
            roadTrips,
            sortKey,
            sortDirection,
        ]);


    const totalPages =
        Math.max(
            1,
            Math.ceil(
                sortedRoadTrips.length /
                pageSize
            )
        );


    const pagedRoadTrips =
        sortedRoadTrips.slice(
            (currentPage - 1) *
                pageSize,
            currentPage *
                pageSize
        );


    const seasonLabel =
        formatSeason(
            summary.season
        );


    function displayKm(
        km: number
    ) {
        return distanceUnit ===
            "miles"
            ? kmToMiles(
                  km
              )
            : km;
    }


    function displaySummaryDistance(
        miles: number,
        km: number
    ) {
        return distanceUnit ===
            "miles"
            ? miles
            : km;
    }


    function displayTripDistance(
        trip: RoadTrip
    ) {
        return distanceUnit ===
            "miles"
            ? trip.miles
            : trip.km;
    }


    function changeSort(
        key: SortKey
    ) {
        setCurrentPage(
            1
        );

        if (
            sortKey === key
        ) {
            setSortDirection(
                sortDirection ===
                    "asc"
                    ? "desc"
                    : "asc"
            );

            return;
        }

        setSortKey(
            key
        );

        setSortDirection(
            key === "date"
                ? "asc"
                : "desc"
        );
    }


    return (
        <div className="space-y-5">

            {/* UNIT TOGGLE */}

            <div className="flex justify-end">

                <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-1">

                    <UnitToggle
                        active={
                            distanceUnit ===
                            "miles"
                        }
                        onClick={() =>
                            setDistanceUnit(
                                "miles"
                            )
                        }
                    >
                        Miles
                    </UnitToggle>


                    <UnitToggle
                        active={
                            distanceUnit ===
                            "km"
                        }
                        onClick={() =>
                            setDistanceUnit(
                                "km"
                            )
                        }
                    >
                        Km
                    </UnitToggle>

                </div>

            </div>


            {/* HEADLINE METRICS */}

            <section className="grid min-w-[1000px] grid-cols-4 gap-4 overflow-x-auto">

                <MetricCard
                    icon={
                        <Plane
                            size={21}
                        />
                    }
                    label="Total Travel"
                    value={`${formatNumber(
                        displaySummaryDistance(
                            summary.total_distance_miles,
                            summary.total_distance_km
                        )
                    )} ${distanceSuffix}`}
                    detail={
                        seasonLabel
                    }
                />

                <MetricCard
                    icon={
                        <Trophy
                            size={21}
                        />
                    }
                    label="NHL Rank"
                    value={`#${summary.distance_rank}`}
                    detail="Travel distance"
                />

                <MetricCard
                    icon={
                        <Route
                            size={21}
                        />
                    }
                    label="Road Trips"
                    value={
                        summary.road_trip_count
                    }
                    detail={`#${summary.road_trip_rank} NHL`}
                />

                <MetricCard
                    icon={
                        <MapPin
                            size={21}
                        />
                    }
                    label="Longest Leg"
                    value={`${formatNumber(
                        displayKm(
                            summary.longest_leg_km
                        )
                    )} ${distanceSuffix}`}
                    detail={`#${summary.longest_leg_rank} NHL`}
                />

            </section>


            {/* MAIN TWO-COLUMN AREA */}

            <section className="grid min-w-[1100px] grid-cols-[0.82fr_1.55fr] items-start gap-5 overflow-x-auto">

                {/* LEFT COLUMN */}

                <div className="space-y-5">

                    {/* 5-YEAR HISTORY */}

                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">

                        <div>
                            <div className="text-sm font-semibold text-white">
                                5-Year Travel Distance
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                                NHL rank · less travel is better
                            </div>
                        </div>


                        <div className="mt-5 space-y-2">

                            {history.map(
                                (
                                    row
                                ) => (
                                    <div
                                        key={
                                            row.season
                                        }
                                        className={`grid grid-cols-[85px_1fr_70px] items-center gap-4 rounded-lg border px-4 py-3 ${rankHeatClass(
                                            row.distance_rank
                                        )}`}
                                    >
                                        <div className="text-sm font-medium text-slate-300">
                                            {formatSeason(
                                                row.season
                                            )}
                                        </div>

                                        <div className="font-semibold text-white">
                                            {formatNumber(
                                                displaySummaryDistance(
                                                    row.total_distance_miles,
                                                    row.total_distance_km
                                                )
                                            )}{" "}
                                            {
                                                distanceSuffix
                                            }
                                        </div>

                                        <div className="text-right">
                                            <div className="text-lg font-bold text-white">
                                                #
                                                {
                                                    row.distance_rank
                                                }
                                            </div>

                                            <div className="text-[10px] uppercase tracking-wide text-slate-400">
                                                NHL
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}

                        </div>


                        <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">

                            <span>
                                More travel
                            </span>

                            <div className="flex items-center gap-1">
                                <div className="h-2.5 w-8 rounded bg-red-500/40" />
                                <div className="h-2.5 w-8 rounded bg-orange-500/30" />
                                <div className="h-2.5 w-8 rounded bg-slate-700" />
                                <div className="h-2.5 w-8 rounded bg-emerald-500/25" />
                                <div className="h-2.5 w-8 rounded bg-green-500/40" />
                            </div>

                            <span>
                                Less travel
                            </span>

                        </div>

                    </div>


                    {/* TRAVEL PROFILE */}

                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">

                        <div>
                            <div className="text-sm font-semibold text-white">
                                Travel Profile
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                                Compared with NHL average
                            </div>
                        </div>


                        <div className="mt-5 space-y-2">

                            <ProfileComparisonRow
                                label="Average leg"
                                value={
                                    displayKm(
                                        summary.average_leg_km
                                    )
                                }
                                average={
                                    summary.nhl_avg_average_leg_km !=
                                    null
                                        ? displayKm(
                                              summary.nhl_avg_average_leg_km
                                          )
                                        : null
                                }
                                suffix={` ${distanceSuffix}`}
                            />


                            <ProfileComparisonRow
                                label="Median leg"
                                value={
                                    displayKm(
                                        summary.median_leg_km
                                    )
                                }
                                average={
                                    summary.nhl_avg_median_leg_km !=
                                    null
                                        ? displayKm(
                                              summary.nhl_avg_median_leg_km
                                          )
                                        : null
                                }
                                suffix={` ${distanceSuffix}`}
                            />


                            <ProfileComparisonRow
                                label="Travel legs"
                                value={
                                    summary.travel_legs
                                }
                                average={
                                    summary.nhl_avg_travel_legs ??
                                    null
                                }
                            />


                            <div className="my-4 border-t border-slate-800" />


                            <ProfileComparisonRow
                                label={
                                    distanceUnit ===
                                    "miles"
                                        ? "> 311 mi"
                                        : "> 500 km"
                                }
                                value={
                                    summary.legs_over_500km
                                }
                                average={
                                    summary.nhl_avg_legs_over_500km ??
                                    null
                                }
                            />


                            <ProfileComparisonRow
                                label={
                                    distanceUnit ===
                                    "miles"
                                        ? "> 621 mi"
                                        : "> 1,000 km"
                                }
                                value={
                                    summary.legs_over_1000km
                                }
                                average={
                                    summary.nhl_avg_legs_over_1000km ??
                                    null
                                }
                            />


                            <ProfileComparisonRow
                                label={
                                    distanceUnit ===
                                    "miles"
                                        ? "> 1,243 mi"
                                        : "> 2,000 km"
                                }
                                value={
                                    summary.legs_over_2000km
                                }
                                average={
                                    summary.nhl_avg_legs_over_2000km ??
                                    null
                                }
                            />


                            <ProfileComparisonRow
                                label={
                                    distanceUnit ===
                                    "miles"
                                        ? "> 1,864 mi"
                                        : "> 3,000 km"
                                }
                                value={
                                    summary.legs_over_3000km
                                }
                                average={
                                    summary.nhl_avg_legs_over_3000km ??
                                    null
                                }
                            />

                        </div>

                    </div>

                </div>


                {/* RIGHT COLUMN */}

                <div className="space-y-5">

                    {/* MAP */}

                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">

                        <div className="flex items-center justify-between gap-5">

                            <div>
                                <div className="text-sm font-semibold text-white">
                                    Travel Map
                                </div>

                                <div className="mt-1 text-xs text-slate-500">
                                    {
                                        seasonLabel
                                    }
                                </div>
                            </div>


                            <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-1">

                                <MapToggle
                                    active={
                                        mapMode ===
                                        "routes"
                                    }
                                    onClick={() =>
                                        setMapMode(
                                            "routes"
                                        )
                                    }
                                >
                                    Routes
                                </MapToggle>


                                <MapToggle
                                    active={
                                        mapMode ===
                                        "longest"
                                    }
                                    onClick={() =>
                                        setMapMode(
                                            "longest"
                                        )
                                    }
                                >
                                    Longest Trip
                                </MapToggle>


                                <MapToggle
                                    active={
                                        mapMode ===
                                        "frequency"
                                    }
                                    onClick={() =>
                                        setMapMode(
                                            "frequency"
                                        )
                                    }
                                >
                                    Visits
                                </MapToggle>

                            </div>

                        </div>


                        <div className="mt-5">

                            <TravelMap
                                legs={
                                    legs
                                }
                                mode={
                                    mapMode
                                }
                                longestTrip={
                                    longestTrip
                                }
                            />

                        </div>


                        <div className="mt-4 text-xs text-slate-500">

                            {mapMode ===
                                "routes" &&
                                "Each line represents the flight sequence of an individual road trip."}

                            {mapMode ===
                                "longest" &&
                                longestTrip &&
                                `Longest road trip: ${longestTrip.cities.join(
                                    " → "
                                )} · ${formatNumber(
                                    displayTripDistance(
                                        longestTrip
                                    )
                                )} ${distanceSuffix}`}

                            {mapMode ===
                                "frequency" &&
                                "Marker size represents the number of travel arrivals in each city."}

                        </div>

                    </div>


                    {/* ROAD TRIPS */}

                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">

                        <div className="flex items-end justify-between">

                            <div>
                                <div className="text-sm font-semibold text-white">
                                    Road Trips
                                </div>

                                <div className="mt-1 text-xs text-slate-500">
                                    {
                                        seasonLabel
                                    }
                                </div>
                            </div>


                            <div className="text-xs text-slate-500">
                                {
                                    roadTrips.length
                                }{" "}
                                trips
                            </div>

                        </div>


                        <div className="mt-5 overflow-x-auto">

                            <div className="min-w-[780px]">

                                {/* TABLE HEADER */}

                                <div className="grid grid-cols-[55px_130px_85px_1fr_105px] items-center border-b border-slate-800 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">

                                    <div>
                                        Trip
                                    </div>


                                    <SortHeader
                                        label="Dates"
                                        sortKey="date"
                                        activeKey={
                                            sortKey
                                        }
                                        direction={
                                            sortDirection
                                        }
                                        onClick={
                                            changeSort
                                        }
                                    />


                                    <SortHeader
                                        label="Games"
                                        sortKey="games"
                                        activeKey={
                                            sortKey
                                        }
                                        direction={
                                            sortDirection
                                        }
                                        onClick={
                                            changeSort
                                        }
                                    />


                                    <div>
                                        Route
                                    </div>


                                    <div className="flex justify-end">
                                        <SortHeader
                                            label={
                                                distanceUnit ===
                                                "miles"
                                                    ? "Miles"
                                                    : "KM"
                                            }
                                            sortKey="miles"
                                            activeKey={
                                                sortKey
                                            }
                                            direction={
                                                sortDirection
                                            }
                                            onClick={
                                                changeSort
                                            }
                                            align="right"
                                        />
                                    </div>

                                </div>


                                {/* TABLE ROWS */}

                                {pagedRoadTrips.map(
                                    (
                                        trip
                                    ) => (
                                        <div
                                            key={
                                                trip.id
                                            }
                                            className="grid grid-cols-[55px_130px_85px_1fr_105px] items-center border-b border-slate-800/70 py-3.5 text-sm"
                                        >

                                            <div>
                                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-400">
                                                    {
                                                        trip.id
                                                    }
                                                </span>
                                            </div>


                                            <div className="text-slate-300">
                                                {formatTripDates(
                                                    trip
                                                )}
                                            </div>


                                            <div className="font-semibold text-white">
                                                {
                                                    trip.games
                                                }
                                            </div>


                                            <div className="pr-4 text-slate-300">
                                                {trip.cities.join(
                                                    " → "
                                                )}
                                            </div>


                                            <div className="text-right font-semibold text-white">
                                                {formatNumber(
                                                    displayTripDistance(
                                                        trip
                                                    )
                                                )}{" "}
                                                {
                                                    distanceSuffix
                                                }
                                            </div>

                                        </div>
                                    )
                                )}

                            </div>

                        </div>


                        {/* PAGINATION */}

                        {totalPages >
                            1 && (
                            <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4">

                                <div className="text-xs text-slate-500">
                                    Showing{" "}
                                    {(currentPage -
                                        1) *
                                        pageSize +
                                        1}
                                    –
                                    {Math.min(
                                        currentPage *
                                            pageSize,
                                        sortedRoadTrips.length
                                    )}{" "}
                                    of{" "}
                                    {
                                        sortedRoadTrips.length
                                    }{" "}
                                    road trips
                                </div>


                                <div className="flex items-center gap-2">

                                    <button
                                        type="button"
                                        disabled={
                                            currentPage ===
                                            1
                                        }
                                        onClick={() =>
                                            setCurrentPage(
                                                (
                                                    page
                                                ) =>
                                                    Math.max(
                                                        1,
                                                        page -
                                                            1
                                                    )
                                            )
                                        }
                                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                                    >
                                        Previous
                                    </button>


                                    <div className="min-w-[85px] text-center text-xs text-slate-400">
                                        Page{" "}
                                        {
                                            currentPage
                                        }{" "}
                                        of{" "}
                                        {
                                            totalPages
                                        }
                                    </div>


                                    <button
                                        type="button"
                                        disabled={
                                            currentPage ===
                                            totalPages
                                        }
                                        onClick={() =>
                                            setCurrentPage(
                                                (
                                                    page
                                                ) =>
                                                    Math.min(
                                                        totalPages,
                                                        page +
                                                            1
                                                    )
                                            )
                                        }
                                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                                    >
                                        Next
                                    </button>

                                </div>

                            </div>
                        )}

                    </div>

                </div>

            </section>

        </div>
    );
}


function MetricCard({
    icon,
    label,
    value,
    detail,
}: {
    icon: React.ReactNode;
    label: string;
    value:
        | string
        | number;
    detail: string;
}) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">

            <div className="flex items-center gap-3 text-blue-400">
                {icon}

                <div className="text-xs font-semibold uppercase tracking-wide">
                    {label}
                </div>
            </div>

            <div className="mt-5 text-2xl font-bold text-white">
                {value}
            </div>

            <div className="mt-2 text-sm text-slate-500">
                {detail}
            </div>

        </div>
    );
}


function ProfileComparisonRow({
    label,
    value,
    average,
    suffix = "",
}: {
    label: string;
    value: number;
    average:
        | number
        | null;
    suffix?: string;
}) {
    const difference =
        average != null &&
        average !== 0
            ? (
                  (value -
                      average) /
                  average
              ) *
              100
            : null;


    const comparisonClass =
        difference == null
            ? "text-slate-500"
            : difference >
                0
              ? "text-red-400"
              : difference <
                  0
                ? "text-emerald-400"
                : "text-slate-400";


    return (
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3">

            <div className="flex items-center justify-between gap-5">

                <div className="text-sm text-slate-400">
                    {label}
                </div>


                <div className="text-right">

                    <div className="font-semibold text-white">
                        {formatNumber(
                            value
                        )}
                        {suffix}
                    </div>


                    {average !=
                        null && (
                        <div className="mt-0.5 text-xs text-slate-500">
                            NHL avg{" "}
                            {formatNumber(
                                average
                            )}
                            {suffix}
                        </div>
                    )}

                </div>

            </div>


            {difference !=
                null && (
                <div
                    className={`mt-2 text-right text-xs font-medium ${comparisonClass}`}
                >
                    {difference >
                    0
                        ? "+"
                        : ""}

                    {difference.toFixed(
                        0
                    )}
                    % vs NHL
                </div>
            )}

        </div>
    );
}


function UnitToggle({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={
                onClick
            }
            className={`rounded-md px-4 py-2 text-xs font-semibold transition ${
                active
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 hover:text-slate-300"
            }`}
        >
            {children}
        </button>
    );
}


function MapToggle({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={
                onClick
            }
            className={`rounded-md px-3 py-2 text-xs font-medium transition ${
                active
                    ? "bg-slate-800 text-white"
                    : "text-slate-500 hover:text-slate-300"
            }`}
        >
            {children}
        </button>
    );
}


function SortHeader({
    label,
    sortKey,
    activeKey,
    direction,
    onClick,
    align = "left",
}: {
    label: string;
    sortKey: SortKey;
    activeKey: SortKey;
    direction:
        SortDirection;
    onClick:
        (
            key:
                SortKey
        ) => void;
    align?:
        | "left"
        | "right";
}) {
    const active =
        sortKey ===
        activeKey;


    return (
        <button
            type="button"
            onClick={() =>
                onClick(
                    sortKey
                )
            }
            className={`flex items-center gap-1.5 transition hover:text-white ${
                align ===
                "right"
                    ? "justify-end text-right"
                    : ""
            } ${
                active
                    ? "text-white"
                    : "text-slate-500"
            }`}
        >
            {label}


            {!active && (
                <ArrowUpDown
                    size={13}
                />
            )}


            {active &&
                direction ===
                    "asc" && (
                    <ArrowUp
                        size={13}
                    />
                )}


            {active &&
                direction ===
                    "desc" && (
                    <ArrowDown
                        size={13}
                    />
                )}

        </button>
    );
}


function buildRoadTrips(
    legs:
        TravelLeg[]
):
    RoadTrip[] {
    const groups =
        new Map<
            number,
            TravelLeg[]
        >();


    legs.forEach(
        (leg) => {
            if (
                leg.road_trip_id ==
                null
            ) {
                return;
            }


            const existing =
                groups.get(
                    leg.road_trip_id
                ) ??
                [];


            existing.push(
                leg
            );


            groups.set(
                leg.road_trip_id,
                existing
            );
        }
    );


    return Array.from(
        groups.entries()
    )
        .map(
            ([
                id,
                tripLegs,
            ]) => {
                const sorted =
                    [
                        ...tripLegs,
                    ].sort(
                        (
                            a,
                            b
                        ) =>
                            a.leg_sequence -
                            b.leg_sequence
                    );


                const cities:
                    string[] =
                    [];


                const first =
                    sorted[0];


                if (
                    first
                        ?.travel_from_city
                ) {
                    cities.push(
                        first.travel_from_city
                    );
                }


                sorted.forEach(
                    (leg) => {
                        if (
                            leg.travel_to_city &&
                            cities[
                                cities.length -
                                    1
                            ] !==
                                leg.travel_to_city
                        ) {
                            cities.push(
                                leg.travel_to_city
                            );
                        }
                    }
                );


                const awayGames =
                    sorted.filter(
                        (leg) =>
                            leg.leg_type ===
                                "GAME_ARRIVAL" &&
                            leg.is_away &&
                            leg.game_date
                    );


                const startDate =
                    awayGames[0]
                        ?.game_date ??
                    null;


                const endDate =
                    awayGames[
                        awayGames.length -
                            1
                    ]?.game_date ??
                    startDate;


                return {
                    id,

                    legs:
                        sorted,

                    cities,

                    miles:
                        sorted.reduce(
                            (
                                total,
                                leg
                            ) =>
                                total +
                                Number(
                                    leg.travel_miles ??
                                        0
                                ),
                            0
                        ),

                    km:
                        sorted.reduce(
                            (
                                total,
                                leg
                            ) =>
                                total +
                                Number(
                                    leg.travel_km ??
                                        0
                                ),
                            0
                        ),

                    games:
                        awayGames.length,

                    startDate,

                    endDate,
                };
            }
        )
        .sort(
            (
                a,
                b
            ) =>
                dateSortValue(
                    a.startDate
                ) -
                dateSortValue(
                    b.startDate
                )
        );
}


function rankHeatClass(
    rank:
        number
) {
    if (
        rank <=
        4
    ) {
        return "border-red-500/30 bg-red-500/20";
    }

    if (
        rank <=
        8
    ) {
        return "border-red-500/20 bg-red-500/12";
    }

    if (
        rank <=
        12
    ) {
        return "border-orange-500/20 bg-orange-500/10";
    }

    if (
        rank <=
        20
    ) {
        return "border-slate-700 bg-slate-800/45";
    }

    if (
        rank <=
        24
    ) {
        return "border-emerald-500/15 bg-emerald-500/8";
    }

    if (
        rank <=
        28
    ) {
        return "border-emerald-500/20 bg-emerald-500/12";
    }

    return "border-green-500/30 bg-green-500/20";
}


function parseDate(
    value:
        string
        | null
) {
    if (!value) {
        return null;
    }


    const match =
        value.match(
            /^(\d{4})-(\d{2})-(\d{2})$/
        );


    if (!match) {
        return null;
    }


    const year =
        Number(
            match[1]
        );

    const month =
        Number(
            match[2]
        );

    const day =
        Number(
            match[3]
        );


    return new Date(
        Date.UTC(
            year,
            month - 1,
            day
        )
    );
}


function dateSortValue(
    value:
        string
        | null
) {
    const date =
        parseDate(
            value
        );


    return date
        ? date.getTime()
        : 0;
}


function formatTripDates(
    trip:
        RoadTrip
) {
    const start =
        parseDate(
            trip.startDate
        );


    if (!start) {
        return "—";
    }


    const end =
        parseDate(
            trip.endDate
        ) ??
        start;


    const startText =
        start.toLocaleDateString(
            "en-GB",
            {
                day:
                    "numeric",
                month:
                    "short",
                timeZone:
                    "UTC",
            }
        );


    const endText =
        end.toLocaleDateString(
            "en-GB",
            {
                day:
                    "numeric",
                month:
                    "short",
                timeZone:
                    "UTC",
            }
        );


    return startText ===
        endText
        ? startText
        : `${startText} – ${endText}`;
}


function formatSeason(
    season:
        number
) {
    const text =
        String(
            season
        );


    if (
        text.length !==
        8
    ) {
        return text;
    }


    return `${text.slice(
        0,
        4
    )}-${text.slice(
        6,
        8
    )}`;
}


function kmToMiles(
    km:
        number
) {
    return (
        km *
        0.621371
    );
}


function formatNumber(
    value:
        number
) {
    return Number(
        value
    ).toLocaleString(
        undefined,
        {
            maximumFractionDigits:
                0,
        }
    );
}