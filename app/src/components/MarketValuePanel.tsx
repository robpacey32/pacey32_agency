"use client";

export interface MarketValueComparable {
    playerId: number;
    player: string;
    position: string;
    headshot_url: string | null;
    similarity: number;
    aav: number | null;
    cap_pct: number | null;
    contract_term: number | null;
    contract_to: string | null;
}

export interface MarketValueDriver {
    label: string;
    detail: string;
    impact:
        | "increase"
        | "slight_increase"
        | "neutral"
        | "slight_decrease"
        | "decrease";
}

export interface MarketValueData {
    playerId: number;
    player: string;
    position: string;

    headshot_url: string | null;

    age: number | null;
    contract_status: string | null;

    current_aav: number | null;
    current_cap_pct: number | null;

    estimated_aav_low: number | null;
    estimated_aav_high: number | null;

    estimated_cap_pct_low: number | null;
    estimated_cap_pct_high: number | null;

    estimated_term_low: number | null;
    estimated_term_high: number | null;

    comparables: MarketValueComparable[];
    drivers: MarketValueDriver[];
}

export default function MarketValuePanel({
    data,
}: {
    data: MarketValueData;
}) {
    return (
        <div className="w-full min-w-0 max-w-full space-y-5">

            {/* Intro */}

            <div className="flex min-w-0 flex-col gap-3 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">

                <div className="min-w-0">

                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                        Market Value
                    </div>

                    <div className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">
                        Estimated fair market value using comparable contracts,
                        player profile, performance, trajectory and the cap environment.
                    </div>

                </div>

                <div className="shrink-0 text-xs text-slate-500">
                    Predictive valuation
                </div>

            </div>


            {/* Player */}

            <div className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/30 p-4 sm:p-5">

                <div className="flex min-w-0 flex-col justify-between gap-5 lg:flex-row lg:items-center">

                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">

                        <PlayerHeadshot
                            name={data.player}
                            url={data.headshot_url}
                        />

                        <div className="min-w-0">

                            <div className="break-words text-xl font-bold text-white sm:text-2xl">
                                {data.player}
                            </div>

                            <div className="mt-1 text-sm text-slate-400">
                                {data.position}
                            </div>

                        </div>

                    </div>

                    <div className="grid w-full min-w-0 grid-cols-2 gap-x-5 gap-y-4 text-sm sm:grid-cols-4 lg:w-auto lg:grid-cols-2 lg:gap-x-8 xl:grid-cols-4">

                        <Info
                            label="Age"
                            value={
                                data.age != null
                                    ? String(data.age)
                                    : "—"
                            }
                        />

                        <Info
                            label="Contract Status"
                            value={
                                data.contract_status ??
                                "—"
                            }
                        />

                        <Info
                            label="Current AAV"
                            value={
                                data.current_aav != null
                                    ? money(data.current_aav)
                                    : "—"
                            }
                        />

                        <Info
                            label="Current Cap %"
                            value={
                                data.current_cap_pct != null
                                    ? `${data.current_cap_pct.toFixed(2)}%`
                                    : "—"
                            }
                        />

                    </div>

                </div>

            </div>


            {/* Main valuation */}

            <div className="w-full min-w-0 rounded-xl border border-emerald-900/60 bg-emerald-950/10 p-4 sm:p-5">

                <div className="text-sm font-semibold text-slate-300">
                    Estimated Market Value
                </div>

                <div className="mt-5 grid grid-cols-1 gap-0 sm:grid-cols-3">

                    <ValuationMetric
                        value={rangeMoney(
                            data.estimated_aav_low,
                            data.estimated_aav_high
                        )}
                        label="AAV"
                    />

                    <ValuationMetric
                        value={rangePercent(
                            data.estimated_cap_pct_low,
                            data.estimated_cap_pct_high
                        )}
                        label="of projected cap"
                    />

                    <ValuationMetric
                        value={rangeYears(
                            data.estimated_term_low,
                            data.estimated_term_high
                        )}
                        label="contract term"
                    />

                </div>

            </div>


            {/* Comparable evidence */}

            <div className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/30 p-4 sm:p-5">

                <div className="mb-4 flex min-w-0 items-center justify-between">

                    <div className="min-w-0">

                        <div className="text-sm font-semibold text-white">
                            Comparable Contract Evidence
                        </div>

                        <div className="mt-1 text-xs leading-5 text-slate-500">
                            Highest-ranked statistical comparables with current contract data.
                        </div>

                    </div>

                </div>

                <div className="space-y-2">

                    {data.comparables
                        .slice(0, 5)
                        .map(
                            (player) => (
                                <ComparableContractRow
                                    key={player.playerId}
                                    player={player}
                                />
                            )
                        )}

                </div>

            </div>


            {/* Valuation drivers */}

            <div className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/30 p-4 sm:p-5">

                <div className="text-sm font-semibold text-white">
                    Valuation Drivers
                </div>

                <div className="mt-4 divide-y divide-slate-800">

                    {data.drivers.map(
                        (driver) => (
                            <DriverRow
                                key={driver.label}
                                driver={driver}
                            />
                        )
                    )}

                </div>

            </div>


            {/* Disclaimer */}

            <div className="w-full min-w-0 rounded-lg border border-emerald-900/50 bg-emerald-950/10 px-4 py-3 text-xs leading-relaxed text-slate-400">
                Market Value estimates a fair contract range from statistical
                comparables and contextual factors. It is a modelling estimate,
                not a prediction of the exact contract a player will sign.
            </div>

        </div>
    );
}


// ---------------------------------------------------------
// COMPARABLE CONTRACT
// ---------------------------------------------------------

function ComparableContractRow({
    player,
}: {
    player: MarketValueComparable;
}) {
    return (
        <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 rounded-lg border border-slate-800 bg-slate-900/20 px-3 py-3 sm:px-4 md:grid-cols-[1.6fr_1fr_1fr_1fr] md:items-center md:gap-4">

            <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">

                <PlayerHeadshot
                    name={player.player}
                    url={player.headshot_url}
                    small
                />

                <div className="min-w-0">

                    <div className="truncate font-medium text-white">
                        {player.player}
                    </div>

                    <div className="mt-0.5 text-xs text-slate-500">
                        {player.position}
                    </div>

                </div>

            </div>


            <div className="col-span-2 min-w-0 md:col-span-1">

                <div className="text-xs text-slate-500">
                    Similarity
                </div>

                <div className="mt-1 flex min-w-0 items-center gap-3">

                    <div className="min-w-0 flex-1 md:w-20 md:flex-none">
                        <SimilarityBar
                            value={player.similarity}
                        />
                    </div>

                    <span className="shrink-0 text-sm font-semibold text-white">
                        {player.similarity.toFixed(1)}%
                    </span>

                </div>

            </div>


            <Info
                label="AAV"
                value={
                    player.aav != null
                        ? money(player.aav)
                        : "—"
                }
            />

            <Info
                label="Cap %"
                value={
                    player.cap_pct != null
                        ? `${player.cap_pct.toFixed(2)}%`
                        : "—"
                }
            />

        </div>
    );
}


// ---------------------------------------------------------
// VALUATION DRIVER
// ---------------------------------------------------------

function DriverRow({
    driver,
}: {
    driver: MarketValueDriver;
}) {
    return (
        <div className="grid min-w-0 grid-cols-1 gap-2 py-4 md:grid-cols-[180px_minmax(0,1fr)_140px] md:items-center md:gap-4 md:py-3">

            <div className="min-w-0 text-sm font-medium text-slate-300">
                {driver.label}
            </div>

            <div className="min-w-0 break-words text-sm leading-5 text-slate-500">
                {driver.detail}
            </div>

            <div
                className={`text-sm font-medium md:text-right ${impactTextClass(
                    driver.impact
                )}`}
            >
                {impactLabel(driver.impact)}
            </div>

        </div>
    );
}


// ---------------------------------------------------------
// VALUATION KPI
// ---------------------------------------------------------

function ValuationMetric({
    value,
    label,
}: {
    value: string;
    label: string;
}) {
    return (
        <div className="min-w-0 border-b border-slate-800 py-4 first:pt-0 last:border-b-0 last:pb-0 sm:border-b-0 sm:border-r sm:px-5 sm:py-0 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0">

            <div className="break-words text-2xl font-bold text-emerald-400 lg:text-3xl">
                {value}
            </div>

            <div className="mt-1 text-sm text-slate-500">
                {label}
            </div>

        </div>
    );
}


// ---------------------------------------------------------
// HEADSHOT
// ---------------------------------------------------------

function PlayerHeadshot({
    name,
    url,
    small = false,
}: {
    name: string;
    url: string | null;
    small?: boolean;
}) {
    const size =
        small
            ? "h-10 w-10"
            : "h-16 w-16 sm:h-20 sm:w-20";

    return (
        <div
            className={`
                ${size}
                shrink-0
                overflow-hidden
                rounded-full
                border border-slate-700
                bg-slate-800
            `}
        >
            {url ? (
                <img
                    src={url}
                    alt={name}
                    className="h-full w-full object-cover object-top"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-300">
                    {initials(name)}
                </div>
            )}
        </div>
    );
}


// ---------------------------------------------------------
// INFO
// ---------------------------------------------------------

function Info({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="min-w-0">

            <div className="text-xs text-slate-500">
                {label}
            </div>

            <div className="mt-0.5 break-words text-sm font-medium text-slate-300">
                {value}
            </div>

        </div>
    );
}


// ---------------------------------------------------------
// SIMILARITY BAR
// ---------------------------------------------------------

function SimilarityBar({
    value,
}: {
    value: number;
}) {
    const safeValue =
        Math.max(
            0,
            Math.min(
                100,
                value
            )
        );

    return (
        <div className="h-2 w-full min-w-0 overflow-hidden rounded-full bg-slate-800">

            <div
                className={`h-full rounded-full ${similarityColour(
                    value
                )}`}
                style={{
                    width: `${safeValue}%`,
                }}
            />

        </div>
    );
}

function similarityColour(
    value: number
) {
    if (value >= 80) {
        return "bg-emerald-400";
    }

    if (value >= 60) {
        return "bg-lime-400";
    }

    if (value >= 40) {
        return "bg-yellow-400";
    }

    if (value >= 20) {
        return "bg-orange-400";
    }

    return "bg-rose-500";
}


// ---------------------------------------------------------
// IMPACT
// ---------------------------------------------------------

function impactTextClass(
    impact: MarketValueDriver["impact"]
) {
    switch (impact) {
        case "increase":
            return "text-emerald-400";

        case "slight_increase":
            return "text-lime-400";

        case "neutral":
            return "text-slate-400";

        case "slight_decrease":
            return "text-orange-400";

        case "decrease":
            return "text-rose-400";
    }
}

function impactLabel(
    impact: MarketValueDriver["impact"]
) {
    switch (impact) {
        case "increase":
            return "Increases value";

        case "slight_increase":
            return "Slight increase";

        case "neutral":
            return "Neutral";

        case "slight_decrease":
            return "Slight decrease";

        case "decrease":
            return "Decreases value";
    }
}


// ---------------------------------------------------------
// FORMATTERS
// ---------------------------------------------------------

function rangeMoney(
    low: number | null,
    high: number | null
) {
    if (
        low == null ||
        high == null
    ) {
        return "—";
    }

    return `${money(low)} – ${money(high)}`;
}

function rangePercent(
    low: number | null,
    high: number | null
) {
    if (
        low == null ||
        high == null
    ) {
        return "—";
    }

    return `${low.toFixed(1)}% – ${high.toFixed(1)}%`;
}

function rangeYears(
    low: number | null,
    high: number | null
) {
    if (
        low == null ||
        high == null
    ) {
        return "—";
    }

    if (low === high) {
        return `${low}`;
    }

    return `${low} – ${high}`;
}

function money(
    value: number
) {
    if (value >= 1_000_000) {
        return `$${(
            value /
            1_000_000
        ).toFixed(2)}m`;
    }

    if (value >= 1_000) {
        return `$${(
            value /
            1_000
        ).toFixed(0)}k`;
    }

    return `$${value.toLocaleString()}`;
}

function initials(
    name: string
) {
    return name
        .split(" ")
        .filter(Boolean)
        .map(
            (part) =>
                part[0]
        )
        .join("")
        .slice(0, 2)
        .toUpperCase();
}