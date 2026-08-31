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

type IncomeTaxData = {
    combined_top_marginal_income_tax_rate: number;
    federal_income_tax_top_rate: number;
    state_income_tax_rate: number;
    income_tax_rate_basis: string;
    state_income_tax_basis: string;
    tax_year: number;
    nhl_avg_income_tax_rate: number;
    income_tax_vs_nhl_avg: number;
    income_tax_rank: number;
    nhl_city_count: number;
};

type IncomeTaxDistribution = {
    venueLocation: string;
    geocoded_city: string;
    state_province: string;
    country: string;
    combined_top_marginal_income_tax_rate: number;
    income_tax_rank: number;
};

type IncomeTaxPanelProps = {
    city: string;
    stateProvince: string;
    country: string;
    tax: IncomeTaxData;
    distribution: IncomeTaxDistribution[];
};

export default function IncomeTaxPanel({
    city,
    stateProvince,
    country,
    tax,
    distribution,
}: IncomeTaxPanelProps) {
    const lowerThanAverage = tax.income_tax_vs_nhl_avg < 0;

    const chartData = distribution
        .slice()
        .sort((a, b) => a.income_tax_rank - b.income_tax_rank)
        .map((row) => ({
            city: row.geocoded_city || row.venueLocation,
            venueLocation: row.venueLocation,
            rate: row.combined_top_marginal_income_tax_rate,
            rank: row.income_tax_rank,
            selected:
                row.venueLocation === taxVenueLocation(
                    city,
                    distribution
                ),
        }));

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-2xl font-semibold text-white">
                    {city}, {stateProvince}, {country}
                </h3>

                <p className="mt-2 text-sm text-slate-400">
                    Top marginal personal income tax rates compared with
                    other NHL cities
                </p>
            </div>

            <div className="grid grid-cols-5 gap-4">
                <TaxKpi
                    icon="%"
                    iconClass={
                        lowerThanAverage
                            ? "text-emerald-400"
                            : "text-red-400"
                    }
                    label="Combined Top Rate"
                    value={`${tax.combined_top_marginal_income_tax_rate.toFixed(
                        2
                    )}%`}
                    detail={`${formatPoints(
                        tax.income_tax_vs_nhl_avg
                    )} vs NHL average`}
                />

                <TaxKpi
                    icon="◆"
                    iconClass="text-blue-400"
                    label="Federal Top Rate"
                    value={`${tax.federal_income_tax_top_rate.toFixed(
                        2
                    )}%`}
                    detail="Top federal marginal rate"
                />

                <TaxKpi
                    icon="◇"
                    iconClass="text-violet-400"
                    label={
                        country === "Canada"
                            ? "Provincial Top Rate"
                            : "State Top Rate"
                    }
                    value={`${tax.state_income_tax_rate.toFixed(2)}%`}
                    detail={
                        country === "Canada"
                            ? "Top provincial marginal rate"
                            : "Top state marginal rate"
                    }
                />

                <TaxKpi
                    icon="#"
                    iconClass="text-amber-400"
                    label="NHL Rank"
                    value={`#${tax.income_tax_rank}`}
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
                        tax.income_tax_vs_nhl_avg
                    )}
                    detail={
                        lowerThanAverage
                            ? "Lower than NHL average"
                            : tax.income_tax_vs_nhl_avg > 0
                              ? "Higher than NHL average"
                              : "At NHL average"
                    }
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <ChartPanel title="NHL Income Tax Distribution">
                    <ResponsiveContainer
                        width="100%"
                        height={360}
                    >
                        <BarChart
                            data={chartData}
                            margin={{
                                top: 20,
                                right: 20,
                                left: 0,
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
                                    fontSize: 10,
                                }}
                                axisLine={false}
                                tickLine={false}
                                interval={1}
                                angle={-50}
                                textAnchor="end"
                                height={70}
                            />

                            <YAxis
                                tick={{
                                    fill: "#94a3b8",
                                }}
                                axisLine={false}
                                tickLine={false}
                                domain={[0, 60]}
                                tickFormatter={(value) =>
                                    `${Math.round(value)}%`
                                }
                            />

                            <Tooltip
                                content={<DistributionTooltip />}
                            />

                            <ReferenceLine
                                y={tax.nhl_avg_income_tax_rate}
                                stroke="#94a3b8"
                                strokeWidth={1.5}
                                strokeDasharray="5 5"
                                label={{
                                    value: `NHL Avg ${tax.nhl_avg_income_tax_rate.toFixed(
                                        1
                                    )}%`,
                                    position: "insideTopRight",
                                    fill: "#94a3b8",
                                    fontSize: 11,
                                }}
                            />

                            <Bar
                                dataKey="rate"
                                name="Top Marginal Rate"
                                radius={[3, 3, 0, 0]}
                            >
                                {chartData.map((row) => (
                                    <Cell
                                        key={row.venueLocation}
                                        fill={
                                            row.selected
                                                ? "#38bdf8"
                                                : "#475569"
                                        }
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>

                    <p className="mt-2 text-center text-xs text-slate-500">
                        Ranked lowest to highest. Selected city highlighted.
                    </p>
                </ChartPanel>

                <ChartPanel title="Rate Breakdown">
                    <div className="space-y-6 pt-3">
                        <BreakdownRow
                            label="Federal Top Rate"
                            value={tax.federal_income_tax_top_rate}
                            colour="bg-blue-500"
                        />

                        <BreakdownRow
                            label={
                                country === "Canada"
                                    ? "Provincial Top Rate"
                                    : "State Top Rate"
                            }
                            value={tax.state_income_tax_rate}
                            colour="bg-violet-500"
                        />

                        <div className="border-t border-slate-800 pt-5">
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-sm text-slate-400">
                                        Combined Top Rate
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                        Statutory top marginal rate
                                    </p>
                                </div>

                                <p className="text-3xl font-semibold text-white">
                                    {tax.combined_top_marginal_income_tax_rate.toFixed(
                                        2
                                    )}
                                    %
                                </p>
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-400">
                                    NHL Average
                                </span>

                                <span className="text-lg font-semibold text-slate-200">
                                    {tax.nhl_avg_income_tax_rate.toFixed(
                                        2
                                    )}
                                    %
                                </span>
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-400">
                                    Difference
                                </span>

                                <span
                                    className={`text-lg font-semibold ${
                                        lowerThanAverage
                                            ? "text-emerald-400"
                                            : tax.income_tax_vs_nhl_avg > 0
                                              ? "text-red-400"
                                              : "text-slate-200"
                                    }`}
                                >
                                    {formatPointsShort(
                                        tax.income_tax_vs_nhl_avg
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                </ChartPanel>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
                <p className="mb-5 font-semibold text-white">
                    NHL Position
                </p>

                <div className="grid grid-cols-3 gap-6">
                    <PositionMetric
                        label="Tax Difference"
                        value={formatPointsShort(
                            tax.income_tax_vs_nhl_avg
                        )}
                        detail={
                            lowerThanAverage
                                ? "Below NHL average"
                                : tax.income_tax_vs_nhl_avg > 0
                                  ? "Above NHL average"
                                  : "At NHL average"
                        }
                        valueClass={
                            lowerThanAverage
                                ? "text-emerald-400"
                                : tax.income_tax_vs_nhl_avg > 0
                                  ? "text-red-400"
                                  : "text-slate-200"
                        }
                    />

                    <PositionMetric
                        label="Tax Rank"
                        value={`#${tax.income_tax_rank}`}
                        detail={`of ${tax.nhl_city_count} NHL cities`}
                        valueClass="text-amber-400"
                    />

                    <PositionMetric
                        label="NHL Average"
                        value={`${tax.nhl_avg_income_tax_rate.toFixed(
                            2
                        )}%`}
                        detail="Combined top marginal rate"
                        valueClass="text-slate-200"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
                    <p className="text-sm font-semibold text-white">
                        Key Takeaway
                    </p>

                    <p className="mt-3 text-sm leading-6 text-slate-400">
                        {taxSummary(
                            city,
                            tax.combined_top_marginal_income_tax_rate,
                            tax.income_tax_vs_nhl_avg,
                            tax.income_tax_rank,
                            tax.nhl_city_count
                        )}
                    </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
                    <p className="text-sm font-semibold text-white">
                        Basis & Methodology
                    </p>

                    <div className="mt-4 space-y-3 text-sm">
                        <MethodRow
                            label="Income tax basis"
                            value={tax.income_tax_rate_basis}
                        />

                        <MethodRow
                            label={
                                country === "Canada"
                                    ? "Provincial basis"
                                    : "State basis"
                            }
                            value={tax.state_income_tax_basis}
                        />

                        <MethodRow
                            label="Tax year"
                            value={tax.tax_year.toString()}
                        />
                    </div>

                    <p className="mt-4 border-t border-slate-800 pt-4 text-xs leading-5 text-slate-500">
                        Rates represent top marginal statutory personal
                        income tax rates. They do not represent the
                        effective tax rate paid by an individual player.
                    </p>
                </div>
            </div>

            <div className="border-t border-slate-800 pt-5 text-xs leading-5 text-slate-500">
                NHL average and rankings include {tax.nhl_city_count} NHL
                cities with available income tax data. Rank #1 represents
                the lowest combined top marginal income tax rate.
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
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
            <div className="flex items-start gap-4">
                <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xl font-semibold ${iconClass}`}
                >
                    {icon}
                </div>

                <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {label}
                    </p>

                    <p
                        className={`mt-2 text-3xl font-semibold ${iconClass}`}
                    >
                        {value}
                    </p>
                </div>
            </div>

            <p className="mt-4 text-sm text-slate-400">
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
        <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/40 p-5">
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
    value: number;
    colour: string;
}) {
    return (
        <div>
            <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-slate-300">
                    {label}
                </p>

                <p className="text-xl font-semibold text-white">
                    {value.toFixed(2)}%
                </p>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                    className={`h-full rounded-full ${colour}`}
                    style={{
                        width: `${Math.min(100, value)}%`,
                    }}
                />
            </div>
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
        <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
            </p>

            <p
                className={`mt-2 text-3xl font-semibold ${valueClass}`}
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
        <div className="grid grid-cols-[140px_1fr] gap-4">
            <span className="text-slate-500">
                {label}
            </span>

            <span className="text-slate-300">
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
                Top rate: {row.rate.toFixed(2)}%
            </p>

            <p className="mt-1 text-xs text-slate-500">
                NHL rank #{row.rank}
            </p>
        </div>
    );
}

function taxVenueLocation(
    city: string,
    distribution: IncomeTaxDistribution[]
) {
    const match = distribution.find(
        (row) => row.geocoded_city === city
    );

    return match?.venueLocation ?? city;
}

function formatPoints(value: number) {
    const amount = Math.abs(value).toFixed(2);

    if (value < 0) return `${amount} pts below`;
    if (value > 0) return `${amount} pts above`;

    return "At NHL average";
}

function formatPointsShort(value: number) {
    if (Math.abs(value) < 0.005) {
        return "0.00 pp";
    }

    return `${value > 0 ? "+" : ""}${value.toFixed(2)} pp`;
}

function taxSummary(
    city: string,
    rate: number,
    difference: number,
    rank: number,
    cityCount: number
) {
    const comparison =
        Math.abs(difference) < 0.005
            ? "in line with"
            : `${Math.abs(difference).toFixed(2)} percentage points ${
                  difference > 0 ? "above" : "below"
              }`;

    return `${city}'s combined top marginal income tax rate is ${rate.toFixed(
        2
    )}%, ${comparison} the average NHL city. It ranks #${rank} of ${cityCount} NHL cities, where #1 represents the lowest top marginal rate.`;
}