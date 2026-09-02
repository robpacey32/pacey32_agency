import { NextRequest, NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const team = request.nextUrl.searchParams.get("team");

        if (!team) {
            return NextResponse.json(
                { error: "Team is required" },
                { status: 400 }
            );
        }

        const teamCode = team.toUpperCase();

        const organisationSql = `
            SELECT
                o.tricode,
                o.fullName,
                o.home_logo,

                o.head_coach,
                o.head_coach_since,

                o.general_manager,
                o.gm_since,
                o.gm_playing_career,

                o.principal_owner,
                o.owner_since,
                o.purchase_price_usd_m,

                o.captain,
                o.captain_since,
                o.captain_position,

                o.alternate_captain_1,
                o.alternate_captain_2,
                o.alternate_captain_3,
                o.alternate_captain_4,
                o.alternate_captain_5,
                o.alternate_captain_6,

                o.stanley_cups,

                l.organization_summary,
                l.fanbase_media_pressure

            FROM \`pacey32-agency.Team.OrganizationDetail\` o

            LEFT JOIN (
                SELECT
                    tricode,
                    organization_summary,
                    fanbase_media_pressure
                FROM \`pacey32-agency.Team.OrganizationDetail_LLM\`
                QUALIFY ROW_NUMBER() OVER (
                    PARTITION BY tricode
                    ORDER BY generated_datetime DESC
                ) = 1
            ) l
                ON o.tricode = l.tricode

            WHERE o.tricode = @team
            LIMIT 1
        `;

        const successSql = `
            SELECT
                season,
                result,
                final_opponent,
                final_score

            FROM \`pacey32-agency.Team.PlayoffResult\`

            WHERE team = @team
              AND result IN (
                  'Stanley Cup Winner',
                  'Stanley Cup Final'
              )

            ORDER BY season
        `;

        const [organisationRows] = await bigquery.query({
            query: organisationSql,
            params: {
                team: teamCode,
            },
        });

        const [successRows] = await bigquery.query({
            query: successSql,
            params: {
                team: teamCode,
            },
        });

        if (!organisationRows.length) {
            return NextResponse.json(
                { error: "Organisation not found" },
                { status: 404 }
            );
        }

        const championships = successRows
            .filter(
                (row) =>
                    row.result ===
                    "Stanley Cup Winner"
            )
            .map((row) => ({
                seasonId: Number(row.season),
                season_label: formatSeason(
                    Number(row.season)
                ),
                opponent:
                    row.final_opponent ??
                    null,
                score:
                    row.final_score ??
                    null,
            }));

        const finalists = successRows
            .filter(
                (row) =>
                    row.result ===
                    "Stanley Cup Final"
            )
            .map((row) => ({
                seasonId: Number(row.season),
                season_label: formatSeason(
                    Number(row.season)
                ),
                opponent:
                    row.final_opponent ??
                    null,
                score:
                    row.final_score ??
                    null,
            }));

        return NextResponse.json({
            team: teamCode,
            organisation:
                organisationRows[0],
            championships,
            finalists,
        });
    } catch (error) {
        console.error(
            "Organisation API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to load organisation data",
            },
            { status: 500 }
        );
    }
}

function formatSeason(
    season: number
) {
    const value =
        String(season);

    if (value.length !== 8) {
        return value;
    }

    const startYear =
        value.slice(0, 4);

    const endYear =
        value.slice(6, 8);

    return `${startYear}-${endYear}`;
}