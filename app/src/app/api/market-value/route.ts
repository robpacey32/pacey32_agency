// app/src/app/api/market-value/route.ts

import {
    NextRequest,
    NextResponse,
} from "next/server";

import { bigquery } from "@/lib/bigquery";

import {
    getCachedComparables,
} from "@/lib/comparison/v3/cache";

import {
    loadHistoricalContracts,
    loadCurrentContractMarket,
    loadTargetPosition,
} from "@/lib/comparison/v3/loaders";

import {
    attachHistoricalContracts,
    ContractComparable,
    ContractMarketType,
} from "@/lib/comparison/v3/07_historicalcontracts";

import {
    weightHistoricalContracts,
} from "@/lib/comparison/v3/08_contractweight";

import {
    calculateMarketValue,
} from "@/lib/comparison/v3/09_marketvalue";

// ---------------------------------------------------------
// TYPES
// ---------------------------------------------------------

const VALID_MARKET_TYPES:
    ContractMarketType[] = [
        "RFA_TO_RFA",
        "RFA_TO_UFA",
        "UFA_SIGNING",
    ];

// ---------------------------------------------------------
// CURRENT NHL CAP
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

        FROM
            \`pacey32-agency.Cap.Team\`

        WHERE
            projected_cap_hit IS NOT NULL
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
// PARSE TOP N
// ---------------------------------------------------------

const MIN_TOP_N = 3;
const MAX_TOP_N = 20;
const DEFAULT_TOP_N = 20;

function parseTopN(
    value: string | null
): number | null {

    if (value == null) {
        return DEFAULT_TOP_N;
    }

    const parsed =
        Number(value);

    if (
        !Number.isInteger(parsed) ||
        parsed < MIN_TOP_N ||
        parsed > MAX_TOP_N
    ) {
        return null;
    }

    return parsed;
}

// ---------------------------------------------------------
// PARSE MARKET TYPE
// ---------------------------------------------------------

function parseMarketType(
    value: string | null
): ContractMarketType | null {

    if (!value) {
        return null;
    }

    const normalised =
        value
            .trim()
            .toUpperCase();

    if (
        VALID_MARKET_TYPES.includes(
            normalised as
                ContractMarketType
        )
    ) {
        return normalised as
            ContractMarketType;
    }

    return null;
}

// ---------------------------------------------------------
// API
// ---------------------------------------------------------

export async function GET(
    request: NextRequest
) {
    try {

        // -------------------------------------------------
        // REQUEST PARAMETERS
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
        // TOP N
        //
        // Default = 20.
        // Supported presets = 5 / 10 / 20.
        // -------------------------------------------------

        const topNValue =
            request.nextUrl.searchParams.get(
                "topN"
            );

        const topN =
            parseTopN(
                topNValue
            );

        if (topN == null) {
            return NextResponse.json(
                {
                    error:
                        "topN must be an integer between 3 and 20",
                },
                {
                    status: 400,
                }
            );
        }

        // -------------------------------------------------
        // OPTIONAL MARKET OVERRIDE
        //
        // If absent, the player's current contract
        // determines the default market.
        // -------------------------------------------------

        const marketTypeValue =
            request.nextUrl.searchParams.get(
                "marketType"
            );

        const marketTypeOverride =
            parseMarketType(
                marketTypeValue
            );

        if (
            marketTypeValue &&
            marketTypeOverride == null
        ) {
            return NextResponse.json(
                {
                    error:
                        "marketType must be RFA_TO_RFA, RFA_TO_UFA, or UFA_SIGNING",
                },
                {
                    status: 400,
                }
            );
        }

        // -------------------------------------------------
        // LOAD TARGET / CACHE / MARKET / CAP
        // -------------------------------------------------

        const [
            target,
            cachedComparables,
            currentContractMarket,
            capCeiling,
        ] = await Promise.all([
            loadTargetPosition(
                playerId
            ),

            getCachedComparables(
                playerId
            ),

            loadCurrentContractMarket(
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

        if (
            !cachedComparables ||
            cachedComparables.length === 0
        ) {
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

        // -------------------------------------------------
        // DETERMINE TARGET MARKET
        // -------------------------------------------------

        const targetMarketType =
            marketTypeOverride ??
            currentContractMarket
                ?.default_market_type ??
            null;

        if (!targetMarketType) {
            return NextResponse.json(
                {
                    error:
                        "Unable to determine target contract market. Supply marketType explicitly.",
                },
                {
                    status: 400,
                }
            );
        }

        // -------------------------------------------------
        // SELECT COMPARABLE PLAYERS
        //
        // Similarity ranking remains untouched.
        // We simply choose how many ranked players
        // feed the valuation model.
        // -------------------------------------------------

        const selectedComparables =
            [...cachedComparables]
                .sort(
                    (a, b) =>
                        a.rank -
                        b.rank
                )
                .slice(
                    0,
                    topN
                );

        const contractComparables:
            ContractComparable[] =
            selectedComparables.map(
                comparable => ({
                    rank:
                        comparable.rank,

                    playerId:
                        comparable.playerId,

                    player:
                        comparable.player ??
                        null,

                    position:
                        comparable.position ??
                        null,

                    overall_similarity:
                        comparable
                            .overall_similarity,

                    models_available:
                        comparable
                            .models_available,
                })
            );

        const comparablePlayerIds =
            contractComparables.map(
                comparable =>
                    comparable.playerId
            );

        // -------------------------------------------------
        // 07 — HISTORICAL CONTRACT EVIDENCE
        // -------------------------------------------------

        const historicalContracts =
            await loadHistoricalContracts(
                comparablePlayerIds
            );

        const contractEvidence =
            attachHistoricalContracts(
                contractComparables,
                historicalContracts
            );

        if (
            contractEvidence.length === 0
        ) {
            return NextResponse.json(
                {
                    error:
                        "No historical contract evidence found for selected comparable players",
                },
                {
                    status: 404,
                }
            );
        }

        // -------------------------------------------------
        // 08 — SIMILARITY × RECENCY
        // -------------------------------------------------

        const weightedContracts =
            weightHistoricalContracts(
                contractEvidence
            );

        if (
            weightedContracts.length === 0
        ) {
            return NextResponse.json(
                {
                    error:
                        "No usable weighted contract evidence found",
                },
                {
                    status: 404,
                }
            );
        }

        // -------------------------------------------------
        // 09 — MARKET RELEVANCE + VALUATION
        // -------------------------------------------------

        const valuation =
            calculateMarketValue(
                weightedContracts,
                targetMarketType,
                capCeiling
            );

        if (!valuation) {
            return NextResponse.json(
                {
                    error:
                        "Insufficient historical contract evidence to calculate market value",
                },
                {
                    status: 404,
                }
            );
        }

        // -------------------------------------------------
        // RESPONSE
        // -------------------------------------------------

        return NextResponse.json({

            playerId:
                target.playerId,

            player:
                target.player,

            position:
                target.position,

            // ---------------------------------------------
            // USER / MODEL SETTINGS
            // ---------------------------------------------

            settings: {
                top_n:
                    topN,

                market_type:
                    targetMarketType,

                market_type_source:
                    marketTypeOverride
                        ? "user"
                        : "current_contract",

                recency_half_life_months:
                    4,
            },

            // ---------------------------------------------
            // CURRENT CONTRACT CONTEXT
            // ---------------------------------------------

            current_contract: {
                contract_id:
                    currentContractMarket
                        ?.contract_id ??
                    null,

                season_from:
                    currentContractMarket
                        ?.season_from ??
                    null,

                season_to:
                    currentContractMarket
                        ?.season_to ??
                    null,

                signing_status:
                    currentContractMarket
                        ?.signing_status ??
                    null,

                expiry_status:
                    currentContractMarket
                        ?.expiry_status ??
                    null,

                default_market_type:
                    currentContractMarket
                        ?.default_market_type ??
                    null,
            },

            // ---------------------------------------------
            // VALUATION
            // ---------------------------------------------

            valuation: {

                // -----------------------------------------
                // NEGOTIATION BENCHMARK
                //
                // Higher median of Peer Value vs
                // Recent Market.
                // -----------------------------------------

                negotiation_benchmark: {
                    source:
                        valuation
                            .negotiation_benchmark
                            .source,

                    cap_pct:
                        valuation
                            .negotiation_benchmark
                            .cap_pct,

                    aav:
                        valuation
                            .negotiation_benchmark
                            .aav,

                    term:
                        valuation
                            .negotiation_benchmark
                            .term,
                },


                // -----------------------------------------
                // PEER VALUE
                //
                // Similarity × market relevance.
                // No recency decay.
                // -----------------------------------------

                peer_value: {
                    contracts_used:
                        valuation
                            .peer_value
                            .contracts_used,

                    players_used:
                        valuation
                            .peer_value
                            .players_used,

                    cap_pct_low:
                        valuation
                            .peer_value
                            .cap_pct_low,

                    cap_pct_median:
                        valuation
                            .peer_value
                            .cap_pct_median,

                    cap_pct_high:
                        valuation
                            .peer_value
                            .cap_pct_high,

                    aav_low:
                        valuation
                            .peer_value
                            .aav_low,

                    aav_median:
                        valuation
                            .peer_value
                            .aav_median,

                    aav_high:
                        valuation
                            .peer_value
                            .aav_high,

                    term_low:
                        valuation
                            .peer_value
                            .term_low,

                    term_median:
                        valuation
                            .peer_value
                            .term_median,

                    term_high:
                        valuation
                            .peer_value
                            .term_high,
                },


                // -----------------------------------------
                // RECENT MARKET
                //
                // Similarity × recency × market relevance.
                // -----------------------------------------

                recent_market: {
                    contracts_used:
                        valuation
                            .recent_market
                            .contracts_used,

                    players_used:
                        valuation
                            .recent_market
                            .players_used,

                    cap_pct_low:
                        valuation
                            .recent_market
                            .cap_pct_low,

                    cap_pct_median:
                        valuation
                            .recent_market
                            .cap_pct_median,

                    cap_pct_high:
                        valuation
                            .recent_market
                            .cap_pct_high,

                    aav_low:
                        valuation
                            .recent_market
                            .aav_low,

                    aav_median:
                        valuation
                            .recent_market
                            .aav_median,

                    aav_high:
                        valuation
                            .recent_market
                            .aav_high,

                    term_low:
                        valuation
                            .recent_market
                            .term_low,

                    term_median:
                        valuation
                            .recent_market
                            .term_median,

                    term_high:
                        valuation
                            .recent_market
                            .term_high,
                },


                // -----------------------------------------
                // COMPATIBILITY FIELDS
                //
                // Keep these temporarily because the
                // existing UI still reads them.
                // They represent whichever valuation lens
                // produced the negotiation benchmark.
                // -----------------------------------------

                cap_pct_low:
                    valuation.cap_pct_low,

                cap_pct_median:
                    valuation.cap_pct_median,

                cap_pct_high:
                    valuation.cap_pct_high,

                aav_low:
                    valuation.aav_low,

                aav_median:
                    valuation.aav_median,

                aav_high:
                    valuation.aav_high,

                term_low:
                    valuation.term_low,

                term_median:
                    valuation.term_median,

                term_high:
                    valuation.term_high,
            },

            // ---------------------------------------------
            // EVIDENCE SUMMARY
            // ---------------------------------------------

            evidence_summary: {
                comparable_players_selected:
                    contractComparables.length,

                contracts_found:
                    contractEvidence.length,

                contracts_used:
                    valuation.contracts_used,

                players_used:
                    valuation.players_used,
            },

            // ---------------------------------------------
            // SELECTED COMPARABLES
            // ---------------------------------------------

            comparables:
                contractComparables.map(
                    comparable => ({
                        rank:
                            comparable.rank,

                        playerId:
                            comparable.playerId,

                        player:
                            comparable.player,

                        position:
                            comparable.position,

                        similarity:
                            comparable
                                .overall_similarity,

                        models_available:
                            comparable
                                .models_available,

                        contracts_found:
                            contractEvidence.filter(
                                contract =>
                                    contract.playerId ===
                                    comparable.playerId
                            ).length,
                    })
                ),

            // ---------------------------------------------
            // CONTRACT EVIDENCE
            //
            // Kept in response so UI can explain exactly
            // which historical contracts drove valuation.
            // ---------------------------------------------

            evidence:
                valuation.evidence.map(
                    contract => {

                        const isPeerValueContract =
                            valuation.peer_evidence.some(
                                peerContract =>
                                    peerContract.playerId ===
                                        contract.playerId &&
                                    peerContract.contract_id ===
                                        contract.contract_id
                            );

                        return {
                            ...contract,

                            is_peer_value_contract:
                                isPeerValueContract,
                        };
                    }
                ),

            // ---------------------------------------------
            // MODEL METADATA
            // ---------------------------------------------

            model: {
                current_salary_cap:
                    capCeiling,

                target_market_type:
                    targetMarketType,

                contracts_used:
                    valuation.contracts_used,

                players_used:
                    valuation.players_used,
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