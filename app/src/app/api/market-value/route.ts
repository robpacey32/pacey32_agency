import { NextRequest, NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

interface ComparableRow {
    comparable_rank: number;
    comparable_playerId: number;
    comparable_player: string;
    comparable_position: string;
    overall_similarity: number;

    current_aav: number | null;
    current_contract_term: number | null;
    current_contract_to: string | null;
    current_contract_cap_pct: number | null;

    age: number | null;
    latestSeasonPPG: number | null;
    ppgGrowth: number | null;

    headshot_url: string | null;
}

interface TargetRow {
    playerId: number;
    player: string;
    position: string;

    age: number | null;
    latestSeasonPPG: number | null;
    ppgGrowth: number | null;

    current_aav: number | null;
    current_contract_term: number | null;
    current_contract_to: string | null;
    current_contract_cap_pct: number | null;

    headshot_url: string | null;
}

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function clamp(
    value: number,
    min: number,
    max: number
) {
    return Math.max(
        min,
        Math.min(max, value)
    );
}

function weightedAverage(
    values: {
        value: number;
        weight: number;
    }[]
): number | null {
    if (!values.length) {
        return null;
    }

    const totalWeight =
        values.reduce(
            (sum, item) =>
                sum + item.weight,
            0
        );

    if (totalWeight === 0) {
        return null;
    }

    return (
        values.reduce(
            (sum, item) =>
                sum +
                item.value *
                    item.weight,
            0
        ) / totalWeight
    );
}

function similarityWeight(
    similarity: number
) {
    const score =
        clamp(
            similarity / 100,
            0,
            1
        );

    return score * score;
}

// ---------------------------------------------------------
// TARGET PLAYER
// ---------------------------------------------------------

async function getTargetPlayer(
    playerId: number
): Promise<TargetRow | null> {
    const query = `
        WITH player_snapshot AS (

            SELECT
                playerId,
                age,
                latestSeasonPPG,
                ppgGrowth

            FROM \`pacey32-agency.Comparison.09_PlayerCurrentSnapshot\`

            WHERE playerId = @playerId

            QUALIFY ROW_NUMBER() OVER (
                PARTITION BY playerId
                ORDER BY SnapshotDate DESC
            ) = 1
        ),

        player_profile AS (

            SELECT
                playerID AS playerId,
                player_name AS player,
                CASE
                    WHEN position = 'L' THEN 'LW'
                    WHEN position = 'R' THEN 'RW'
                    ELSE position
                END AS position,
                headshot_url

            FROM \`pacey32-agency.Player.PlayerDetail_NHLAPI\`

            WHERE playerID = @playerId
              AND rn = 1

            QUALIFY ROW_NUMBER() OVER (
                PARTITION BY playerID
                ORDER BY RunDate DESC
            ) = 1
        ),

        current_contract AS (

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

            QUALIFY ROW_NUMBER() OVER (
                PARTITION BY player
                ORDER BY scrape_datetime DESC
            ) = 1
        )

        SELECT
            p.playerId,
            p.player,
            p.position,

            s.age,
            s.latestSeasonPPG,
            s.ppgGrowth,

            c.current_aav,
            c.current_contract_term,
            c.current_contract_to,
            c.current_contract_cap_pct,

            p.headshot_url

        FROM player_profile p

        LEFT JOIN player_snapshot s
            USING (playerId)

        LEFT JOIN current_contract c
            ON LOWER(TRIM(c.player)) =
               LOWER(TRIM(p.player))
    `;

    const [rows] =
        await bigquery.query({
            query,
            params: {
                playerId,
            },
            types: {
                playerId: "INT64",
            },
            location:
                "us-central1",
        });

    if (!rows.length) {
        return null;
    }

    return rows[0] as TargetRow;
}

// ---------------------------------------------------------
// COMPARABLES
// ---------------------------------------------------------

async function getComparablePlayers(
    playerId: number
): Promise<ComparableRow[]> {
    const query = `
        WITH latest_run AS (

            SELECT MAX(RunDate) AS RunDate

            FROM \`pacey32-agency.Comparison.10_ComparablePlayers\`

            WHERE target_playerId =
                @playerId
        ),

        comparables AS (

            SELECT
                c.comparable_rank,
                c.comparable_playerId,
                c.comparable_player,
                c.comparable_position,
                c.overall_similarity,

                c.current_aav,
                c.current_contract_term,
                c.current_contract_to,
                c.current_contract_cap_pct

            FROM \`pacey32-agency.Comparison.10_ComparablePlayers\` c

            CROSS JOIN latest_run r

            WHERE c.target_playerId =
                @playerId

              AND c.RunDate =
                r.RunDate
        ),

        snapshots AS (

            SELECT
                playerId,
                age,
                latestSeasonPPG,
                ppgGrowth

            FROM \`pacey32-agency.Comparison.09_PlayerCurrentSnapshot\`

            QUALIFY ROW_NUMBER() OVER (
                PARTITION BY playerId
                ORDER BY SnapshotDate DESC
            ) = 1
        ),

        profiles AS (

            SELECT
                playerID AS playerId,
                headshot_url

            FROM \`pacey32-agency.Player.PlayerDetail_NHLAPI\`

            WHERE rn = 1

            QUALIFY ROW_NUMBER() OVER (
                PARTITION BY playerID
                ORDER BY RunDate DESC
            ) = 1
        )

        SELECT
            c.*,

            s.age,
            s.latestSeasonPPG,
            s.ppgGrowth,

            p.headshot_url

        FROM comparables c

        LEFT JOIN snapshots s
            ON s.playerId =
               c.comparable_playerId

        LEFT JOIN profiles p
            ON p.playerId =
               c.comparable_playerId

        ORDER BY
            c.comparable_rank
    `;

    const [rows] =
        await bigquery.query({
            query,
            params: {
                playerId,
            },
            types: {
                playerId: "INT64",
            },
            location:
                "us-central1",
        });

    return rows as ComparableRow[];
}

// ---------------------------------------------------------
// CURRENT CAP
// ---------------------------------------------------------

async function getCurrentCapCeiling():
Promise<number | null> {
    const query = `
        SELECT
            APPROX_QUANTILES(
                CAST(projected_cap_hit AS FLOAT64)
                +
                CAST(projected_cap_space AS FLOAT64),
                2
            )[OFFSET(1)] AS cap_ceiling

        FROM \`pacey32-agency.Cap.Team\`

        WHERE projected_cap_hit IS NOT NULL
          AND projected_cap_space IS NOT NULL
    `;

    const [rows] =
        await bigquery.query({
            query,
            location:
                "us-central1",
        });

    if (!rows.length) {
        return null;
    }

    const value =
        Number(
            rows[0].cap_ceiling
        );

    return Number.isFinite(value)
        ? value
        : null;
}

// ---------------------------------------------------------
// MARKET VALUE MODEL
// ---------------------------------------------------------

function calculateMarketValue(
    target: TargetRow,
    comparables: ComparableRow[],
    capCeiling: number
) {
    const contractedComparables =
        comparables.filter(
            (row) =>
                row.current_contract_cap_pct != null &&
                row.current_contract_cap_pct > 0
        );

    if (
        contractedComparables.length ===
        0
    ) {
        return null;
    }

    // -----------------------------------------------------
    // BASE VALUE
    //
    // Similar players carry more weight.
    // Weight is similarity².
    // -----------------------------------------------------

    const baseCapPct =
        weightedAverage(
            contractedComparables.map(
                (row) => ({
                    value:
                        Number(
                            row.current_contract_cap_pct
                        ),

                    weight:
                        similarityWeight(
                            row.overall_similarity
                        ),
                })
            )
        );

    if (baseCapPct == null) {
        return null;
    }

    // -----------------------------------------------------
    // COMPARABLE AVERAGES
    // -----------------------------------------------------

    const comparableAge =
        weightedAverage(
            contractedComparables
                .filter(
                    (row) =>
                        row.age != null
                )
                .map((row) => ({
                    value:
                        Number(row.age),

                    weight:
                        similarityWeight(
                            row.overall_similarity
                        ),
                }))
        );

    const comparablePPG =
        weightedAverage(
            contractedComparables
                .filter(
                    (row) =>
                        row.latestSeasonPPG !=
                        null
                )
                .map((row) => ({
                    value:
                        Number(
                            row.latestSeasonPPG
                        ),

                    weight:
                        similarityWeight(
                            row.overall_similarity
                        ),
                }))
        );

    // -----------------------------------------------------
    // PERFORMANCE ADJUSTMENT
    //
    // Production difference is deliberately dampened.
    // Maximum adjustment +/-10%.
    // -----------------------------------------------------

    let performanceAdjustment = 1;

    if (
        target.latestSeasonPPG != null &&
        comparablePPG != null &&
        comparablePPG > 0
    ) {
        const productionRatio =
            target.latestSeasonPPG /
            comparablePPG;

        const rawAdjustment =
            1 +
            (
                productionRatio -
                1
            ) *
                0.25;

        performanceAdjustment =
            clamp(
                rawAdjustment,
                0.90,
                1.10
            );
    }

    // -----------------------------------------------------
    // AGE ADJUSTMENT
    //
    // 1% per year relative to comparable group.
    // Maximum +/-5%.
    // -----------------------------------------------------

    let ageAdjustment = 1;

    if (
        target.age != null &&
        comparableAge != null
    ) {
        const ageDifference =
            comparableAge -
            target.age;

        ageAdjustment =
            1 +
            clamp(
                ageDifference *
                    0.01,
                -0.05,
                0.05
            );
    }

    // -----------------------------------------------------
    // TRAJECTORY ADJUSTMENT
    //
    // Small adjustment only.
    // Maximum +/-5%.
    // -----------------------------------------------------

    let trajectoryAdjustment = 1;

    if (
        target.ppgGrowth != null &&
        Number.isFinite(
            target.ppgGrowth
        )
    ) {
        trajectoryAdjustment =
            1 +
            clamp(
                target.ppgGrowth *
                    0.05,
                -0.05,
                0.05
            );
    }

    // -----------------------------------------------------
    // FINAL CAP %
    // -----------------------------------------------------

    const estimatedCapPct =
        baseCapPct *
        performanceAdjustment *
        ageAdjustment *
        trajectoryAdjustment;

    // +/- 7.5% valuation range
    const capPctLow =
        estimatedCapPct *
        0.925;

    const capPctHigh =
        estimatedCapPct *
        1.075;

    const aavLow =
        capCeiling *
        (
            capPctLow /
            100
        );

    const aavHigh =
        capCeiling *
        (
            capPctHigh /
            100
        );

    // -----------------------------------------------------
    // TERM
    // -----------------------------------------------------

    const weightedTerm =
        weightedAverage(
            contractedComparables
                .filter(
                    (row) =>
                        row.current_contract_term !=
                        null
                )
                .map((row) => ({
                    value:
                        Number(
                            row.current_contract_term
                        ),

                    weight:
                        similarityWeight(
                            row.overall_similarity
                        ),
                }))
        );

    let centreTerm =
        weightedTerm != null
            ? Math.round(weightedTerm)
            : 4;

    // Reduce expected term for older players.
    if (
        target.age != null
    ) {
        if (target.age >= 35) {
            centreTerm =
                Math.min(
                    centreTerm,
                    3
                );
        } else if (
            target.age >= 32
        ) {
            centreTerm =
                Math.min(
                    centreTerm,
                    5
                );
        }
    }

    centreTerm =
        clamp(
            centreTerm,
            1,
            8
        );

    const termLow =
        clamp(
            centreTerm - 1,
            1,
            8
        );

    const termHigh =
        clamp(
            centreTerm + 1,
            1,
            8
        );

    // -----------------------------------------------------
    // DRIVERS
    // -----------------------------------------------------

    const drivers = [
        {
            label:
                "Comparable Contracts",

            detail:
                `${contractedComparables.length} comparable players with current contract data; similarity-weighted base value ${baseCapPct.toFixed(
                    2
                )}% of cap.`,

            impact:
                "neutral" as const,
        },

        {
            label:
                "Age",

            detail:
                comparableAge != null &&
                target.age != null
                    ? `Age ${target.age} vs weighted comparable average ${comparableAge.toFixed(
                          1
                      )}.`
                    : "Insufficient age data.",

            impact:
                ageAdjustment >
                1.01
                    ? "increase" as const
                    : ageAdjustment <
                      0.99
                    ? "decrease" as const
                    : "neutral" as const,
        },

        {
            label:
                "Performance",

            detail:
                comparablePPG != null &&
                target.latestSeasonPPG !=
                    null
                    ? `${target.latestSeasonPPG.toFixed(
                          2
                      )} PPG vs ${comparablePPG.toFixed(
                          2
                      )} weighted comparable average.`
                    : "Insufficient current production data.",

            impact:
                performanceAdjustment >
                1.02
                    ? "increase" as const
                    : performanceAdjustment <
                      0.98
                    ? "decrease" as const
                    : "neutral" as const,
        },

        {
            label:
                "Trajectory",

            detail:
                target.ppgGrowth != null
                    ? `Recent PPG growth: ${target.ppgGrowth.toFixed(
                          2
                      )}.`
                    : "Insufficient trajectory history.",

            impact:
                trajectoryAdjustment >
                1.01
                    ? "increase" as const
                    : trajectoryAdjustment <
                      0.99
                    ? "decrease" as const
                    : "neutral" as const,
        },

        {
            label:
                "Cap Environment",

            detail:
                `Current modelled cap ceiling: $${(
                    capCeiling /
                    1_000_000
                ).toFixed(
                    1
                )}m.`,

            impact:
                "neutral" as const,
        },
    ];

    return {
        estimated_aav_low:
            aavLow,

        estimated_aav_high:
            aavHigh,

        estimated_cap_pct_low:
            capPctLow,

        estimated_cap_pct_high:
            capPctHigh,

        estimated_term_low:
            termLow,

        estimated_term_high:
            termHigh,

        base_cap_pct:
            baseCapPct,

        estimated_cap_pct:
            estimatedCapPct,

        adjustments: {
            performance:
                performanceAdjustment,

            age:
                ageAdjustment,

            trajectory:
                trajectoryAdjustment,
        },

        drivers,
    };
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

        const [
            target,
            comparables,
            capCeiling,
        ] = await Promise.all([
            getTargetPlayer(
                playerId
            ),

            getComparablePlayers(
                playerId
            ),

            getCurrentCapCeiling(),
        ]);

        if (!target) {
            return NextResponse.json(
                {
                    error:
                        "Player not found",
                },
                {
                    status: 404,
                }
            );
        }

        if (!comparables.length) {
            return NextResponse.json(
                {
                    error:
                        "Comparable player results are required before market value can be calculated",
                },
                {
                    status: 404,
                }
            );
        }

        if (
            capCeiling == null
        ) {
            return NextResponse.json(
                {
                    error:
                        "Unable to determine current NHL cap ceiling",
                },
                {
                    status: 500,
                }
            );
        }

        const valuation =
            calculateMarketValue(
                target,
                comparables,
                capCeiling
            );

        if (!valuation) {
            return NextResponse.json(
                {
                    error:
                        "Insufficient comparable contract data",
                },
                {
                    status: 404,
                }
            );
        }

        return NextResponse.json({
            playerId:
                target.playerId,

            player:
                target.player,

            position:
                target.position,

            headshot_url:
                target.headshot_url,

            age:
                target.age,

            contract_status:
                null,

            current_aav:
                target.current_aav,

            current_cap_pct:
                target.current_contract_cap_pct,

            estimated_aav_low:
                valuation.estimated_aav_low,

            estimated_aav_high:
                valuation.estimated_aav_high,

            estimated_cap_pct_low:
                valuation.estimated_cap_pct_low,

            estimated_cap_pct_high:
                valuation.estimated_cap_pct_high,

            estimated_term_low:
                valuation.estimated_term_low,

            estimated_term_high:
                valuation.estimated_term_high,

            comparables:
                comparables
                    .filter(
                        (row) =>
                            row.current_contract_cap_pct !=
                            null
                    )
                    .slice(0, 10)
                    .map(
                        (row) => ({
                            playerId:
                                row.comparable_playerId,

                            player:
                                row.comparable_player,

                            position:
                                row.comparable_position,

                            headshot_url:
                                row.headshot_url,

                            similarity:
                                row.overall_similarity,

                            aav:
                                row.current_aav,

                            cap_pct:
                                row.current_contract_cap_pct,

                            contract_term:
                                row.current_contract_term,

                            contract_to:
                                row.current_contract_to,
                        })
                    ),

            drivers:
                valuation.drivers,

            model: {
                cap_ceiling:
                    capCeiling,

                base_cap_pct:
                    valuation.base_cap_pct,

                estimated_cap_pct:
                    valuation.estimated_cap_pct,

                adjustments:
                    valuation.adjustments,
            },
        });

    } catch (error) {
        console.error(
            "Market value API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to calculate market value",
            },
            {
                status: 500,
            }
        );
    }
}