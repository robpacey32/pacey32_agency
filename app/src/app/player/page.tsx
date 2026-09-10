"use client";

import { useEffect, useState } from "react";

import ComparablePlayersPanel, {
    ComparablePlayersData,
} from "@/components/ComparablePlayersPanel";
import EventMappingPanel, {
    EventMappingData,
} from "@/components/EventMappingPanel";
import ExpandableCard from "@/components/ExpandableCard";
import MarketValuePanel, {
    MarketValueData,
} from "@/components/MarketValuePanel";
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

    // ---------------------------------------------------------
    // DATA
    // ---------------------------------------------------------

    const [profile, setProfile] =
        useState<PlayerProfileData | null>(null);

    const [performance, setPerformance] =
        useState<PlayerPerformanceData | null>(null);

    const [comparables, setComparables] =
        useState<ComparablePlayersData | null>(null);

    const [contract, setContract] =
        useState<PlayerContractData | null>(null);

    const [marketValue, setMarketValue] =
        useState<MarketValueData | null>(null);

    const [eventMapping, setEventMapping] =
        useState<EventMappingData | null>(null);

    const [eventMappingHasData, setEventMappingHasData] =
        useState<boolean | null>(null);

    // ---------------------------------------------------------
    // LOADING
    // ---------------------------------------------------------

    const [profileLoading, setProfileLoading] =
        useState(false);

    const [performanceLoading, setPerformanceLoading] =
        useState(false);

    const [comparablesLoading, setComparablesLoading] =
        useState(false);

    const [contractLoading, setContractLoading] =
        useState(false);

    const [marketValueLoading, setMarketValueLoading] =
        useState(false);

    const [eventMappingLoading, setEventMappingLoading] =
        useState(false);

    // ---------------------------------------------------------
    // ERRORS
    // ---------------------------------------------------------

    const [profileError, setProfileError] =
        useState<string | null>(null);

    const [performanceError, setPerformanceError] =
        useState<string | null>(null);

    const [comparablesError, setComparablesError] =
        useState<string | null>(null);

    const [contractError, setContractError] =
        useState<string | null>(null);

    const [marketValueError, setMarketValueError] =
        useState<string | null>(null);

    const [eventMappingError, setEventMappingError] =
        useState<string | null>(null);

    // ---------------------------------------------------------
    // UI
    // ---------------------------------------------------------

    const [openCard, setOpenCard] =
        useState<string | null>(null);

    // ---------------------------------------------------------
    // LOAD PLAYER
    // ---------------------------------------------------------

    useEffect(() => {
        if (!selectedPlayerId) {
            setProfile(null);
            setPerformance(null);
            setComparables(null);
            setContract(null);
            setMarketValue(null);
            setEventMapping(null);
            setEventMappingHasData(null);

            setProfileError(null);
            setPerformanceError(null);
            setComparablesError(null);
            setContractError(null);
            setMarketValueError(null);
            setEventMappingError(null);

            setProfileLoading(false);
            setPerformanceLoading(false);
            setComparablesLoading(false);
            setContractLoading(false);
            setMarketValueLoading(false);
            setEventMappingLoading(false);

            setOpenCard(null);

            return;
        }

        setOpenCard(null);

        // -----------------------------------------------------
        // PROFILE
        // -----------------------------------------------------

        async function loadProfile() {
            try {
                setProfileLoading(true);
                setProfileError(null);
                setProfile(null);

                const response = await fetch(
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

        // -----------------------------------------------------
        // PERFORMANCE
        // -----------------------------------------------------

        async function loadPerformance() {
            try {
                setPerformanceLoading(true);
                setPerformanceError(null);
                setPerformance(null);

                const response = await fetch(
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

        // -----------------------------------------------------
        // COMPARABLE PLAYERS
        // -----------------------------------------------------

        async function loadComparables() {
            try {
                setComparablesLoading(true);
                setComparablesError(null);
                setComparables(null);

                const response = await fetch(
                    `/api/comparable-players?playerId=${selectedPlayerId}`
                );

                const result =
                    await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error ??
                            "Failed to load comparable players"
                    );
                }

                setComparables(
                    result as ComparablePlayersData
                );

                return result as ComparablePlayersData;

            } catch (error) {
                console.error(
                    "Failed to load comparable players:",
                    error
                );

                setComparablesError(
                    error instanceof Error
                        ? error.message
                        : "Failed to load comparable players"
                );

                return null;

            } finally {
                setComparablesLoading(false);
            }
        }

        // -----------------------------------------------------
        // MARKET VALUE
        // -----------------------------------------------------

        async function loadMarketValue() {
            try {
                setMarketValueLoading(true);
                setMarketValueError(null);
                setMarketValue(null);

                const response = await fetch(
                    `/api/market-value?playerId=${selectedPlayerId}`
                );

                const result =
                    await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error ??
                            "Failed to load market value"
                    );
                }

                setMarketValue(
                    result as MarketValueData
                );

            } catch (error) {
                console.error(
                    "Failed to load market value:",
                    error
                );

                setMarketValueError(
                    error instanceof Error
                        ? error.message
                        : "Failed to load market value"
                );

            } finally {
                setMarketValueLoading(false);
            }
        }

        // -----------------------------------------------------
        // CONTRACT
        // -----------------------------------------------------

        async function loadContract(
            playerName: string,
            playerId: string
        ) {
            try {
                setContractLoading(true);
                setContractError(null);
                setContract(null);

                const response = await fetch(
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
                        errorData.error ??
                            "Failed to load player contract"
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

        // -----------------------------------------------------
        // EVENT MAPPING
        // -----------------------------------------------------

        async function loadEventMapping(
            position: string | null
        ) {
            try {
                setEventMappingLoading(true);
                setEventMappingError(null);
                setEventMapping(null);
                setEventMappingHasData(null);

                const response = await fetch(
                    `/api/event-mapping?playerId=${encodeURIComponent(
                        String(selectedPlayerId)
                    )}&position=${encodeURIComponent(
                        position ?? ""
                    )}`
                );

                const result =
                    await response.json();

                if (!response.ok) {
                    const message =
                        result.error ??
                        "Failed to load event mapping";

                    if (
                        message.includes(
                            "Parameter types must be provided for empty arrays"
                        )
                    ) {
                        setEventMapping(null);
                        setEventMappingHasData(false);
                        return;
                    }

                    throw new Error(message);
                }

                if (
                    typeof result.hasData ===
                    "boolean"
                ) {
                    if (!result.hasData) {
                        setEventMapping(null);
                        setEventMappingHasData(false);
                        return;
                    }

                    setEventMapping(
                        result.data
                    );

                    setEventMappingHasData(
                        true
                    );

                    return;
                }

                setEventMapping(
                    result as EventMappingData
                );

                setEventMappingHasData(
                    true
                );

            } catch (error) {
                console.error(
                    "Failed to load event mapping:",
                    error
                );

                setEventMappingError(
                    error instanceof Error
                        ? error.message
                        : "Failed to load event mapping"
                );

                setEventMappingHasData(
                    null
                );

            } finally {
                setEventMappingLoading(false);
            }
        }

        // -----------------------------------------------------
        // INITIALISE PROFILE-DEPENDENT DATA
        // -----------------------------------------------------

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

            if (profileResult) {
                loadEventMapping(
                    profileResult.position ??
                        null
                );
            }
        }

        // -----------------------------------------------------
        // COMPARABLES -> MARKET VALUE
        //
        // Market Value depends on comparable-player results
        // existing in the cache.
        // -----------------------------------------------------

        async function initialiseValuation() {
            const comparableResult =
                await loadComparables();

            if (comparableResult) {
                await loadMarketValue();
            }
        }

        initialisePlayer();

        loadPerformance();

        initialiseValuation();

    }, [selectedPlayerId]);

    // ---------------------------------------------------------
    // CARD TOGGLE
    // ---------------------------------------------------------

    const toggleCard = (
        card: string
    ) => {
        setOpenCard(
            openCard === card
                ? null
                : card
        );
    };

    // ---------------------------------------------------------
    // NO PLAYER
    // ---------------------------------------------------------

    if (!selectedPlayerId) {
        return (
            <main className="min-h-screen bg-slate-950 px-8 py-10">
                <div className="mx-auto max-w-7xl text-slate-400">
                    Please select a player to view player data.
                </div>
            </main>
        );
    }

    // ---------------------------------------------------------
    // PROFILE LOADING
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // PROFILE ERROR
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // DERIVED VALUES
    // ---------------------------------------------------------

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

    const topComparable =
        comparables
            ?.comparables?.[0] ??
        null;

    // ---------------------------------------------------------
    // CARDS
    // ---------------------------------------------------------

    const cards = [
        // -----------------------------------------------------
        // PROFILE
        // -----------------------------------------------------

        {
            id: "profile",

            title:
                "Player Profile",

            value:
                `${profile.position ?? "—"} · Age ${
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

        // -----------------------------------------------------
        // PERFORMANCE
        // -----------------------------------------------------

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
                          .filter(
                              Boolean
                          )
                          .join(
                              " · "
                          )
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

        // -----------------------------------------------------
        // COMPARABLES
        // -----------------------------------------------------

        {
            id: "comparables",

            title:
                "Comparable Players",

            value:
                comparablesLoading
                    ? "Loading..."
                    : topComparable
                      ? topComparable.comparable_player
                      : "—",

            detail:
                comparablesLoading
                    ? "Running player comparison model"
                    : topComparable
                      ? `${topComparable.overall_similarity.toFixed(
                            1
                        )}% closest match`
                      : "Closest statistical profiles",

            content:
                comparablesLoading ? (
                    <LoadingPanel
                        title="Comparable Players"
                    />
                ) : comparablesError ? (
                    <UnavailablePanel
                        title="Comparable Players"
                    />
                ) : comparables ? (
                    <ComparablePlayersPanel
                        data={comparables}
                    />
                ) : (
                    <UnavailablePanel
                        title="Comparable Players"
                    />
                ),
        },

        // -----------------------------------------------------
        // CONTRACT
        // -----------------------------------------------------

        {
            id: "contract",

            title:
                "Contract",

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
                          .filter(
                              Boolean
                          )
                          .join(
                              " · "
                          )
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
                        data={contract}
                    />
                ) : (
                    <UnavailablePanel
                        title="Contract"
                    />
                ),
        },

        // -----------------------------------------------------
        // MARKET VALUE
        // -----------------------------------------------------

        {
            id: "market",

            title:
                "Market Value",

            value:
                marketValueLoading
                    ? "Calculating..."
                    : marketValue
                      ? formatMarketValueRange(
                            marketValue.estimated_aav_low,
                            marketValue.estimated_aav_high
                        )
                      : "—",

            detail:
                marketValueLoading
                    ? "Analysing comparable contracts"
                    : marketValue
                      ? [
                            marketValue.estimated_cap_pct_low !=
                                null &&
                            marketValue.estimated_cap_pct_high !=
                                null
                                ? `${marketValue.estimated_cap_pct_low.toFixed(
                                      1
                                  )}%–${marketValue.estimated_cap_pct_high.toFixed(
                                      1
                                  )}% of cap`
                                : null,

                            marketValue.estimated_term_low !=
                                null &&
                            marketValue.estimated_term_high !=
                                null
                                ? `${marketValue.estimated_term_low}–${marketValue.estimated_term_high} year term`
                                : null,
                        ]
                            .filter(
                                Boolean
                            )
                            .join(
                                " · "
                            )
                      : "Comparable contract valuation",

            content:
                marketValueLoading ? (
                    <LoadingPanel
                        title="Market Value"
                    />
                ) : marketValueError ? (
                    <UnavailablePanel
                        title="Market Value"
                    />
                ) : marketValue ? (
                    <MarketValuePanel
                        data={
                            marketValue
                        }
                    />
                ) : (
                    <UnavailablePanel
                        title="Market Value"
                    />
                ),
        },

        // -----------------------------------------------------
        // EVENT MAPPING
        // -----------------------------------------------------

        {
            id: "events",

            title:
                "Event Mapping",

            value:
                eventMappingLoading
                    ? "Loading..."
                    : eventMappingHasData ===
                        false
                      ? "No data"
                      : eventMapping?.playerType ===
                          "goalie"
                        ? "Shots & save profile"
                        : eventMapping
                          ? "Shooting, faceoffs & possession"
                          : "—",

            detail:
                eventMappingLoading
                    ? "Loading on-ice event locations"
                    : eventMappingHasData ===
                        false
                      ? "No NHL game data"
                      : eventMapping?.playerType ===
                          "goalie"
                        ? "Shot locations, save zones & shot types"
                        : eventMapping
                          ? "Shot locations, faceoffs & possession events"
                          : "On-ice event locations",

            content:
                eventMappingLoading ? (
                    <LoadingPanel
                        title="Event Mapping"
                    />
                ) : eventMappingError ? (
                    <UnavailablePanel
                        title="Event Mapping"
                    />
                ) : eventMappingHasData ===
                  false ? (
                    <NoDataPanel
                        title="Event Mapping"
                    />
                ) : eventMapping ? (
                    <EventMappingPanel
                        data={
                            eventMapping
                        }
                    />
                ) : (
                    <NoDataPanel
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

    // ---------------------------------------------------------
    // PAGE
    // ---------------------------------------------------------

    return (
        <main className="min-h-screen bg-slate-950 px-8 py-10">

            <div className="mx-auto max-w-7xl">

                {/* Player heading */}
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
                                .filter(
                                    Boolean
                                )
                                .join(
                                    " · "
                                )}
                        </p>

                    </div>

                </div>

                {/* All cards */}
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

                {/* Expanded card */}
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

// ---------------------------------------------------------
// PANELS
// ---------------------------------------------------------

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

function NoDataPanel({
    title,
}: {
    title: string;
}) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-slate-500">
            No {title.toLowerCase()} data available for this player.
        </div>
    );
}

// ---------------------------------------------------------
// FORMATTERS
// ---------------------------------------------------------

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

function formatMarketValueRange(
    low: number | null,
    high: number | null
) {
    if (
        low == null ||
        high == null
    ) {
        return "—";
    }

    return `$${(
        low /
        1_000_000
    ).toFixed(
        1
    )}m – $${(
        high /
        1_000_000
    ).toFixed(
        1
    )}m`;
}

function money(
    value: number
) {
    if (
        value >=
        1_000_000
    ) {
        return `$${(
            value /
            1_000_000
        ).toFixed(
            2
        )}m`;
    }

    if (
        value >=
        1_000
    ) {
        return `$${(
            value /
            1_000
        ).toFixed(
            0
        )}k`;
    }

    return `$${value.toLocaleString()}`;
}