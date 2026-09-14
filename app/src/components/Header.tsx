"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SelectorBar from "@/components/SelectorBar";

const tabs = [
    { name: "Home", href: "/" },
    { name: "City", href: "/city" },
    { name: "Team", href: "/team" },
    { name: "Player", href: "/player" },
];

export default function Header() {
    const pathname = usePathname();

    return (
        <>
            <header className="border-b border-slate-800 bg-slate-950">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-8 py-4">

                    {/* BRAND */}
                    <div className="shrink-0">
                        <Link
                            href="/"
                            className="text-lg font-bold tracking-wide text-white transition hover:text-slate-200"
                        >
                            PACEY32{" "}
                            <span className="text-slate-400">
                                ANALYTICS
                            </span>
                        </Link>
                    </div>

                    {/* SELECTORS */}
                    <div className="w-full max-w-2xl">
                        <SelectorBar />
                    </div>

                </div>
            </header>

            {/* NAVIGATION */}
            <nav className="border-b border-slate-800 bg-slate-950">
                <div className="mx-auto flex max-w-7xl items-end gap-2 px-8">

                    {tabs.map((tab) => {
                        const active =
                            tab.href === "/"
                                ? pathname === "/"
                                : pathname.startsWith(
                                      tab.href
                                  );

                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className={`min-w-32 rounded-t-xl border-x border-t px-8 py-4 text-center text-lg font-semibold transition ${
                                    active
                                        ? "border-slate-700 bg-slate-900 text-white"
                                        : "border-transparent text-slate-500 hover:bg-slate-900/40 hover:text-slate-300"
                                }`}
                            >
                                {tab.name}
                            </Link>
                        );
                    })}

                </div>
            </nav>
        </>
    );
}