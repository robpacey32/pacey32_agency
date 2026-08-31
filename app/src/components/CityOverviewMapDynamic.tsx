"use client";

import dynamic from "next/dynamic";

const CityOverviewMap = dynamic(
    () => import("@/components/CityOverviewMap"),
    {
        ssr: false,
        loading: () => (
            <div className="h-[560px] w-full animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
        ),
    }
);

export default CityOverviewMap;