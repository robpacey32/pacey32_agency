"use client";

import { useEffect, useState } from "react";

import ExpandableCard from "@/components/ExpandableCard";
import PlayerContractPanel, {
    PlayerContractData,
} from "@/components/PlayerContractPanel";
import PlayerPerformancePanel, {
    PlayerPerformanceData,
} from "@/components/PlayerPerformancePanel";
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
        performance,
        setPerformance,
    ] =
        useState<PlayerPerformanceData | null>(
            null
        );

    const [
        contract,
        setContract,
    ] =
        useState<PlayerContractData | null>(
            null
        );

    const [
        profileLoading,
        setProfileLoading,
    ] = useState(false);

    const [
        performanceLoading,
        setPerformanceLoading,
    ] = useState(false);

    const [
        contractLoading,
        setContractLoading,
    ] = useState(false);

    const [
        profileError,
        setProfileError,
    ] =
        useState<string | null>(
            null
        );

    const [
        performanceError,
        setPerformanceError,
    ] =
        useState<string | null>(
            null
        );

    const [
        contractError,
        setContractError,
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
            setPerformance(null);
            setContract(null);

            setProfileError(null);
            setPerformanceError(null);
            setContractError(null);

            setProfileLoading(false);
            setPerformanceLoading(false);
            setContractLoading(false);

            setOpenCard(null);

            return;
        }

        setOpenCard(null);

        async function loadProfile() {
            try {
                setProfileLoading(true);
                setProfileError(null);

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

                return result as PlayerProfileData;

            } catch (error) {
                console.error(error);

                setProfileError(
                    "Failed to load player profile"
                );

                return null;

            } finally {
                setProfileLoading(false);
            }
        }

        async function loadPerformance() {
            try {
                setPerformanceLoading(true);
                setPerformanceError(null);
                setPerformance(null);

                const response =
                    await fetch(
                        `/api/player-performance?playerId=${selectedPlayerId}`
                    );

                if (!response.ok) {
                    throw new Error(
                        "Failed to load player performance"
                    );
                }

                const result =
                    await response.json();

                setPerformance(result);

            } catch (error) {
                console.error(error);

                setPerformanceError(
                    "Failed to load player performance"
                );

            } finally {
                setPerformanceLoading(false);
            }
        }

        async function loadContract(
            playerName: string,
            playerId: string
        ) {
            try {
                setContractLoading(true);
                setContractError(null);
                setContract(null);

                const response =
                    await fetch(
                        `/api/player-contract?player=${encodeURIComponent(
                            playerName
                        )}&playerId=${encodeURIComponent(
                            playerId
                        )}`
                    );

                if (!response.ok) {
                    const errorData =
                        await response.json();

                    throw new Error(
                        errorData.error
                        ?? "Failed to load player contract"
                    );
                }

                const result:
                    PlayerContractData =
                    await response.json();

                setContract(result);

            } catch (error) {
                console.error(
                    "Failed to load player contract:",
                    error
                );

                setContractError(
                    error instanceof Error
                        ? error.message
                        : "Failed to load player contract"
                );

            } finally {
                setContractLoading(false);
            }
        }

        async function initialisePlayer() {
            const profileResult =
                await loadProfile();

            if (
                profileResult?.player_name
            ) {
                loadContract(
                    profileResult.player_name,
                    String(
                        selectedPlayerId
                    )
                );
            }
        }

        initialisePlayer();
        loadPerformance();

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

    const latestPerformance =
        performance?.seasons?.length
            ? [...performance.seasons]
                  .sort(
                      (a, b) =>
                          Number(
                              b.season
                          ) -
                          Number(
                              a.season
                          )
                  )[0]
            : null;

    const currentContract =
        contract?.contracts?.find(
            item =>
                item.current_contract
        ) ??
        contract?.contracts?.[0] ??
        null;

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
                    ? `${
                          profile.position ===
                          "G"
                              ? "Catches"
                              : "Shoots"
                      } ${profile.shoots_catches}`
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
            title:
                "Performance & Trajectory",
            value:
                latestPerformance
                    ? `${latestPerformance.points ?? 0} P`
                    : performanceLoading
                      ? "Loading..."
                      : "—",
            detail:
                latestPerformance
                    ? [
                          formatSeason(
                              latestPerformance.season
                          ),
                          latestPerformance.points_per_game !=
                          null
                              ? `${Number(
                                    latestPerformance.points_per_game
                                ).toFixed(
                                    2
                                )} P/GP`
                              : null,
                          latestPerformance.team_code,
                      ]
                          .filter(Boolean)
                          .join(" · ")
                    : performanceLoading
                      ? "Loading season performance"
                      : "Season performance and career trend",
            content:
                performanceLoading ? (
                    <LoadingPanel
                        title="Performance & Trajectory"
                    />
                ) : performanceError ? (
                    <UnavailablePanel
                        title="Performance & Trajectory"
                    />
                ) : performance ? (
                    <PlayerPerformancePanel
                        data={
                            performance
                        }
                    />
                ) : (
                    <UnavailablePanel
                        title="Performance & Trajectory"
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
            value:
                currentContract?.cap_hit !=
                null
                    ? money(
                          currentContract.cap_hit
                      )
                    : contractLoading
                      ? "Loading..."
                      : "—",
            detail:
                currentContract
                    ? [
                          currentContract.term !=
                          null
                              ? `${currentContract.term} years`
                              : null,
                          currentContract.season_to
                              ? `through ${currentContract.season_to}`
                              : null,
                          currentContract.expiry_status,
                      ]
                          .filter(Boolean)
                          .join(" · ")
                    : contractLoading
                      ? "Loading current contract"
                      : "Current contract status",
            content:
                contractLoading ? (
                    <LoadingPanel
                        title="Contract"
                    />
                ) : contractError ? (
                    <UnavailablePanel
                        title="Contract"
                    />
                ) : contract ? (
                    <PlayerContractPanel
                        data={
                            contract
                        }
                    />
                ) : (
                    <UnavailablePanel
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

        {
            id: "events",
            title:
                "Event Mapping",
            value: "—",
            detail:
                "On-ice event locations",
            content: (
                <PlaceholderPanel
                    title="Event Mapping"
                />
            ),
        },
    ];

    const selectedCard =
        cards.find(
            card =>
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
                                    ? `${
                                          profile.position ===
                                          "G"
                                              ? "Catches"
                                              : "Shoots"
                                      } ${profile.shoots_catches}`
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
                            card => (
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
                                    card =>
                                        card.id !==
                                        openCard
                                )
                                .map(
                                    card => (
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


function LoadingPanel({
    title,
}: {
    title: string;
}) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-slate-400">
            Loading {title.toLowerCase()}...
        </div>
    );
}


function UnavailablePanel({
    title,
}: {
    title: string;
}) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-slate-500">
            No {title.toLowerCase()} data available.
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


function formatSeason(
    value:
        | number
        | string
) {
    const season =
        String(value);

    if (
        season.length !== 8
    ) {
        return season;
    }

    return `${season.slice(
        0,
        4
    )}/${season.slice(6)}`;
}


function money(
    value: number
) {
    if (value >= 1_000_000) {
        return `$${(
            value / 1_000_000
        ).toFixed(2)}m`;
    }

    if (value >= 1_000) {
        return `$${(
            value / 1_000
        ).toFixed(0)}k`;
    }

    return `$${value.toLocaleString()}`;
}