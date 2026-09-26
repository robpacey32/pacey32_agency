import { NextRequest, NextResponse } from "next/server";

import { bigquery } from "@/lib/bigquery";
import { isQAAuthenticated } from "@/lib/qa/auth";

const SOURCE_ORDER = [
    "Team",
    "Schedule",
    "Roster",
    "PlayerLanding",
    "Boxscore",
    "GameAction",
    "Standings",
    "TeamSummary",
    "Playoffs",
];

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

    try {
        const query = `
            SELECT
                source_object,
                run_id,
                run_datetime,
                test_count,
                pass_count,
                warn_count,
                fail_count,
                overall_status

            FROM \`nhl-pacey32-github.QA.DailyStatus\`

            WHERE qa_date = (
                SELECT MAX(qa_date)
                FROM \`nhl-pacey32-github.QA.DailyStatus\`
            )
        `;

        const [rows] = await bigquery.query({
            query,
            location: "us-central1",
        });

        const results = rows
            .map((row) => ({
                domain: String(
                    row.source_object
                ),

                run_id: String(
                    row.run_id
                ),

                run_datetime:
                    row.run_datetime?.value ??
                    row.run_datetime,

                test_count:
                    Number(row.test_count),

                pass_count:
                    Number(row.pass_count),

                warn_count:
                    Number(row.warn_count),

                fail_count:
                    Number(row.fail_count),

                overall_status:
                    String(row.overall_status),
            }))
            .sort(
                (a, b) =>
                    SOURCE_ORDER.indexOf(
                        a.domain
                    ) -
                    SOURCE_ORDER.indexOf(
                        b.domain
                    )
            );

        return NextResponse.json({
            project: "nhl-pacey32-github",
            layer: "NHL Source",
            results,
        });
    } catch (error) {
        console.error(
            "Source QA query failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to load NHL Source QA.",
            },
            {
                status: 500,
            }
        );
    }
}
