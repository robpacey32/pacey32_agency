"use client";

import { useState } from "react";
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

type CostOfLivingSummary = {
    venueLocation: string;
    cost_of_living_index: number;
    housing_index: number;
    utilities_index: number;
    groceries_index: number;
    eating_out_index: number;
    transport_index: number;
    lifestyle_index: number;
    family_index: number;
    metrics_used: number;
    vs_nhl_average_pct: number;
    affordability_rank: number;
    nhl_city_count: number;
};

type CostOfLivingDetail = {
    category: string;
    metric: string;
    local_value: number;
    local_low: number | null;
    local_high: number | null;
    avg_usd: number;
    nhl_avg_usd: number;
    metric_index: number;
};

type CostOfLivingPanelProps = {
    city: string;
    stateProvince: string;
    country: string;
    cost: CostOfLivingSummary;
    detail: CostOfLivingDetail[];
};

type CategoryData = {
    category: string;
    city: number;
};

export default function CostOfLivingPanel({
    city,
    stateProvince,
    country,
    cost,
    detail,
}: CostOfLivingPanelProps) {
    const [openCategory, setOpenCategory] = useState<string | null>(null);

    const chartData: CategoryData[] = [
        {
            category: "Housing",
            city: cost.housing_index,
        },
        {
            category: "Utilities",
            city: cost.utilities_index,
        },
        {
            category: "Groceries",
            city: cost.groceries_index,
        },
        {
            category: "Eating Out",
            city: cost.eating_out_index,
        },
        {
            category: "Transport",
            city: cost.transport_index,
        },
        {
            category: "Lifestyle",
            city: cost.lifestyle_index,
        },
        {
            category: "Family",
            city: cost.family_index,
        },
    ];

    const toggleCategory = (category: string) => {
        setOpenCategory(
            openCategory === category ? null : category
        );
    };

    return (
        <div className="w-full min-w-0 max-w-full space-y-8">
            <div className="min-w-0">
                <h3 className="break-words text-xl font-semibold text-white sm:text-2xl">
                    {city}, {stateProvince}, {country}
                </h3>

                <p className="mt-2 text-sm text-slate-400">
                    Cost of living compared with the average NHL city
                </p>
            </div>

            {/* MAIN KPIs */}
            <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <CostKpi
                    icon="$"
                    label="Overall Cost"
                    value={cost.cost_of_living_index}
                    detail={`${formatPercent(
                        cost.vs_nhl_average_pct
                    )} vs NHL average`}
                />

                <CostKpi
                    icon="⌂"
                    label="Housing"
                    value={cost.housing_index}
                    detail={comparisonText(cost.housing_index)}
                />

                <CostKpi
                    icon="●"
                    label="Groceries"
                    value={cost.groceries_index}
                    detail={comparisonText(cost.groceries_index)}
                />

                <CostKpi
                    icon="♨"
                    label="Eating Out"
                    value={cost.eating_out_index}
                    detail={comparisonText(cost.eating_out_index)}
                />

                <CostKpi
                    icon="↔"
                    label="Transport"
                    value={cost.transport_index}
                    detail={comparisonText(cost.transport_index)}
                />
            </div>

            {/* CHART + CATEGORY DETAIL */}
            <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartPanel title="Cost of Living by Category">
                    <div className="w-full min-w-0 overflow-hidden">
                        <ResponsiveContainer width="100%" height={360}>
                            <BarChart
                                data={chartData}
                                margin={{
                                    top: 10,
                                    right: 5,
                                    left: -20,
                                    bottom: 45,
                                }}
                            >
                                <CartesianGrid
                                    stroke="#1e293b"
                                    vertical={false}
                                />

                                <XAxis
                                    dataKey="category"
                                    tick={{
                                        fill: "#94a3b8",
                                        fontSize: 10,
                                    }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={0}
                                    angle={-35}
                                    textAnchor="end"
                                    height={60}
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
                                        Math.round(value).toString()
                                    }
                                />

                                <Tooltip content={<CostTooltip />} />

                                <ReferenceLine
                                    y={100}
                                    stroke="#94a3b8"
                                    strokeWidth={1.5}
                                    strokeDasharray="5 5"
                                    label={{
                                        value: "NHL Average",
                                        position: "insideTopRight",
                                        fill: "#94a3b8",
                                        fontSize: 10,
                                    }}
                                />

                                <Bar
                                    dataKey="city"
                                    name={city}
                                    radius={[4, 4, 0, 0]}
                                >
                                    {chartData.map((item) => (
                                        <Cell
                                            key={item.category}
                                            fill={getChartColour(
                                                item.city
                                            )}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <p className="mt-2 text-center text-xs text-slate-500">
                        NHL average = 100. Lower values indicate lower
                        cost.
                    </p>
                </ChartPanel>

                <ChartPanel title="Relative Cost by Category">
                    <div className="space-y-2">
                        {chartData.map((item) => {
                            const categoryDetail = detail.filter(
                                (row) =>
                                    row.category === item.category
                            );

                            return (
                                <CategoryRow
                                    key={item.category}
                                    category={item.category}
                                    value={item.city}
                                    detail={categoryDetail}
                                    open={
                                        openCategory ===
                                        item.category
                                    }
                                    onClick={() =>
                                        toggleCategory(
                                            item.category
                                        )
                                    }
                                />
                            );
                        })}
                    </div>
                </ChartPanel>
            </div>

            {/* ADDITIONAL INSIGHTS */}
            <div className="w-full min-w-0">
                <p className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-500">
                    Additional Cost Insights
                </p>

                <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <CostKpi
                        icon="⚡"
                        label="Utilities"
                        value={cost.utilities_index}
                        detail={comparisonText(
                            cost.utilities_index
                        )}
                    />

                    <CostKpi
                        icon="★"
                        label="Lifestyle"
                        value={cost.lifestyle_index}
                        detail={comparisonText(
                            cost.lifestyle_index
                        )}
                    />

                    <CostKpi
                        icon="♟"
                        label="Family"
                        value={cost.family_index}
                        detail={comparisonText(
                            cost.family_index
                        )}
                    />

                    <RankKpi
                        icon="#"
                        label="Affordability Rank"
                        value={`#${cost.affordability_rank}`}
                        detail={`of ${cost.nhl_city_count} NHL cities`}
                    />
                </div>
            </div>

            {/* SUMMARY + METHODOLOGY */}
            <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5">
                    <p className="text-sm font-semibold text-white">
                        Overall Position
                    </p>

                    <p className="mt-3 text-sm leading-6 text-slate-400">
                        {overallSummary(
                            cost.vs_nhl_average_pct,
                            cost.affordability_rank,
                            cost.nhl_city_count
                        )}
                    </p>
                </div>

                <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5">
                    <p className="text-sm font-semibold text-white">
                        Methodology
                    </p>

                    <p className="mt-3 text-sm leading-6 text-slate-400">
                        Category indices are normalised so the average
                        NHL city equals 100. Values below 100 indicate
                        lower cost; values above 100 indicate higher
                        cost.
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                        Based on {cost.metrics_used} underlying cost
                        metrics.
                    </p>
                </div>
            </div>
        </div>
    );
}

function CostKpi({
    icon,
    label,
    value,
    detail,
}: {
    icon: string;
    label: string;
    value: number;
    detail: string;
}) {
    const colour = getCostColour(value);

    return (
        <div className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5">
            <div className="flex min-w-0 items-start gap-4">
                <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xl font-semibold ${colour.text}`}
                >
                    {icon}
                </div>

                <div className="min-w-0">
                    <p className="break-words text-xs font-medium uppercase tracking-wide text-slate-400">
                        {label}
                    </p>

                    <p
                        className={`mt-2 break-words text-2xl font-semibold sm:text-3xl ${colour.text}`}
                    >
                        {value.toFixed(1)}
                    </p>
                </div>
            </div>

            <p className="mt-4 break-words text-sm text-slate-400">
                {detail}
            </p>
        </div>
    );
}

function RankKpi({
    icon,
    label,
    value,
    detail,
}: {
    icon: string;
    label: string;
    value: string;
    detail: string;
}) {
    return (
        <div className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5">
            <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xl font-semibold text-sky-400">
                    {icon}
                </div>

                <div className="min-w-0">
                    <p className="break-words text-xs font-medium uppercase tracking-wide text-slate-400">
                        {label}
                    </p>

                    <p className="mt-2 break-words text-2xl font-semibold text-sky-400 sm:text-3xl">
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

function CategoryRow({
    category,
    value,
    detail,
    open,
    onClick,
}: {
    category: string;
    value: number;
    detail: CostOfLivingDetail[];
    open: boolean;
    onClick: () => void;
}) {
    const colour = getCostColour(value);
    const differenceText = comparisonText(value);
    const maxWidth = Math.min(
        100,
        Math.max(4, value)
    );

    return (
        <div className="w-full min-w-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/30">
            <button
                type="button"
                onClick={onClick}
                className="w-full min-w-0 p-3 text-left transition hover:bg-slate-900/60"
            >
                <div className="mb-2 flex min-w-0 items-center justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                            <p className="min-w-0 break-words text-sm font-medium text-slate-200">
                                {category}
                            </p>

                            <span className="shrink-0 text-xs text-slate-500">
                                {open ? "▲" : "▼"}
                            </span>
                        </div>

                        <p
                            className={`break-words text-xs ${colour.text}`}
                        >
                            {differenceText}
                        </p>
                    </div>

                    <p
                        className={`shrink-0 text-lg font-semibold ${colour.text}`}
                    >
                        {value.toFixed(1)}
                    </p>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                        className={`h-full rounded-full ${colour.bar}`}
                        style={{
                            width: `${maxWidth}%`,
                        }}
                    />
                </div>
            </button>

            {open && (
                <div className="min-w-0 border-t border-slate-800 px-3 py-2">
                    {detail.length > 0 ? (
                        <div className="divide-y divide-slate-800">
                            {detail.map((item) => (
                                <MetricDetailRow
                                    key={item.metric}
                                    item={item}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="py-3 text-sm text-slate-500">
                            No underlying metrics available.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

function MetricDetailRow({
    item,
}: {
    item: CostOfLivingDetail;
}) {
    const colour = getCostColour(item.metric_index);

    return (
        <div className="grid min-w-0 grid-cols-1 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_90px] sm:gap-4">
            <div className="min-w-0">
                <p className="break-words text-sm text-slate-300">
                    {cleanMetricName(item.metric)}
                </p>

                <p
                    className={`mt-1 text-xs ${colour.text}`}
                >
                    {comparisonText(item.metric_index)}
                </p>

                <p className="mt-1 break-words text-xs text-slate-500">
                    Local: {formatDollar(item.avg_usd)} · NHL avg:{" "}
                    {formatDollar(item.nhl_avg_usd)}
                </p>
            </div>

            <p
                className={`text-left text-lg font-semibold sm:text-right ${colour.text}`}
            >
                {item.metric_index.toFixed(1)}
            </p>
        </div>
    );
}

function CostTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: {
        name: string;
        value: number;
        color: string;
    }[];
    label?: string;
}) {
    if (!active || !payload?.length) {
        return null;
    }

    return (
        <div className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 shadow-xl">
            <p className="mb-2 font-medium text-white">
                {label}
            </p>

            {payload.map((item) => (
                <p
                    key={item.name}
                    className="text-sm text-slate-300"
                >
                    {item.name}: {item.value.toFixed(1)}
                </p>
            ))}

            <p className="mt-1 text-xs text-slate-500">
                NHL Average: 100
            </p>
        </div>
    );
}

function getCostColour(value: number) {
    if (value < 75) {
        return {
            text: "text-emerald-300",
            bar: "bg-emerald-600",
        };
    }

    if (value < 85) {
        return {
            text: "text-green-400",
            bar: "bg-green-500",
        };
    }

    if (value < 95) {
        return {
            text: "text-green-300",
            bar: "bg-green-300",
        };
    }

    if (value <= 105) {
        return {
            text: "text-amber-200",
            bar: "bg-amber-200",
        };
    }

    if (value <= 115) {
        return {
            text: "text-red-300",
            bar: "bg-red-300",
        };
    }

    if (value <= 125) {
        return {
            text: "text-red-400",
            bar: "bg-red-500",
        };
    }

    return {
        text: "text-red-500",
        bar: "bg-red-700",
    };
}

function getChartColour(value: number) {
    if (value < 75) return "#059669";
    if (value < 85) return "#22c55e";
    if (value < 95) return "#86efac";
    if (value <= 105) return "#fde68a";
    if (value <= 115) return "#fca5a5";
    if (value <= 125) return "#ef4444";

    return "#b91c1c";
}

function comparisonText(value: number) {
    const difference = value - 100;

    if (Math.abs(difference) < 0.05) {
        return "At NHL average";
    }

    return `${Math.abs(difference).toFixed(1)}% ${
        difference > 0 ? "above" : "below"
    } NHL average`;
}

function formatPercent(value?: number | null) {
    if (value == null) return "—";

    return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatDollar(value: number) {
    return `$${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function cleanMetricName(metric: string) {
    return metric
        .replace(
            "Basic Utilities for 85 m2Apartment (Electricity, Heating, Cooling, Water, Garbage)",
            "Basic Utilities"
        )
        .replace(
            "Broadband Internet (Unlimited Data, 60 Mbps or Higher)",
            "Broadband Internet"
        )
        .replace(
            "Mobile Phone Plan (Monthly, with Calls and 10GB+ Data)",
            "Mobile Phone Plan"
        )
        .replace(
            "Meal for Two at a Mid-Range Restaurant (Three Courses, Without Drinks)",
            "Mid-Range Restaurant Meal for Two"
        )
        .replace(
            "Combo Meal at McDonald's (or Equivalent Fast-Food Meal)",
            "Fast-Food Combo Meal"
        )
        .replace(
            "Private Full-Day Preschool or Kindergarten, Monthly Fee per Child",
            "Preschool / Kindergarten"
        )
        .replace(
            "International Primary School, Annual Tuition per Child",
            "International Primary School"
        );
}

function overallSummary(
    difference: number,
    rank: number,
    cityCount: number
) {
    const comparison =
        Math.abs(difference) < 0.05
            ? "approximately in line with"
            : `${Math.abs(difference).toFixed(1)}% ${
                  difference > 0
                      ? "more expensive than"
                      : "less expensive than"
              }`;

    return `Overall, this city is ${comparison} the average NHL city and ranks #${rank} of ${cityCount} for affordability.`;
}