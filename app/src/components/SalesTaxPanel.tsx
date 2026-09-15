"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type SalesTaxData = {
    combined_sales_tax_rate: number;
    sales_tax_state_rate: number | null;
    sales_tax_average_local_rate: number | null;
    gst_hst_rate: number | null;
    pst_rate: number | null;
    sales_tax_basis: string;
    tax_year: number;
    nhl_avg_sales_tax_rate: number;
    sales_tax_vs_nhl_avg: number;
    sales_tax_rank: number;
    nhl_city_count: number;
};

type SalesTaxDistribution = {
    venueLocation: string;
    geocoded_city: string;
    state_province: string;
    country: string;
    combined_sales_tax_rate: number;
    sales_tax_rank: number;
};

type SalesTaxPanelProps = {
    city: string;
    stateProvince: string;
    country: string;
    tax: SalesTaxData;
    distribution: SalesTaxDistribution[];
};

export default function SalesTaxPanel({
    city,
    stateProvince,
    country,
    tax,
    distribution,
}: SalesTaxPanelProps) {
    const lowerThanAverage = tax.sales_tax_vs_nhl_avg < 0;
    const canadian = country === "Canada";

    const chartData = distribution
        .slice()
        .sort((a, b) => a.sales_tax_rank - b.sales_tax_rank)
        .map((row) => ({
            city: row.geocoded_city || row.venueLocation,
            venueLocation: row.venueLocation,
            rate: row.combined_sales_tax_rate,
            rank: row.sales_tax_rank,
            selected:
                row.venueLocation ===
                taxVenueLocation(city, distribution),
        }));

    return (
        <div className="w-full min-w-0 max-w-full space-y-8">
            <div className="min-w-0">
                <h3 className="break-words text-xl font-semibold text-white sm:text-2xl">
                    {city}, {stateProvince}, {country}
                </h3>

                <p className="mt-2 text-sm text-slate-400">
                    Combined sales tax rates compared across NHL
                    cities
                </p>
            </div>

            {/* MAIN KPIs */}
            <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <TaxKpi
                    icon="%"
                    iconClass={
                        lowerThanAverage
                            ? "text-emerald-400"
                            : "text-red-400"
                    }
                    label="Combined Sales Tax"
                    value={`${tax.combined_sales_tax_rate.toFixed(
                        2
                    )}%`}
                    detail={`${formatPoints(
                        tax.sales_tax_vs_nhl_avg
                    )} NHL average`}
                />

                <TaxKpi
                    icon="◆"
                    iconClass="text-blue-400"
                    label={
                        canadian
                            ? "GST / HST"
                            : "State Rate"
                    }
                    value={formatNullablePercent(
                        canadian
                            ? tax.gst_hst_rate
                            : tax.sales_tax_state_rate
                    )}
                    detail={
                        canadian
                            ? "Federal / harmonised sales tax"
                            : "State sales tax rate"
                    }
                />

                <TaxKpi
                    icon="◇"
                    iconClass="text-violet-400"
                    label={
                        canadian
                            ? "PST"
                            : "Average Local Rate"
                    }
                    value={formatNullablePercent(
                        canadian
                            ? tax.pst_rate
                            : tax.sales_tax_average_local_rate
                    )}
                    detail={
                        canadian
                            ? "Provincial sales tax"
                            : "Average applicable local rate"
                    }
                />

                <TaxKpi
                    icon="#"
                    iconClass="text-amber-400"
                    label="NHL Rank"
                    value={`#${tax.sales_tax_rank}`}
                    detail={`of ${tax.nhl_city_count} NHL cities`}
                />

                <TaxKpi
                    icon="↕"
                    iconClass={
                        lowerThanAverage
                            ? "text-emerald-400"
                            : "text-red-400"
                    }
                    label="vs NHL Average"
                    value={formatPointsShort(
                        tax.sales_tax_vs_nhl_avg
                    )}
                    detail={
                        lowerThanAverage
                            ? "Lower than NHL average"
                            : tax.sales_tax_vs_nhl_avg > 0
                              ? "Higher than NHL average"
                              : "At NHL average"
                    }
                />
            </div>

            {/* CHART + BREAKDOWN */}
            <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartPanel title="NHL Sales Tax Distribution">
                    <p className="-mt-2 mb-3 text-xs text-slate-500">
                        Combined sales tax rate, ranked lowest to
                        highest
                    </p>

                    <div className="w-full min-w-0 overflow-hidden">
                        <ResponsiveContainer
                            width="100%"
                            height={360}
                        >
                            <BarChart
                                data={chartData}
                                margin={{
                                    top: 20,
                                    right: 5,
                                    left: -20,
                                    bottom: 70,
                                }}
                            >
                                <CartesianGrid
                                    stroke="#1e293b"
                                    vertical={false}
                                />

                                <XAxis
                                    dataKey="city"
                                    tick={{
                                        fill: "#94a3b8",
                                        fontSize: 9,
                                    }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={2}
                                    angle={-50}
                                    textAnchor="end"
                                    height={70}
                                />

                                <YAxis
                                    tick={{
                                        fill: "#94a3b8",
                                        fontSize: 10,
                                    }}
                                    axisLine={false}
                                    tickLine={false}
                                    domain={[0, "auto"]}
                                    tickFormatter={(value) =>
                                        `${Math.round(value)}%`
                                    }
                                />

                                <Tooltip
                                    content={
                                        <DistributionTooltip />
                                    }
                                />

                                <ReferenceLine
                                    y={
                                        tax.nhl_avg_sales_tax_rate
                                    }
                                    stroke="#94a3b8"
                                    strokeWidth={1.5}
                                    strokeDasharray="5 5"
                                    label={{
                                        value: `NHL Avg ${tax.nhl_avg_sales_tax_rate.toFixed(
                                            2
                                        )}%`,
                                        position:
                                            "insideTopRight",
                                        fill: "#94a3b8",
                                        fontSize: 10,
                                    }}
                                />

                                <Bar
                                    dataKey="rate"
                                    radius={[3, 3, 0, 0]}
                                >
                                    {chartData.map((row) => (
                                        <Cell
                                            key={
                                                row.venueLocation
                                            }
                                            fill={
                                                row.selected
                                                    ? "#38bdf8"
                                                    : getTaxColour(
                                                          row.rate,
                                                          tax.nhl_avg_sales_tax_rate
                                                      )
                                            }
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-1 text-center text-xs sm:grid-cols-3 sm:text-left">
                        <span className="text-emerald-400">
                            Lower tax
                        </span>

                        <span className="text-slate-500 sm:text-center">
                            NHL cities ranked · #1 lowest
                        </span>

                        <span className="text-red-400 sm:text-right">
                            Higher tax
                        </span>
                    </div>
                </ChartPanel>

                <ChartPanel title="Sales Tax Breakdown">
                    <p className="-mt-2 mb-6 text-xs text-slate-500">
                        How the combined rate is calculated
                    </p>

                    <div className="space-y-6">
                        {canadian ? (
                            <>
                                <BreakdownRow
                                    label="GST / HST"
                                    value={tax.gst_hst_rate}
                                    colour="bg-blue-500"
                                />

                                <BreakdownRow
                                    label="PST"
                                    value={tax.pst_rate}
                                    colour="bg-violet-500"
                                />
                            </>
                        ) : (
                            <>
                                <BreakdownRow
                                    label="State Rate"
                                    value={
                                        tax.sales_tax_state_rate
                                    }
                                    colour="bg-blue-500"
                                />

                                <BreakdownRow
                                    label="Average Local Rate"
                                    value={
                                        tax.sales_tax_average_local_rate
                                    }
                                    colour="bg-violet-500"
                                />
                            </>
                        )}

                        <div className="border-t border-slate-800 pt-5">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-sm text-slate-400">
                                        Combined Sales Tax
                                    </p>

                                    <p className="mt-1 break-words text-xs text-slate-500">
                                        {tax.sales_tax_basis}
                                    </p>
                                </div>

                                <p className="shrink-0 text-2xl font-semibold text-white sm:text-3xl">
                                    {tax.combined_sales_tax_rate.toFixed(
                                        2
                                    )}
                                    %
                                </p>
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-900/50">
                            <BreakdownMetric
                                label="NHL Average"
                                value={`${tax.nhl_avg_sales_tax_rate.toFixed(
                                    2
                                )}%`}
                            />

                            <div className="border-t border-slate-800" />

                            <BreakdownMetric
                                label="Difference vs NHL Average"
                                value={formatPointsShort(
                                    tax.sales_tax_vs_nhl_avg
                                )}
                                valueClass={
                                    lowerThanAverage
                                        ? "text-emerald-400"
                                        : tax.sales_tax_vs_nhl_avg >
                                            0
                                          ? "text-red-400"
                                          : "text-slate-200"
                                }
                            />
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 text-xs leading-5 text-slate-500">
                            {canadian
                                ? "Canadian sales tax structures may use GST/HST and provincial sales tax depending on the province."
                                : "Local rate represents the average applicable local sales tax included in the combined rate."}
                        </div>
                    </div>
                </ChartPanel>
            </div>

            {/* NHL POSITION */}
            <div className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5">
                <div className="mb-5">
                    <p className="font-semibold text-white">
                        NHL Position
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                        How {city} compares with other NHL cities
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                    <PositionMetric
                        label="Tax Difference"
                        value={formatPointsShort(
                            tax.sales_tax_vs_nhl_avg
                        )}
                        detail={
                            lowerThanAverage
                                ? "Below NHL average"
                                : tax.sales_tax_vs_nhl_avg > 0
                                  ? "Above NHL average"
                                  : "At NHL average"
                        }
                        valueClass={
                            lowerThanAverage
                                ? "text-emerald-400"
                                : tax.sales_tax_vs_nhl_avg > 0
                                  ? "text-red-400"
                                  : "text-slate-200"
                        }
                    />

                    <PositionMetric
                        label="Sales Tax Rank"
                        value={`#${tax.sales_tax_rank} of ${tax.nhl_city_count}`}
                        detail="#1 = lowest sales tax"
                        valueClass="text-amber-400"
                    />

                    <PositionMetric
                        label="NHL Average"
                        value={`${tax.nhl_avg_sales_tax_rate.toFixed(
                            2
                        )}%`}
                        detail="Combined sales tax rate"
                        valueClass="text-slate-200"
                    />
                </div>
            </div>

            {/* TAKEAWAY + METHODOLOGY */}
            <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5">
                    <p className="text-sm font-semibold text-white">
                        Key Takeaway
                    </p>

                    <p className="mt-3 text-sm leading-6 text-slate-400">
                        {salesTaxSummary(
                            city,
                            tax.combined_sales_tax_rate,
                            tax.sales_tax_vs_nhl_avg,
                            tax.sales_tax_rank,
                            tax.nhl_city_count
                        )}
                    </p>
                </div>

                <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5">
                    <p className="text-sm font-semibold text-white">
                        Basis & Methodology
                    </p>

                    <div className="mt-4 space-y-3 text-sm">
                        <MethodRow
                            label="Sales tax basis"
                            value={tax.sales_tax_basis}
                        />

                        <MethodRow
                            label="Tax year"
                            value={tax.tax_year.toString()}
                        />
                    </div>

                    <p className="mt-4 border-t border-slate-800 pt-4 text-xs leading-5 text-slate-500">
                        Rates represent statutory sales tax
                        rates for the tax year shown. They do
                        not account for product-specific
                        exemptions or individual purchasing
                        patterns.
                    </p>
                </div>
            </div>

            <div className="border-t border-slate-800 pt-5 text-xs leading-5 text-slate-500">
                Rankings include {tax.nhl_city_count} NHL cities
                with available sales tax data. Rank #1
                represents the lowest combined sales tax rate.
            </div>
        </div>
    );
}

function TaxKpi({
    icon,
    iconClass,
    label,
    value,
    detail,
}: {
    icon: string;
    iconClass: string;
    label: string;
    value: string;
    detail: string;
}) {
    return (
        <div className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5">
            <div className="flex min-w-0 items-start gap-4">
                <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xl font-semibold ${iconClass}`}
                >
                    {icon}
                </div>

                <div className="min-w-0">
                    <p className="break-words text-xs font-medium uppercase tracking-wide text-slate-400">
                        {label}
                    </p>

                    <p
                        className={`mt-2 break-words text-2xl font-semibold sm:text-3xl ${iconClass}`}
                    >
                        {value}
                    </p>
                </div>
            </div>

            <p className="mt-4 break-words text-sm text-slate-400">
                {detail}
            </p>
        </div>
    );
}

function ChartPanel({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5">
            <p className="mb-5 font-semibold text-white">
                {title}
            </p>

            {children}
        </div>
    );
}

function BreakdownRow({
    label,
    value,
    colour,
}: {
    label: string;
    value: number | null;
    colour: string;
}) {
    const safeValue = value ?? 0;

    return (
        <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-4">
                <p className="min-w-0 text-sm text-slate-300">
                    {label}
                </p>

                <p className="shrink-0 text-xl font-semibold text-white">
                    {formatNullablePercent(value)}
                </p>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                    className={`h-full rounded-full ${colour}`}
                    style={{
                        width: `${Math.min(
                            100,
                            safeValue * 5
                        )}%`,
                    }}
                />
            </div>
        </div>
    );
}

function BreakdownMetric({
    label,
    value,
    valueClass = "text-slate-200",
}: {
    label: string;
    value: string;
    valueClass?: string;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="min-w-0 text-sm text-slate-400">
                {label}
            </span>

            <span
                className={`shrink-0 text-lg font-semibold ${valueClass}`}
            >
                {value}
            </span>
        </div>
    );
}

function PositionMetric({
    label,
    value,
    detail,
    valueClass,
}: {
    label: string;
    value: string;
    detail: string;
    valueClass: string;
}) {
    return (
        <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
            </p>

            <p
                className={`mt-2 break-words text-2xl font-semibold sm:text-3xl ${valueClass}`}
            >
                {value}
            </p>

            <p className="mt-1 text-sm text-slate-400">
                {detail}
            </p>
        </div>
    );
}

function MethodRow({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-[140px_1fr] sm:gap-4">
            <span className="text-slate-500">
                {label}
            </span>

            <span className="min-w-0 break-words text-slate-300">
                {value}
            </span>
        </div>
    );
}

function DistributionTooltip({
    active,
    payload,
}: {
    active?: boolean;
    payload?: {
        payload: {
            city: string;
            rate: number;
            rank: number;
        };
    }[];
}) {
    if (!active || !payload?.length) {
        return null;
    }

    const row = payload[0].payload;

    return (
        <div className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 shadow-xl">
            <p className="font-medium text-white">
                {row.city}
            </p>

            <p className="mt-1 text-sm text-slate-300">
                Combined rate: {row.rate.toFixed(2)}%
            </p>

            <p className="mt-1 text-xs text-slate-500">
                NHL rank #{row.rank}
            </p>
        </div>
    );
}

function taxVenueLocation(
    city: string,
    distribution: SalesTaxDistribution[]
) {
    const match = distribution.find(
        (row) => row.geocoded_city === city
    );

    return match?.venueLocation ?? city;
}

function getTaxColour(
    rate: number,
    average: number
) {
    const difference = rate - average;

    if (difference <= -3) return "#10b981";
    if (difference <= -1.5) return "#65a30d";
    if (difference < 0) return "#a3a832";
    if (difference <= 1.5) return "#d97706";
    if (difference <= 3) return "#f97316";

    return "#ef4444";
}

function formatNullablePercent(
    value: number | null
) {
    return value == null
        ? "—"
        : `${value.toFixed(2)}%`;
}

function formatPoints(value: number) {
    const amount = Math.abs(value).toFixed(2);

    if (value < 0) return `${amount} pts below`;
    if (value > 0) return `${amount} pts above`;

    return "At";
}

function formatPointsShort(value: number) {
    if (Math.abs(value) < 0.005) {
        return "0.00 pp";
    }

    return `${value > 0 ? "+" : ""}${value.toFixed(
        2
    )} pp`;
}

function salesTaxSummary(
    city: string,
    rate: number,
    difference: number,
    rank: number,
    cityCount: number
) {
    const comparison =
        Math.abs(difference) < 0.005
            ? "in line with"
            : `${Math.abs(difference).toFixed(
                  2
              )} percentage points ${
                  difference > 0 ? "above" : "below"
              }`;

    return `${city}'s combined sales tax rate is ${rate.toFixed(
        2
    )}%, ${comparison} the average NHL city. It ranks #${rank} of ${cityCount} NHL cities, where #1 represents the lowest combined sales tax rate.`;
}