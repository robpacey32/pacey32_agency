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
        <div className="relative overflow-hidden rounded-xl border border-slate-800">

            <div
                ref={mapElementRef}
                className="h-[320px] w-full"
            />

            <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-lg bg-slate-950/90 px-4 py-2 text-sm font-semibold text-white">
                {label}
            </div>

        </div>
    );
}