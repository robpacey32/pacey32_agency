"use client";

import { useEffect, useState } from "react";
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
import { useAppContext } from "@/context/AppContext";

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

    const [team, setTeam] =
        useState<Team | null>(null);

    const [salaryCap, setSalaryCap] =
        useState<SalaryCapData | null>(
            null
        );

    const [depthChart, setDepthChart] =
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

    const [capLoading, setCapLoading] =
        useState(true);

    const [
        depthChartLoading,
        setDepthChartLoading,
    ] = useState(true);

    const [
        performanceLoading,
        setPerformanceLoading,
    ] = useState(true);

    const [openCard, setOpenCard] =
        useState<string | null>(null);

    useEffect(() => {
        async function loadTeam() {
            try {
                const response =
                    await fetch("/api/teams");

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

    useEffect(() => {
        let cancelled = false;

        async function loadDepthChart() {
            try {
                setDepthChartLoading(
                    true
                );
                setDepthChart(null);

                const response =
                    await fetch(
                        `/api/depth-chart?team=${selectedTeam}`,
                        {
                            cache: "no-store",
                        }
                    );

                if (!response.ok) {
                    if (!cancelled) {
                        setDepthChart(null);
                    }

                    return;
                }

                const data: DepthChartData =
                    await response.json();

                if (!cancelled) {
                    setDepthChart(data);
                }
            } catch {
                if (!cancelled) {
                    setDepthChart(null);
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

    useEffect(() => {
        let cancelled = false;

        async function loadTeamPerformance() {
            try {
                setPerformanceLoading(
                    true
                );
                setTeamPerformance(null);

                const response =
                    await fetch(
                        `/api/team-performance?team=${selectedTeam}`,
                        {
                            cache: "no-store",
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

                const data: TeamPerformanceData =
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

    const toggleCard = (
        card: string
    ) => {
        setOpenCard(
            openCard === card
                ? null
                : card
        );
    };

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

    const selectedPrimaryPosition =
        selectedPlayer?.position
            ?.split(",")[0]
            .trim()
            .toUpperCase() ?? null;

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
            : rosterPositionCount !=
                null
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

    const cards = [
        {
            id: "cap",
            title: "Salary Cap",
            value: capSpace,
            detail: capDetail,
            content: salaryCap ? (
                <SalaryCapPanel
                    data={salaryCap}
                />
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
            id: "depth-chart",
            title: "Depth Chart",
            value: depthChartValue,
            detail: depthChartDetail,
            content: depthChart ? (
                <DepthChartPanel
                    data={depthChart}
                />
            ) : depthChartLoading ? (
                <p className="text-slate-400">
                    Loading depth chart...
                </p>
            ) : (
                <p className="text-slate-400">
                    Depth chart data unavailable.
                </p>
            ),
        },
        {
            id: "performance",
            title: "Team Performance",
            value: performanceValue,
            detail: performanceDetail,
            content: teamPerformance ? (
                <TeamPerformancePanel
                    data={teamPerformance}
                />
            ) : performanceLoading ? (
                <p className="text-slate-400">
                    Loading team performance...
                </p>
            ) : (
                <p className="text-slate-400">
                    Team performance data unavailable.
                </p>
            ),
        },
        {
            id: "organisation",
            title: "Organisation",
            value: "—",
            detail:
                "Leadership & structure",
            content: <NotBuiltYet />,
        },
        {
            id: "ahl",
            title: "AHL Affiliate",
            value: "—",
            detail:
                "Development pathway",
            content: <NotBuiltYet />,
        },
        {
            id: "travel",
            title: "Travel",
            value: "—",
            detail:
                "Travel & schedule",
            content: <NotBuiltYet />,
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
                                .filter(
                                    Boolean
                                )
                                .join(
                                    " · "
                                )}
                        </p>
                    )}
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

function getRosterPositionCount(
    data: DepthChartData,
    position: string
) {
    const players: DepthChartPlayer[] =
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
    const labels: Record<
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
            `$${(
                abs / 1_000_000
            ).toFixed(1)}m`;
    } else if (
        abs >= 1_000
    ) {
        formatted =
            `$${(
                abs / 1_000
            ).toFixed(0)}k`;
    } else {
        formatted =
            `$${abs.toFixed(0)}`;
    }

    return value < 0
        ? `-${formatted}`
        : formatted;
}