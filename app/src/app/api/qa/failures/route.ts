import { NextRequest, NextResponse } from "next/server";

import { bigquery } from "@/lib/bigquery";
import { isQAAuthenticated } from "@/lib/qa/auth";

const PROJECTS = {
    source: "nhl-pacey32-github",
    agency: "pacey32-agency",
} as const;

export async function GET(
    request: NextRequest
) {
    if (!isQAAuthenticated(request)) {
        return NextResponse.json(
            {
                error: "Unauthorized",
            },
            {
                status: 401,
            }
        );
    }

    const layer =
        request.nextUrl.searchParams.get("layer");

    const runId =
        request.nextUrl.searchParams.get("run_id");

    const testId =
        request.nextUrl.searchParams.get("test_id");

    if (
        layer !== "source" &&
        layer !== "agency"
    ) {
        return NextResponse.json(
            {
                error: "Invalid layer.",
            },
            {
                status: 400,
            }
        );
    }

    if (!runId || !testId) {
        return NextResponse.json(
            {
                error:
                    "run_id and test_id are required.",
            },
            {
                status: 400,
            }
        );
    }

    const project = PROJECTS[layer];

    try {
        const query = `
            SELECT
                test_id,
                source_object,
                season,
                record_key,
                failure_reason,
                record_json

            FROM \`${project}.QA.TestFailures\`

            WHERE run_id = @run_id
              AND test_id = @test_id

            ORDER BY
                record_key
        `;

        const [rows] = await bigquery.query({
            query,
            location: "us-central1",
            params: {
                run_id: runId,
                test_id: testId,
            },
        });

        const results = rows.map((row) => ({
            test_id: row.test_id,
            source_object: row.source_object,
            season: row.season,
            record_key: row.record_key,
            failure_reason: row.failure_reason,
            record_json: row.record_json,
        }));

        return NextResponse.json({
            project,
            layer,
            run_id: runId,
            test_id: testId,
            failure_count: results.length,
            results,
        });
    } catch (error) {
        console.error(
            "QA failures query failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to load QA failure records.",
            },
            {
                status: 500,
            }
        );
    }
}
