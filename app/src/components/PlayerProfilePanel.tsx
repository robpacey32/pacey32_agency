"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
    CalendarDays,
    Flag,
    Hash,
    Ruler,
    Scale,
    Shirt,
    Target,
} from "lucide-react";

const PlayerBirthplaceMap = dynamic(
    () => import("./PlayerBirthplaceMap"),
    {
        ssr: false,
    }
);

export type PlayerProfileData = {
    playerId: number;
    player_name: string;
    is_active: boolean;

    current_team_id: number | null;
    team_code: string | null;
    team_name: string | null;
    team_logo: string | null;

    sweater_number: number | null;
    position: string | null;
    shoots_catches: string | null;

    height_inches: number | null;
    height_cm: number | null;
    weight_lbs: number | null;
    weight_kg: number | null;

    birth_date:
        | { value: string }
        | string
        | null;

    age: number | null;
    birth_city: string | null;
    birth_country: string | null;
    nationality: string | null;
    birth_latitude: number | null;
    birth_longitude: number | null;
    birth_matched_address: string | null;

    draft_year: number | null;
    draft_team: string | null;
    draft_round: number | null;
    draft_pick_in_round: number | null;
    draft_overall: number | null;

    headshot: string | null;
    hero_image: string | null;

    top_100_all_time: number | boolean | null;
    hall_of_fame: number | boolean | null;

    rs_games: number | null;
    rs_goals: number | null;
    rs_assists: number | null;
    rs_points: number | null;
    rs_pim: number | null;
    rs_shots: number | null;
    rs_shooting_pct: number | null;
    rs_pp_goals: number | null;
    rs_pp_points: number | null;
    rs_sh_goals: number | null;
    rs_sh_points: number | null;
    rs_gw_goals: number | null;
    rs_ot_goals: number | null;
    rs_plus_minus: number | null;
    rs_faceoff_pct: number | null;
    rs_avg_toi: string | null;

    rs_games_started: number | null;
    rs_wins: number | null;
    rs_losses: number | null;
    rs_ot_losses: number | null;
    rs_ties: number | null;
    rs_goals_against: number | null;
    rs_goals_against_avg: number | null;
    rs_shots_against: number | null;
    rs_save_pct: number | null;
    rs_shutouts: number | null;
    rs_time_on_ice: string | null;

    po_games: number | null;
    po_goals: number | null;
    po_assists: number | null;
    po_points: number | null;
    po_pim: number | null;
    po_shots: number | null;
    po_shooting_pct: number | null;
    po_pp_goals: number | null;
    po_pp_points: number | null;
    po_sh_goals: number | null;
    po_sh_points: number | null;
    po_gw_goals: number | null;
    po_ot_goals: number | null;
    po_plus_minus: number | null;
    po_faceoff_pct: number | null;
    po_avg_toi: string | null;

    po_games_started: number | null;
    po_wins: number | null;
    po_losses: number | null;
    po_ot_losses: number | null;
    po_ties: number | null;
    po_goals_against: number | null;
    po_goals_against_avg: number | null;
    po_shots_against: number | null;
    po_save_pct: number | null;
    po_shutouts: number | null;
    po_time_on_ice: string | null;
};

type Props = {
    data: PlayerProfileData;
};

type UnitMode = "imperial" | "metric";

export default function PlayerProfilePanel({
    data,
}: Props) {
    const [unitMode, setUnitMode] =
        useState<UnitMode>("imperial");

    const isGoalie =
        data.position === "G";

    const draftLogo =
        data.draft_team
            ? `https://assets.nhle.com/logos/nhl/svg/${data.draft_team}_light.svg`
            : null;

    const birthplaceLabel =
        data.birth_matched_address ??
        [
            data.birth_city,
            data.birth_country
                ? countryName(
                      data.birth_country
                  )
                : null,
        ]
            .filter(Boolean)
            .join(", ");

    const nationalityFlag =
        nationalityCode(
            data.nationality
        );

    return (
        <div className="w-full min-w-0 max-w-full space-y-5">

            {/* HERO */}

            <div className="flex w-full min-w-0 justify-start">
                <section className="relative h-[400px] w-full min-w-0 max-w-[1050px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 sm:h-[440px] lg:h-[500px]">

                    {data.hero_image && (
                        <img
                            src={data.hero_image}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover object-center"
                        />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/65 to-slate-950/20 sm:via-slate-950/55 sm:to-slate-950/10" />

                    <div className="relative flex h-full min-w-0 items-end gap-3 px-4 pt-4 sm:gap-6 sm:px-6 sm:pt-6 lg:gap-8 lg:px-8 lg:pt-8">

                        <div className="flex h-full shrink-0 items-end">

                            {data.headshot ? (
                                <img
                                    src={data.headshot}
                                    alt={data.player_name}
                                    className="h-auto max-h-[58%] w-28 object-contain object-bottom sm:max-h-[68%] sm:w-40 lg:max-h-72 lg:w-52"
                                />
                            ) : (
                                <div className="h-48 w-28 sm:h-56 sm:w-40 lg:h-64 lg:w-52" />
                            )}

                        </div>

                        <div className="min-w-0 flex-1 pb-5 sm:pb-6 lg:pb-8">

                            <div className="flex min-w-0 items-center gap-2 sm:gap-3">

                                {data.team_logo && (
                                    <img
                                        src={data.team_logo}
                                        alt=""
                                        className="h-8 w-8 shrink-0 object-contain sm:h-10 sm:w-10 lg:h-11 lg:w-11"
                                    />
                                )}

                                <div className="min-w-0 break-words text-xs font-semibold uppercase tracking-wide text-slate-200 sm:text-sm">
                                    {data.team_name ??
                                        "No current team"}
                                </div>

                            </div>

                            <h2 className="mt-3 break-words text-2xl font-bold leading-tight text-white sm:mt-4 sm:text-3xl lg:text-4xl">
                                {data.player_name}
                            </h2>

                            <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4 sm:gap-3">

                                {data.sweater_number != null && (
                                    <HeroBadge>
                                        #{data.sweater_number}
                                    </HeroBadge>
                                )}

                                {data.position && (
                                    <HeroBadge>
                                        {data.position}
                                    </HeroBadge>
                                )}

                                {data.shoots_catches && (
                                    <HeroBadge>
                                        {isGoalie
                                            ? "Catches"
                                            : "Shoots"}{" "}
                                        {data.shoots_catches}
                                    </HeroBadge>
                                )}

                                {data.age != null && (
                                    <HeroBadge>
                                        {data.age} yrs
                                    </HeroBadge>
                                )}

                            </div>

                        </div>

                    </div>

                </section>
            </div>

            {/* MAIN GRID */}

            <section className="grid w-full min-w-0 grid-cols-1 gap-5 xl:grid-cols-[1.1fr_1fr]">

                {/* PERSONAL */}

                <ProfileSection
                    title="Personal"
                    action={
                        <UnitToggle
                            value={unitMode}
                            onChange={setUnitMode}
                        />
                    }
                >

                    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">

                        <ProfileMetric
                            icon={
                                <CalendarDays
                                    size={18}
                                />
                            }
                            label="Date of Birth"
                            value={formatBirthDate(
                                data.birth_date
                            )}
                        />

                        <ProfileMetric
                            icon={
                                <CalendarDays
                                    size={18}
                                />
                            }
                            label="Age"
                            value={
                                data.age != null
                                    ? data.age
                                    : "—"
                            }
                        />

                        <ProfileMetric
                            icon={
                                <Hash
                                    size={18}
                                />
                            }
                            label="Jersey Number"
                            value={
                                data.sweater_number !=
                                null
                                    ? data.sweater_number
                                    : "—"
                            }
                        />

                        <ProfileMetric
                            icon={
                                <Shirt
                                    size={18}
                                />
                            }
                            label="Position"
                            value={
                                data.position ??
                                "—"
                            }
                        />

                        <ProfileMetric
                            icon={
                                <Flag
                                    size={18}
                                />
                            }
                            label="Nationality"
                            value={
                                <div className="flex min-w-0 items-center gap-2">

                                    {nationalityFlag && (
                                        <img
                                            src={`https://flagcdn.com/24x18/${nationalityFlag}.png`}
                                            alt=""
                                            className="h-[18px] w-6 shrink-0 rounded-sm object-cover"
                                        />
                                    )}

                                    <span className="min-w-0 break-words">
                                        {data.nationality ??
                                            "—"}
                                    </span>

                                </div>
                            }
                        />

                        <ProfileMetric
                            icon={
                                <Flag
                                    size={18}
                                />
                            }
                            label="Birthplace"
                            value={
                                [
                                    data.birth_city,
                                    data.birth_country
                                        ? countryName(
                                              data.birth_country
                                          )
                                        : null,
                                ]
                                    .filter(Boolean)
                                    .join(", ") ||
                                "—"
                            }
                        />

                        <ProfileMetric
                            icon={
                                <Ruler
                                    size={18}
                                />
                            }
                            label="Height"
                            value={
                                unitMode ===
                                "imperial"
                                    ? data.height_inches !=
                                      null
                                        ? formatHeight(
                                              data.height_inches
                                          )
                                        : "—"
                                    : data.height_cm !=
                                        null
                                      ? `${data.height_cm} cm`
                                      : "—"
                            }
                        />

                        <ProfileMetric
                            icon={
                                <Scale
                                    size={18}
                                />
                            }
                            label="Weight"
                            value={
                                unitMode ===
                                "imperial"
                                    ? data.weight_lbs !=
                                      null
                                        ? `${data.weight_lbs} lbs`
                                        : "—"
                                    : data.weight_kg !=
                                        null
                                      ? `${data.weight_kg} kg`
                                      : "—"
                            }
                        />

                        <ProfileMetric
                            icon={
                                <Target
                                    size={18}
                                />
                            }
                            label={
                                isGoalie
                                    ? "Catches"
                                    : "Shoots"
                            }
                            value={
                                data.shoots_catches ??
                                "—"
                            }
                        />

                    </div>

                    {/* BIRTHPLACE MAP */}

                    <div className="mt-3 w-full min-w-0 overflow-hidden">

                        {data.birth_latitude !=
                            null &&
                        data.birth_longitude !=
                            null ? (
                            <PlayerBirthplaceMap
                                latitude={
                                    data.birth_latitude
                                }
                                longitude={
                                    data.birth_longitude
                                }
                                label={
                                    birthplaceLabel
                                }
                            />
                        ) : (
                            <div className="flex h-44 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/40">

                                <div className="px-4 text-center">

                                    <div className="text-sm font-semibold text-white">
                                        {[
                                            data.birth_city,
                                            data.birth_country
                                                ? countryName(
                                                      data.birth_country
                                                  )
                                                : null,
                                        ]
                                            .filter(
                                                Boolean
                                            )
                                            .join(
                                                ", "
                                            ) ||
                                            "Birthplace unavailable"}
                                    </div>

                                    <div className="mt-1 text-xs text-slate-500">
                                        Birthplace map unavailable
                                    </div>

                                </div>

                            </div>
                        )}

                    </div>

                </ProfileSection>

                {/* RIGHT COLUMN */}

                <div className="min-w-0 space-y-5">

                    {/* DRAFT */}

                    <ProfileSection title="Draft">

                        {data.draft_year ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">

                                <div className="col-span-2 flex min-h-24 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:col-span-1">

                                    {draftLogo ? (
                                        <img
                                            src={
                                                draftLogo
                                            }
                                            alt={
                                                data.draft_team ??
                                                ""
                                            }
                                            className="h-14 w-14 object-contain"
                                        />
                                    ) : (
                                        <span className="text-lg font-bold text-white">
                                            —
                                        </span>
                                    )}

                                </div>

                                <DraftMetric
                                    label="Year"
                                    value={
                                        data.draft_year
                                    }
                                />

                                <DraftMetric
                                    label="Round"
                                    value={
                                        data.draft_round ??
                                        "—"
                                    }
                                />

                                <DraftMetric
                                    label="Pick"
                                    value={
                                        data.draft_pick_in_round ??
                                        "—"
                                    }
                                />

                                <DraftMetric
                                    label="Overall"
                                    value={
                                        data.draft_overall !=
                                        null
                                            ? `#${data.draft_overall}`
                                            : "—"
                                    }
                                />

                            </div>
                        ) : (
                            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
                                <div className="text-lg font-semibold text-white">
                                    Undrafted
                                </div>
                            </div>
                        )}

                    </ProfileSection>

                    {/* CAREER STATS */}

                    <ProfileSection title="Career Statistics">

                        <CareerSection
                            title="Regular Season"
                            metrics={
                                isGoalie
                                    ? buildRegularGoalieMetrics(
                                          data
                                      )
                                    : buildRegularSkaterMetrics(
                                          data
                                      )
                            }
                        />

                        <CareerSection
                            title="Playoffs"
                            metrics={
                                isGoalie
                                    ? buildPlayoffGoalieMetrics(
                                          data
                                      )
                                    : buildPlayoffSkaterMetrics(
                                          data
                                      )
                            }
                        />

                    </ProfileSection>

                </div>

            </section>

        </div>
    );
}

function buildRegularSkaterMetrics(
    data: PlayerProfileData
) {
    return cleanMetrics([
        metric("GP", data.rs_games),
        metric("G", data.rs_goals),
        metric("A", data.rs_assists),
        metric("P", data.rs_points),
        metric("+/-", data.rs_plus_minus),
        metric("PIM", data.rs_pim),
        metric("Shots", data.rs_shots),
        metric(
            "S%",
            percent(
                data.rs_shooting_pct
            )
        ),
        metric("PPG", data.rs_pp_goals),
        metric("PPP", data.rs_pp_points),
        metric("SHG", data.rs_sh_goals),
        metric("SHP", data.rs_sh_points),
        metric("GWG", data.rs_gw_goals),
        metric("OTG", data.rs_ot_goals),
        metric(
            "FO%",
            percent(
                data.rs_faceoff_pct
            )
        ),
        metric("ATOI", data.rs_avg_toi),
    ]);
}

function buildPlayoffSkaterMetrics(
    data: PlayerProfileData
) {
    const noPlayoffs =
        !data.po_games;

    return [
        metric("GP", data.po_games ?? 0),
        metric("G", noPlayoffs ? 0 : data.po_goals ?? 0),
        metric("A", noPlayoffs ? 0 : data.po_assists ?? 0),
        metric("P", noPlayoffs ? 0 : data.po_points ?? 0),
        metric("+/-", noPlayoffs ? 0 : data.po_plus_minus ?? 0),
        metric("PIM", noPlayoffs ? 0 : data.po_pim ?? 0),
        metric("Shots", noPlayoffs ? 0 : data.po_shots ?? 0),
        metric(
            "S%",
            noPlayoffs
                ? "0.0%"
                : percent(
                      data.po_shooting_pct ?? 0
                  )
        ),
        metric("PPG", noPlayoffs ? 0 : data.po_pp_goals ?? 0),
        metric("PPP", noPlayoffs ? 0 : data.po_pp_points ?? 0),
        metric("SHG", noPlayoffs ? 0 : data.po_sh_goals ?? 0),
        metric("SHP", noPlayoffs ? 0 : data.po_sh_points ?? 0),
        metric("GWG", noPlayoffs ? 0 : data.po_gw_goals ?? 0),
        metric("OTG", noPlayoffs ? 0 : data.po_ot_goals ?? 0),
        metric(
            "FO%",
            noPlayoffs
                ? "0.0%"
                : percent(
                      data.po_faceoff_pct ?? 0
                  )
        ),
        metric(
            "ATOI",
            noPlayoffs
                ? "0:00"
                : data.po_avg_toi ?? "0:00"
        ),
    ].filter(
        (
            item
        ): item is CareerMetric =>
            item !== null
    );
}

function buildRegularGoalieMetrics(
    data: PlayerProfileData
) {
    return cleanMetrics([
        metric("GP", data.rs_games),
        metric(
            "GS",
            data.rs_games_started
        ),
        metric("W", data.rs_wins),
        metric("L", data.rs_losses),
        metric(
            "OTL",
            data.rs_ot_losses
        ),
        metric("T", data.rs_ties),
        metric(
            "GA",
            data.rs_goals_against
        ),
        metric(
            "GAA",
            decimal(
                data.rs_goals_against_avg,
                2
            )
        ),
        metric(
            "SA",
            data.rs_shots_against
        ),
        metric(
            "SV%",
            savePercent(
                data.rs_save_pct
            )
        ),
        metric(
            "SO",
            data.rs_shutouts
        ),
        metric(
            "TOI",
            data.rs_time_on_ice
        ),
    ]);
}

function buildPlayoffGoalieMetrics(
    data: PlayerProfileData
) {
    return cleanMetrics([
        metric("GP", data.po_games),
        metric(
            "GS",
            data.po_games_started
        ),
        metric("W", data.po_wins),
        metric("L", data.po_losses),
        metric(
            "OTL",
            data.po_ot_losses
        ),
        metric("T", data.po_ties),
        metric(
            "GA",
            data.po_goals_against
        ),
        metric(
            "GAA",
            decimal(
                data.po_goals_against_avg,
                2
            )
        ),
        metric(
            "SA",
            data.po_shots_against
        ),
        metric(
            "SV%",
            savePercent(
                data.po_save_pct
            )
        ),
        metric(
            "SO",
            data.po_shutouts
        ),
        metric(
            "TOI",
            data.po_time_on_ice
        ),
    ]);
}

type CareerMetric = {
    label: string;
    value: string;
};

function cleanMetrics(
    metrics: Array<
        CareerMetric | null
    >
): CareerMetric[] {
    return metrics.filter(
        (
            item
        ): item is CareerMetric =>
            item !== null
    );
}

function metric(
    label: string,
    value:
        | string
        | number
        | null
        | undefined
): CareerMetric | null {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    return {
        label,
        value: String(value),
    };
}

function CareerSection({
    title,
    metrics,
}: {
    title: string;
    metrics: CareerMetric[];
}) {
    if (!metrics.length) {
        return null;
    }

    return (
        <div className="min-w-0">

            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {title}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">

                {metrics.map(
                    (
                        item,
                        index
                    ) => {
                        const primary =
                            index < 4;

                        return (
                            <div
                                key={`${title}-${item.label}-${index}`}
                                className={
                                    primary
                                        ? "min-w-0 rounded-lg border border-slate-600 bg-slate-800/70 p-3"
                                        : "min-w-0 rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                                }
                            >

                                <div
                                    className={
                                        primary
                                            ? "text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                                            : "text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                                    }
                                >
                                    {item.label}
                                </div>

                                <div
                                    className={
                                        primary
                                            ? "mt-1 break-words text-lg font-bold text-white sm:text-xl"
                                            : "mt-1 break-words text-base font-semibold text-white sm:text-lg"
                                    }
                                >
                                    {item.value}
                                </div>

                            </div>
                        );
                    }
                )}

            </div>

        </div>
    );
}

function UnitToggle({
    value,
    onChange,
}: {
    value: UnitMode;
    onChange: (
        value: UnitMode
    ) => void;
}) {
    return (
        <div className="flex shrink-0 rounded-lg border border-slate-800 bg-slate-950 p-1">

            <button
                type="button"
                onClick={() =>
                    onChange("imperial")
                }
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold sm:px-3 ${
                    value === "imperial"
                        ? "bg-slate-700 text-white"
                        : "text-slate-500"
                }`}
            >
                Imperial
            </button>

            <button
                type="button"
                onClick={() =>
                    onChange("metric")
                }
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold sm:px-3 ${
                    value === "metric"
                        ? "bg-slate-700 text-white"
                        : "text-slate-500"
                }`}
            >
                Metric
            </button>

        </div>
    );
}

function HeroBadge({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <span className="rounded-lg border border-slate-700 bg-slate-950/75 px-2.5 py-1.5 text-xs font-semibold text-slate-200 sm:px-3 sm:py-2 sm:text-sm">
            {children}
        </span>
    );
}

function ProfileSection({
    title,
    action,
    children,
}: {
    title: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="w-full min-w-0 max-w-full rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">

            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 sm:gap-4">

                <div className="text-sm font-semibold text-white">
                    {title}
                </div>

                {action}

            </div>

            <div className="mt-5 min-w-0 space-y-5">
                {children}
            </div>

        </div>
    );
}

function ProfileMetric({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:p-4">

            <div className="flex min-w-0 items-center gap-2 text-slate-500">

                <div className="shrink-0">
                    {icon}
                </div>

                <div className="min-w-0 text-[10px] font-semibold uppercase tracking-wide sm:text-xs">
                    {label}
                </div>

            </div>

            <div className="mt-3 min-w-0 break-words text-base font-semibold text-white sm:text-lg">
                {value}
            </div>

        </div>
    );
}

function DraftMetric({
    label,
    value,
}: {
    label: string;
    value: string | number;
}) {
    return (
        <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-center sm:p-4">

            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </div>

            <div className="mt-2 break-words text-lg font-bold text-white sm:text-xl">
                {value}
            </div>

        </div>
    );
}

function formatHeight(
    inches: number
) {
    const feet =
        Math.floor(inches / 12);

    const remaining =
        inches % 12;

    return `${feet}'${remaining}"`;
}

function formatBirthDate(
    value:
        | { value: string }
        | string
        | null
) {
    if (!value) {
        return "—";
    }

    const raw =
        typeof value === "string"
            ? value
            : value.value;

    const match =
        raw.match(
            /^(\d{4})-(\d{2})-(\d{2})$/
        );

    if (!match) {
        return raw;
    }

    const date =
        new Date(
            Date.UTC(
                Number(match[1]),
                Number(match[2]) - 1,
                Number(match[3])
            )
        );

    return date.toLocaleDateString(
        "en-GB",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
        }
    );
}

function percent(
    value: number | null
) {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    return `${(
        value * 100
    ).toFixed(1)}%`;
}

function savePercent(
    value: number | null
) {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    return value.toFixed(3);
}

function decimal(
    value: number | null,
    places: number
) {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    return value.toFixed(
        places
    );
}

function nationalityCode(
    nationality: string | null
) {
    if (!nationality) {
        return null;
    }

    const codes: Record<
        string,
        string
    > = {
        USA: "us",
        "United States": "us",
        Canada: "ca",
        Sweden: "se",
        Finland: "fi",
        Czechia: "cz",
        "Czech Republic": "cz",
        Slovakia: "sk",
        Russia: "ru",
        Switzerland: "ch",
        Germany: "de",
        Denmark: "dk",
        Norway: "no",
        Austria: "at",
        France: "fr",
        "United Kingdom": "gb",
        England: "gb",
        Latvia: "lv",
        Belarus: "by",
        Slovenia: "si",
        Netherlands: "nl",
        Poland: "pl",
        Belgium: "be",
        Italy: "it",
        Croatia: "hr",
        Estonia: "ee",
        Lithuania: "lt",
        Ukraine: "ua",
        Kazakhstan: "kz",
        Australia: "au",
    };

    return codes[
        nationality
    ] ?? null;
}

function countryName(
    code: string
) {
    const countries: Record<
        string,
        string
    > = {
        CAN: "Canada",
        USA: "United States",
        SWE: "Sweden",
        FIN: "Finland",
        CZE: "Czechia",
        SVK: "Slovakia",
        RUS: "Russia",
        CHE: "Switzerland",
        DEU: "Germany",
        DNK: "Denmark",
        NOR: "Norway",
        AUT: "Austria",
        FRA: "France",
        GBR: "United Kingdom",
    };

    return countries[code] ?? code;
}