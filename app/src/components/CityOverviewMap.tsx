"use client";

import { useMemo, useState } from "react";
import {
    MapContainer,
    Marker,
    Popup,
    TileLayer,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Point = {
    name: string | null;
    address?: string | null;
    latitude: number;
    longitude: number;
};

type ResidentialArea = {
    rank: number;
    name: string;
    reason: string;
    latitude: number;
    longitude: number;
};

type CityOverviewMapProps = {
    cityLatitude: number;
    cityLongitude: number;
    arena: Point[];
    practiceFacility: Point[];
    residentialAreas: ResidentialArea[];
    airports: Point[];
    hospitals: Point[];
    schools: Point[];
    restaurants: Point[];
    shopping: Point[];
    golfClubs: Point[];
    countryClubs: Point[];
    ski: Point[];
    beaches: Point[];
    marinas: Point[];
};

type LayerKey =
    | "residential"
    | "arena"
    | "practice"
    | "airports"
    | "hospitals"
    | "schools"
    | "restaurants"
    | "shopping"
    | "golf"
    | "countryClubs"
    | "ski"
    | "beaches"
    | "marinas";

const layerConfig: {
    key: LayerKey;
    label: string;
    icon: string;
}[] = [
    { key: "residential", label: "Residential Areas", icon: "⌂" },
    { key: "arena", label: "Arena", icon: "🏟" },
    { key: "practice", label: "Practice Facility", icon: "⛸" },
    { key: "airports", label: "Airports", icon: "✈" },
    { key: "hospitals", label: "Hospitals", icon: "✚" },
    { key: "schools", label: "Schools", icon: "🎓" },
    { key: "restaurants", label: "Restaurants", icon: "🍴" },
    { key: "shopping", label: "Shopping", icon: "🛍" },
    { key: "golf", label: "Golf Clubs", icon: "⚑" },
    { key: "countryClubs", label: "Country Clubs", icon: "♜" },
    { key: "ski", label: "Ski", icon: "❄" },
    { key: "beaches", label: "Beaches", icon: "☂" },
    { key: "marinas", label: "Marinas", icon: "⚓" },
];

export default function CityOverviewMap({
    cityLatitude,
    cityLongitude,
    arena,
    practiceFacility,
    residentialAreas,
    airports,
    hospitals,
    schools,
    restaurants,
    shopping,
    golfClubs,
    countryClubs,
    ski,
    beaches,
    marinas,
}: CityOverviewMapProps) {
    const [visibleLayers, setVisibleLayers] = useState<Set<LayerKey>>(
        new Set(["residential", "arena", "practice"])
    );

    const toggleLayer = (layer: LayerKey) => {
        setVisibleLayers((current) => {
            const next = new Set(current);

            if (next.has(layer)) {
                next.delete(layer);
            } else {
                next.add(layer);
            }

            return next;
        });
    };

    const clean = useMemo(
        () => ({
            airports: cleanPoints(airports),
            hospitals: cleanPoints(hospitals),
            schools: cleanPoints(schools),
            restaurants: cleanPoints(restaurants),
            shopping: cleanPoints(shopping),
            golfClubs: cleanPoints(golfClubs),
            countryClubs: cleanPoints(countryClubs),
            ski: cleanPoints(ski),
            beaches: cleanPoints(beaches),
            marinas: cleanPoints(marinas),
        }),
        [
            airports,
            hospitals,
            schools,
            restaurants,
            shopping,
            golfClubs,
            countryClubs,
            ski,
            beaches,
            marinas,
        ]
    );

    return (
        <div className="space-y-5">
            <div>
                <p className="text-lg font-semibold text-white">
                    Explore the city
                </p>
                <p className="mt-1 text-sm text-slate-400">
                    Show or hide points of interest on the map.
                </p>
            </div>

            <div className="flex flex-wrap gap-2">
                {layerConfig.map((layer) => {
                    const active = visibleLayers.has(layer.key);

                    return (
                        <button
                            key={layer.key}
                            type="button"
                            onClick={() => toggleLayer(layer.key)}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                active
                                    ? "border-blue-500 bg-blue-500/10 text-blue-300"
                                    : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600"
                            }`}
                        >
                            <span className="text-base">
                                {layer.icon}
                            </span>

                            <span>{layer.label}</span>

                            {active && (
                                <span className="text-blue-400">
                                    ✓
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="overflow-hidden rounded-xl border border-slate-800">
                    <MapContainer
                        center={[cityLatitude, cityLongitude]}
                        zoom={10}
                        scrollWheelZoom
                        className="h-[560px] w-full"
                    >
                        <TileLayer
                            attribution="&copy; OpenStreetMap contributors"
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        {visibleLayers.has("arena") &&
                            arena.map((item, index) => (
                                <Marker
                                    key={`arena-${index}`}
                                    position={[
                                        item.latitude,
                                        item.longitude,
                                    ]}
                                    icon={markerIcon("🏟")}
                                >
                                    <Popup>
                                        <strong>
                                            {item.name ?? "Arena"}
                                        </strong>

                                        {item.address && (
                                            <>
                                                <br />
                                                {item.address}
                                            </>
                                        )}
                                    </Popup>
                                </Marker>
                            ))}

                        {visibleLayers.has("practice") &&
                            practiceFacility.map((item, index) => (
                                <Marker
                                    key={`practice-${index}`}
                                    position={[
                                        item.latitude,
                                        item.longitude,
                                    ]}
                                    icon={markerIcon("⛸")}
                                >
                                    <Popup>
                                        <strong>
                                            {item.name ??
                                                "Practice Facility"}
                                        </strong>

                                        {item.address && (
                                            <>
                                                <br />
                                                {item.address}
                                            </>
                                        )}
                                    </Popup>
                                </Marker>
                            ))}

                        {visibleLayers.has("residential") &&
                            residentialAreas.map((area) => (
                                <Marker
                                    key={`${area.rank}-${area.name}`}
                                    position={[
                                        area.latitude,
                                        area.longitude,
                                    ]}
                                    icon={residentialIcon(area.rank)}
                                >
                                    <Popup>
                                        <strong>
                                            {area.rank}. {area.name}
                                        </strong>
                                        <br />
                                        {area.reason}
                                    </Popup>
                                </Marker>
                            ))}

                        {visibleLayers.has("airports") &&
                            renderPoints(
                                clean.airports,
                                "airport",
                                "✈"
                            )}

                        {visibleLayers.has("hospitals") &&
                            renderPoints(
                                clean.hospitals,
                                "hospital",
                                "✚"
                            )}

                        {visibleLayers.has("schools") &&
                            renderPoints(
                                clean.schools,
                                "school",
                                "🎓"
                            )}

                        {visibleLayers.has("restaurants") &&
                            renderPoints(
                                clean.restaurants,
                                "restaurant",
                                "🍴"
                            )}

                        {visibleLayers.has("shopping") &&
                            renderPoints(
                                clean.shopping,
                                "shopping",
                                "🛍"
                            )}

                        {visibleLayers.has("golf") &&
                            renderPoints(
                                clean.golfClubs,
                                "golf",
                                "⚑"
                            )}

                        {visibleLayers.has("countryClubs") &&
                            renderPoints(
                                clean.countryClubs,
                                "country-club",
                                "♜"
                            )}

                        {visibleLayers.has("ski") &&
                            renderPoints(
                                clean.ski,
                                "ski",
                                "❄"
                            )}

                        {visibleLayers.has("beaches") &&
                            renderPoints(
                                clean.beaches,
                                "beach",
                                "☂"
                            )}

                        {visibleLayers.has("marinas") &&
                            renderPoints(
                                clean.marinas,
                                "marina",
                                "⚓"
                            )}
                    </MapContainer>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
                    <p className="text-lg font-semibold text-white">
                        Key
                    </p>

                    <div className="mt-5 space-y-5">
                        <KeyGroup
                            title="Core Locations"
                            items={[
                                ["🏟", "Arena"],
                                ["⛸", "Practice Facility"],
                                ["⌂", "Player Residential Areas"],
                            ]}
                        />

                        <KeyGroup
                            title="Transportation"
                            items={[["✈", "Airports"]]}
                        />

                        <KeyGroup
                            title="Health"
                            items={[["✚", "Hospitals"]]}
                        />

                        <KeyGroup
                            title="Education"
                            items={[["🎓", "Schools"]]}
                        />

                        <KeyGroup
                            title="Lifestyle"
                            items={[
                                ["🍴", "Restaurants"],
                                ["🛍", "Shopping"],
                                ["⚑", "Golf Clubs"],
                                ["♜", "Country Clubs"],
                                ["❄", "Ski"],
                            ]}
                        />

                        <KeyGroup
                            title="Recreation"
                            items={[
                                ["☂", "Beaches"],
                                ["⚓", "Marinas"],
                            ]}
                        />
                    </div>

                    <p className="mt-6 text-xs leading-5 text-slate-500">
                        Click any marker on the map for more
                        information.
                    </p>
                </div>
            </div>
        </div>
    );
}

function markerIcon(icon: string) {
    return L.divIcon({
        className: "",
        html: `
            <div style="
                width:36px;
                height:36px;
                border-radius:9999px;
                background:#0f172a;
                border:2px solid #64748b;
                color:#f8fafc;
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:17px;
                box-shadow:0 3px 10px rgba(0,0,0,.4);
            ">
                ${icon}
            </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20],
    });
}

function residentialIcon(rank: number) {
    return L.divIcon({
        className: "",
        html: `
            <div style="
                width:38px;
                height:38px;
                border-radius:9999px 9999px 9999px 0;
                transform:rotate(-45deg);
                background:#166534;
                border:2px solid #4ade80;
                color:white;
                display:flex;
                align-items:center;
                justify-content:center;
                box-shadow:0 3px 10px rgba(0,0,0,.4);
            ">
                <div style="
                    transform:rotate(45deg);
                    font-weight:700;
                    font-size:14px;
                ">
                    ${rank}
                </div>
            </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38],
    });
}

function renderPoints(
    points: Point[],
    keyPrefix: string,
    icon: string
) {
    return points.map((item, index) => (
        <Marker
            key={`${keyPrefix}-${index}`}
            position={[item.latitude, item.longitude]}
            icon={markerIcon(icon)}
        >
            <Popup>
                <strong>{item.name}</strong>

                {item.address && (
                    <>
                        <br />
                        {item.address}
                    </>
                )}
            </Popup>
        </Marker>
    ));
}

function cleanPoints(points: Point[]) {
    return points.filter(
        (item) =>
            item.name &&
            Number.isFinite(item.latitude) &&
            Number.isFinite(item.longitude)
    );
}

function KeyGroup({
    title,
    items,
}: {
    title: string;
    items: [string, string][];
}) {
    return (
        <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                {title}
            </p>

            <div className="space-y-2">
                {items.map(([icon, label]) => (
                    <div
                        key={label}
                        className="flex items-center gap-3"
                    >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-base">
                            {icon}
                        </div>

                        <span className="text-sm text-slate-300">
                            {label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}