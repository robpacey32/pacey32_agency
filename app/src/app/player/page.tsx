"use client";

import { useState } from "react";
import ExpandableCard from "@/components/ExpandableCard";
import { useAppContext } from "@/context/AppContext";

const players = {
    "8477492": {
        name: "Nathan MacKinnon",
        position: "C",
        age: 30,
        shoots: "R",
        height: `6'0"`,
        weight: "200 lb",
        points: 116,
        goals: 32,
        assists: 84,
        ppg: "1.47",
        p60: "3.18",
        capHit: "$12.6m",
        ufaYear: "2031",
        comparableCount: 10,
    },
    "8478402": {
        name: "Jack Eichel",
        position: "C",
        age: 29,
        shoots: "R",
        height: `6'2"`,
        weight: "203 lb",
        points: 94,
        goals: 31,
        assists: 63,
        ppg: "1.24",
        p60: "3.01",
        capHit: "$10.0m",
        ufaYear: "2031",
        comparableCount: 10,
    },
    "8479318": {
        name: "Connor McDavid",
        position: "C",
        age: 29,
        shoots: "L",
        height: `6'1"`,
        weight: "194 lb",
        points: 132,
        goals: 44,
        assists: 88,
        ppg: "1.61",
        p60: "3.42",
        capHit: "$12.5m",
        ufaYear: "2026",
        comparableCount: 10,
    },
};

export default function PlayerPage() {
    const { player: selectedPlayer } = useAppContext();
    const player = players[selectedPlayer as keyof typeof players];

    const [openCard, setOpenCard] = useState<string | null>(null);

    const toggleCard = (card: string) => {
        setOpenCard(openCard === card ? null : card);
    };

    const cards = [
        {
            id: "profile",
            title: "Player Profile",
            value: `${player.position} · Age ${player.age}`,
            detail: `${player.height} · ${player.weight} · Shoots ${player.shoots}`,
            content: (
                <div className="grid gap-6 md:grid-cols-3">
                    <Metric label="Position" value={player.position} />
                    <Metric label="Age" value={`${player.age}`} />
                    <Metric label="Shoots" value={player.shoots} />
                    <Metric label="Height" value={player.height} />
                    <Metric label="Weight" value={player.weight} />
                    <Metric label="Drafted" value="2013 · #1 overall" />
                </div>
            ),
        },
        {
            id: "performance",
            title: "Performance",
            value: `${player.points} pts`,
            detail: `${player.ppg} points/game`,
            content: (
                <div className="grid gap-6 md:grid-cols-4">
                    <Metric label="Goals" value={`${player.goals}`} />
                    <Metric label="Assists" value={`${player.assists}`} />
                    <Metric label="Points" value={`${player.points}`} />
                    <Metric label="Points / Game" value={player.ppg} />
                    <Metric label="Points / 60" value={player.p60} />
                    <Metric label="Avg TOI" value="22:04" />
                    <Metric label="Team Points Rank" value="#1" />
                    <Metric label="League Points Rank" value="#2" />
                </div>
            ),
        },
        {
            id: "contract",
            title: "Contract",
            value: player.capHit,
            detail: `UFA ${player.ufaYear}`,
            content: (
                <div className="grid gap-6 md:grid-cols-3">
                    <Metric label="Cap Hit" value={player.capHit} />
                    <Metric label="Contract Term" value="8 years" />
                    <Metric label="UFA Year" value={player.ufaYear} />
                    <Metric label="Expiry Age" value="35" />
                    <Metric label="Signing Status" value="UFA" />
                    <Metric label="% of Cap at Signing" value="15.3%" />
                </div>
            ),
        },
        {
            id: "trajectory",
            title: "Career Trajectory",
            value: "Rising",
            detail: "Recent performance trend",
            content: (
                <div className="grid gap-6 md:grid-cols-3">
                    <Metric label="Last Season PPG" value={player.ppg} />
                    <Metric label="2-Year Avg PPG" value="1.42" />
                    <Metric label="3-Year Avg PPG" value="1.35" />
                    <Metric label="Points Trend" value="+8%" />
                    <Metric label="Peak Points" value="140" />
                    <Metric label="Peak Season" value="2023-24" />
                </div>
            ),
        },
        {
            id: "comparables",
            title: "Comparable Players",
            value: `${player.comparableCount}`,
            detail: "Closest statistical profiles",
            content: (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Comparable name="Connor McDavid" similarity="91%" />
                    <Comparable name="Jack Eichel" similarity="89%" />
                    <Comparable name="Auston Matthews" similarity="86%" />
                    <Comparable name="Sidney Crosby" similarity="84%" />
                    <Comparable name="Brayden Point" similarity="82%" />
                    <Comparable name="Jack Hughes" similarity="80%" />
                </div>
            ),
        },
        {
            id: "rankings",
            title: "Rankings",
            value: "Elite",
            detail: "Team and league standing",
            content: (
                <div className="grid gap-6 md:grid-cols-3">
                    <Metric label="Team Points Rank" value="#1" />
                    <Metric label="League Points Rank" value="#2" />
                    <Metric label="Team Goals Rank" value="#3" />
                    <Metric label="League PPG Rank" value="#3" />
                    <Metric label="Team TOI Rank" value="#1" />
                    <Metric label="Points / 60 Rank" value="#4" />
                </div>
            ),
        },
    ];

    const selectedCard = cards.find((card) => card.id === openCard);

    return (
        <main className="min-h-screen bg-slate-950 px-8 py-10">
            <div className="mx-auto max-w-7xl">
                <div className="mb-8">
                    <p className="text-sm font-medium text-slate-500">PLAYER</p>
                    <h1 className="text-4xl font-bold">{player.name}</h1>
                    <p className="mt-1 text-slate-400">
                        {player.position} · Age {player.age} · Shoots {player.shoots}
                    </p>
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
                                onClick={() => toggleCard(card.id)}
                            />
                        ))}
                    </div>
                )}

                {openCard && (
                    <>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                            {cards
                                .filter((card) => card.id !== openCard)
                                .map((card) => (
                                    <ExpandableCard
                                        key={card.id}
                                        title={card.title}
                                        value={card.value}
                                        detail={card.detail}
                                        compact
                                        open={false}
                                        onClick={() => toggleCard(card.id)}
                                    />
                                ))}
                        </div>

                        {selectedCard && (
                            <div className="mt-4">
                                <ExpandableCard
                                    title={selectedCard.title}
                                    value={selectedCard.value}
                                    detail={selectedCard.detail}
                                    open
                                    onClick={() => toggleCard(selectedCard.id)}
                                >
                                    {selectedCard.content}
                                </ExpandableCard>
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
    );
}

function Comparable({ name, similarity }: { name: string; similarity: string }) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="font-semibold">{name}</p>
            <p className="mt-1 text-sm text-slate-500">{similarity} similarity</p>
        </div>
    );
}