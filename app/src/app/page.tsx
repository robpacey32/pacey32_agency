"use client";

import { useRouter } from "next/navigation";

const questions = [
    {
        question:
            "If my player signs in Toronto instead of Tampa, how much does that change their take-home pay?",
        area: "Tax",
        route: "/city",
    },
    {
        question:
            "What does living in this city actually look like for a player and their family?",
        area: "City",
        route: "/city",
    },
    {
        question:
            "How expensive is this market compared with the rest of the NHL?",
        area: "Cost of Living",
        route: "/city",
    },
    {
        question:
            "Which players are genuinely comparable to this player?",
        area: "Comparables",
        route: "/player",
    },
    {
        question:
            "How does this player's production, usage and trajectory compare with the league?",
        area: "Player Analytics",
        route: "/player",
    },
    {
        question:
            "What does joining this organisation mean for the player?",
        area: "Team",
        route: "/team",
    },
];

export default function HomePage() {
    const router = useRouter();

    return (
        <main className="min-h-screen bg-slate-950 px-8 py-12">
            <div className="mx-auto max-w-7xl">

                {/* HERO */}
                <section className="py-16">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Pacey32 Analytics
                    </p>

                    <h1 className="mt-4 max-w-4xl text-5xl font-bold tracking-tight text-white md:text-6xl">
                        Decision support for hockey agents.
                    </h1>

                    <p className="mt-6 max-w-3xl text-xl leading-8 text-slate-400">
                        Understand the financial,
                        lifestyle and performance
                        implications of where a
                        player signs, how they
                        compare, and what they are
                        worth.
                    </p>

                    <div className="mt-8 flex flex-wrap gap-3">
                        <button
                            onClick={() =>
                                router.push(
                                    "/team"
                                )
                            }
                            className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-950 transition hover:bg-slate-200"
                        >
                            Explore a Team
                        </button>

                        <button
                            onClick={() =>
                                router.push(
                                    "/player"
                                )
                            }
                            className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900"
                        >
                            Explore a Player
                        </button>
                    </div>
                </section>


                {/* QUESTIONS */}
                <section className="border-t border-slate-800 py-14">

                    <div className="mb-8">
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Questions this can answer
                        </p>

                        <h2 className="mt-2 text-3xl font-bold text-white">
                            Start with the decision,
                            not the data.
                        </h2>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

                        {questions.map(
                            (item) => (
                                <button
                                    key={
                                        item.question
                                    }
                                    onClick={() =>
                                        router.push(
                                            item.route
                                        )
                                    }
                                    className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-left transition hover:border-slate-600 hover:bg-slate-900"
                                >
                                    <p className="text-lg font-semibold leading-7 text-white">
                                        “
                                        {
                                            item.question
                                        }
                                        ”
                                    </p>

                                    <div className="mt-6 flex items-center justify-between">

                                        <span className="text-sm font-medium text-slate-500">
                                            {
                                                item.area
                                            }
                                        </span>

                                        <span className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-white">
                                            →
                                        </span>

                                    </div>
                                </button>
                            )
                        )}

                    </div>
                </section>


                {/* HOW IT WORKS */}
                <section className="border-t border-slate-800 py-14">

                    <div className="mb-8">
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                            How it works
                        </p>

                        <h2 className="mt-2 text-3xl font-bold text-white">
                            From raw data to a
                            player decision.
                        </h2>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">

                        <Step
                            number="01"
                            title="Select the situation"
                            detail="Choose the player, team or city you want to evaluate."
                        />

                        <Step
                            number="02"
                            title="Combine the data"
                            detail="Performance, contracts, schedules, tax, cost of living, organisation and location data are brought together."
                        />

                        <Step
                            number="03"
                            title="Compare the outcome"
                            detail="See the financial, sporting and lifestyle implications in a form designed to support an agent conversation."
                        />

                    </div>
                </section>


                {/* CAPABILITIES */}
                <section className="border-t border-slate-800 py-14">

                    <div className="mb-8">
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Decision areas
                        </p>

                        <h2 className="mt-2 text-3xl font-bold text-white">
                            Built around the decisions
                            agents actually make.
                        </h2>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">

                        <Capability
                            title="Player"
                            items={[
                                "Performance",
                                "Comparables",
                                "Trajectory",
                                "Contracts",
                                "Market positioning",
                            ]}
                        />

                        <Capability
                            title="Team"
                            items={[
                                "Organisation",
                                "Travel",
                                "Facilities",
                                "Affiliate",
                                "Roster context",
                            ]}
                        />

                        <Capability
                            title="City"
                            items={[
                                "Tax",
                                "Cost of living",
                                "Climate",
                                "Neighbourhoods",
                                "Lifestyle",
                            ]}
                        />

                    </div>
                </section>

            </div>
        </main>
    );
}


function Step({
    number,
    title,
    detail,
}: {
    number: string;
    title: string;
    detail: string;
}) {
    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">

            <p className="text-sm font-semibold text-slate-600">
                {number}
            </p>

            <h3 className="mt-4 text-xl font-semibold text-white">
                {title}
            </h3>

            <p className="mt-3 leading-6 text-slate-400">
                {detail}
            </p>

        </div>
    );
}


function Capability({
    title,
    items,
}: {
    title: string;
    items: string[];
}) {
    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">

            <h3 className="text-xl font-semibold text-white">
                {title}
            </h3>

            <div className="mt-5 space-y-3">

                {items.map(
                    (item) => (
                        <div
                            key={item}
                            className="flex items-center gap-3 text-slate-400"
                        >
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-600" />

                            <span>
                                {item}
                            </span>
                        </div>
                    )
                )}

            </div>

        </div>
    );
}