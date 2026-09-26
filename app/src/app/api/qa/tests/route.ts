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

    if (!runId) {
        return NextResponse.json(
            {
                error: "run_id is required.",
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
                test_name,
                category,
                source_dataset,
                source_object,
                season,
                severity,
                status,
                failure_count,
                description,
                details

            FROM \`${project}.QA.TestResults\`

            WHERE run_id = @run_id

            ORDER BY
                test_id
        `;

        const [rows] = await bigquery.query({
            query,
            location: "us-central1",
            params: {
                run_id: runId,
            },
        });

        const results = rows.map((row) => ({
            test_id: row.test_id,
            test_name: row.test_name,
            category: row.category,
            source_dataset: row.source_dataset,
            source_object: row.source_object,
            season: row.season,
            severity: row.severity,
            status: row.status,
            failure_count: Number(
                row.failure_count
            ),
            description: row.description,
            details: row.details,
        }));

        return NextResponse.json({
            project,
            layer,
            run_id: runId,
            results,
        });
    } catch (error) {
        console.error(
            "QA tests query failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to load QA tests.",
            },
            {
                status: 500,
            }
        );
    }
}
