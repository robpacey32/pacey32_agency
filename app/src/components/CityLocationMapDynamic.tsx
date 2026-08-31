"use client";

import dynamic from "next/dynamic";

const CityLocationMap = dynamic(
    () => import("@/components/CityLocationMap"),
    {
        ssr: false,
        loading: () => (
            <div className="h-[360px] w-full animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
        ),
    }
);

export default CityLocationMap;