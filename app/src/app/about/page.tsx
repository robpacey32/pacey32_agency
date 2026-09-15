import Image from "next/image";

export default function AboutPage() {
    return (
        <main className="min-h-screen bg-slate-950 px-8 py-12">
            <div className="mx-auto max-w-7xl">

                {/* HERO */}
                <section className="py-16">

                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                        About
                    </p>

                    <div className="mt-8 grid items-center gap-12 lg:grid-cols-[320px_1fr]">

                        <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                            <Image
                                src="/RP1.jpg"
                                alt="Rob Pacey"
                                fill
                                priority
                                className="object-cover"
                                sizes="(max-width: 1024px) 100vw, 40vw"
                            />
                        </div>

                        <div>

                            <h1 className="text-5xl font-bold tracking-tight text-white md:text-3xl">
                                Rob Pacey
                            </h1>

                            <p className="mt-3 text-xl text-slate-400">
                                Analytics Leader & Creator of Pacey32 Analytics
                            </p>

                            <p className="mt-8 max-w-1xl text-base leading-7 text-slate-300">
                                I&apos;m an analytics leader with 14 years&apos;
                                experience using data to improve commercial
                                decision-making, build analytics capabilities
                                and turn complex information into practical
                                decisions.
                            </p>

                            <p className="mt-5 max-w-3xl text-base leading-6 text-slate-400">
                                I built Pacey32 Analytics to explore how that
                                same approach can be applied to professional
                                hockey — a personal challenge to source and
                                bring together data for player performance,
                                contracts, teams, cities and financial matters
                                to support the decisions agents and players
                                actually face.
                            </p>

                            <div className="mt-8 flex flex-wrap gap-3">

                                <a
                                    href="https://www.linkedin.com/in/rob-pacey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
                                >
                                    LinkedIn
                                </a>

                                <a
                                    href="mailto:info@pacey32.com"
                                    className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900"
                                >
                                    info@pacey32.com
                                </a>

                            </div>

                        </div>

                    </div>

                </section>

                {/* WHY HOCKEY */}
                <section className="border-t border-slate-800 py-14">

                    <div className="max-w-4xl">

                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Why hockey?
                        </p>

                        <h2 className="mt-2 text-3xl font-bold text-white">
                            Combining professional experience with a personal interest.
                        </h2>

                        <div className="mt-6 grid gap-6 text-base leading-7 text-slate-400 md:grid-cols-2">

                            <p>
                                Hockey is a sport I have an obsession with, but it also
                                contains some fascinating analytics problems. Player decisions
                                sit at the intersection of performance, contracts, opportunity,
                                tax, geography, lifestyle and family considerations. It&apos;s 
                                more than just a sport, and more than data — 
                                these are personal lives and careers.
                            </p>

                            <p>
                                Much of that data already exists, but it isn&apos;t always 
                                accessible or organised in a way that answers the questions
                                agents or players actually want answered. I built this tool
                                to connect the things I see as important, while continuing to
                                learn more about the sport I love.
                            </p>

                        </div>

                    </div>

                    {/* HOCKEY PHOTOS */}
                    <div className="mt-10 grid gap-5 md:grid-cols-2">

                        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                            <Image
                                src="/RP2.jpg"
                                alt="Rob Pacey playing ball hockey"
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 50vw"
                            />
                        </div>

                        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                            <Image
                                src="/RP3.jpg"
                                alt="Rob Pacey playing ice hockey"
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 50vw"
                            />
                        </div>

                    </div>

                </section>

            </div>
        </main>
    );
}


function Stat({
    value,
    label,
}: {
    value: string;
    label: string;
}) {
    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">

            <p className="text-3xl font-bold text-white">
                {value}
            </p>

            <p className="mt-2 text-sm text-slate-500">
                {label}
            </p>

        </div>
    );
}


function Skill({
    title,
    detail,
}: {
    title: string;
    detail: string;
}) {
    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">

            <h3 className="text-lg font-semibold text-white">
                {title}
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-400">
                {detail}
            </p>

        </div>
    );
}