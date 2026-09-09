import { NextRequest, NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";


type ShotEventRow = {
    gameID: string | null;
    game_date: string | null;
    season: number | null;
    SeasonPart: string | null;
    period: string | null;
    eventType: string | null;
    eventOwnerTeamCode: string | null;
    eventOwnerHomeAway: string | null;
    homeTeamDefendingSide: string | null;
    xCoord: number | null;
    yCoord: number | null;
    zoneCode: string | null;
    shotType: string | null;
    shootingPlayerId: string | null;
    shootingPlayer: string | null;
    goalieInNetId: string | null;
};


type FaceoffEventRow = {
    gameID: string | null;
    game_date: string | null;
    season: number | null;
    SeasonPart: string | null;
    period: string | null;
    eventOwnerHomeAway: string | null;
    homeTeamDefendingSide: string | null;
    xCoord: number | null;
    yCoord: number | null;
    zoneCode: string | null;
    winningPlayerId: string | null;
    winningPlayer: string | null;
    losingPlayerId: string | null;
    losingPlayer: string | null;
};


type PhysicalEventRow = {
    gameID: string | null;
    game_date: string | null;
    season: number | null;
    SeasonPart: string | null;
    period: string | null;
    eventType: string | null;
    eventOwnerHomeAway: string | null;
    homeTeamDefendingSide: string | null;
    xCoord: number | null;
    yCoord: number | null;
    zoneCode: string | null;
    playerId: string | null;
    player: string | null;
    hittingPlayerId: string | null;
    hittingPlayer: string | null;
    hitteePlayerId: string | null;
    hitteePlayer: string | null;
};


type PenaltyEventRow = {
    gameID: string | null;
    game_date: string | null;
    season: number | null;
    SeasonPart: string | null;
    period: string | null;
    eventType: string | null;
    eventOwnerHomeAway: string | null;
    homeTeamDefendingSide: string | null;
    xCoord: number | null;
    yCoord: number | null;
    zoneCode: string | null;
    reason: string | null;
    duration: string | null;
    committedByPlayerId: string | null;
    committedByPlayer: string | null;
    drawnByPlayerId: string | null;
    drawnByPlayer: string | null;
};


type PerformanceRow = {
    playerId: string;
    player: string | null;
    season: number;
    seasonPart: string | null;
    games_played: number | null;
    toi_minutes: number | null;
    [key: string]: string | number | null;
};


type BenchmarkRow = {
    season: number;
    seasonPart: string | null;
    benchmark_group: string;
    zone_key: string;
    shots: number | null;
    goals: number | null;
    saves: number | null;
    shooting_pct: number | null;
    save_pct: number | null;
};


function normaliseCoordinates(
    xCoord: number | null,
    yCoord: number | null,
    eventOwnerHomeAway: string | null,
    homeTeamDefendingSide: string | null
) {
    if (
        xCoord == null
        || yCoord == null
        || !eventOwnerHomeAway
        || !homeTeamDefendingSide
    ) {
        return {
            x: xCoord,
            y: yCoord,
        };
    }

    const homeDefendsRight =
        homeTeamDefendingSide.toLowerCase() === "right";

    const eventOwnerIsHome =
        eventOwnerHomeAway.toLowerCase() === "home";

    const attackingLeft =
        eventOwnerIsHome
            ? homeDefendsRight
            : !homeDefendsRight;

    if (attackingLeft) {
        return {
            x: -xCoord,
            y: -yCoord,
        };
    }

    return {
        x: xCoord,
        y: yCoord,
    };
}


function getBenchmarkGroup(
    position: string | null
) {
    const value =
        position?.toUpperCase()
        ?? "";

    if (
        value === "C"
        || value === "L"
        || value === "R"
    ) {
        return "Forward";
    }

    if (value === "D") {
        return "Defence";
    }

    if (value === "G") {
        return "Goalie";
    }

    return null;
}


async function loadBenchmarks(
    benchmarkGroup: string,
    seasons: number[]
) {
    if (seasons.length === 0) {
        return [];
    }

    const benchmarkQuery = `
        SELECT
            season,
            seasonPart,
            benchmark_group,
            zone_key,
            shots,
            goals,
            saves,
            shooting_pct,
            save_pct
        FROM \`pacey32-agency.EventLocations.11_ZoneBenchmarks\`
        WHERE benchmark_group = @benchmarkGroup
          AND season IN UNNEST(@seasons)
        ORDER BY
            season DESC,
            seasonPart,
            zone_key
    `;

    const [benchmarkRows] =
        await bigquery.query({
            query:
                benchmarkQuery,
            params: {
                benchmarkGroup,
                seasons,
            },
        });

    return benchmarkRows as BenchmarkRow[];
}


export async function GET(
    request: NextRequest
) {
    try {
        const { searchParams } =
            new URL(request.url);

        const playerId =
            searchParams.get("playerId");

        const position =
            searchParams.get("position");

        if (!playerId) {
            return NextResponse.json(
                {
                    error: "playerId is required",
                },
                {
                    status: 400,
                }
            );
        }

        const isGoalie =
            position?.toUpperCase() === "G";

        const benchmarkGroup =
            getBenchmarkGroup(
                position
            );


        // -------------------------------------------------
        // SHOT EVENTS
        // -------------------------------------------------

        const shotQuery = isGoalie
            ? `
                SELECT
                    gameID,
                    game_date,
                    season,
                    SeasonPart,
                    period,
                    eventType,
                    eventOwnerTeamCode,
                    eventOwnerHomeAway,
                    homeTeamDefendingSide,
                    xCoord,
                    yCoord,
                    zoneCode,
                    shotType,
                    shootingPlayerId,
                    shootingPlayer,
                    goalieInNetId
                FROM \`pacey32-agency.EventLocations.05_ShotEvents\`
                WHERE goalieInNetId = @playerId
                  AND xCoord IS NOT NULL
                  AND yCoord IS NOT NULL
                  AND eventType IN (
                      'shot-on-goal',
                      'goal',
                      'blocked-shot',
                      'missed-shot'
                  )
                ORDER BY season DESC, game_date DESC
            `
            : `
                SELECT
                    gameID,
                    game_date,
                    season,
                    SeasonPart,
                    period,
                    eventType,
                    eventOwnerTeamCode,
                    eventOwnerHomeAway,
                    homeTeamDefendingSide,
                    xCoord,
                    yCoord,
                    zoneCode,
                    shotType,
                    shootingPlayerId,
                    shootingPlayer,
                    goalieInNetId
                FROM \`pacey32-agency.EventLocations.05_ShotEvents\`
                WHERE shootingPlayerId = @playerId
                  AND xCoord IS NOT NULL
                  AND yCoord IS NOT NULL
                  AND eventType IN (
                      'shot-on-goal',
                      'goal',
                      'blocked-shot',
                      'missed-shot'
                  )
                ORDER BY season DESC, game_date DESC
            `;

        const [shotRows] =
            await bigquery.query({
                query: shotQuery,
                params: {
                    playerId,
                },
            });

        const allShots = (shotRows as ShotEventRow[]).map(row => {
            const coords =
                normaliseCoordinates(
                    row.xCoord,
                    row.yCoord,
                    row.eventOwnerHomeAway,
                    row.homeTeamDefendingSide
                );

            return {
                ...row,
                normalisedX: coords.x,
                normalisedY: coords.y,
            };
        });


        // -------------------------------------------------
        // AVAILABLE SHOT SEASONS
        // -------------------------------------------------

        const shotSeasons = [
            ...new Set(
                allShots
                    .map(row => row.season)
                    .filter(
                        (season): season is number =>
                            season != null
                    )
            ),
        ].sort(
            (a, b) => b - a
        );


        // -------------------------------------------------
        // GOALIE
        // -------------------------------------------------

        if (isGoalie) {
            const seasons =
                shotSeasons.slice(
                    0,
                    3
                );

            const shots =
                allShots.filter(
                    row =>
                        row.season != null
                        && seasons.includes(
                            row.season
                        )
                );

            const benchmarks =
                benchmarkGroup
                    ? await loadBenchmarks(
                          benchmarkGroup,
                          seasons
                      )
                    : [];

            const shotsOnGoal =
                shots.filter(
                    row =>
                        row.eventType === "shot-on-goal"
                ).length;

            const goalsAgainst =
                shots.filter(
                    row =>
                        row.eventType === "goal"
                ).length;

            const saves =
                shotsOnGoal;

            const officialShotsAgainst =
                shotsOnGoal + goalsAgainst;

            const savePct =
                officialShotsAgainst > 0
                    ? saves / officialShotsAgainst
                    : null;

            const blockedAttempts =
                shots.filter(
                    row =>
                        row.eventType === "blocked-shot"
                ).length;

            const missedAttempts =
                shots.filter(
                    row =>
                        row.eventType === "missed-shot"
                ).length;

            const totalAttempts =
                officialShotsAgainst
                + blockedAttempts
                + missedAttempts;

            return NextResponse.json({
                playerId,

                position:
                    position ?? "G",

                playerType:
                    "goalie",

                benchmarkGroup,

                seasons,

                benchmarks,

                shots,

                summary: {
                    shotsAgainst:
                        officialShotsAgainst,

                    saves,

                    goalsAgainst,

                    savePct,

                    blockedAttempts,

                    missedAttempts,

                    totalAttempts,
                },
            });
        }


        // -------------------------------------------------
        // SKATER PERFORMANCE
        // LAST 3 SEASONS
        // -------------------------------------------------

        const performanceQuery = `
            SELECT *
            FROM \`pacey32-agency.EventLocations.09_PlayerPerformanceLocation\`
            WHERE playerId = @playerId
              AND season IN (
                  SELECT season
                  FROM (
                      SELECT DISTINCT season
                      FROM \`pacey32-agency.EventLocations.09_PlayerPerformanceLocation\`
                      WHERE playerId = @playerId
                  )
                  ORDER BY season DESC
                  LIMIT 3
              )
            ORDER BY season DESC, seasonPart
        `;

        const [performanceRows] =
            await bigquery.query({
                query:
                    performanceQuery,
                params: {
                    playerId,
                },
            });

        const performance =
            performanceRows as PerformanceRow[];


        // -------------------------------------------------
        // SKATER AVAILABLE SEASONS
        // -------------------------------------------------

        const performanceSeasons = [
            ...new Set(
                performance
                    .map(row => Number(row.season))
                    .filter(
                        season =>
                            Number.isFinite(season)
                    )
            ),
        ].sort(
            (a, b) => b - a
        );

        const seasons =
            performanceSeasons.length > 0
                ? performanceSeasons.slice(0, 3)
                : shotSeasons.slice(0, 3);


        // -------------------------------------------------
        // BENCHMARKS
        // -------------------------------------------------

        const benchmarks =
            benchmarkGroup
                ? await loadBenchmarks(
                      benchmarkGroup,
                      seasons
                  )
                : [];


        // -------------------------------------------------
        // LIMIT SHOTS TO LAST 3 SKATER SEASONS
        // -------------------------------------------------

        const shots =
            allShots.filter(
                row =>
                    row.season != null
                    && seasons.includes(row.season)
            );


        // -------------------------------------------------
        // SKATER OTHER EVENTS
        // -------------------------------------------------

        const faceoffQuery = `
            SELECT
                gameID,
                game_date,
                season,
                SeasonPart,
                period,
                eventOwnerHomeAway,
                homeTeamDefendingSide,
                xCoord,
                yCoord,
                zoneCode,
                winningPlayerId,
                winningPlayer,
                losingPlayerId,
                losingPlayer
            FROM \`pacey32-agency.EventLocations.07_FaceoffEvents\`
            WHERE (
                winningPlayerId = @playerId
                OR losingPlayerId = @playerId
            )
              AND season IN UNNEST(@seasons)
              AND xCoord IS NOT NULL
              AND yCoord IS NOT NULL
            ORDER BY season DESC, game_date DESC
        `;

        const physicalQuery = `
            SELECT
                gameID,
                game_date,
                season,
                SeasonPart,
                period,
                eventType,
                eventOwnerHomeAway,
                homeTeamDefendingSide,
                xCoord,
                yCoord,
                zoneCode,
                playerId,
                player,
                hittingPlayerId,
                hittingPlayer,
                hitteePlayerId,
                hitteePlayer
            FROM \`pacey32-agency.EventLocations.08_PhysicalPossessionEvents\`
            WHERE (
                playerId = @playerId
                OR hittingPlayerId = @playerId
                OR hitteePlayerId = @playerId
            )
              AND season IN UNNEST(@seasons)
              AND xCoord IS NOT NULL
              AND yCoord IS NOT NULL
            ORDER BY season DESC, game_date DESC
        `;

        const penaltyQuery = `
            SELECT
                gameID,
                game_date,
                season,
                SeasonPart,
                period,
                eventType,
                eventOwnerHomeAway,
                homeTeamDefendingSide,
                xCoord,
                yCoord,
                zoneCode,
                reason,
                duration,
                committedByPlayerId,
                committedByPlayer,
                drawnByPlayerId,
                drawnByPlayer
            FROM \`pacey32-agency.EventLocations.06_PenaltyEvents\`
            WHERE (
                committedByPlayerId = @playerId
                OR drawnByPlayerId = @playerId
            )
              AND season IN UNNEST(@seasons)
              AND xCoord IS NOT NULL
              AND yCoord IS NOT NULL
            ORDER BY season DESC, game_date DESC
        `;

        const [
            faceoffResult,
            physicalResult,
            penaltyResult,
        ] = await Promise.all([
            bigquery.query({
                query:
                    faceoffQuery,
                params: {
                    playerId,
                    seasons,
                },
            }),

            bigquery.query({
                query:
                    physicalQuery,
                params: {
                    playerId,
                    seasons,
                },
            }),

            bigquery.query({
                query:
                    penaltyQuery,
                params: {
                    playerId,
                    seasons,
                },
            }),
        ]);


        // -------------------------------------------------
        // FACEOFF EVENTS
        // -------------------------------------------------

        const faceoffs = (faceoffResult[0] as FaceoffEventRow[]).map(row => {
            const coords =
                normaliseCoordinates(
                    row.xCoord,
                    row.yCoord,
                    row.eventOwnerHomeAway,
                    row.homeTeamDefendingSide
                );

            return {
                ...row,

                result:
                    row.winningPlayerId === playerId
                        ? "win"
                        : "loss",

                normalisedX:
                    coords.x,

                normalisedY:
                    coords.y,
            };
        });


        // -------------------------------------------------
        // PHYSICAL / POSSESSION EVENTS
        // -------------------------------------------------

        const physicalEvents = (physicalResult[0] as PhysicalEventRow[]).map(row => {
            const coords =
                normaliseCoordinates(
                    row.xCoord,
                    row.yCoord,
                    row.eventOwnerHomeAway,
                    row.homeTeamDefendingSide
                );

            const eventType =
                row.eventType?.toLowerCase()
                ?? null;

            let playerRole:
                | "hit-given"
                | "hit-received"
                | "takeaway"
                | "giveaway"
                | null = null;

            if (
                eventType === "hit"
                && row.hittingPlayerId === playerId
            ) {
                playerRole =
                    "hit-given";
            } else if (
                eventType === "hit"
                && row.hitteePlayerId === playerId
            ) {
                playerRole =
                    "hit-received";
            } else if (
                eventType === "takeaway"
                && row.playerId === playerId
            ) {
                playerRole =
                    "takeaway";
            } else if (
                eventType === "giveaway"
                && row.playerId === playerId
            ) {
                playerRole =
                    "giveaway";
            }

            return {
                ...row,

                playerRole,

                normalisedX:
                    coords.x,

                normalisedY:
                    coords.y,
            };
        }).filter(
            row =>
                row.playerRole != null
        );


        // -------------------------------------------------
        // PENALTY EVENTS
        // -------------------------------------------------

        const penalties = (penaltyResult[0] as PenaltyEventRow[]).map(row => {
            const coords =
                normaliseCoordinates(
                    row.xCoord,
                    row.yCoord,
                    row.eventOwnerHomeAway,
                    row.homeTeamDefendingSide
                );

            return {
                ...row,

                playerRole:
                    row.committedByPlayerId === playerId
                        ? "committed"
                        : "drawn",

                normalisedX:
                    coords.x,

                normalisedY:
                    coords.y,
            };
        });


        // -------------------------------------------------
        // SKATER SUMMARY
        // -------------------------------------------------

        const shotsOnGoal =
            shots.filter(
                row =>
                    row.eventType === "shot-on-goal"
            ).length;

        const goals =
            shots.filter(
                row =>
                    row.eventType === "goal"
            ).length;

        const missedShots =
            shots.filter(
                row =>
                    row.eventType === "missed-shot"
            ).length;

        const blockedShots =
            shots.filter(
                row =>
                    row.eventType === "blocked-shot"
            ).length;

        const shootingPct =
            (
                shotsOnGoal + goals
            ) > 0
                ? goals / (
                    shotsOnGoal + goals
                )
                : null;


        // -------------------------------------------------
        // RESPONSE
        // -------------------------------------------------

        return NextResponse.json({
            playerId,

            position:
                position ?? null,

            playerType:
                "skater",

            benchmarkGroup,

            seasons,

            benchmarks,

            performance,

            shots,

            faceoffs,

            physicalEvents,

            penalties,

            summary: {
                shotsOnGoal:
                    shotsOnGoal + goals,

                goals,

                shootingPct,

                missedShots,

                blockedShots,

                totalAttempts:
                    shotsOnGoal
                    + goals
                    + missedShots
                    + blockedShots,

                faceoffs:
                    faceoffs.length,

                faceoffWins:
                    faceoffs.filter(
                        row =>
                            row.result === "win"
                    ).length,

                hitsGiven:
                    physicalEvents.filter(
                        row =>
                            row.playerRole === "hit-given"
                    ).length,

                hitsReceived:
                    physicalEvents.filter(
                        row =>
                            row.playerRole === "hit-received"
                    ).length,

                takeaways:
                    physicalEvents.filter(
                        row =>
                            row.playerRole === "takeaway"
                    ).length,

                giveaways:
                    physicalEvents.filter(
                        row =>
                            row.playerRole === "giveaway"
                    ).length,

                penaltiesCommitted:
                    penalties.filter(
                        row =>
                            row.playerRole === "committed"
                    ).length,

                penaltiesDrawn:
                    penalties.filter(
                        row =>
                            row.playerRole === "drawn"
                    ).length,
            },
        });

    } catch (error) {
        console.error(
            "Event mapping API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to load event mapping data",
            },
            {
                status: 500,
            }
        );
    }
}