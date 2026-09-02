import { NextRequest, NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const team =
            request.nextUrl.searchParams.get("team");

        if (!team) {
            return NextResponse.json(
                { error: "Team is required" },
                { status: 400 }
            );
        }

        const teamCode =
            team.toUpperCase();

        const sql = `
            SELECT
                o.tricode,
                o.fullName,
                o.home_logo,

                o.ahl_team,
                o.ahl_city,
                o.ahl_arena,
                o.ahl_capacity,
                o.ahl_founded,
                o.ahl_joined,
                o.ahl_current_city_since,
                o.ahl_head_coach,

                l.logo_url AS ahl_logo_url

            FROM \`pacey32-agency.Team.OrganizationDetail\` o

            LEFT JOIN \`pacey32-agency.Team.AHLLogo\` l
                ON LOWER(TRIM(o.ahl_team)) =
                   LOWER(TRIM(l.ahl_team))

            WHERE o.tricode = @team
            LIMIT 1
        `;

        const [rows] =
            await bigquery.query({
                query: sql,
                params: {
                    team: teamCode,
                },
            });

        if (!rows.length) {
            return NextResponse.json(
                {
                    error:
                        "AHL affiliate not found",
                },
                {
                    status: 404,
                }
            );
        }

        return NextResponse.json({
            team: teamCode,
            affiliate: rows[0],
        });
    } catch (error) {
        console.error(
            "AHL Affiliate API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to load AHL affiliate data",
            },
            {
                status: 500,
            }
        );
    }
}