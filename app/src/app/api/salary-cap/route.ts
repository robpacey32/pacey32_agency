import { NextRequest, NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const team = request.nextUrl.searchParams.get("team");

        if (!team) {
            return NextResponse.json(
                { error: "team parameter is required" },
                { status: 400 }
            );
        }

        // --------------------------------------------------
        // CURRENT CAP SUMMARY
        // --------------------------------------------------

        const summarySql = `
            SELECT
                s.*
            FROM \`pacey32-agency.Cap.TeamSalaryCapSummary\` s
            INNER JOIN \`pacey32-agency.Team.TeamList\` t
                ON s.team_name = t.fullName
            WHERE t.triCode = @team
            LIMIT 1
        `;

        const [summaryRows] = await bigquery.query({
            query: summarySql,
            params: { team },
        });

        // --------------------------------------------------
        // FUTURE CAP COMMITMENTS
        // --------------------------------------------------

        const futureSql = `
            SELECT
                f.*
            FROM \`pacey32-agency.Cap.TeamSalaryCapFuture\` f
            INNER JOIN \`pacey32-agency.Team.TeamList\` t
                ON f.team_name = t.fullName
            WHERE t.triCode = @team
            ORDER BY f.year
        `;

        const [futureRows] = await bigquery.query({
            query: futureSql,
            params: { team },
        });

        // --------------------------------------------------
        // CURRENT CONTRACTS
        // --------------------------------------------------

        const contractsSql = `
            SELECT
                c.*
            FROM \`pacey32-agency.Cap.TeamSalaryCapContracts\` c
            INNER JOIN \`pacey32-agency.Team.TeamList\` t
                ON c.team = t.fullName
            WHERE t.triCode = @team
            ORDER BY
                c.cap_hit DESC,
                c.player
        `;

        const [contractRows] = await bigquery.query({
            query: contractsSql,
            params: { team },
        });

        // --------------------------------------------------
        // UPCOMING CONTRACT DECISIONS
        // --------------------------------------------------

        const expirySql = `
            SELECT
                c.expiry_year,

                COUNT(*) AS expiring_players,
                SUM(c.cap_hit) AS expiring_cap_hit,

                COUNTIF(
                    STARTS_WITH(
                        UPPER(COALESCE(c.expiry_status, '')),
                        'UFA'
                    )
                ) AS ufa_players,

                SUM(
                    CASE
                        WHEN STARTS_WITH(
                            UPPER(COALESCE(c.expiry_status, '')),
                            'UFA'
                        )
                        THEN c.cap_hit
                        ELSE 0
                    END
                ) AS ufa_cap_hit,

                COUNTIF(
                    UPPER(c.expiry_status) = 'RFA'
                ) AS rfa_players,

                SUM(
                    CASE
                        WHEN UPPER(c.expiry_status) = 'RFA'
                        THEN c.cap_hit
                        ELSE 0
                    END
                ) AS rfa_cap_hit,

                COUNTIF(c.is_elc) AS elc_players,

                SUM(
                    CASE
                        WHEN c.is_elc
                        THEN c.cap_hit
                        ELSE 0
                    END
                ) AS elc_cap_hit

            FROM \`pacey32-agency.Cap.TeamSalaryCapContracts\` c

            INNER JOIN \`pacey32-agency.Team.TeamList\` t
                ON c.team = t.fullName

            WHERE t.triCode = @team
              AND c.expiry_year IS NOT NULL

            GROUP BY
                c.expiry_year

            ORDER BY
                c.expiry_year
        `;

        const [expiryRows] = await bigquery.query({
            query: expirySql,
            params: { team },
        });

        // --------------------------------------------------
        // LARGEST CONTRACTS
        // --------------------------------------------------

        const largestContracts = contractRows
            .filter((row: any) => row.cap_hit != null)
            .slice(0, 5);

        return NextResponse.json({
            team,

            summary:
                summaryRows.length > 0
                    ? summaryRows[0]
                    : null,

            future: futureRows,

            contracts: contractRows,

            expiries: expiryRows,

            largestContracts,
        });
    } catch (error) {
        console.error("Salary Cap API error:", error);

        return NextResponse.json(
            { error: "Failed to load salary cap data" },
            { status: 500 }
        );
    }
}