"use client";

import Image from "next/image";
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

                    <div className="mt-4 flex items-center gap-8">

                        <Image
                            src="/32Logo.png"
                            alt="Pacey32 Analytics"
                            width={160}
                            height={160}
                            priority
                            className="hidden h-auto w-28 shrink-0 object-contain sm:block md:w-36"
                        />

                        <h1 className="max-w-4xl text-5xl font-bold tracking-tight text-white md:text-6xl">
                            Decision support for hockey agents.
                        </h1>

                    </div>

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
                                router.push("/team")
                            }
                            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
                        >
                            Explore a Team
                        </button>

                        <button
                            onClick={() =>
                                router.push("/player")
                            }
                            className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900"
                        >
                            Explore a Player
                        </button>

                        <button
                            onClick={() =>
                                router.push("/city")
                            }
                            className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900"
                        >
                            Explore a City
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
                            Start with the question,
                            not the data.
                        </h2>

                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

                        {questions.map((item) => (
                            <button
                                key={item.question}
                                onClick={() =>
                                    router.push(item.route)
                                }
                                className="group flex min-h-[150px] flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-left transition hover:border-slate-600 hover:bg-slate-900"
                            >

                                <p className="text-sm font-normal leading-6 text-slate-200">
                                    “{item.question}”
                                </p>

                                <div className="mt-5 flex items-center justify-between">

                                    <span className="text-xs font-normal text-slate-500">
                                        {item.area}
                                    </span>

                                    <span className="text-sm text-slate-600 transition group-hover:translate-x-1 group-hover:text-white">
                                        →
                                    </span>

                                </div>

                            </button>
                        ))}

                    </div>

                </section>


                {/* HOW IT WORKS */}
                <section className="border-t border-slate-800 py-14">

                    <div className="mb-10">

                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                            How it works
                        </p>

                        <h2 className="mt-2 text-3xl font-bold text-white">
                            We provide the data.
                            You make the decisions.
                        </h2>

                    </div>


                    {/* DESKTOP PROCESS FLOW */}
                    <div className="hidden items-stretch lg:flex">

                        <ProcessStep
                            number="01"
                            title="Select the situation"
                            detail="Choose the player, team or city you want to evaluate."
                        />

                        <ProcessArrow />

                        <ProcessStep
                            number="02"
                            title="Combine the data"
                            detail="Performance, contracts, schedules, tax, cost of living, organisation and location data are brought together."
                        />

                        <ProcessArrow />

                        <ProcessStep
                            number="03"
                            title="Compare the outcome"
                            detail="See the financial, sporting and lifestyle implications in a form designed to support an agent conversation."
                        />

                    </div>


                    {/* MOBILE PROCESS FLOW */}
                    <div className="space-y-3 lg:hidden">

                        <ProcessStep
                            number="01"
                            title="Select the situation"
                            detail="Choose the player, team or city you want to evaluate."
                        />

                        <div className="text-center text-2xl text-slate-600">
                            ↓
                        </div>

                        <ProcessStep
                            number="02"
                            title="Combine the data"
                            detail="Performance, contracts, schedules, tax, cost of living, organisation and location data are brought together."
                        />

                        <div className="text-center text-2xl text-slate-600">
                            ↓
                        </div>

                        <ProcessStep
                            number="03"
                            title="Compare the outcome"
                            detail="See the financial, sporting and lifestyle implications in a form designed to support an agent conversation."
                        />

                    </div>

                </section>


                {/* CAPABILITIES */}
                <section className="border-t border-slate-800 py-14">

                    <div className="grid gap-4 lg:grid-cols-3">

                        <Capability
                            title="City"
                            route="/city"
                            onNavigate={router.push}
                            items={[
                                "Tax",
                                "Cost of living",
                                "Climate",
                                "Neighbourhoods",
                                "Lifestyle",
                            ]}
                        />

                        <Capability
                            title="Team"
                            route="/team"
                            onNavigate={router.push}
                            items={[
                                "Organisation",
                                "Travel",
                                "Facilities",
                                "Affiliate",
                                "Roster context",
                            ]}
                        />

                        <Capability
                            title="Player"
                            route="/player"
                            onNavigate={router.push}
                            items={[
                                "Performance",
                                "Comparables",
                                "Trajectory",
                                "Contracts",
                                "Market positioning",
                            ]}
                        />

                    </div>

                </section>

            </div>
        </main>
    );
}


function ProcessStep({
    number,
    title,
    detail,
}: {
    number: string;
    title: string;
    detail: string;
}) {
    return (
        <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/30 p-6">

            <p className="text-sm font-semibold text-slate-600">
                {number}
            </p>

            <h3 className="mt-3 text-xl font-semibold text-white">
                {title}
            </h3>

            <p className="mt-3 leading-6 text-slate-400">
                {detail}
            </p>

        </div>
    );
}


function ProcessArrow() {
    return (
        <div className="flex w-16 shrink-0 items-center justify-center">

            <span className="text-3xl font-light text-slate-600">
                →
            </span>

        </div>
    );
}


function Capability({
    title,
    items,
    route,
    onNavigate,
}: {
    title: string;
    items: string[];
    route: string;
    onNavigate: (route: string) => void;
}) {
    return (
        <button
            onClick={() =>
                onNavigate(route)
            }
            className="group rounded-2xl border border-slate-800 bg-slate-900/30 p-6 text-left transition hover:border-slate-600 hover:bg-slate-900"
        >

            <div className="flex items-center justify-between">

                <h3 className="text-xl font-semibold text-white">
                    {title}
                </h3>

                <span className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-white">
                    →
                </span>

            </div>

            <div className="mt-5 space-y-3">

                {items.map((item) => (
                    <div
                        key={item}
                        className="flex items-center gap-3 text-slate-400"
                    >

                        <div className="h-1.5 w-1.5 rounded-full bg-slate-600" />

                        <span>
                            {item}
                        </span>

                    </div>
                ))}

            </div>

        </button>
    );
}