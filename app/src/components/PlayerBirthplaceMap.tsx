"use client";

import {
    useEffect,
    useRef,
} from "react";

import L from "leaflet";

import "leaflet/dist/leaflet.css";

type PlayerBirthplaceMapProps = {
    latitude: number;
    longitude: number;
    label: string;
};

export default function PlayerBirthplaceMap({
    latitude,
    longitude,
    label,
}: PlayerBirthplaceMapProps) {
    const mapElementRef =
        useRef<HTMLDivElement | null>(
            null
        );

    const mapRef =
        useRef<L.Map | null>(
            null
        );

    useEffect(() => {
        if (!mapElementRef.current) {
            return;
        }

        /*
         * Important for React Strict Mode /
         * component remounts.
         */
        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
        }

        const map = L.map(
            mapElementRef.current,
            {
                center: [
                    latitude,
                    longitude,
                ],
                zoom: 8,
                scrollWheelZoom: false,
            }
        );

        mapRef.current = map;

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                attribution:
                    "&copy; OpenStreetMap contributors",
            }
        ).addTo(map);

        L.circleMarker(
            [
                latitude,
                longitude,
            ],
            {
                radius: 8,
                color: "#ffffff",
                fillColor: "#2563eb",
                fillOpacity: 1,
                weight: 3,
            }
        ).addTo(map);

        /*
         * Ensure Leaflet calculates the final
         * expanded panel dimensions.
         */
        window.setTimeout(
            () => {
                map.invalidateSize();
            },
            100
        );

        return () => {
            map.remove();

            if (
                mapRef.current ===
                map
            ) {
                mapRef.current = null;
            }
        };
    }, [
        latitude,
        longitude,
    ]);

    return (
        <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-800">

            <div
                ref={mapElementRef}
                className="h-[240px] w-full min-w-0 sm:h-[280px] lg:h-[320px]"
            />

            <div className="pointer-events-none absolute left-3 right-3 top-3 z-[500] w-fit max-w-[calc(100%-1.5rem)] break-words rounded-lg bg-slate-950/90 px-3 py-2 text-xs font-semibold text-white sm:left-4 sm:right-auto sm:top-4 sm:max-w-[calc(100%-2rem)] sm:px-4 sm:text-sm">
                {label}
            </div>

        </div>
    );
}