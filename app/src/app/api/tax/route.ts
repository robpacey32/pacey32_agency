import { NextRequest, NextResponse } from "next/server";

import { bigquery } from "@/lib/bigquery";
import { taxComparisonQuery } from "@/lib/sql/taxComparison";

export async function GET(
    request: NextRequest
) {
    try {
        const { searchParams } =
            new URL(request.url);

        const salary = Number(
            searchParams.get("salary")
        );

        const taxYear = Number(
            searchParams.get("tax_year") ?? 2026
        );

        const season = Number(
            searchParams.get("season") ?? 20252026
        );

        const includeLocalTax =
            searchParams.get("includeLocalTax")
                ?.toLowerCase() !== "false";

        if (
            !Number.isFinite(salary) ||
            salary <= 0
        ) {
            return NextResponse.json(
                {
                    error:
                        "A valid salary greater than 0 is required.",
                },
                {
                    status: 400,
                }
            );
        }

        const [rows] =
            await bigquery.query({
                query: taxComparisonQuery,

                params: {
                    salary,
                    tax_year: taxYear,
                    season,
                    include_local_tax:
                        includeLocalTax,
                },
            });

        return NextResponse.json({
            salary,
            taxYear,
            season,
            includeLocalTax,
            teams: rows,
        });
    } catch (error) {
        console.error(
            "Tax API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to calculate tax comparison.",
            },
            {
                status: 500,
            }
        );
    }
}