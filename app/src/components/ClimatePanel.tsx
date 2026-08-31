"use client";

import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type ClimateSummary = {
    avg_annual_temp: number;
    avg_winter_temp: number;
    avg_summer_temp: number;
    annual_rain_mm: number;
    annual_snowfall: number;
    avg_cloud_cover: number;
    avg_solar_radiation: number;

    nhl_avg_annual_temp: number;
    nhl_avg_winter_temp: number;
    nhl_avg_summer_temp: number;
    nhl_avg_annual_rain_mm: number;
    nhl_avg_annual_snowfall: number;
    nhl_avg_cloud_cover: number;
    nhl_avg_solar_radiation: number;

    annual_temp_vs_nhl_avg: number;
    winter_temp_vs_nhl_avg: number;
    summer_temp_vs_nhl_avg: number;
    rain_vs_nhl_avg_pct: number;
    snowfall_vs_nhl_avg_pct: number;
    cloud_vs_nhl_avg_pct: number;
    solar_vs_nhl_avg_pct: number;

    sunshine_rank: number;
    nhl_city_count: number;
};

type MonthlyClimate = {
    month: number;
    avgTemp: number;
    minTemp: number;
    maxTemp: number;
    rainMM: number;
    snowfall: number;
    cloudCover: number;
    solarRadiation: number;
    nhlAvgTemp: number;
    nhlAvgRainMM: number;
    nhlAvgSnowfall: number;
    nhlAvgCloudCover: number;
    nhlAvgSolarRadiation: number;
};

type ClimatePanelProps = {
    city: string;
    stateProvince: string;
    country: string;
    climate: ClimateSummary;
    monthly: MonthlyClimate[];
};

const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

export default function ClimatePanel({
    city,
    stateProvince,
    country,
    climate,
    monthly,
}: ClimatePanelProps) {
    const chartData = monthly.map((row) => ({
        ...row,
        monthName: months[row.month - 1],
    }));

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-2xl font-semibold text-white">
                    {city}, {stateProvince}, {country}
                </h3>

                <p className="mt-2 text-sm text-slate-400">
                    Long-term monthly climate averages
                </p>
            </div>

            <div className="grid grid-cols-5 gap-4">
                <ClimateKpi
                    icon="☀"
                    iconClass="text-yellow-400"
                    valueClass="text-yellow-400"
                    label="Sunshine Rank"
                    value={`#${climate.sunshine_rank}`}
                    detail={`${formatPercent(
                        climate.solar_vs_nhl_avg_pct
                    )} vs NHL average`}
                />

                <ClimateKpi
                    icon="☼"
                    iconClass="text-yellow-400"
                    valueClass="text-yellow-400"
                    label="Sunshine vs Avg"
                    value={formatPercent(
                        climate.solar_vs_nhl_avg_pct
                    )}
                    detail={
                        climate.solar_vs_nhl_avg_pct >= 0
                            ? "Above NHL average"
                            : "Below NHL average"
                    }
                />

                <ClimateKpi
                    icon="♨"
                    iconClass="text-red-400"
                    valueClass="text-red-400"
                    label="Annual Avg Temp"
                    value={`${climate.avg_annual_temp.toFixed(
                        1
                    )} °C`}
                    detail={`${formatTemperatureDifference(
                        climate.annual_temp_vs_nhl_avg
                    )} vs NHL average`}
                />

                <ClimateKpi
                    icon="☂"
                    iconClass="text-blue-400"
                    valueClass="text-blue-400"
                    label="Annual Rainfall"
                    value={`${climate.annual_rain_mm.toFixed(
                        0
                    )} mm`}
                    detail={`${formatPercent(
                        climate.rain_vs_nhl_avg_pct
                    )} vs NHL average`}
                />

                <ClimateKpi
                    icon="❄"
                    iconClass="text-cyan-300"
                    valueClass="text-cyan-300"
                    label="Annual Snowfall"
                    value={climate.annual_snowfall.toFixed(0)}
                    detail={`${formatPercent(
                        climate.snowfall_vs_nhl_avg_pct
                    )} vs NHL average`}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <ChartPanel title="Monthly Temperature (°C)">
                    <ResponsiveContainer
                        width="100%"
                        height={320}
                    >
                        <LineChart
                            data={chartData}
                            margin={{
                                top: 10,
                                right: 20,
                                left: 0,
                                bottom: 0,
                            }}
                        >
                            <CartesianGrid
                                stroke="#1e293b"
                                vertical={false}
                            />

                            <XAxis
                                dataKey="monthName"
                                tick={{ fill: "#94a3b8" }}
                                axisLine={false}
                                tickLine={false}
                            />

                            <YAxis
                                tick={{
                                    fill: "#94a3b8",
                                }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) =>
                                    `${Math.round(value)}°`
                                }
                            />

                            <Tooltip
                                content={
                                    <ClimateTooltip
                                        chart="temperature"
                                    />
                                }
                            />

                            <Legend />

                            <Line
                                type="monotone"
                                dataKey="avgTemp"
                                name="Average"
                                stroke="#ef4444"
                                strokeWidth={3}
                                dot={{ r: 3 }}
                                activeDot={{ r: 5 }}
                            />

                            <Line
                                type="monotone"
                                dataKey="maxTemp"
                                name="Maximum"
                                stroke="#fca5a5"
                                strokeWidth={1.25}
                                strokeDasharray="4 4"
                                dot={false}
                            />

                            <Line
                                type="monotone"
                                dataKey="minTemp"
                                name="Minimum"
                                stroke="#fecaca"
                                strokeWidth={1.25}
                                strokeDasharray="4 4"
                                dot={false}
                            />

                            <Line
                                type="monotone"
                                dataKey="nhlAvgTemp"
                                name="NHL Average"
                                stroke="#94a3b8"
                                strokeWidth={1.5}
                                strokeDasharray="5 5"
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>

                    <p className="mt-2 text-center text-xs text-slate-500">
                        Monthly average, maximum and minimum
                        temperatures
                    </p>
                </ChartPanel>

                <ChartPanel title="Monthly Precipitation">
                    <ResponsiveContainer
                        width="100%"
                        height={320}
                    >
                        <ComposedChart
                            data={chartData}
                            margin={{
                                top: 10,
                                right: 20,
                                left: 0,
                                bottom: 0,
                            }}
                        >
                            <CartesianGrid
                                stroke="#1e293b"
                                vertical={false}
                            />

                            <XAxis
                                dataKey="monthName"
                                tick={{ fill: "#94a3b8" }}
                                axisLine={false}
                                tickLine={false}
                            />

                            <YAxis
                                tick={{
                                    fill: "#94a3b8",
                                }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) =>
                                    `${Math.round(value)}`
                                }
                            />

                            <Tooltip
                                content={
                                    <ClimateTooltip
                                        chart="precipitation"
                                    />
                                }
                            />

                            <Legend />

                            <Bar
                                dataKey="rainMM"
                                name="Rainfall"
                                fill="#3b82f6"
                                radius={[3, 3, 0, 0]}
                            />

                            <Bar
                                dataKey="snowfall"
                                name="Snowfall"
                                fill="#67e8f9"
                                radius={[3, 3, 0, 0]}
                            />

                            <Line
                                type="monotone"
                                dataKey="nhlAvgRainMM"
                                name="NHL Avg Rain"
                                stroke="#94a3b8"
                                strokeWidth={1.5}
                                strokeDasharray="5 5"
                                dot={false}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>

                    <p className="mt-2 text-center text-xs text-slate-500">
                        Monthly rainfall and snowfall
                    </p>
                </ChartPanel>
            </div>

            <div>
                <p className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-500">
                    Additional Climate Insights
                </p>

                <div className="grid grid-cols-4 gap-4">
                    <ClimateKpi
                        icon="❄"
                        iconClass="text-cyan-300"
                        valueClass="text-cyan-300"
                        label="Winter Avg Temp"
                        value={`${climate.avg_winter_temp.toFixed(
                            1
                        )} °C`}
                        detail={`${formatTemperatureDifference(
                            climate.winter_temp_vs_nhl_avg
                        )} vs NHL average`}
                    />

                    <ClimateKpi
                        icon="☀"
                        iconClass="text-orange-400"
                        valueClass="text-orange-400"
                        label="Summer Avg Temp"
                        value={`${climate.avg_summer_temp.toFixed(
                            1
                        )} °C`}
                        detail={`${formatTemperatureDifference(
                            climate.summer_temp_vs_nhl_avg
                        )} vs NHL average`}
                    />

                    <ClimateKpi
                        icon="☁"
                        iconClass="text-slate-300"
                        valueClass="text-slate-200"
                        label="Average Cloud Cover"
                        value={`${climate.avg_cloud_cover.toFixed(
                            1
                        )}%`}
                        detail={`${formatPercent(
                            climate.cloud_vs_nhl_avg_pct
                        )} vs NHL average`}
                    />

                    <ClimateKpi
                        icon="☼"
                        iconClass="text-yellow-400"
                        valueClass="text-yellow-400"
                        label="Solar Radiation"
                        value={climate.avg_solar_radiation.toFixed(
                            1
                        )}
                        detail={`${formatPercent(
                            climate.solar_vs_nhl_avg_pct
                        )} vs NHL average`}
                    />
                </div>
            </div>

            <div className="border-t border-slate-800 pt-5 text-xs leading-5 text-slate-500">
                NHL comparisons are calculated across all NHL
                cities in the climate dataset. Winter = Dec–Feb.
                Summer = Jun–Aug.
            </div>
        </div>
    );
}

function ClimateKpi({
    icon,
    iconClass,
    valueClass,
    label,
    value,
    detail,
}: {
    icon: string;
    iconClass: string;
    valueClass: string;
    label: string;
    value: string;
    detail: string;
}) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
            <div className="flex items-start gap-4">
                <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xl ${iconClass}`}
                >
                    {icon}
                </div>

                <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {label}
                    </p>

                    <p
                        className={`mt-2 text-3xl font-semibold ${valueClass}`}
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

function ClimateTooltip({
    active,
    payload,
    label,
    chart,
}: {
    active?: boolean;
    payload?: {
        name: string;
        value: number;
        color: string;
    }[];
    label?: string;
    chart: "temperature" | "precipitation";
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
                    {item.name}:{" "}
                    {formatTooltipValue(
                        item.value,
                        item.name,
                        chart
                    )}
                </p>
            ))}
        </div>
    );
}

function formatTooltipValue(
    value: number,
    name: string,
    chart: "temperature" | "precipitation"
) {
    const rounded = Math.round(value);

    if (chart === "temperature") {
        return `${rounded} °C`;
    }

    if (name === "Rainfall") {
        return `${rounded} mm`;
    }

    return `${rounded}`;
}

function formatPercent(value?: number | null) {
    if (value == null) return "—";

    return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatTemperatureDifference(
    value?: number | null
) {
    if (value == null) return "—";

    return `${value > 0 ? "+" : ""}${value.toFixed(
        1
    )} °C`;
}