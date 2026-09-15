"use client";

import dynamic from "next/dynamic";

const CityLocationMap = dynamic(
    () => import("@/components/CityLocationMap"),
    {
        ssr: false,
        loading: () => (
            <div className="h-[320px] w-full min-w-0 max-w-full animate-pulse rounded-xl border border-slate-800 bg-slate-900 sm:h-[400px] lg:h-[480px]" />
        ),
    }
);

export default CityLocationMap;