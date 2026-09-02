"use client";

import {
    CircleMarker,
    MapContainer,
    Polyline,
    Popup,
    TileLayer,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import type {
    TravelLeg,
} from "@/components/TravelPanel";


type RoadTrip = {
    id: number;
    legs: TravelLeg[];
    cities: string[];
    miles: number;
    games: number;
    startDate:
        | string
        | null;
    endDate:
        | string
        | null;
};


type Props = {
    legs: TravelLeg[];

    mode:
        | "routes"
        | "longest"
        | "frequency";

    longestTrip:
        | RoadTrip
        | null;
};


export default function TravelMap({
    legs,
    mode,
    longestTrip,
}: Props) {

    const homeLat =
        legs[0]
            ?.team_home_latitude;

    const homeLon =
        legs[0]
            ?.team_home_longitude;


    const validLegs =
        legs.filter(
            (leg) =>
                leg.travel_from_latitude !=
                    null &&
                leg.travel_from_longitude !=
                    null &&
                leg.travel_to_latitude !=
                    null &&
                leg.travel_to_longitude !=
                    null
        );


    const trips =
        groupTrips(
            validLegs
        );


    const visitFrequency =
        buildVisitFrequency(
            validLegs
        );


    const center:
        [number, number] =
        homeLat != null &&
        homeLon != null
            ? [
                  homeLat,
                  homeLon,
              ]
            : [
                  39.5,
                  -98.5,
              ];


    return (
        <div className="overflow-hidden rounded-xl border border-slate-800">
            <MapContainer
                center={center}
                zoom={4}
                scrollWheelZoom={
                    false
                }
                className="h-[520px] w-full"
            >
                <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />


                {mode ===
                    "routes" &&
                    trips.map(
                        (
                            trip,
                            index
                        ) => (
                            <Polyline
                                key={
                                    trip.id
                                }
                                positions={
                                    trip.positions
                                }
                                pathOptions={{
                                    color:
                                        tripColour(
                                            index
                                        ),
                                    weight:
                                        2.5,
                                    opacity:
                                        0.75,
                                }}
                            >
                                <Popup>
                                    <div>
                                        <strong>
                                            Road Trip{" "}
                                            {
                                                trip.id
                                            }
                                        </strong>

                                        <br />

                                        {
                                            trip.cities.join(
                                                " → "
                                            )
                                        }

                                        <br />

                                        {Math.round(
                                            trip.miles
                                        ).toLocaleString()}{" "}
                                        mi
                                    </div>
                                </Popup>
                            </Polyline>
                        )
                    )}


                {mode ===
                    "longest" &&
                    longestTrip && (
                        <Polyline
                            positions={
                                buildTripPositions(
                                    longestTrip
                                        .legs
                                )
                            }
                            pathOptions={{
                                color:
                                    "#a78bfa",
                                weight:
                                    5,
                                opacity:
                                    0.95,
                            }}
                        >
                            <Popup>
                                <div>
                                    <strong>
                                        Longest
                                        Road Trip
                                    </strong>

                                    <br />

                                    {
                                        longestTrip
                                            .cities
                                            .join(
                                                " → "
                                            )
                                    }

                                    <br />

                                    {Math.round(
                                        longestTrip
                                            .miles
                                    ).toLocaleString()}{" "}
                                    mi
                                </div>
                            </Popup>
                        </Polyline>
                    )}


                {mode ===
                    "frequency" &&
                    visitFrequency.map(
                        (city) => (
                            <CircleMarker
                                key={
                                    city.key
                                }
                                center={[
                                    city.latitude,
                                    city.longitude,
                                ]}
                                radius={
                                    Math.min(
                                        5 +
                                            city.count *
                                                2,
                                        18
                                    )
                                }
                                pathOptions={{
                                    color:
                                        "#60a5fa",
                                    fillColor:
                                        "#3b82f6",
                                    fillOpacity:
                                        0.5,
                                    weight:
                                        2,
                                }}
                            >
                                <Popup>
                                    <div>
                                        <strong>
                                            {
                                                city.city
                                            }
                                        </strong>

                                        <br />

                                        {
                                            city.count
                                        }{" "}
                                        travel
                                        arrivals
                                    </div>
                                </Popup>
                            </CircleMarker>
                        )
                    )}


                {homeLat != null &&
                    homeLon != null && (
                    <CircleMarker
                        center={[
                            homeLat,
                            homeLon,
                        ]}
                        radius={
                            9
                        }
                        pathOptions={{
                            color:
                                "#ffffff",
                            fillColor:
                                "#2563eb",
                            fillOpacity:
                                1,
                            weight:
                                3,
                        }}
                    >
                        <Popup>
                            Home
                        </Popup>
                    </CircleMarker>
                )}

            </MapContainer>
        </div>
    );
}


function buildTripPositions(
    legs: TravelLeg[]
): [number, number][] {

    if (!legs.length) {
        return [];
    }

    const sorted =
        [...legs].sort(
            (a, b) =>
                a.leg_sequence -
                b.leg_sequence
        );

    const positions:
        [number, number][] =
        [];

    const first =
        sorted[0];

    if (
        first.travel_from_latitude !=
            null &&
        first.travel_from_longitude !=
            null
    ) {
        positions.push([
            first.travel_from_latitude,
            first.travel_from_longitude,
        ]);
    }

    sorted.forEach(
        (leg) => {
            if (
                leg.travel_to_latitude !=
                    null &&
                leg.travel_to_longitude !=
                    null
            ) {
                positions.push([
                    leg.travel_to_latitude,
                    leg.travel_to_longitude,
                ]);
            }
        }
    );

    return positions;
}


function groupTrips(
    legs: TravelLeg[]
) {
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

            const current =
                groups.get(
                    leg.road_trip_id
                ) ?? [];

            current.push(
                leg
            );

            groups.set(
                leg.road_trip_id,
                current
            );
        }
    );


    return Array.from(
        groups.entries()
    ).map(
        ([id, tripLegs]) => {

            const positions =
                buildTripPositions(
                    tripLegs
                );

            const cities:
                string[] = [];

            const sorted =
                [...tripLegs].sort(
                    (a, b) =>
                        a.leg_sequence -
                        b.leg_sequence
                );

            if (
                sorted[0]
                    ?.travel_from_city
            ) {
                cities.push(
                    sorted[0]
                        .travel_from_city!
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

            const miles =
                tripLegs.reduce(
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
                );


            return {
                id,
                positions,
                cities,
                miles,
            };
        }
    );
}


function buildVisitFrequency(
    legs: TravelLeg[]
) {
    const cities =
        new Map<
            string,
            {
                key: string;
                city: string;
                latitude: number;
                longitude: number;
                count: number;
            }
        >();


    legs.forEach(
        (leg) => {
            if (
                !leg.travel_to_city ||
                leg.travel_to_latitude ==
                    null ||
                leg.travel_to_longitude ==
                    null
            ) {
                return;
            }


            /*
             * Don't count returning
             * home as an away-city visit.
             */
            if (
                leg.travel_to_city ===
                leg.team_home_city
            ) {
                return;
            }


            const key =
                `${leg.travel_to_city}|${leg.travel_to_latitude}|${leg.travel_to_longitude}`;


            const current =
                cities.get(
                    key
                );


            if (current) {
                current.count +=
                    1;
            } else {
                cities.set(
                    key,
                    {
                        key,
                        city:
                            leg.travel_to_city,
                        latitude:
                            leg.travel_to_latitude,
                        longitude:
                            leg.travel_to_longitude,
                        count:
                            1,
                    }
                );
            }
        }
    );


    return Array.from(
        cities.values()
    );
}


function tripColour(
    index: number
) {
    const colours = [
        "#3b82f6",
        "#06b6d4",
        "#8b5cf6",
        "#10b981",
        "#f59e0b",
        "#ec4899",
        "#14b8a6",
        "#6366f1",
    ];

    return colours[
        index %
        colours.length
    ];
}