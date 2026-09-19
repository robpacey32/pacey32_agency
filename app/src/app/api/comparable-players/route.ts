// app/src/app/api/comparable-players/route.ts

import {
    NextRequest,
    NextResponse,
} from "next/server";

import { bigquery } from "@/lib/bigquery";

import {
    findOverallComparables,
    OverallComparable,
} from "@/lib/comparison/v3/06_overall";

import {
    findGoalieOverallComparables,
    GoalieOverallComparable,
} from "@/lib/comparison/v3/06G_overall";

import {
    getCachedComparables,
    saveComparables,
} from "@/lib/comparison/v3/cache";

import {
    loadGoalieOverallPopulations,
    loadSkaterOverallPopulations,
    loadTargetPosition,
} from "@/lib/comparison/v3/loaders";

// ---------------------------------------------------------
// CONFIG
// ---------------------------------------------------------

const TOP_N = 20;

// ---------------------------------------------------------
// TYPES
// ---------------------------------------------------------

type V3Comparable =
    | OverallComparable
    | GoalieOverallComparable;

interface PlayerHeadshot {
    playerId: number;
    headshot_url: string | null;
}

// ---------------------------------------------------------
// PLAYER HEADSHOTS
// ---------------------------------------------------------

async function getPlayerHeadshots(
    playerIds: number[]
): Promise<Map<number, string | null>> {
    if (playerIds.length === 0) {
        return new Map();
    }

    const query = `
        WITH latest_season AS (
            SELECT
                MAX(season) AS season

            FROM
                \`pacey32-agency.Player.PlayerDetail_NHLAPI\`
        )

        SELECT
            playerID AS playerId,
            headshot_url

        FROM
            \`pacey32-agency.Player.PlayerDetail_NHLAPI\`

        WHERE
            playerID IN UNNEST(@playerIds)
            AND rn = 1
            AND season = (
                SELECT season
                FROM latest_season
            )

        QUALIFY
            ROW_NUMBER() OVER (
                PARTITION BY playerID
                ORDER BY RunDate DESC
            ) = 1
    `;

    const [rows] =
        await bigquery.query({
            query,

            params: {
                playerIds,
            },

            types: {
                playerIds: [
                    "INT64",
                ],
            },

            location:
                "us-central1",
        });

    const headshots =
        new Map<
            number,
            string | null
        >();

    for (
        const row of
        rows as PlayerHeadshot[]
    ) {
        headshots.set(
            Number(
                row.playerId
            ),
            row.headshot_url ??
                null
        );
    }

    return headshots;
}

// ---------------------------------------------------------
// FORMAT API COMPARABLE
//
// Keep the existing API field names used by
// ComparablePlayersPanel while also retaining
// the complete v3 model detail.
// ---------------------------------------------------------

function formatComparable(
    comparable: V3Comparable,
    headshotUrl: string | null
) {
    return {
        comparable_rank:
            comparable.rank,

        comparable_playerId:
            comparable.playerId,

        comparable_player:
            comparable.player,

        comparable_position:
            comparable.position,

        overall_similarity:
            comparable.overall_similarity,

        playing_style_similarity:
            comparable.playing_style
                ?.similarity ??
            null,

        production_similarity:
            comparable.production
                ?.similarity ??
            null,

        effectiveness_similarity:
            comparable.effectiveness
                ?.similarity ??
            null,

        usage_similarity:
            comparable.usage
                ?.similarity ??
            null,

        trajectory_similarity:
            comparable.trajectory
                ?.similarity ??
            null,

        models_available:
            comparable.models_available,

        trajectory_periods_available:
            comparable
                .trajectory_periods_available,

        headshot_url:
            headshotUrl,

        // Complete v3 detail.
        // This is what allows the explanation
        // UI to use the actual cached v3 result.
        comparison_detail:
            comparable,
    };
}

// ---------------------------------------------------------
// BUILD API RESPONSE
// ---------------------------------------------------------

async function buildApiComparables(
    comparables: V3Comparable[]
) {
    if (
        comparables.length === 0
    ) {
        return [];
    }

    const headshots =
        await getPlayerHeadshots(
            comparables.map(
                comparable =>
                    comparable.playerId
            )
        );

    return comparables.map(
        comparable =>
            formatComparable(
                comparable,

                headshots.get(
                    comparable.playerId
                ) ?? null
            )
    );
}

// ---------------------------------------------------------
// API
// ---------------------------------------------------------

export async function GET(
    request: NextRequest
) {
    try {
        // -------------------------------------------------
        // VALIDATE PLAYER ID
        // -------------------------------------------------

        const playerIdValue =
            request.nextUrl.searchParams.get(
                "playerId"
            );

        if (!playerIdValue) {
            return NextResponse.json(
                {
                    error:
                        "playerId is required",
                },
                {
                    status: 400,
                }
            );
        }

        const playerId =
            Number(
                playerIdValue
            );

        if (
            !Number.isInteger(
                playerId
            ) ||
            playerId <= 0
        ) {
            return NextResponse.json(
                {
                    error:
                        "Invalid playerId",
                },
                {
                    status: 400,
                }
            );
        }

        // -------------------------------------------------
        // 1. CHECK V3 CACHE
        // -------------------------------------------------

        const cached =
            await getCachedComparables(
                playerId
            );

        if (
            cached &&
            cached.length > 0
        ) {
            const [
                target,
                apiComparables,
            ] = await Promise.all([
                loadTargetPosition(
                    playerId
                ),

                buildApiComparables(
                    cached
                ),
            ]);

            return NextResponse.json({
                source:
                    "cache",

                playerId,

                player:
                    target?.player ??
                    null,

                position:
                    target?.position ??
                    null,

                comparables:
                    apiComparables,
            });
        }

        // -------------------------------------------------
        // 2. LOAD TARGET
        // -------------------------------------------------

        const target =
            await loadTargetPosition(
                playerId
            );

        if (!target) {
            return NextResponse.json(
                {
                    error:
                        "Player not found in active comparison population",
                },
                {
                    status: 404,
                }
            );
        }

        const isGoalie =
            target.position
                ?.toUpperCase() ===
            "G";

        // -------------------------------------------------
        // 3. RUN CORRECT V3 MODEL
        // -------------------------------------------------

        let comparables:
            V3Comparable[];

        if (isGoalie) {
            const populations =
                await loadGoalieOverallPopulations();

            comparables =
                findGoalieOverallComparables(
                    playerId,
                    populations,
                    TOP_N
                );
        } else {
            const populations =
                await loadSkaterOverallPopulations();

            comparables =
                findOverallComparables(
                    playerId,
                    populations,
                    TOP_N
                );
        }

        // -------------------------------------------------
        // 4. HANDLE INSUFFICIENT MODEL DATA
        // -------------------------------------------------

        if (
            comparables.length === 0
        ) {
            return NextResponse.json({
                source:
                    "model",

                playerId,

                player:
                    target.player,

                position:
                    target.position,

                comparables: [],
            });
        }

        // -------------------------------------------------
        // 5. SAVE COMPLETE V3 RESULT
        // -------------------------------------------------

        await saveComparables(
            target,
            comparables
        );

        // -------------------------------------------------
        // 6. ADD DISPLAY DATA
        // -------------------------------------------------

        const apiComparables =
            await buildApiComparables(
                comparables
            );

        // -------------------------------------------------
        // 7. RETURN
        // -------------------------------------------------

        return NextResponse.json({
            source:
                "model",

            playerId,

            player:
                target.player,

            position:
                target.position,

            comparables:
                apiComparables,
        });

    } catch (error) {
        console.error(
            "V3 comparable players API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to load comparable players",
            },
            {
                status: 500,
            }
        );
    }
}