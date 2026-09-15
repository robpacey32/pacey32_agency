"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SelectorBar from "@/components/SelectorBar";

const tabs = [
    { name: "Home", href: "/" },
    { name: "City", href: "/city" },
    { name: "Team", href: "/team" },
    { name: "Player", href: "/player" },
    { name: "About", href: "/about" },
];

export default function Header() {
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const isActive = (href: string) =>
        href === "/"
            ? pathname === "/"
            : pathname.startsWith(href);

    return (
        <>
            <header className="w-full min-w-0 border-b border-slate-800 bg-slate-950">
                <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-4 md:px-8">

                    {/* DESKTOP HEADER */}
                    <div className="hidden min-w-0 items-center justify-between gap-8 md:flex">

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
                        <div className="w-full min-w-0 max-w-2xl">
                            <SelectorBar />
                        </div>

                    </div>

                    {/* MOBILE HEADER */}
                    <div className="flex min-w-0 items-center justify-between gap-3 md:hidden">

                        {/* BRAND */}
                        <Link
                            href="/"
                            onClick={() =>
                                setMobileMenuOpen(
                                    false
                                )
                            }
                            className="min-w-0 text-base font-bold tracking-wide text-white"
                        >
                            <span className="whitespace-nowrap">
                                PACEY32{" "}
                                <span className="text-slate-400">
                                    ANALYTICS
                                </span>
                            </span>
                        </Link>

                        {/* HAMBURGER */}
                        <button
                            type="button"
                            onClick={() =>
                                setMobileMenuOpen(
                                    (open) => !open
                                )
                            }
                            aria-label="Toggle navigation"
                            aria-expanded={
                                mobileMenuOpen
                            }
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition hover:border-slate-600 hover:bg-slate-900 hover:text-white"
                        >
                            {mobileMenuOpen ? (
                                <span className="text-2xl leading-none">
                                    ×
                                </span>
                            ) : (
                                <div className="flex flex-col gap-1.5">
                                    <span className="block h-0.5 w-5 bg-current" />
                                    <span className="block h-0.5 w-5 bg-current" />
                                    <span className="block h-0.5 w-5 bg-current" />
                                </div>
                            )}
                        </button>

                    </div>

                    {/* MOBILE MENU */}
                    {mobileMenuOpen && (
                        <div className="mt-4 w-full min-w-0 max-w-full border-t border-slate-800 pt-4 md:hidden">

                            {/* NAVIGATION */}
                            <nav className="flex w-full min-w-0 flex-col gap-1">
                                {tabs.map(
                                    (tab) => {
                                        const active =
                                            isActive(
                                                tab.href
                                            );

                                        return (
                                            <Link
                                                key={
                                                    tab.href
                                                }
                                                href={
                                                    tab.href
                                                }
                                                onClick={() =>
                                                    setMobileMenuOpen(
                                                        false
                                                    )
                                                }
                                                className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition ${
                                                    active
                                                        ? "bg-slate-900 text-white"
                                                        : "text-slate-400 hover:bg-slate-900/50 hover:text-white"
                                                }`}
                                            >
                                                {
                                                    tab.name
                                                }
                                            </Link>
                                        );
                                    }
                                )}
                            </nav>

                            {/* SELECTORS */}
                            <div className="mt-4 w-full min-w-0 max-w-full border-t border-slate-800 pt-4">
                                <SelectorBar />
                            </div>

                        </div>
                    )}

                </div>
            </header>

            {/* DESKTOP NAVIGATION */}
            <nav className="hidden w-full min-w-0 border-b border-slate-800 bg-slate-950 md:block">
                <div className="mx-auto flex w-full min-w-0 max-w-7xl items-end gap-2 px-8">

                    {tabs.map(
                        (tab) => {
                            const active =
                                isActive(
                                    tab.href
                                );

                            return (
                                <Link
                                    key={
                                        tab.href
                                    }
                                    href={
                                        tab.href
                                    }
                                    className={`min-w-32 rounded-t-xl border-x border-t px-8 py-4 text-center text-lg font-semibold transition ${
                                        active
                                            ? "border-slate-700 bg-slate-900 text-white"
                                            : "border-transparent text-slate-500 hover:bg-slate-900/40 hover:text-slate-300"
                                    }`}
                                >
                                    {
                                        tab.name
                                    }
                                </Link>
                            );
                        }
                    )}

                </div>
            </nav>
        </>
    );
}