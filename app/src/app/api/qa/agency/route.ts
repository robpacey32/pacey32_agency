import { NextRequest, NextResponse } from "next/server";

import { bigquery } from "@/lib/bigquery";
import { isQAAuthenticated } from "@/lib/qa/auth";

const DOMAIN_MAP: Record<string, string> = {
    PL: "Player",
    CP: "Cap",
    CQ: "Comparison",
    EL: "Event Locations",
    TM: "Team",
    ORG: "Organisation",
    CT: "City",
    TX: "Tax",
    TR: "Travel",
    GE: "Geo",
};

const DOMAIN_ORDER = [
    "Player",
    "Cap",
    "Comparison",
    "Event Locations",
    "Team",
    "Organisation",
    "City",
    "Tax",
    "Travel",
    "Geo",
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
            WITH runs AS (
                SELECT
                    REGEXP_EXTRACT(
                        test_id,
                        r'^[A-Z]+'
                    ) AS test_prefix,

                    run_id,
                    run_datetime,

                    COUNT(*) AS test_count,

                    COUNTIF(
                        status = 'PASS'
                    ) AS pass_count,

                    COUNTIF(
                        status = 'WARN'
                    ) AS warn_count,

                    COUNTIF(
                        status = 'FAIL'
                    ) AS fail_count

                FROM \`pacey32-agency.QA.TestResults\`

                GROUP BY
                    test_prefix,
                    run_id,
                    run_datetime
            ),

            latest_runs AS (
                SELECT
                    *,
                    ROW_NUMBER() OVER (
                        PARTITION BY test_prefix
                        ORDER BY run_datetime DESC
                    ) AS rn

                FROM runs
            )

            SELECT
                test_prefix,
                run_id,
                run_datetime,
                test_count,
                pass_count,
                warn_count,
                fail_count,

                CASE
                    WHEN fail_count > 0
                        THEN 'FAIL'
                    WHEN warn_count > 0
                        THEN 'WARN'
                    ELSE 'PASS'
                END AS overall_status

            FROM latest_runs

            WHERE rn = 1

            ORDER BY test_prefix
        `;

        const [rows] = await bigquery.query({
            query,
            location: "us-central1",
        });

        const results = rows
            .map((row) => {
                const prefix =
                    String(row.test_prefix);

                return {
                    domain:
                        DOMAIN_MAP[prefix] ??
                        prefix,

                    test_prefix: prefix,

                    run_id:
                        String(row.run_id),

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
                        String(
                            row.overall_status
                        ),
                };
            })
            .sort(
                (a, b) =>
                    DOMAIN_ORDER.indexOf(
                        a.domain
                    ) -
                    DOMAIN_ORDER.indexOf(
                        b.domain
                    )
            );

        return NextResponse.json({
            project: "pacey32-agency",
            layer: "Agency",
            results,
        });
    } catch (error) {
        console.error(
            "Agency QA query failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to load Agency QA.",
            },
            {
                status: 500,
            }
        );
    }
}