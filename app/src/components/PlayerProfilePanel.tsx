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
        <div className="space-y-5">

            {/* HERO */}

            <div className="flex justify-start">
                <section className="relative h-[500px] w-full max-w-[1050px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

                    {data.hero_image && (
                        <img
                            src={data.hero_image}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover object-center"
                        />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/55 to-slate-950/10" />

                    <div className="relative flex h-full items-end gap-8 px-8 pt-8">

                        <div className="shrink-0">

                            {data.headshot ? (
                                <img
                                    src={data.headshot}
                                    alt={data.player_name}
                                    className="h-[88%] max-h-72 w-52 object-contain object-bottom"
                                />
                            ) : (
                                <div className="h-64 w-52" />
                            )}

                        </div>

                        <div className="flex-1 pb-8">

                            <div className="flex items-center gap-3">

                                {data.team_logo && (
                                    <img
                                        src={data.team_logo}
                                        alt=""
                                        className="h-11 w-11 object-contain"
                                    />
                                )}

                                <div className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                                    {data.team_name ??
                                        "No current team"}
                                </div>

                            </div>

                            <h2 className="mt-4 text-4xl font-bold text-white">
                                {data.player_name}
                            </h2>

                            <div className="mt-4 flex flex-wrap items-center gap-3">

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

            <section className="grid min-w-[1180px] grid-cols-[1.1fr_1fr] gap-5 overflow-x-auto">

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

                    <div className="grid grid-cols-3 gap-3">

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
                                <div className="flex items-center gap-2">

                                    {nationalityFlag && (
                                        <img
                                            src={`https://flagcdn.com/24x18/${nationalityFlag}.png`}
                                            alt=""
                                            className="h-[18px] w-6 rounded-sm object-cover"
                                        />
                                    )}

                                    <span>
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

                    <div className="mt-3">

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

                                <div className="text-center">

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

                <div className="space-y-5">

                    {/* DRAFT */}

                    <ProfileSection title="Draft">

                        {data.draft_year ? (
                            <div className="grid grid-cols-[76px_repeat(4,1fr)] gap-3">

                                <div className="flex min-h-24 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/40 p-3">

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
        <div>

            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {title}
            </div>

            <div className="grid grid-cols-4 gap-2">

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
                                        ? "rounded-lg border border-slate-600 bg-slate-800/70 p-3"
                                        : "rounded-lg border border-slate-800 bg-slate-950/40 p-3"
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
                                            ? "mt-1 text-xl font-bold text-white"
                                            : "mt-1 text-lg font-semibold text-white"
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
        <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-1">

            <button
                type="button"
                onClick={() =>
                    onChange("imperial")
                }
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
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
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
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
        <span className="rounded-lg border border-slate-700 bg-slate-950/75 px-3 py-2 text-sm font-semibold text-slate-200">
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
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">

            <div className="flex items-center justify-between gap-4">

                <div className="text-sm font-semibold text-white">
                    {title}
                </div>

                {action}

            </div>

            <div className="mt-5 space-y-5">
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
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">

            <div className="flex items-center gap-2 text-slate-500">

                {icon}

                <div className="text-xs font-semibold uppercase tracking-wide">
                    {label}
                </div>

            </div>

            <div className="mt-3 text-lg font-semibold text-white">
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
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-center">

            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </div>

            <div className="mt-2 text-xl font-bold text-white">
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