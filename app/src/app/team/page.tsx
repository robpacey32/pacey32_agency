"use client";

import { useState } from "react";
import ExpandableCard from "@/components/ExpandableCard";
import { useAppContext } from "@/context/AppContext";

const teams = {
    COL: {
        name: "Colorado Avalanche",
        code: "COL",
        city: "Denver",
        capSpace: "$8.4m",
        avgAge: "28.3",
        contracts: "23",
        travelMiles: "41,820",
        backToBacks: "11",
        facilities: "2",
    },
    VGK: {
        name: "Vegas Golden Knights",
        code: "VGK",
        city: "Las Vegas",
        capSpace: "$10.8m",
        avgAge: "28.1",
        contracts: "22",
        travelMiles: "42,310",
        backToBacks: "13",
        facilities: "2",
    },
    EDM: {
        name: "Edmonton Oilers",
        code: "EDM",
        city: "Edmonton",
        capSpace: "$4.2m",
        avgAge: "29.0",
        contracts: "24",
        travelMiles: "45,100",
        backToBacks: "12",
        facilities: "2",
    },
    NYR: {
        name: "New York Rangers",
        code: "NYR",
        city: "New York",
        capSpace: "$6.1m",
        avgAge: "28.5",
        contracts: "23",
        travelMiles: "33,900",
        backToBacks: "10",
        facilities: "2",
    },
};

export default function TeamPage() {
    const { team: selectedTeam } = useAppContext();
    const team = teams[selectedTeam as keyof typeof teams];

    const [openCard, setOpenCard] = useState<string | null>(null);

    const toggleCard = (card: string) => {
        setOpenCard(openCard === card ? null : card);
    };

    const cards = [
        {
            id: "cap",
            title: "Salary Cap",
            value: team.capSpace,
            detail: "Projected cap space",
            content: (
                <div className="grid gap-6 md:grid-cols-3">
                    <Metric label="Projected Cap Space" value={team.capSpace} />
                    <Metric label="Current Cap Space" value="$6.9m" />
                    <Metric label="Deadline Cap Space" value="$11.2m" />
                    <Metric label="Contracts" value={team.contracts} />
                    <Metric label="Dead Cap" value="$0.8m" />
                    <Metric label="Average Age" value={team.avgAge} />
                </div>
            ),
        },
        {
            id: "roster",
            title: "Roster",
            value: team.avgAge,
            detail: "Average age",
            content: (
                <div className="grid gap-6 md:grid-cols-3">
                    <Metric label="Forwards" value="13" />
                    <Metric label="Defence" value="8" />
                    <Metric label="Goalies" value="2" />
                    <Metric label="Average Age" value={team.avgAge} />
                    <Metric label="Contracts" value={team.contracts} />
                    <Metric label="Active Roster" value="23" />
                </div>
            ),
        },
        {
            id: "organisation",
            title: "Organisation",
            value: "Established",
            detail: "Leadership & structure",
            content: (
                <div className="grid gap-6 md:grid-cols-3">
                    <Metric label="General Manager" value="Chris MacFarland" />
                    <Metric label="Head Coach" value="Jared Bednar" />
                    <Metric label="AHL Affiliate" value="Colorado Eagles" />
                </div>
            ),
        },
        {
            id: "travel",
            title: "Travel",
            value: `${team.travelMiles} mi`,
            detail: "Season travel",
            content: (
                <div className="grid gap-6 md:grid-cols-4">
                    <Metric label="Total Miles" value={team.travelMiles} />
                    <Metric label="NHL Rank" value="#22" />
                    <Metric label="Longest Trip" value="2,540 mi" />
                    <Metric label="Longest Road Stretch" value="6 games" />
                </div>
            ),
        },
        {
            id: "schedule",
            title: "Schedule",
            value: team.backToBacks,
            detail: "Back-to-backs",
            content: (
                <div className="grid gap-6 md:grid-cols-3">
                    <Metric label="Back-to-backs" value={team.backToBacks} />
                    <Metric label="Longest Home Stand" value="5 games" />
                    <Metric label="Longest Road Trip" value="6 games" />
                </div>
            ),
        },
        {
            id: "facilities",
            title: "Facilities",
            value: team.facilities,
            detail: "Key facilities",
            content: (
                <div className="grid gap-6 md:grid-cols-2">
                    <Metric label="Arena" value="Ball Arena" />
                    <Metric label="Practice Facility" value="Family Sports Center" />
                </div>
            ),
        },
    ];

    const selectedCard = cards.find((card) => card.id === openCard);

    return (
        <main className="min-h-screen bg-slate-950 px-8 py-10">
            <div className="mx-auto max-w-7xl">

                <div className="mb-8">
                    <p className="text-sm font-medium text-slate-500">TEAM</p>
                    <h1 className="text-4xl font-bold">{team.name}</h1>
                    <p className="mt-1 text-slate-400">
                        {team.city} · {team.code}
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