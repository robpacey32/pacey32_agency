"use client";

import { useMemo } from "react";

export type Summary = {
    projected_cap_hit: number;
    projected_cap_space: number;
    current_cap_space: number;
    deadline_cap_space: number;
    dead_cap_space: number;
    cap_utilisation_pct: number;
    cap_space_rank: number;
    active_roster: number;
    contracts: number;
    average_age: number;
    forward_cap: number;
    defense_cap: number;
    goalie_cap: number;
    forward_cap_pct: number;
    defense_cap_pct: number;
    goalie_cap_pct: number;
    nhl_avg_projected_cap_space: number;
    nhl_avg_forward_cap: number;
    nhl_avg_defense_cap: number;
    nhl_avg_goalie_cap: number;
};

export type FutureRow = {
    year: number;
    season: string;
    forward_cap: number;
    defense_cap: number;
    goalie_cap: number;
    roster_cap: number;
    non_roster_cap: number;
    roster_players: number;
    nhl_avg_roster_cap: number;
};

export type Contract = {
    player: string;
    position: string | null;
    cap_hit: number | null;
    expiry_status: string | null;
    expiry_year: number | null;
    is_elc: boolean | null;
};

export type Expiry = {
    expiry_year: number;
    expiring_players: number;
    expiring_cap_hit: number;
    ufa_players: number;
    ufa_cap_hit: number;
    rfa_players: number;
    rfa_cap_hit: number;
    elc_players: number;
    elc_cap_hit: number;
};

export type SalaryCapData = {
    team: string;
    summary: Summary | null;
    future: FutureRow[];
    contracts: Contract[];
    expiries: Expiry[];
    largestContracts: Contract[];
};

export default function SalaryCapPanel({
    data,
}: {
    data: SalaryCapData;
}) {
    const maxRosterCap = useMemo(() => {
        if (!data.future?.length) return 1;

        return Math.max(
            ...data.future.map((row) => row.roster_cap)
        );
    }, [data.future]);

    if (!data.summary) {
        return (
            <p className="text-slate-400">
                Salary cap data unavailable.
            </p>
        );
    }

    const {
        summary,
        future,
        expiries,
        largestContracts,
    } = data;

    return (
        <div className="space-y-8">

            <div className="grid gap-4 md:grid-cols-5">
                <Kpi
                    label="Projected Cap Hit"
                    value={money(summary.projected_cap_hit)}
                />
                <Kpi
                    label="Projected Cap Space"
                    value={money(summary.projected_cap_space)}
                />
                <Kpi
                    label="NHL Cap Space Rank"
                    value={`#${summary.cap_space_rank}`}
                />
                <Kpi
                    label="Dead Cap"
                    value={money(summary.dead_cap_space)}
                />
                <Kpi
                    label="Cap Utilisation"
                    value={`${summary.cap_utilisation_pct.toFixed(1)}%`}
                />
            </div>

            <Section title="Cap Position">
                <div className="grid gap-6 lg:grid-cols-2">

                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
                        <p className="text-sm text-slate-500">
                            Projected cap space
                        </p>

                        <p className="mt-2 text-3xl font-semibold">
                            {money(summary.projected_cap_space)}
                        </p>

                        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
                            <div
                                className="h-full rounded-full bg-slate-300"
                                style={{
                                    width: `${Math.max(
                                        2,
                                        Math.min(
                                            100,
                                            (
                                                summary.projected_cap_space /
                                                Math.max(
                                                    summary.projected_cap_space,
                                                    summary.nhl_avg_projected_cap_space
                                                )
                                            ) * 100
                                        )
                                    )}%`,
                                }}
                            />
                        </div>

                        <div className="mt-3 flex justify-between text-sm text-slate-500">
                            <span>
                                Team {money(summary.projected_cap_space)}
                            </span>
                            <span>
                                NHL avg {money(summary.nhl_avg_projected_cap_space)}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <SmallMetric
                            label="Current Cap Space"
                            value={money(summary.current_cap_space)}
                        />
                        <SmallMetric
                            label="Deadline Cap Space"
                            value={money(summary.deadline_cap_space)}
                        />
                        <SmallMetric
                            label="Active Roster"
                            value={String(summary.active_roster)}
                        />
                        <SmallMetric
                            label="Contracts"
                            value={String(summary.contracts)}
                        />
                    </div>

                </div>
            </Section>

            <Section title="Positional Spend">
                <div className="grid gap-4 md:grid-cols-3">
                    <PositionSpend
                        label="Forwards"
                        value={summary.forward_cap}
                        pct={summary.forward_cap_pct}
                        average={summary.nhl_avg_forward_cap}
                    />

                    <PositionSpend
                        label="Defence"
                        value={summary.defense_cap}
                        pct={summary.defense_cap_pct}
                        average={summary.nhl_avg_defense_cap}
                    />

                    <PositionSpend
                        label="Goalies"
                        value={summary.goalie_cap}
                        pct={summary.goalie_cap_pct}
                        average={summary.nhl_avg_goalie_cap}
                    />
                </div>
            </Section>

            <Section title="Future Commitments">
                <div className="space-y-4">
                    {future.map((row) => (
                        <div key={row.season}>

                            <div className="mb-2 flex items-center justify-between">
                                <div>
                                    <p className="font-medium">
                                        {row.season}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        {row.roster_players} roster players under contract
                                    </p>
                                </div>

                                <div className="text-right">
                                    <p className="font-semibold">
                                        {money(row.roster_cap)}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        NHL avg {money(row.nhl_avg_roster_cap)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex h-8 overflow-hidden rounded-lg bg-slate-800">
                                <CapSegment
                                    value={row.forward_cap}
                                    total={maxRosterCap}
                                    label="F"
                                />

                                <CapSegment
                                    value={row.defense_cap}
                                    total={maxRosterCap}
                                    label="D"
                                />

                                <CapSegment
                                    value={row.goalie_cap}
                                    total={maxRosterCap}
                                    label="G"
                                />
                            </div>

                        </div>
                    ))}
                </div>
            </Section>

            <div className="grid gap-6 lg:grid-cols-2">

                <Section title="Upcoming Contract Decisions">
                    {expiries.length === 0 ? (
                        <p className="text-slate-500">
                            No expiry data available.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {expiries.slice(0, 5).map((row) => (
                                <div
                                    key={row.expiry_year}
                                    className="flex items-center justify-between border-b border-slate-800 pb-3"
                                >
                                    <div>
                                        <p className="font-medium">
                                            {row.expiry_year}
                                        </p>

                                        <p className="text-sm text-slate-500">
                                            {row.ufa_players} UFA ·{" "}
                                            {row.rfa_players} RFA ·{" "}
                                            {row.elc_players} ELC
                                        </p>
                                    </div>

                                    <div className="text-right">
                                        <p className="font-semibold">
                                            {money(row.expiring_cap_hit)}
                                        </p>

                                        <p className="text-sm text-slate-500">
                                            {row.expiring_players} players
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>

                <Section title="Largest Contracts">
                    <div className="space-y-3">
                        {largestContracts.map((contract) => (
                            <div
                                key={`${contract.player}-${contract.cap_hit}`}
                                className="flex items-center justify-between border-b border-slate-800 pb-3"
                            >
                                <div>
                                    <p className="font-medium">
                                        {contract.player}
                                    </p>

                                    <p className="text-sm text-slate-500">
                                        {contract.position || "—"}
                                        {contract.expiry_year
                                            ? ` · ${contract.expiry_status || ""} ${contract.expiry_year}`
                                            : ""}
                                    </p>
                                </div>

                                <p className="font-semibold">
                                    {money(contract.cap_hit || 0)}
                                </p>
                            </div>
                        ))}
                    </div>
                </Section>

            </div>

            <Section title="Roster & Cap Details">
                <div className="grid gap-4 md:grid-cols-4">
                    <SmallMetric
                        label="Average Age"
                        value={summary.average_age.toFixed(1)}
                    />

                    <SmallMetric
                        label="Active Roster"
                        value={String(summary.active_roster)}
                    />

                    <SmallMetric
                        label="Contracts"
                        value={String(summary.contracts)}
                    />

                    <SmallMetric
                        label="Deadline Cap Space"
                        value={money(summary.deadline_cap_space)}
                    />
                </div>
            </Section>

        </div>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <h3 className="mb-5 text-lg font-semibold">
                {title}
            </h3>
            {children}
        </section>
    );
}

function Kpi({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="text-sm text-slate-500">
                {label}
            </p>
            <p className="mt-1 text-2xl font-semibold">
                {value}
            </p>
        </div>
    );
}

function SmallMetric({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-sm text-slate-500">
                {label}
            </p>
            <p className="mt-1 text-lg font-semibold">
                {value}
            </p>
        </div>
    );
}

function PositionSpend({
    label,
    value,
    pct,
    average,
}: {
    label: string;
    value: number;
    pct: number;
    average: number;
}) {
    const diff = value - average;

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
            <p className="text-sm text-slate-500">
                {label}
            </p>

            <p className="mt-1 text-2xl font-semibold">
                {money(value)}
            </p>

            <p className="mt-1 text-sm text-slate-400">
                {pct.toFixed(1)}% of cap
            </p>

            <p className="mt-4 text-sm text-slate-500">
                {diff >= 0 ? "+" : ""}
                {money(diff)} vs NHL avg
            </p>
        </div>
    );
}

function CapSegment({
    value,
    total,
    label,
}: {
    value: number;
    total: number;
    label: string;
}) {
    if (!value) return null;

    return (
        <div
            className="flex items-center justify-center border-r border-slate-950/60 bg-slate-600 text-xs font-medium"
            style={{
                width: `${(value / total) * 100}%`,
            }}
            title={`${label}: ${money(value)}`}
        >
            {label}
        </div>
    );
}

function money(value: number) {
    const abs = Math.abs(value);

    let formatted: string;

    if (abs >= 1_000_000) {
        formatted = `$${(abs / 1_000_000).toFixed(1)}m`;
    } else if (abs >= 1_000) {
        formatted = `$${(abs / 1_000).toFixed(0)}k`;
    } else {
        formatted = `$${abs.toFixed(0)}`;
    }

    return value < 0
        ? `-${formatted}`
        : formatted;
}