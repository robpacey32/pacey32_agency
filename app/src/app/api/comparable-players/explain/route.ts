// app/src/app/api/comparable-players/explain/route.ts

import {
    NextRequest,
    NextResponse,
} from "next/server";

import {
    getCachedComparables,
} from "@/lib/comparison/v3/cache";

// ---------------------------------------------------------
// VALID MODELS
// ---------------------------------------------------------

const VALID_MODELS = [
    "playing_style",
    "production",
    "effectiveness",
    "usage",
    "trajectory",
] as const;

type ComparisonModel =
    typeof VALID_MODELS[number];

function isComparisonModel(
    value: string
): value is ComparisonModel {
    return (
        VALID_MODELS as readonly string[]
    ).includes(value);
}

// ---------------------------------------------------------
// API
// ---------------------------------------------------------

export async function GET(
    request: NextRequest
) {
    try {
        // -------------------------------------------------
        // PARAMETERS
        // -------------------------------------------------

        const playerIdValue =
            request.nextUrl.searchParams.get(
                "playerId"
            );

        const comparablePlayerIdValue =
            request.nextUrl.searchParams.get(
                "comparablePlayerId"
            );

        const modelValue =
            request.nextUrl.searchParams.get(
                "model"
            );

        // -------------------------------------------------
        // VALIDATION
        // -------------------------------------------------

        if (
            !playerIdValue ||
            !comparablePlayerIdValue ||
            !modelValue
        ) {
            return NextResponse.json(
                {
                    error:
                        "playerId, comparablePlayerId and model are required",
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

        const comparablePlayerId =
            Number(
                comparablePlayerIdValue
            );

        if (
            !Number.isInteger(
                playerId
            ) ||
            playerId <= 0 ||
            !Number.isInteger(
                comparablePlayerId
            ) ||
            comparablePlayerId <= 0
        ) {
            return NextResponse.json(
                {
                    error:
                        "playerId and comparablePlayerId must be valid integers",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !isComparisonModel(
                modelValue
            )
        ) {
            return NextResponse.json(
                {
                    error:
                        "Invalid model",
                },
                {
                    status: 400,
                }
            );
        }

        // -------------------------------------------------
        // LOAD V3 CACHE
        // -------------------------------------------------

        const comparables =
            await getCachedComparables(
                playerId
            );

        if (
            !comparables ||
            comparables.length === 0
        ) {
            return NextResponse.json(
                {
                    error:
                        "No cached v3 comparison available for this player",
                },
                {
                    status: 404,
                }
            );
        }

        // -------------------------------------------------
        // FIND COMPARABLE
        // -------------------------------------------------

        const comparable =
            comparables.find(
                item =>
                    item.playerId ===
                    comparablePlayerId
            );

        if (!comparable) {
            return NextResponse.json(
                {
                    error:
                        "Comparable player not found in cached v3 result",
                },
                {
                    status: 404,
                }
            );
        }

        // -------------------------------------------------
        // SELECT MODEL DETAIL
        // -------------------------------------------------

        const explanation =
            comparable[
                modelValue
            ];

        if (!explanation) {
            return NextResponse.json(
                {
                    playerId,
                    comparablePlayerId,
                    model:
                        modelValue,
                    similarity:
                        null,
                    available:
                        false,
                }
            );
        }

        // -------------------------------------------------
        // RETURN EXACT V3 MODEL DETAIL
        // -------------------------------------------------

        return NextResponse.json({
            playerId,

            comparablePlayerId,

            comparablePlayer:
                comparable.player,

            model:
                modelValue,

            similarity:
                explanation.similarity,

            available:
                true,

            explanation,
        });

    } catch (error) {
        console.error(
            "V3 comparable explanation API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to load comparable explanation",
            },
            {
                status: 500,
            }
        );
    }
}