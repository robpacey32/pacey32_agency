import Image from "next/image";

export default function AboutPage() {
    return (
        <main className="min-h-screen overflow-x-hidden bg-slate-950 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
            <div className="mx-auto w-full min-w-0 max-w-7xl">

                {/* HERO */}
                <section className="py-10 sm:py-12 lg:py-16">

                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 sm:text-sm sm:tracking-[0.2em]">
                        About
                    </p>

                    <div className="mt-6 grid w-full min-w-0 items-center gap-8 sm:mt-8 sm:gap-10 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-12">

                        {/* PROFILE PHOTO */}
                        <div className="relative aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 sm:max-w-[360px] lg:max-w-none">
                            <Image
                                src="/RP1.jpg"
                                alt="Rob Pacey"
                                fill
                                priority
                                className="object-cover"
                                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 360px, 320px"
                            />
                        </div>

                        {/* ABOUT */}
                        <div className="min-w-0">

                            <h1 className="break-words text-4xl font-bold tracking-tight text-white sm:text-5xl">
                                Rob Pacey
                            </h1>

                            <p className="mt-3 max-w-2xl text-lg leading-7 text-slate-400 sm:text-xl">
                                Analytics Leader & Creator of Pacey32 Analytics
                            </p>

                            <p className="mt-6 max-w-3xl text-base leading-7 text-slate-300 sm:mt-8">
                                I&apos;m an analytics leader with 14 years&apos;
                                experience using data to improve commercial
                                decision-making, build analytics capabilities
                                and turn complex information into practical
                                decisions.
                            </p>

                            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-400">
                                I built Pacey32 Analytics to explore how that
                                same approach can be applied to professional
                                hockey — a personal challenge to source and
                                bring together data for player performance,
                                contracts, teams, cities and financial matters
                                to support the decisions agents and players
                                actually face.
                            </p>

                            <div className="mt-7 grid w-full grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:mt-8 sm:flex sm:w-auto sm:flex-wrap">

                                <a
                                    href="https://www.linkedin.com/in/rob-pacey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-lg bg-white px-5 py-2.5 text-center text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
                                >
                                    LinkedIn
                                </a>

                                <a
                                    href="mailto:info@pacey32.com"
                                    className="rounded-lg border border-slate-700 px-5 py-2.5 text-center text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900"
                                >
                                    info@pacey32.com
                                </a>

                            </div>

                        </div>

                    </div>

                </section>


                {/* WHY HOCKEY */}
                <section className="border-t border-slate-800 py-10 sm:py-12 lg:py-14">

                    <div className="w-full min-w-0 max-w-4xl">

                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-sm">
                            Why hockey?
                        </p>

                        <h2 className="mt-2 max-w-3xl text-2xl font-bold leading-tight text-white sm:text-3xl">
                            Combining professional experience with a personal interest.
                        </h2>

                        <div className="mt-5 grid min-w-0 grid-cols-1 gap-5 text-base leading-7 text-slate-400 sm:mt-6 sm:gap-6 md:grid-cols-2">

                            <p className="min-w-0">
                                Hockey is a sport I have an obsession with, but it also
                                contains some fascinating analytics problems. Player decisions
                                sit at the intersection of performance, contracts, opportunity,
                                tax, geography, lifestyle and family considerations. It&apos;s
                                more than just a sport, and more than data —
                                these are personal lives and careers.
                            </p>

                            <p className="min-w-0">
                                Much of that data already exists, but it isn&apos;t always
                                accessible or organised in a way that answers the questions
                                agents or players actually want answered. I built this tool
                                to connect the things I see as important, while continuing to
                                learn more about the sport I love.
                            </p>

                        </div>

                    </div>


                    {/* HOCKEY PHOTOS */}
                    <div className="mt-8 grid w-full min-w-0 grid-cols-1 gap-4 sm:mt-10 sm:gap-5 md:grid-cols-2">

                        <div className="relative aspect-[16/9] min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                            <Image
                                src="/RP2.jpg"
                                alt="Rob Pacey playing ball hockey"
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 50vw"
                            />
                        </div>

                        <div className="relative aspect-[16/9] min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
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