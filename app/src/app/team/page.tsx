"use client";

import {
    useEffect,
    useState,
} from "react";

import ExpandableCard from "@/components/ExpandableCard";

import SalaryCapPanel, {
    SalaryCapData,
} from "@/components/SalaryCapPanel";

import DepthChartPanel, {
    DepthChartData,
    DepthChartPlayer,
} from "@/components/DepthChartPanel";

import TeamPerformancePanel, {
    TeamPerformanceData,
} from "@/components/TeamPerformancePanel";

import OrganisationPanel, {
    OrganisationData,
} from "@/components/OrganisationPanel";

import AhlAffiliatePanel, {
    AhlAffiliateData,
} from "@/components/AhlAffiliatePanel";

import TravelPanel, {
    TravelData,
} from "@/components/TravelPanel";

import {
    useAppContext,
} from "@/context/AppContext";


type Team = {
    triCode: string;
    fullName: string;
    conferenceName?: string;
    divisionName?: string;
};


export default function TeamPage() {
    const {
        team: selectedTeam,
        selectedPlayer,
    } = useAppContext();


    const [
        team,
        setTeam,
    ] =
        useState<Team | null>(
            null
        );


    const [
        salaryCap,
        setSalaryCap,
    ] =
        useState<SalaryCapData | null>(
            null
        );


    const [
        depthChart,
        setDepthChart,
    ] =
        useState<DepthChartData | null>(
            null
        );


    const [
        teamPerformance,
        setTeamPerformance,
    ] =
        useState<TeamPerformanceData | null>(
            null
        );


    const [
        organisation,
        setOrganisation,
    ] =
        useState<OrganisationData | null>(
            null
        );


    const [
        ahlAffiliate,
        setAhlAffiliate,
    ] =
        useState<AhlAffiliateData | null>(
            null
        );


    const [
        travel,
        setTravel,
    ] =
        useState<TravelData | null>(
            null
        );


    const [
        capLoading,
        setCapLoading,
    ] =
        useState(true);


    const [
        depthChartLoading,
        setDepthChartLoading,
    ] =
        useState(true);


    const [
        performanceLoading,
        setPerformanceLoading,
    ] =
        useState(true);


    const [
        organisationLoading,
        setOrganisationLoading,
    ] =
        useState(true);


    const [
        ahlLoading,
        setAhlLoading,
    ] =
        useState(true);


    const [
        travelLoading,
        setTravelLoading,
    ] =
        useState(true);


    const [
        openCard,
        setOpenCard,
    ] =
        useState<string | null>(
            null
        );


    // --------------------------------------------------
    // TEAM
    // --------------------------------------------------

    useEffect(() => {
        async function loadTeam() {
            try {
                const response =
                    await fetch(
                        "/api/teams"
                    );

                if (!response.ok) {
                    setTeam(null);
                    return;
                }

                const teams: Team[] =
                    await response.json();

                const match =
                    teams.find(
                        (t) =>
                            t.triCode ===
                            selectedTeam
                    );

                setTeam(
                    match ?? null
                );

            } catch {
                setTeam(null);
            }
        }

        loadTeam();

    }, [selectedTeam]);


    // --------------------------------------------------
    // SALARY CAP
    // --------------------------------------------------

    useEffect(() => {
        let cancelled = false;

        async function loadSalaryCap() {
            try {
                setCapLoading(true);
                setSalaryCap(null);

                const response =
                    await fetch(
                        `/api/salary-cap?team=${selectedTeam}`,
                        {
                            cache:
                                "no-store",
                        }
                    );

                if (!response.ok) {
                    if (!cancelled) {
                        setSalaryCap(
                            null
                        );
                    }

                    return;
                }

                const data:
                    SalaryCapData =
                    await response.json();

                if (!cancelled) {
                    setSalaryCap(
                        data
                    );
                }

            } catch {
                if (!cancelled) {
                    setSalaryCap(
                        null
                    );
                }

            } finally {
                if (!cancelled) {
                    setCapLoading(
                        false
                    );
                }
            }
        }

        loadSalaryCap();

        return () => {
            cancelled = true;
        };

    }, [selectedTeam]);


    // --------------------------------------------------
    // DEPTH CHART
    // --------------------------------------------------

    useEffect(() => {
        let cancelled = false;

        async function loadDepthChart() {
            try {
                setDepthChartLoading(
                    true
                );

                setDepthChart(
                    null
                );

                const response =
                    await fetch(
                        `/api/depth-chart?team=${selectedTeam}`,
                        {
                            cache:
                                "no-store",
                        }
                    );

                if (!response.ok) {
                    if (!cancelled) {
                        setDepthChart(
                            null
                        );
                    }

                    return;
                }

                const data:
                    DepthChartData =
                    await response.json();

                if (!cancelled) {
                    setDepthChart(
                        data
                    );
                }

            } catch {
                if (!cancelled) {
                    setDepthChart(
                        null
                    );
                }

            } finally {
                if (!cancelled) {
                    setDepthChartLoading(
                        false
                    );
                }
            }
        }

        loadDepthChart();

        return () => {
            cancelled = true;
        };

    }, [selectedTeam]);


    // --------------------------------------------------
    // TEAM PERFORMANCE
    // --------------------------------------------------

    useEffect(() => {
        let cancelled = false;

        async function loadTeamPerformance() {
            try {
                setPerformanceLoading(
                    true
                );

                setTeamPerformance(
                    null
                );

                const response =
                    await fetch(
                        `/api/team-performance?team=${selectedTeam}`,
                        {
                            cache:
                                "no-store",
                        }
                    );

                if (!response.ok) {
                    if (!cancelled) {
                        setTeamPerformance(
                            null
                        );
                    }

                    return;
                }

                const data:
                    TeamPerformanceData =
                    await response.json();

                if (!cancelled) {
                    setTeamPerformance(
                        data
                    );
                }

            } catch {
                if (!cancelled) {
                    setTeamPerformance(
                        null
                    );
                }

            } finally {
                if (!cancelled) {
                    setPerformanceLoading(
                        false
                    );
                }
            }
        }

        loadTeamPerformance();

        return () => {
            cancelled = true;
        };

    }, [selectedTeam]);


    // --------------------------------------------------
    // ORGANISATION
    // --------------------------------------------------

    useEffect(() => {
        let cancelled = false;

        async function loadOrganisation() {
            try {
                setOrganisationLoading(
                    true
                );

                setOrganisation(
                    null
                );

                const response =
                    await fetch(
                        `/api/organisation?team=${selectedTeam}`,
                        {
                            cache:
                                "no-store",
                        }
                    );

                if (!response.ok) {
                    if (!cancelled) {
                        setOrganisation(
                            null
                        );
                    }

                    return;
                }

                const data:
                    OrganisationData =
                    await response.json();

                if (!cancelled) {
                    setOrganisation(
                        data
                    );
                }

            } catch {
                if (!cancelled) {
                    setOrganisation(
                        null
                    );
                }

            } finally {
                if (!cancelled) {
                    setOrganisationLoading(
                        false
                    );
                }
            }
        }

        loadOrganisation();

        return () => {
            cancelled = true;
        };

    }, [selectedTeam]);


    // --------------------------------------------------
    // AHL AFFILIATE
    // --------------------------------------------------

    useEffect(() => {
        let cancelled = false;

        async function loadAhlAffiliate() {
            try {
                setAhlLoading(
                    true
                );

                setAhlAffiliate(
                    null
                );

                const response =
                    await fetch(
                        `/api/ahl-affiliate?team=${selectedTeam}`,
                        {
                            cache:
                                "no-store",
                        }
                    );

                if (!response.ok) {
                    if (!cancelled) {
                        setAhlAffiliate(
                            null
                        );
                    }

                    return;
                }

                const data:
                    AhlAffiliateData =
                    await response.json();

                if (!cancelled) {
                    setAhlAffiliate(
                        data
                    );
                }

            } catch {
                if (!cancelled) {
                    setAhlAffiliate(
                        null
                    );
                }

            } finally {
                if (!cancelled) {
                    setAhlLoading(
                        false
                    );
                }
            }
        }

        loadAhlAffiliate();

        return () => {
            cancelled = true;
        };

    }, [selectedTeam]);


    // --------------------------------------------------
    // TRAVEL
    // --------------------------------------------------

    useEffect(() => {
        let cancelled = false;

        async function loadTravel() {
            try {
                setTravelLoading(
                    true
                );

                setTravel(
                    null
                );

                const response =
                    await fetch(
                        `/api/travel?team=${selectedTeam}`,
                        {
                            cache:
                                "no-store",
                        }
                    );

                if (!response.ok) {
                    if (!cancelled) {
                        setTravel(
                            null
                        );
                    }

                    return;
                }

                const data:
                    TravelData =
                    await response.json();

                if (!cancelled) {
                    setTravel(
                        data
                    );
                }

            } catch {
                if (!cancelled) {
                    setTravel(
                        null
                    );
                }

            } finally {
                if (!cancelled) {
                    setTravelLoading(
                        false
                    );
                }
            }
        }

        loadTravel();

        return () => {
            cancelled = true;
        };

    }, [selectedTeam]);


    // --------------------------------------------------
    // CARD TOGGLE
    // --------------------------------------------------

    const toggleCard = (
        card: string
    ) => {
        setOpenCard(
            openCard === card
                ? null
                : card
        );
    };


    // --------------------------------------------------
    // SALARY CAP CARD
    // --------------------------------------------------

    const capSpace =
        salaryCap?.summary
            ? money(
                  salaryCap.summary
                      .projected_cap_space
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


    // --------------------------------------------------
    // DEPTH CHART CARD
    // --------------------------------------------------

    const selectedPrimaryPosition =
        selectedPlayer?.position
            ?.split(",")[0]
            .trim()
            .toUpperCase() ??
        null;


    const rosterPositionCount =
        depthChart &&
        selectedPrimaryPosition
            ? getRosterPositionCount(
                  depthChart,
                  selectedPrimaryPosition
              )
            : null;


    const depthChartValue =
        depthChartLoading
            ? "..."
            : rosterPositionCount != null
              ? String(
                    rosterPositionCount
                )
              : "—";


    const depthChartDetail =
        depthChartLoading
            ? "Loading depth chart"
            : selectedPrimaryPosition
              ? `Roster ${positionLabel(
                    selectedPrimaryPosition
                )}`
              : "Roster players at selected position";


    // --------------------------------------------------
    // TEAM PERFORMANCE CARD
    // --------------------------------------------------

    const latestPerformance =
        teamPerformance?.seasons?.[0] ??
        null;


    const performanceValue =
        performanceLoading
            ? "..."
            : latestPerformance
              ? `${latestPerformance.wins}-${latestPerformance.losses}-${latestPerformance.ot_losses}`
              : "—";


    const performanceDetail =
        performanceLoading
            ? "Loading performance"
            : latestPerformance
              ? latestPerformance.playoff_result
                  ? `(${latestPerformance.playoff_result})`
                  : latestPerformance.season_label
              : "Team results & performance";


    // --------------------------------------------------
    // ORGANISATION CARD
    // --------------------------------------------------

    const organisationValue =
        organisationLoading
            ? "..."
            : organisation
              ? `GM: ${
                    organisation
                        .organisation
                        .general_manager ??
                    "—"
                }`
              : "GM: —";


    const organisationDetail =
        organisationLoading
            ? "Loading organisation"
            : organisation
              ? `HC: ${
                    organisation
                        .organisation
                        .head_coach ??
                    "—"
                }`
              : "HC: —";


    // --------------------------------------------------
    // AHL CARD
    // --------------------------------------------------

    const ahlValue =
        ahlLoading
            ? "..."
            : ahlAffiliate
                  ?.affiliate
                  .ahl_logo_url
              ? (
                    <img
                        src={
                            ahlAffiliate
                                .affiliate
                                .ahl_logo_url
                        }
                        alt={
                            ahlAffiliate
                                .affiliate
                                .ahl_team ??
                            "AHL Affiliate"
                        }
                        className="h-20 w-20 object-contain"
                    />
                )
              : "—";


    const ahlDetail =
        ahlLoading
            ? "Loading affiliate"
            : ahlAffiliate
              ? ahlAffiliate
                    .affiliate
                    .ahl_team ??
                "AHL Affiliate"
              : "Development pathway";


    // --------------------------------------------------
    // TRAVEL CARD
    // --------------------------------------------------

    const travelValue =
        travelLoading
            ? "..."
            : travel
              ? `${(
                    travel.summary
                        .total_distance_miles /
                    1000
                ).toFixed(1)}k mi`
              : "—";


    const travelDetail =
        travelLoading
            ? "Loading travel"
            : travel
              ? `#${travel.summary.distance_rank} NHL travel`
              : "Travel & schedule";


    // --------------------------------------------------
    // CARDS
    // --------------------------------------------------

    const cards = [
        {
            id: "cap",
            title:
                "Salary Cap",
            value:
                capSpace,
            detail:
                capDetail,
            uniformValueDetail:
                false,

            content:
                salaryCap ? (
                    <SalaryCapPanel
                        data={
                            salaryCap
                        }
                    />
                ) : capLoading ? (
                    <p className="text-slate-400">
                        Loading salary
                        cap data...
                    </p>
                ) : (
                    <p className="text-slate-400">
                        Salary cap data
                        unavailable.
                    </p>
                ),
        },

        {
            id:
                "depth-chart",
            title:
                "Depth Chart",
            value:
                depthChartValue,
            detail:
                depthChartDetail,
            uniformValueDetail:
                false,

            content:
                depthChart ? (
                    <DepthChartPanel
                        data={
                            depthChart
                        }
                    />
                ) : depthChartLoading ? (
                    <p className="text-slate-400">
                        Loading depth
                        chart...
                    </p>
                ) : (
                    <p className="text-slate-400">
                        Depth chart data
                        unavailable.
                    </p>
                ),
        },

        {
            id:
                "performance",
            title:
                "Team Performance",
            value:
                performanceValue,
            detail:
                performanceDetail,
            uniformValueDetail:
                false,

            content:
                teamPerformance ? (
                    <TeamPerformancePanel
                        data={
                            teamPerformance
                        }
                    />
                ) : performanceLoading ? (
                    <p className="text-slate-400">
                        Loading team
                        performance...
                    </p>
                ) : (
                    <p className="text-slate-400">
                        Team performance
                        data unavailable.
                    </p>
                ),
        },

        {
            id:
                "organisation",
            title:
                "Organisation",
            value:
                organisationValue,
            detail:
                organisationDetail,
            uniformValueDetail:
                true,

            content:
                organisation ? (
                    <OrganisationPanel
                        data={
                            organisation
                        }
                    />
                ) : organisationLoading ? (
                    <p className="text-slate-400">
                        Loading
                        organisation...
                    </p>
                ) : (
                    <p className="text-slate-400">
                        Organisation data
                        unavailable.
                    </p>
                ),
        },

        {
            id:
                "ahl",
            title:
                "AHL Affiliate",
            value:
                ahlValue,
            detail:
                ahlDetail,
            uniformValueDetail:
                false,

            content:
                ahlAffiliate ? (
                    <AhlAffiliatePanel
                        data={
                            ahlAffiliate
                        }
                    />
                ) : ahlLoading ? (
                    <p className="text-slate-400">
                        Loading AHL
                        affiliate...
                    </p>
                ) : (
                    <p className="text-slate-400">
                        AHL affiliate
                        data unavailable.
                    </p>
                ),
        },

        {
            id:
                "travel",
            title:
                "Travel",
            value:
                travelValue,
            detail:
                travelDetail,
            uniformValueDetail:
                false,

            content:
                travel ? (
                    <TravelPanel
                        data={
                            travel
                        }
                    />
                ) : travelLoading ? (
                    <p className="text-slate-400">
                        Loading travel
                        data...
                    </p>
                ) : (
                    <p className="text-slate-400">
                        Travel data
                        unavailable.
                    </p>
                ),
        },
    ];


    const selectedCard =
        cards.find(
            (card) =>
                card.id ===
                openCard
        );


    // --------------------------------------------------
    // PAGE
    // --------------------------------------------------

    return (
        <main className="min-h-screen bg-slate-950 px-8 py-10">
            <div className="mx-auto max-w-7xl">

                <div className="mb-8">
                    {ahlAffiliate
                        ?.affiliate
                        .home_logo && (
                        <img
                            src={
                                ahlAffiliate
                                    .affiliate
                                    .home_logo
                            }
                            alt=""
                            className="h-24 w-24 object-contain"
                        />
                    )}
                </div>


                {!openCard && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {cards.map(
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
                                    uniformValueDetail={
                                        card.uniformValueDetail
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
                                            uniformValueDetail={
                                                card.uniformValueDetail
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
                                    uniformValueDetail={
                                        selectedCard.uniformValueDetail
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


// --------------------------------------------------
// DEPTH CHART HELPERS
// --------------------------------------------------

function getRosterPositionCount(
    data: DepthChartData,
    position: string
) {
    const players:
        DepthChartPlayer[] =
        [
            ...data.forwards,
            ...data.defence,
            ...data.goalies,
        ];

    return players.filter(
        (player) =>
            player.is_depth_chart &&
            player.depth_chart_position ===
                position
    ).length;
}


function positionLabel(
    position: string
) {
    const labels:
        Record<
            string,
            string
        > = {
        C: "centres",
        LW: "left wings",
        RW: "right wings",
        LD: "left defence",
        RD: "right defence",
        D: "defencemen",
        G: "goalies",
    };

    return (
        labels[position] ??
        position
    );
}


// --------------------------------------------------
// MONEY
// --------------------------------------------------

function money(
    value: number
) {
    const abs =
        Math.abs(
            value
        );

    let formatted:
        string;

    if (
        abs >=
        1_000_000
    ) {
        formatted =
            `$${(
                abs /
                1_000_000
            ).toFixed(
                1
            )}m`;

    } else if (
        abs >=
        1_000
    ) {
        formatted =
            `$${(
                abs /
                1_000
            ).toFixed(
                0
            )}k`;

    } else {
        formatted =
            `$${abs.toFixed(
                0
            )}`;
    }

    return value < 0
        ? `-${formatted}`
        : formatted;
}