"use client";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type CityLocationMapProps = {
    latitude: number;
    longitude: number;
    city: string;
    teamName: string;
    logo: string;
};

export default function CityLocationMap({
    latitude,
    longitude,
    city,
    teamName,
    logo,
}: CityLocationMapProps) {
    const logoIcon = L.divIcon({
        className: "",
        html: `
            <div style="
                width:54px;
                height:54px;
                border-radius:9999px;
                border:2px solid #64748b;
                background:#020617;
                display:flex;
                align-items:center;
                justify-content:center;
                box-shadow:0 4px 12px rgba(0,0,0,.35);
            ">
                <img
                    src="${logo}"
                    alt="${teamName}"
                    style="width:38px;height:38px;object-fit:contain;"
                />
            </div>
        `,
        iconSize: [54, 54],
        iconAnchor: [27, 27],
        popupAnchor: [0, -28],
    });

    return (
        <div className="overflow-hidden rounded-xl border border-slate-800">
            <MapContainer
                center={[latitude, longitude]}
                zoom={4}
                scrollWheelZoom={false}
                className="h-[480px] w-full"
            >
                <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <Marker
                    position={[latitude, longitude]}
                    icon={logoIcon}
                >
                    <Popup>
                        <div className="text-sm">
                            <strong>{teamName}</strong>
                            <br />
                            {city}
                        </div>
                    </Popup>
                </Marker>
            </MapContainer>
        </div>
    );
}