"use client";

import {
    Building2,
    CalendarDays,
    GraduationCap,
    MapPin,
    Shield,
    UsersRound,
} from "lucide-react";

export type AhlAffiliateDetail = {
    tricode: string;
    fullName: string;
    home_logo: string | null;

    ahl_team: string | null;
    ahl_city: string | null;
    ahl_arena: string | null;
    ahl_capacity:
        | number
        | string
        | null;
    ahl_founded:
        | number
        | string
        | null;
    ahl_joined:
        | number
        | string
        | null;
    ahl_current_city_since:
        | number
        | string
        | null;
    ahl_head_coach: string | null;

    ahl_logo_url: string | null;
};

export type AhlAffiliateData = {
    team: string;
    affiliate: AhlAffiliateDetail;
};

type Props = {
    data: AhlAffiliateData;
};

export default function AhlAffiliatePanel({
    data,
}: Props) {
    const affiliate =
        data.affiliate;

    return (
        <div className="w-full min-w-0 max-w-full space-y-5">

            {/* AFFILIATE OVERVIEW */}
            <section className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_1fr] lg:gap-6">

                    {/* AHL TEAM */}
                    <div className="flex min-w-0 flex-col items-center gap-5 rounded-xl border border-slate-800 bg-slate-950/50 p-5 text-center sm:flex-row sm:items-center sm:gap-6 sm:p-7 sm:text-left">
                        <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 p-3 sm:h-32 sm:w-32">
                            {affiliate.ahl_logo_url ? (
                                <img
                                    src={
                                        affiliate.ahl_logo_url
                                    }
                                    alt={
                                        affiliate.ahl_team ??
                                        "AHL affiliate"
                                    }
                                    className="max-h-full max-w-full object-contain"
                                />
                            ) : (
                                <Shield
                                    size={56}
                                    className="text-blue-400"
                                />
                            )}
                        </div>

                        <div className="min-w-0">
                            <div className="text-xs font-semibold uppercase tracking-wide text-blue-400">
                                AHL Affiliate
                            </div>

                            <h2 className="mt-2 break-words text-2xl font-bold text-white sm:text-3xl">
                                {affiliate.ahl_team ??
                                    "—"}
                            </h2>

                            <div className="mt-3 flex items-center justify-center gap-2 text-slate-400 sm:justify-start">
                                <MapPin
                                    size={17}
                                    className="shrink-0"
                                />

                                <span className="break-words">
                                    {affiliate.ahl_city ??
                                        "—"}
                                </span>
                            </div>

                            {affiliate.ahl_joined && (
                                <div className="mt-2 flex items-center justify-center gap-2 text-slate-400 sm:justify-start">
                                    <CalendarDays
                                        size={17}
                                        className="shrink-0"
                                    />

                                    <span>
                                        AHL member since{" "}
                                        {
                                            affiliate.ahl_joined
                                        }
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>


                    {/* DEVELOPMENT PATHWAY */}
                    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/50 p-5 sm:p-7">
                        <div className="flex items-center gap-3">
                            <GraduationCap
                                size={22}
                                className="shrink-0 text-violet-400"
                            />

                            <div className="text-sm font-semibold uppercase tracking-wide text-white">
                                Development Pathway
                            </div>
                        </div>

                        <p className="mt-5 text-sm leading-7 text-slate-300">
                            {
                                affiliate.ahl_team
                            }{" "}
                            serves as the American
                            Hockey League affiliate
                            of{" "}
                            {
                                affiliate.fullName
                            },
                            providing the primary
                            professional development
                            pathway between the
                            organisation&apos;s
                            prospects and the NHL
                            roster.
                        </p>

                        {affiliate.home_logo && (
                            <div className="mt-6 flex min-w-0 items-center gap-4 border-t border-slate-800 pt-5">
                                <img
                                    src={
                                        affiliate.home_logo
                                    }
                                    alt={
                                        affiliate.fullName
                                    }
                                    className="h-12 w-12 shrink-0 object-contain"
                                />

                                <div className="min-w-0">
                                    <div className="text-xs uppercase tracking-wide text-slate-500">
                                        NHL Parent Club
                                    </div>

                                    <div className="mt-1 break-words font-semibold text-white">
                                        {
                                            affiliate.fullName
                                        }
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>


            {/* AFFILIATE DETAILS */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">

                <InfoCard
                    icon={
                        <Building2
                            size={22}
                        />
                    }
                    label="Arena"
                    value={
                        affiliate.ahl_arena
                    }
                    detail={
                        affiliate.ahl_city
                    }
                />

                <InfoCard
                    icon={
                        <UsersRound
                            size={22}
                        />
                    }
                    label="Capacity"
                    value={
                        formatNumber(
                            affiliate.ahl_capacity
                        )
                    }
                    detail="Seating capacity"
                />

                <InfoCard
                    icon={
                        <CalendarDays
                            size={22}
                        />
                    }
                    label="Founded"
                    value={
                        affiliate.ahl_founded
                    }
                    detail="Franchise founded"
                />

                <InfoCard
                    icon={
                        <GraduationCap
                            size={22}
                        />
                    }
                    label="Joined AHL"
                    value={
                        affiliate.ahl_joined
                    }
                    detail="AHL member since"
                />

                <InfoCard
                    icon={
                        <MapPin
                            size={22}
                        />
                    }
                    label="Current City"
                    value={
                        affiliate.ahl_current_city_since
                    }
                    detail="In current city since"
                />

            </section>


            {/* COACH + RELATIONSHIP */}
            <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr]">

                {/* HEAD COACH */}
                <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-400">
                        Head Coach
                    </div>

                    <div className="mt-5 flex min-w-0 items-center gap-4 sm:gap-5">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-slate-500 sm:h-20 sm:w-20">
                            <UsersRound
                                size={34}
                                className="sm:hidden"
                            />

                            <UsersRound
                                size={38}
                                className="hidden sm:block"
                            />
                        </div>

                        <div className="min-w-0">
                            <div className="break-words text-xl font-bold text-white sm:text-2xl">
                                {affiliate.ahl_head_coach ??
                                    "—"}
                            </div>

                            <div className="mt-1 text-sm text-slate-400">
                                Head Coach
                            </div>
                        </div>
                    </div>
                </div>


                {/* AFFILIATE RELATIONSHIP */}
                <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
                    <div className="text-xs font-semibold uppercase tracking-wide text-violet-400">
                        Affiliate Relationship
                    </div>

                    <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5">

                        {/* AHL */}
                        <div className="min-w-0 text-center">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 p-2 sm:h-20 sm:w-20">
                                {affiliate.ahl_logo_url ? (
                                    <img
                                        src={
                                            affiliate.ahl_logo_url
                                        }
                                        alt={
                                            affiliate.ahl_team ??
                                            "AHL affiliate"
                                        }
                                        className="max-h-full max-w-full object-contain"
                                    />
                                ) : (
                                    <Shield
                                        size={38}
                                        className="text-blue-400"
                                    />
                                )}
                            </div>

                            <div className="mt-3 break-words text-sm font-semibold text-white sm:text-base">
                                {affiliate.ahl_team ??
                                    "—"}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                                AHL
                            </div>
                        </div>


                        {/* CONNECTION */}
                        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                            <div className="h-px w-3 bg-slate-700 sm:w-12" />

                            <GraduationCap
                                size={20}
                                className="shrink-0 text-violet-400 sm:hidden"
                            />

                            <GraduationCap
                                size={22}
                                className="hidden shrink-0 text-violet-400 sm:block"
                            />

                            <div className="h-px w-3 bg-slate-700 sm:w-12" />
                        </div>


                        {/* NHL */}
                        <div className="min-w-0 text-center">
                            {affiliate.home_logo ? (
                                <div className="mx-auto flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20">
                                    <img
                                        src={
                                            affiliate.home_logo
                                        }
                                        alt={
                                            affiliate.fullName
                                        }
                                        className="h-16 w-16 object-contain sm:h-20 sm:w-20"
                                    />
                                </div>
                            ) : (
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 sm:h-20 sm:w-20">
                                    <Shield
                                        size={38}
                                    />
                                </div>
                            )}

                            <div className="mt-3 break-words text-sm font-semibold text-white sm:text-base">
                                {
                                    affiliate.fullName
                                }
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                                NHL
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}


function InfoCard({
    icon,
    label,
    value,
    detail,
}: {
    icon: React.ReactNode;
    label: string;
    value:
        | string
        | number
        | null;
    detail?: string | null;
}) {
    return (
        <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <div className="flex items-center gap-3 text-blue-400">
                <div className="shrink-0">
                    {icon}
                </div>

                <div className="text-xs font-semibold uppercase tracking-wide">
                    {label}
                </div>
            </div>

            <div className="mt-5 break-words text-lg font-bold text-white sm:text-xl">
                {value ?? "—"}
            </div>

            {detail && (
                <div className="mt-2 break-words text-sm text-slate-500">
                    {detail}
                </div>
            )}
        </div>
    );
}


function formatNumber(
    value:
        | number
        | string
        | null
) {
    if (value == null) {
        return "—";
    }

    const number =
        Number(value);

    if (
        Number.isNaN(number)
    ) {
        return String(value);
    }

    return number.toLocaleString();
}