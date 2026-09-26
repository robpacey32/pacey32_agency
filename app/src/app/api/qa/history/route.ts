import { NextRequest, NextResponse } from "next/server";

import { bigquery } from "@/lib/bigquery";

const SOURCE_PROJECT = "nhl-pacey32-github";
const AGENCY_PROJECT = "pacey32-agency";

const AGENCY_DOMAINS = [
    {
        domain: "Player",
        prefix: "PL",
    },
    {
        domain: "Cap",
        prefix: "CP",
    },
    {
        domain: "Comparison",
        prefix: "CQ",
    },
    {
        domain: "Event Locations",
        prefix: "EL",
    },
    {
        domain: "Team",
        prefix: "TM",
    },
    {
        domain: "Organisation",
        prefix: "ORG",
    },
    {
        domain: "City",
        prefix: "CT",
    },
    {
        domain: "Tax",
        prefix: "TX",
    },
    {
        domain: "Travel",
        prefix: "TR",
    },
    {
        domain: "Geo",
        prefix: "GE",
    },
];

function normaliseValue(value: unknown): unknown {
    if (
        value &&
        typeof value === "object" &&
        "value" in value
    ) {
        return (
            value as {
                value: unknown;
            }
        ).value;
    }

    return value;
}

function normaliseRows(
    rows: Record<string, unknown>[]
) {
    return rows.map((row) =>
        Object.fromEntries(
            Object.entries(row).map(
                ([key, value]) => [
                    key,
                    normaliseValue(value),
                ]
            )
        )
    );
}

async function getSourceHistory() {
    const query = `
        SELECT
            qa_date,
            source_object AS domain,
            run_id,
            run_datetime,
            test_count,
            pass_count,
            warn_count,
            fail_count,
            overall_status
        FROM \`${SOURCE_PROJECT}.QA.DailyStatus\`
        WHERE qa_date >= DATE_SUB(
            CURRENT_DATE(),
            INTERVAL 29 DAY
        )
        ORDER BY
            qa_date ASC,
            source_object ASC
    `;

    const [rows] =
        await bigquery.query({
            query,
            location: "us-central1",
        });

    return normaliseRows(
        rows as Record<
            string,
            unknown
        >[]
    );
}

async function getAgencyHistory() {
    const domainCase = AGENCY_DOMAINS.map(
        ({ domain, prefix }) => `
            WHEN STARTS_WITH(test_id, '${prefix}')
            THEN '${domain}'
        `
    ).join("\n");

    const query = `
        WITH classified AS (
            SELECT
                DATE(run_datetime) AS qa_date,

                CASE
                    ${domainCase}
                    ELSE NULL
                END AS domain,

                run_id,
                run_datetime,
                status

            FROM \`${AGENCY_PROJECT}.QA.TestResults\`

            WHERE
                DATE(run_datetime) >= DATE_SUB(
                    CURRENT_DATE(),
                    INTERVAL 29 DAY
                )
        ),

        recognised AS (
            SELECT *
            FROM classified
            WHERE domain IS NOT NULL
        ),

        runs AS (
            SELECT
                qa_date,
                domain,
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

            FROM recognised

            GROUP BY
                qa_date,
                domain,
                run_id,
                run_datetime
        ),

        daily_runs AS (
            SELECT
                *,

                ROW_NUMBER() OVER (
                    PARTITION BY
                        qa_date,
                        domain

                    ORDER BY
                        run_datetime DESC
                ) AS rn

            FROM runs
        )

        SELECT
            qa_date,
            domain,
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

        FROM daily_runs

        WHERE rn = 1

        ORDER BY
            qa_date ASC,
            domain ASC
    `;

    const [rows] =
        await bigquery.query({
            query,
            location: "us-central1",
        });

    return normaliseRows(
        rows as Record<
            string,
            unknown
        >[]
    );
}

export async function GET(
    request: NextRequest
) {
    const layer =
        request.nextUrl.searchParams.get(
            "layer"
        );

    try {
        if (layer === "source") {
            const results =
                await getSourceHistory();

            return NextResponse.json({
                project: SOURCE_PROJECT,
                layer: "NHL Source",
                days: 30,
                results,
            });
        }

        if (layer === "agency") {
            const results =
                await getAgencyHistory();

            return NextResponse.json({
                project: AGENCY_PROJECT,
                layer: "Agency",
                days: 30,
                results,
            });
        }

        return NextResponse.json(
            {
                error:
                    "layer must be 'source' or 'agency'",
            },
            {
                status: 400,
            }
        );
    } catch (error) {
        console.error(
            "QA history error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unable to load QA history.",
            },
            {
                status: 500,
            }
        );
    }
}