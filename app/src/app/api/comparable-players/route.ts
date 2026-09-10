import { NextRequest, NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

import {
    calculateOverallComparables,
    loadComparisonFeatures,
    TOP_N,
} from "@/lib/comparison/comparablePlayers";

// ---------------------------------------------------------
// TYPES
// ---------------------------------------------------------

interface ComparableCacheRow {
    target_playerId: number;
    target_player: string;
    target_position: string;

    comparable_rank: number;
    comparable_playerId: number;
    comparable_player: string;
    comparable_position: string;

    overall_similarity: number;

    playing_style_similarity: number;
    playing_style_rank: number;

    production_similarity: number;
    production_rank: number;

    effectiveness_similarity: number;
    effectiveness_rank: number;

    usage_similarity: number;
    usage_rank: number;

    trajectory_similarity: number;
    trajectory_rank: number;

    models_available: number;

    current_aav: number | null;
    current_contract_term: number | null;
    current_contract_to: string | null;
    current_contract_cap_pct: number | null;

    RunDate: string;
}

interface ComparableApiRow extends ComparableCacheRow {
    headshot_url: string | null;
}

interface CurrentContract {
    player: string;
    current_aav: number | null;
    current_contract_term: number | null;
    current_contract_to: string | null;
    current_contract_cap_pct: number | null;
}

interface PlayerHeadshot {
    playerId: number;
    headshot_url: string | null;
}

// ---------------------------------------------------------
// CACHE
// ---------------------------------------------------------

async function getCachedComparables(
    playerId: number
): Promise<ComparableCacheRow[]> {
    const query = `
        WITH latest_features AS (
            SELECT MAX(SnapshotDate) AS latest_snapshot
            FROM \`pacey32-agency.Comparison.11_ComparisonModelFeatures\`
        ),

        latest_cache AS (
            SELECT MAX(RunDate) AS latest_run
            FROM \`pacey32-agency.Comparison.10_ComparablePlayers\`
            WHERE target_playerId = @playerId
        )

        SELECT
            c.* EXCEPT(RunDate),
            CAST(c.RunDate AS STRING) AS RunDate

        FROM \`pacey32-agency.Comparison.10_ComparablePlayers\` c
        CROSS JOIN latest_features f
        CROSS JOIN latest_cache l

        WHERE c.target_playerId = @playerId
          AND c.RunDate = l.latest_run
          AND l.latest_run >= f.latest_snapshot

        ORDER BY c.comparable_rank
    `;

    const [rows] = await bigquery.query({
        query,
        params: {
            playerId,
        },
        types: {
            playerId: "INT64",
        },
        location: "us-central1",
    });

    return rows as ComparableCacheRow[];
}

// ---------------------------------------------------------
// CURRENT CONTRACTS
// ---------------------------------------------------------

async function getCurrentContracts(
    playerNames: string[]
): Promise<Map<string, CurrentContract>> {
    if (playerNames.length === 0) {
        return new Map();
    }

    const query = `
        SELECT
            player,

            CAST(cap_hit AS FLOAT64) AS current_aav,

            CAST(term AS INT64) AS current_contract_term,

            CAST(season_to AS STRING) AS current_contract_to,

            CAST(
                pct_cap_contract_start AS FLOAT64
            ) AS current_contract_cap_pct

        FROM \`pacey32-agency.Cap.PlayerDetail\`

        WHERE current_contract = TRUE
          AND player IN UNNEST(@playerNames)

        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY player
            ORDER BY scrape_datetime DESC
        ) = 1
    `;

    const [rows] = await bigquery.query({
        query,
        params: {
            playerNames,
        },
        types: {
            playerNames: ["STRING"],
        },
        location: "us-central1",
    });

    const contracts =
        new Map<string, CurrentContract>();

    for (
        const row of rows as CurrentContract[]
    ) {
        contracts.set(
            row.player
                .toLowerCase()
                .trim(),
            row
        );
    }

    return contracts;
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
            SELECT MAX(season) AS season
            FROM \`pacey32-agency.Player.PlayerDetail_NHLAPI\`
        )

        SELECT
            playerID AS playerId,
            headshot_url

        FROM \`pacey32-agency.Player.PlayerDetail_NHLAPI\`

        WHERE playerID IN UNNEST(@playerIds)
          AND rn = 1
          AND season = (
              SELECT season
              FROM latest_season
          )

        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY playerID
            ORDER BY RunDate DESC
        ) = 1
    `;

    const [rows] = await bigquery.query({
        query,
        params: {
            playerIds,
        },
        types: {
            playerIds: ["INT64"],
        },
        location: "us-central1",
    });

    const headshots =
        new Map<number, string | null>();

    for (
        const row of rows as PlayerHeadshot[]
    ) {
        headshots.set(
            Number(row.playerId),
            row.headshot_url ?? null
        );
    }

    return headshots;
}

// ---------------------------------------------------------
// ADD HEADSHOTS TO API RESPONSE
// ---------------------------------------------------------

async function addHeadshots(
    rows: ComparableCacheRow[]
): Promise<ComparableApiRow[]> {
    if (rows.length === 0) {
        return [];
    }

    const headshots =
        await getPlayerHeadshots(
            rows.map(
                (row) =>
                    row.comparable_playerId
            )
        );

    return rows.map((row) => ({
        ...row,

        headshot_url:
            headshots.get(
                row.comparable_playerId
            ) ?? null,
    }));
}

// ---------------------------------------------------------
// FORMAT GENERATED RESULTS
// ---------------------------------------------------------

async function buildCacheRows(
    playerId: number,
    targetPlayer: string,
    targetPosition: string,
    comparables: ReturnType<
        typeof calculateOverallComparables
    >
): Promise<ComparableCacheRow[]> {
    const contracts =
        await getCurrentContracts(
            comparables.map(
                (row) => row.player
            )
        );

    const runDate =
        new Date().toISOString();

    return comparables.map((row) => {
        const contract =
            contracts.get(
                row.player
                    .toLowerCase()
                    .trim()
            );

        return {
            target_playerId:
                playerId,

            target_player:
                targetPlayer,

            target_position:
                targetPosition,

            comparable_rank:
                row.overallRank,

            comparable_playerId:
                row.playerId,

            comparable_player:
                row.player,

            comparable_position:
                row.position,

            overall_similarity:
                row.overallSimilarity,

            playing_style_similarity:
                row.playingStyleSimilarity,

            playing_style_rank:
                row.playingStyleRank,

            production_similarity:
                row.productionSimilarity,

            production_rank:
                row.productionRank,

            effectiveness_similarity:
                row.effectivenessSimilarity,

            effectiveness_rank:
                row.effectivenessRank,

            usage_similarity:
                row.usageSimilarity,

            usage_rank:
                row.usageRank,

            trajectory_similarity:
                row.trajectorySimilarity,

            trajectory_rank:
                row.trajectoryRank,

            models_available:
                row.modelsAvailable,

            current_aav:
                contract?.current_aav ??
                null,

            current_contract_term:
                contract?.current_contract_term ??
                null,

            current_contract_to:
                contract?.current_contract_to ??
                null,

            current_contract_cap_pct:
                contract?.current_contract_cap_pct ??
                null,

            RunDate:
                runDate,
        };
    });
}

// ---------------------------------------------------------
// WRITE CACHE
// ---------------------------------------------------------

async function cacheComparables(
    rows: ComparableCacheRow[]
): Promise<void> {
    if (rows.length === 0) {
        return;
    }

    const table = bigquery
        .dataset("Comparison")
        .table(
            "10_ComparablePlayers"
        );

    await table.insert(rows);
}

// ---------------------------------------------------------
// API
// ---------------------------------------------------------

export async function GET(
    request: NextRequest
) {
    try {
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
            Number(playerIdValue);

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

        // ---------------------------------------------
        // 1. CHECK CACHE
        // ---------------------------------------------

        const cached =
            await getCachedComparables(
                playerId
            );

        if (cached.length > 0) {
            const apiRows =
                await addHeadshots(
                    cached
                );

            return NextResponse.json({
                source: "cache",
                playerId,
                comparables:
                    apiRows,
            });
        }

        // ---------------------------------------------
        // 2. LOAD MODEL FEATURES
        // ---------------------------------------------

        const featureRows =
            await loadComparisonFeatures();

        const target =
            featureRows.find(
                (row) =>
                    row.playerId ===
                    playerId
            );

        if (!target) {
            return NextResponse.json(
                {
                    error:
                        "Player not found in comparison model features",
                },
                {
                    status: 404,
                }
            );
        }

        // ---------------------------------------------
        // 3. RUN FIVE-MODEL COMPARISON
        // ---------------------------------------------

        const comparables =
            calculateOverallComparables(
                featureRows,
                playerId,
                TOP_N
            );

        if (
            comparables.length === 0
        ) {
            return NextResponse.json({
                source: "model",
                playerId,
                player:
                    target.player,
                position:
                    target.position,
                comparables: [],
            });
        }

        // ---------------------------------------------
        // 4. ADD CONTRACT DATA
        // ---------------------------------------------

        const cacheRows =
            await buildCacheRows(
                playerId,
                target.player,
                target.position,
                comparables
            );

        // ---------------------------------------------
        // 5. CACHE MODEL OUTPUT
        // ---------------------------------------------

        await cacheComparables(
            cacheRows
        );

        // ---------------------------------------------
        // 6. ADD HEADSHOTS
        // ---------------------------------------------

        const apiRows =
            await addHeadshots(
                cacheRows
            );

        // ---------------------------------------------
        // 7. RETURN
        // ---------------------------------------------

        return NextResponse.json({
            source: "model",
            playerId,
            player:
                target.player,
            position:
                target.position,
            comparables:
                apiRows,
        });

    } catch (error) {
        console.error(
            "Comparable players API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to load comparable players",
            },
            {
                status: 500,
            }
        );
    }
}