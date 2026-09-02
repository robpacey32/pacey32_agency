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
        <div className="space-y-5">

            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="grid min-w-[900px] grid-cols-[1.15fr_1fr] gap-6">

                    <div className="flex items-center gap-6 rounded-xl border border-slate-800 bg-slate-950/50 p-7">
                        <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 p-3">
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

                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-blue-400">
                                AHL Affiliate
                            </div>

                            <h2 className="mt-2 text-3xl font-bold text-white">
                                {affiliate.ahl_team ??
                                    "—"}
                            </h2>

                            <div className="mt-3 flex items-center gap-2 text-slate-400">
                                <MapPin
                                    size={17}
                                />

                                <span>
                                    {affiliate.ahl_city ??
                                        "—"}
                                </span>
                            </div>

                            {affiliate.ahl_joined && (
                                <div className="mt-2 flex items-center gap-2 text-slate-400">
                                    <CalendarDays
                                        size={17}
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

                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-7">
                        <div className="flex items-center gap-3">
                            <GraduationCap
                                size={22}
                                className="text-violet-400"
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
                            <div className="mt-6 flex items-center gap-4 border-t border-slate-800 pt-5">
                                <img
                                    src={
                                        affiliate.home_logo
                                    }
                                    alt={
                                        affiliate.fullName
                                    }
                                    className="h-12 w-12 object-contain"
                                />

                                <div>
                                    <div className="text-xs uppercase tracking-wide text-slate-500">
                                        NHL Parent Club
                                    </div>

                                    <div className="mt-1 font-semibold text-white">
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

            <section className="grid min-w-[1000px] grid-cols-5 gap-4 overflow-x-auto">

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

            <section className="grid min-w-[900px] grid-cols-[1fr_1.4fr] gap-5 overflow-x-auto">

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-400">
                        Head Coach
                    </div>

                    <div className="mt-5 flex items-center gap-5">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-slate-500">
                            <UsersRound
                                size={38}
                            />
                        </div>

                        <div>
                            <div className="text-2xl font-bold text-white">
                                {affiliate.ahl_head_coach ??
                                    "—"}
                            </div>

                            <div className="mt-1 text-sm text-slate-400">
                                Head Coach
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
                    <div className="text-xs font-semibold uppercase tracking-wide text-violet-400">
                        Affiliate Relationship
                    </div>

                    <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-5">

                        <div className="text-center">
                            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 p-2">
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

                            <div className="mt-3 font-semibold text-white">
                                {affiliate.ahl_team ??
                                    "—"}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                                AHL
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="h-px w-12 bg-slate-700" />

                            <GraduationCap
                                size={22}
                                className="text-violet-400"
                            />

                            <div className="h-px w-12 bg-slate-700" />
                        </div>

                        <div className="text-center">
                            {affiliate.home_logo ? (
                                <div className="mx-auto flex h-20 w-20 items-center justify-center">
                                    <img
                                        src={
                                            affiliate.home_logo
                                        }
                                        alt={
                                            affiliate.fullName
                                        }
                                        className="h-20 w-20 object-contain"
                                    />
                                </div>
                            ) : (
                                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-xl border border-slate-700 bg-slate-950">
                                    <Shield
                                        size={38}
                                    />
                                </div>
                            )}

                            <div className="mt-3 font-semibold text-white">
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
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center gap-3 text-blue-400">
                {icon}

                <div className="text-xs font-semibold uppercase tracking-wide">
                    {label}
                </div>
            </div>

            <div className="mt-5 text-xl font-bold text-white">
                {value ?? "—"}
            </div>

            {detail && (
                <div className="mt-2 text-sm text-slate-500">
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