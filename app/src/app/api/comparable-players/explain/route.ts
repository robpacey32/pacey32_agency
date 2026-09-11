import { NextRequest, NextResponse } from "next/server";

import {
    loadComparisonFeatures,
} from "@/lib/comparison/comparablePlayers";

import {
    explainSimilarity,
} from "@/lib/comparison/explainSimilarity";

import {
    isComparisonModel,
} from "@/lib/comparison/modelMetadata";

export async function GET(
    request: NextRequest
) {
    try {
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
            Number(playerIdValue);

        const comparablePlayerId =
            Number(
                comparablePlayerIdValue
            );

        if (
            !Number.isInteger(
                playerId
            ) ||
            !Number.isInteger(
                comparablePlayerId
            )
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

        // -----------------------------------------------------
        // LOAD THE EXACT SAME FEATURE POPULATION
        // USED BY THE LIVE COMPARISON MODEL
        // -----------------------------------------------------

        const features =
            await loadComparisonFeatures();

        if (!features.length) {
            return NextResponse.json(
                {
                    error:
                        "No comparison model feature data available",
                },
                {
                    status: 404,
                }
            );
        }

        // -----------------------------------------------------
        // EXPLAIN THE SELECTED MODEL SCORE
        // -----------------------------------------------------

        const explanation =
            explainSimilarity(
                features,
                playerId,
                comparablePlayerId,
                modelValue
            );

        return NextResponse.json(
            explanation
        );
    } catch (error) {
        console.error(
            "Comparable explanation API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to explain similarity",
            },
            {
                status: 500,
            }
        );
    }
}