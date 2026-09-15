"use client";

import dynamic from "next/dynamic";

const CityOverviewMap = dynamic(
    () => import("@/components/CityOverviewMap"),
    {
        ssr: false,
        loading: () => (
            <div className="h-[400px] w-full min-w-0 max-w-full animate-pulse rounded-xl border border-slate-800 bg-slate-900 sm:h-[480px] lg:h-[560px]" />
        ),
    }
);

export default CityOverviewMap;