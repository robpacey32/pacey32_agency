"use client";

import { useEffect, useState } from "react";
import ExpandableCard from "@/components/ExpandableCard";
import SalaryCapPanel, {
    SalaryCapData,
} from "@/components/SalaryCapPanel";
import { useAppContext } from "@/context/AppContext";

type Team = {
    triCode: string;
    fullName: string;
    conferenceName?: string;
    divisionName?: string;
};

export default function TeamPage() {
    const { team: selectedTeam } = useAppContext();

    const [team, setTeam] = useState<Team | null>(null);
    const [salaryCap, setSalaryCap] =
        useState<SalaryCapData | null>(null);

    const [capLoading, setCapLoading] = useState(true);
    const [openCard, setOpenCard] =
        useState<string | null>(null);

    useEffect(() => {
        async function loadTeam() {
            try {
                const response = await fetch("/api/teams");

                if (!response.ok) {
                    setTeam(null);
                    return;
                }

                const teams: Team[] =
                    await response.json();

                const match = teams.find(
                    (t) => t.triCode === selectedTeam
                );

                setTeam(match ?? null);
            } catch {
                setTeam(null);
            }
        }

        loadTeam();
    }, [selectedTeam]);

    useEffect(() => {
        let cancelled = false;

        async function loadSalaryCap() {
            try {
                setCapLoading(true);
                setSalaryCap(null);

                const response = await fetch(
                    `/api/salary-cap?team=${selectedTeam}`,
                    {
                        cache: "no-store",
                    }
                );

                if (!response.ok) {
                    if (!cancelled) {
                        setSalaryCap(null);
                    }
                    return;
                }

                const data: SalaryCapData =
                    await response.json();

                if (!cancelled) {
                    setSalaryCap(data);
                }
            } catch {
                if (!cancelled) {
                    setSalaryCap(null);
                }
            } finally {
                if (!cancelled) {
                    setCapLoading(false);
                }
            }
        }

        loadSalaryCap();

        return () => {
            cancelled = true;
        };
    }, [selectedTeam]);

    const toggleCard = (card: string) => {
        setOpenCard(
            openCard === card
                ? null
                : card
        );
    };

    const capSpace =
        salaryCap?.summary
            ? money(
                  salaryCap.summary.projected_cap_space
              )
            : capLoading
              ? "..."
              : "—";

    const capDetail =
        salaryCap?.summary
            ? `#${salaryCap.summary.cap_space_rank} NHL cap space`
            : capLoading
              ? "Loading cap data"
              : "Projected cap space";

    const cards = [
        {
            id: "cap",
            title: "Salary Cap",
            value: capSpace,
            detail: capDetail,
            content: salaryCap ? (
                <SalaryCapPanel data={salaryCap} />
            ) : capLoading ? (
                <p className="text-slate-400">
                    Loading salary cap data...
                </p>
            ) : (
                <p className="text-slate-400">
                    Salary cap data unavailable.
                </p>
            ),
        },
        {
            id: "roster",
            title: "Roster",
            value: "—",
            detail: "Roster & depth chart",
            content: <NotBuiltYet />,
        },
        {
            id: "performance",
            title: "Team Performance",
            value: "—",
            detail: "Team results & performance",
            content: <NotBuiltYet />,
        },
        {
            id: "organisation",
            title: "Organisation",
            value: "—",
            detail: "Leadership & structure",
            content: <NotBuiltYet />,
        },
        {
            id: "ahl",
            title: "AHL Affiliate",
            value: "—",
            detail: "Development pathway",
            content: <NotBuiltYet />,
        },
        {
            id: "travel",
            title: "Travel",
            value: "—",
            detail: "Travel & schedule",
            content: <NotBuiltYet />,
        },
    ];

    const selectedCard =
        cards.find(
            (card) => card.id === openCard
        );

    return (
        <main className="min-h-screen bg-slate-950 px-8 py-10">
            <div className="mx-auto max-w-7xl">

                <div className="mb-8">
                    <p className="text-sm font-medium text-slate-500">
                        TEAM
                    </p>

                    <h1 className="text-4xl font-bold">
                        {team?.fullName ??
                            selectedTeam}
                    </h1>

                    {team && (
                        <p className="mt-1 text-slate-400">
                            {[
                                team.triCode,
                                team.divisionName,
                                team.conferenceName,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </p>
                    )}
                </div>

                {!openCard && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {cards.map((card) => (
                            <ExpandableCard
                                key={card.id}
                                title={card.title}
                                value={card.value}
                                detail={card.detail}
                                open={false}
                                onClick={() =>
                                    toggleCard(card.id)
                                }
                            />
                        ))}
                    </div>
                )}

                {openCard && (
                    <>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                            {cards
                                .filter(
                                    (card) =>
                                        card.id !== openCard
                                )
                                .map((card) => (
                                    <ExpandableCard
                                        key={card.id}
                                        title={card.title}
                                        value={card.value}
                                        detail={card.detail}
                                        compact
                                        open={false}
                                        onClick={() =>
                                            toggleCard(
                                                card.id
                                            )
                                        }
                                    />
                                ))}
                        </div>

                        {selectedCard && (
                            <div className="mt-4">
                                <ExpandableCard
                                    title={
                                        selectedCard.title
                                    }
                                    value={
                                        selectedCard.value
                                    }
                                    detail={
                                        selectedCard.detail
                                    }
                                    open
                                    onClick={() =>
                                        toggleCard(
                                            selectedCard.id
                                        )
                                    }
                                >
                                    {
                                        selectedCard.content
                                    }
                                </ExpandableCard>
                            </div>
                        )}
                    </>
                )}

            </div>
        </main>
    );
}

function NotBuiltYet() {
    return (
        <p className="text-slate-500">
            Data panel not yet built.
        </p>
    );
}

function money(value: number) {
    const abs = Math.abs(value);

    let formatted: string;

    if (abs >= 1_000_000) {
        formatted =
            `$${(abs / 1_000_000).toFixed(1)}m`;
    } else if (abs >= 1_000) {
        formatted =
            `$${(abs / 1_000).toFixed(0)}k`;
    } else {
        formatted =
            `$${abs.toFixed(0)}`;
    }

    return value < 0
        ? `-${formatted}`
        : formatted;
}