"use client";

import { useState } from "react";

import {
    BriefcaseBusiness,
    CalendarDays,
    CircleDollarSign,
    FileSignature,
    Percent,
    UserRound,
} from "lucide-react";

import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";


type BigQueryValue = {
    value: string;
};


export type PlayerContract = {
    player: string;
    contract_number: number;
    current_contract: boolean;

    season_from: string | null;
    season_to: string | null;

    cap_hit: number | null;
    term: number | null;
    total_value: number | null;

    signing_status: string | null;
    signing_age: number | null;

    expiry_status: string | null;
    expiry_year: number | null;
    expiry_age: number | null;

    signed_date: BigQueryValue | null;

    pct_cap_contract_start: number | null;

    signing_GM: string | null;
    signing_agent: string | null;
    offer_sheet: string | null;

    cap_hit_yr1: number | null;
    cap_hit_yr2: number | null;
    cap_hit_yr3: number | null;
    cap_hit_yr4: number | null;
    cap_hit_yr5: number | null;
    cap_hit_yr6: number | null;
    cap_hit_yr7: number | null;
    cap_hit_yr8: number | null;

    agent: string | null;
    ufa_year: number | null;
    estimated_career_earnings: number | null;

    scrape_datetime: BigQueryValue | null;
};


export type PlayerContractData = {
    player: string;
    contracts: PlayerContract[];
};


type Props = {
    data: PlayerContractData;
};


type ContractMetric =
    | "capHit"
    | "totalValue"
    | "capPercent";


const contractMetrics: {
    key: ContractMetric;
    label: string;
}[] = [
    {
        key: "capHit",
        label: "Cap Hit",
    },
    {
        key: "totalValue",
        label: "Total Value",
    },
    {
        key: "capPercent",
        label: "Cap %",
    },
];


const metricColours: Record<
    ContractMetric,
    string[]
> = {
    capHit: [
        "#1e3a8a",
        "#2563eb",
        "#60a5fa",
        "#bfdbfe",
    ],

    totalValue: [
        "#14532d",
        "#16a34a",
        "#4ade80",
        "#bbf7d0",
    ],

    capPercent: [
        "#581c87",
        "#9333ea",
        "#c084fc",
        "#e9d5ff",
    ],
};


function money(
    value: number | null,
    decimals = 2
) {
    if (value == null) {
        return "—";
    }

    if (value >= 1_000_000) {
        return `$${(
            value / 1_000_000
        ).toFixed(decimals)}m`;
    }

    if (value >= 1_000) {
        return `$${(
            value / 1_000
        ).toFixed(0)}k`;
    }

    return `$${value.toLocaleString()}`;
}


function formatDate(
    value: BigQueryValue | null
) {
    if (!value?.value) {
        return "—";
    }

    const [
        year,
        month,
        day,
    ] = value.value.split("-");

    if (!year || !month || !day) {
        return value.value;
    }

    return new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
    ).toLocaleDateString(
        "en-GB",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
        }
    );
}


function Detail({
    label,
    value,
}: {
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
            </p>

            <div className="text-sm font-semibold text-slate-100">
                {value}
            </div>
        </div>
    );
}


function HeadlineMetric({
    icon,
    label,
    value,
    detail,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    detail?: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="mb-3 text-slate-400">
                {icon}
            </div>

            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
            </p>

            <div className="mt-1 text-xl font-semibold text-white">
                {value}
            </div>

            {detail && (
                <div className="mt-1 text-xs text-slate-400">
                    {detail}
                </div>
            )}
        </div>
    );
}


function seasonRange(
    from: string | null,
    to: string | null
) {
    if (!from || !to) {
        return [];
    }

    const start =
        Number(
            from.slice(0, 4)
        );

    const end =
        Number(
            to.slice(0, 4)
        );

    if (
        Number.isNaN(start) ||
        Number.isNaN(end)
    ) {
        return [];
    }

    return Array.from(
        {
            length:
                end - start + 1,
        },
        (_, index) => {
            const year =
                start + index;

            return `${year}-${String(
                year + 1
            ).slice(-2)}`;
        }
    );
}


function getContractYearValue(
    contract: PlayerContract,
    yearIndex: number
) {
    const values = [
        contract.cap_hit_yr1,
        contract.cap_hit_yr2,
        contract.cap_hit_yr3,
        contract.cap_hit_yr4,
        contract.cap_hit_yr5,
        contract.cap_hit_yr6,
        contract.cap_hit_yr7,
        contract.cap_hit_yr8,
    ];

    return (
        values[yearIndex]
        ?? contract.cap_hit
        ?? null
    );
}


function formatChartValue(
    value: number,
    metric: ContractMetric
) {
    if (
        metric ===
        "capPercent"
    ) {
        return `${value.toFixed(
            2
        )}%`;
    }

    return money(value);
}


export default function PlayerContractPanel({
    data,
}: Props) {
    const [
        contractMetric,
        setContractMetric,
    ] =
        useState<ContractMetric>(
            "capHit"
        );

    const current =
        data.contracts.find(
            contract =>
                contract.current_contract
        )
        ?? data.contracts[0];

    if (!current) {
        return (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
                No contract information available.
            </div>
        );
    }

    const history = [
        ...data.contracts,
    ].sort(
        (a, b) =>
            (a.contract_number ?? 0)
            - (b.contract_number ?? 0)
    );

    const chartDataMap =
        new Map<
            string,
            Record<
                string,
                string | number | null
            >
        >();

    history.forEach(
        contract => {
            const seasons =
                seasonRange(
                    contract.season_from,
                    contract.season_to
                );

            seasons.forEach(
                (
                    season,
                    yearIndex
                ) => {
                    if (
                        !chartDataMap.has(
                            season
                        )
                    ) {
                        chartDataMap.set(
                            season,
                            {
                                season,
                            }
                        );
                    }

                    const row =
                        chartDataMap.get(
                            season
                        )!;

                    const key =
                        `contract_${contract.contract_number}`;

                    if (
                        contractMetric ===
                        "capHit"
                    ) {
                        row[key] =
                            getContractYearValue(
                                contract,
                                yearIndex
                            );
                    }

                    if (
                        contractMetric ===
                        "totalValue"
                    ) {
                        row[key] =
                            contract.total_value;
                    }

                    if (
                        contractMetric ===
                        "capPercent"
                    ) {
                        row[key] =
                            contract.pct_cap_contract_start;
                    }
                }
            );
        }
    );

    const chartData =
        Array.from(
            chartDataMap.values()
        ).sort(
            (a, b) =>
                Number(
                    String(
                        a.season
                    ).slice(
                        0,
                        4
                    )
                )
                -
                Number(
                    String(
                        b.season
                    ).slice(
                        0,
                        4
                    )
                )
        );

    const colours =
        metricColours[
            contractMetric
        ];

    return (
        <div className="space-y-5">

            {/* CURRENT CONTRACT */}

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-5 flex items-start justify-between gap-5">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Current Contract
                        </p>

                        <h2 className="mt-1 text-xl font-semibold text-white">
                            {current.season_from ?? "—"}
                            {" → "}
                            {current.season_to ?? "—"}
                        </h2>
                    </div>

                    {current.expiry_status && (
                        <div className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">
                            {current.expiry_status}
                            {current.expiry_year
                                ? ` ${current.expiry_year}`
                                : ""}
                        </div>
                    )}
                </div>

                <div className="grid min-w-[850px] grid-cols-4 gap-3 overflow-x-auto">
                    <HeadlineMetric
                        icon={
                            <CircleDollarSign size={20} />
                        }
                        label="Cap Hit / AAV"
                        value={money(
                            current.cap_hit
                        )}
                    />

                    <HeadlineMetric
                        icon={
                            <CalendarDays size={20} />
                        }
                        label="Term"
                        value={
                            current.term != null
                                ? `${current.term} years`
                                : "—"
                        }
                    />

                    <HeadlineMetric
                        icon={
                            <BriefcaseBusiness size={20} />
                        }
                        label="Total Value"
                        value={money(
                            current.total_value
                        )}
                    />

                    <HeadlineMetric
                        icon={
                            <Percent size={20} />
                        }
                        label="Cap % When Signed"
                        value={
                            current.pct_cap_contract_start
                                != null
                                ? `${current.pct_cap_contract_start.toFixed(2)}%`
                                : "—"
                        }
                    />
                </div>
            </section>


            {/* SIGNING + PLAYER CONTRACT INFO */}

            <section className="grid min-w-[950px] grid-cols-[1.4fr_1fr] gap-5 overflow-x-auto">

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                    <div className="mb-5 flex items-center gap-2">
                        <FileSignature
                            size={18}
                            className="text-slate-400"
                        />

                        <h3 className="font-semibold text-white">
                            Signing Details
                        </h3>
                    </div>

                    <div className="grid grid-cols-3 gap-x-6 gap-y-5">
                        <Detail
                            label="Signed"
                            value={formatDate(
                                current.signed_date
                            )}
                        />

                        <Detail
                            label="Signing Status"
                            value={
                                current.signing_status
                                ?? "—"
                            }
                        />

                        <Detail
                            label="Signing Age"
                            value={
                                current.signing_age
                                ?? "—"
                            }
                        />

                        <Detail
                            label="General Manager"
                            value={
                                current.signing_GM
                                ?? "—"
                            }
                        />

                        <Detail
                            label="Signing Agent"
                            value={
                                current.signing_agent
                                ?? current.agent
                                ?? "—"
                            }
                        />

                        <Detail
                            label="Offer Sheet"
                            value={
                                current.offer_sheet
                                ?? "No"
                            }
                        />
                    </div>
                </div>


                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                    <div className="mb-5 flex items-center gap-2">
                        <UserRound
                            size={18}
                            className="text-slate-400"
                        />

                        <h3 className="font-semibold text-white">
                            Contract Status
                        </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                        <Detail
                            label="Expiry"
                            value={
                                current.expiry_status
                                ?? "—"
                            }
                        />

                        <Detail
                            label="Expiry Age"
                            value={
                                current.expiry_age
                                ?? "—"
                            }
                        />

                        <Detail
                            label="Current Agent"
                            value={
                                current.agent
                                ?? "—"
                            }
                        />

                        <Detail
                            label="Career Earnings"
                            value={money(
                                current
                                    .estimated_career_earnings
                            )}
                        />
                    </div>
                </div>
            </section>


            {/* CONTRACT HISTORY */}

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

                <div className="mb-6 flex items-start justify-between gap-5">

                    <div>
                        <h3 className="font-semibold text-white">
                            Contract History
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                            Career contract progression by season
                        </p>
                    </div>


                    <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-1">

                        {contractMetrics.map(
                            metric => (
                                <button
                                    key={
                                        metric.key
                                    }
                                    type="button"
                                    onClick={() =>
                                        setContractMetric(
                                            metric.key
                                        )
                                    }
                                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                                        contractMetric ===
                                        metric.key
                                            ? "bg-slate-700 text-white"
                                            : "text-slate-400 hover:text-slate-200"
                                    }`}
                                >
                                    {
                                        metric.label
                                    }
                                </button>
                            )
                        )}

                    </div>

                </div>


                <div className="h-[340px] min-w-[900px]">

                    <ResponsiveContainer
                        width="100%"
                        height="100%"
                    >
                        <LineChart
                            data={
                                chartData
                            }
                            margin={{
                                top: 10,
                                right: 25,
                                left: 15,
                                bottom: 10,
                            }}
                        >

                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#1e293b"
                                vertical={false}
                            />

                            <XAxis
                                dataKey="season"
                                stroke="#64748b"
                                tick={{
                                    fill:
                                        "#94a3b8",
                                    fontSize:
                                        12,
                                }}
                                tickLine={
                                    false
                                }
                                axisLine={{
                                    stroke:
                                        "#334155",
                                }}
                            />

                            <YAxis
                                stroke="#64748b"
                                tick={{
                                    fill:
                                        "#94a3b8",
                                    fontSize:
                                        12,
                                }}
                                tickLine={
                                    false
                                }
                                axisLine={
                                    false
                                }
                                tickFormatter={(
                                    value
                                ) =>
                                    contractMetric ===
                                    "capPercent"
                                        ? `${value}%`
                                        : money(
                                              Number(
                                                  value
                                              )
                                          )
                                }
                                width={80}
                            />

                            <Tooltip
                                contentStyle={{
                                    backgroundColor:
                                        "#020617",
                                    border:
                                        "1px solid #334155",
                                    borderRadius:
                                        "10px",
                                    color:
                                        "#e2e8f0",
                                }}
                                labelStyle={{
                                    color:
                                        "#94a3b8",
                                }}
                                formatter={(
                                    value,
                                    name
                                ) => [
                                    formatChartValue(
                                        Number(
                                            value
                                        ),
                                        contractMetric
                                    ),
                                    name,
                                ]}
                            />

                            <Legend
                                wrapperStyle={{
                                    fontSize:
                                        "12px",
                                    color:
                                        "#94a3b8",
                                }}
                            />


                            {history.map(
                                (
                                    contract,
                                    index
                                ) => {
                                    const colour =
                                        colours[
                                            Math.min(
                                                index,
                                                colours.length -
                                                    1
                                            )
                                        ];

                                    return (
                                        <Line
                                            key={
                                                contract.contract_number
                                            }
                                            type="monotone"
                                            dataKey={`contract_${contract.contract_number}`}
                                            name={`${
                                                contract.season_from
                                            } → ${
                                                contract.season_to
                                            }`}
                                            stroke={
                                                colour
                                            }
                                            strokeWidth={
                                                contract.current_contract
                                                    ? 3
                                                    : 2
                                            }
                                            dot={{
                                                r: 4,
                                                fill:
                                                    colour,
                                                strokeWidth:
                                                    0,
                                            }}
                                            activeDot={{
                                                r: 6,
                                            }}
                                            connectNulls={
                                                false
                                            }
                                        />
                                    );
                                }
                            )}

                        </LineChart>
                    </ResponsiveContainer>

                </div>

            </section>

        </div>
    );
}