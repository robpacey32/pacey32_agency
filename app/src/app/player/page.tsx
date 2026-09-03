"use client";

import { useEffect, useState } from "react";
import ExpandableCard from "@/components/ExpandableCard";
import PlayerProfilePanel, {
    PlayerProfileData,
} from "@/components/PlayerProfilePanel";
import { useAppContext } from "@/context/AppContext";

export default function PlayerPage() {
    const { player: selectedPlayerId } = useAppContext();

    const [
        profile,
        setProfile,
    ] =
        useState<PlayerProfileData | null>(
            null
        );

    const [
        profileLoading,
        setProfileLoading,
    ] = useState(false);

    const [
        profileError,
        setProfileError,
    ] =
        useState<string | null>(
            null
        );

    const [
        openCard,
        setOpenCard,
    ] =
        useState<string | null>(
            null
        );

    useEffect(() => {
        if (!selectedPlayerId) {
            setProfile(null);
            setProfileError(null);
            setProfileLoading(false);
            setOpenCard(null);
            return;
        }

        async function loadProfile() {
            try {
                setProfileLoading(true);
                setProfileError(null);
                setOpenCard(null);

                const response =
                    await fetch(
                        `/api/player-profile?playerId=${selectedPlayerId}`
                    );

                if (!response.ok) {
                    throw new Error(
                        "Failed to load player profile"
                    );
                }

                const result =
                    await response.json();

                setProfile(result);
            } catch (error) {
                console.error(error);

                setProfileError(
                    "Failed to load player profile"
                );
            } finally {
                setProfileLoading(false);
            }
        }

        loadProfile();
    }, [selectedPlayerId]);

    const toggleCard = (
        card: string
    ) => {
        setOpenCard(
            openCard === card
                ? null
                : card
        );
    };

    if (!selectedPlayerId) {
        return (
            <main className="min-h-screen bg-slate-950 px-8 py-10">
                <div className="mx-auto max-w-7xl text-slate-400">
                    Please select a player to view player data.
                </div>
            </main>
        );
    }

    if (
        profileLoading &&
        !profile
    ) {
        return (
            <main className="min-h-screen bg-slate-950 px-8 py-10">
                <div className="mx-auto max-w-7xl text-slate-400">
                    Loading player...
                </div>
            </main>
        );
    }

    if (
        profileError ||
        !profile
    ) {
        return (
            <main className="min-h-screen bg-slate-950 px-8 py-10">
                <div className="mx-auto max-w-7xl text-red-400">
                    {profileError ??
                        "Player profile unavailable"}
                </div>
            </main>
        );
    }

    const cards = [
        {
            id: "profile",
            title: "Player Profile",
            value: `${profile.position ?? "—"} · Age ${
                profile.age ?? "—"
            }`,
            detail: [
                profile.height_inches !=
                null
                    ? formatHeight(
                          profile.height_inches
                      )
                    : null,
                profile.weight_lbs !=
                null
                    ? `${profile.weight_lbs} lbs`
                    : null,
                profile.shoots_catches
                    ? `Shoots ${profile.shoots_catches}`
                    : null,
            ]
                .filter(Boolean)
                .join(" · "),
            content: (
                <PlayerProfilePanel
                    data={profile}
                />
            ),
        },
        {
            id: "performance",
            title: "Performance",
            value: "—",
            detail:
                "Season performance",
            content: (
                <PlaceholderPanel
                    title="Performance"
                />
            ),
        },
        {
            id: "trajectory",
            title:
                "Career Trajectory",
            value: "—",
            detail:
                "Recent performance trend",
            content: (
                <PlaceholderPanel
                    title="Career Trajectory"
                />
            ),
        },
        {
            id: "comparables",
            title:
                "Comparable Players",
            value: "—",
            detail:
                "Closest statistical profiles",
            content: (
                <PlaceholderPanel
                    title="Comparable Players"
                />
            ),
        },
        {
            id: "contract",
            title: "Contract",
            value: "—",
            detail:
                "Current contract status",
            content: (
                <PlaceholderPanel
                    title="Contract"
                />
            ),
        },
        {
            id: "market",
            title:
                "Market Value",
            value: "—",
            detail:
                "Contract comparables",
            content: (
                <PlaceholderPanel
                    title="Market Value"
                />
            ),
        },
    ];

    const selectedCard =
        cards.find(
            (card) =>
                card.id === openCard
        );

    return (
        <main className="min-h-screen bg-slate-950 px-8 py-10">
            <div className="mx-auto max-w-7xl">

                <div className="mb-8 flex items-center gap-5">

                    {profile.team_logo && (
                        <img
                            src={
                                profile.team_logo
                            }
                            alt=""
                            className="h-20 w-20 object-contain"
                        />
                    )}

                    <div>
                        <p className="text-sm font-medium text-slate-500">
                            PLAYER
                        </p>

                        <h1 className="text-4xl font-bold text-white">
                            {
                                profile.player_name
                            }
                        </h1>

                        <p className="mt-1 text-slate-400">
                            {[
                                profile.position,
                                profile.age !=
                                null
                                    ? `Age ${profile.age}`
                                    : null,
                                profile.shoots_catches
                                    ? `Shoots ${profile.shoots_catches}`
                                    : null,
                                profile.team_code,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </p>
                    </div>

                </div>


                {!openCard && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

                        {cards.map(
                            (card) => (
                                <ExpandableCard
                                    key={
                                        card.id
                                    }
                                    title={
                                        card.title
                                    }
                                    value={
                                        card.value
                                    }
                                    detail={
                                        card.detail
                                    }
                                    open={
                                        false
                                    }
                                    onClick={() =>
                                        toggleCard(
                                            card.id
                                        )
                                    }
                                />
                            )
                        )}

                    </div>
                )}


                {openCard && (
                    <>

                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">

                            {cards
                                .filter(
                                    (
                                        card
                                    ) =>
                                        card.id !==
                                        openCard
                                )
                                .map(
                                    (
                                        card
                                    ) => (
                                        <ExpandableCard
                                            key={
                                                card.id
                                            }
                                            title={
                                                card.title
                                            }
                                            value={
                                                card.value
                                            }
                                            detail={
                                                card.detail
                                            }
                                            compact
                                            open={
                                                false
                                            }
                                            onClick={() =>
                                                toggleCard(
                                                    card.id
                                                )
                                            }
                                        />
                                    )
                                )}

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


function PlaceholderPanel({
    title,
}: {
    title: string;
}) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-slate-500">
            {title} will be added next.
        </div>
    );
}


function formatHeight(
    inches: number
) {
    const feet =
        Math.floor(
            inches / 12
        );

    const remaining =
        inches % 12;

    return `${feet}'${remaining}"`;
}