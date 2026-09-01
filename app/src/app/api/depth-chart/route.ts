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

        const sql = `
            WITH headshots AS (
                SELECT
                    playerID,
                    ARRAY_AGG(
                        headshot_url IGNORE NULLS
                        LIMIT 1
                    )[SAFE_OFFSET(0)] AS headshot_url
                FROM \`pacey32-agency.Player.PlayerDetail_NHLAPI\`
                GROUP BY playerID
            )

            SELECT
                d.team_code,
                d.team_name,

                d.player,
                d.playerId,
                h.headshot_url,

                d.position,
                d.depth_chart_position,
                d.depth_chart_line,

                d.leadership_role,
                d.sweater_number,
                d.age,

                d.cap_hit,
                d.term,
                d.total_value,

                d.expiry_status,
                d.expiry_year,

                d.agent,

                d.is_depth_chart,
                d.depth_group,
                d.position_sort,
                d.group_sort

            FROM \`pacey32-agency.Team.TeamDepthChart\` d

            LEFT JOIN headshots h
                ON d.playerId = h.playerID

            WHERE d.team_code = @team

            ORDER BY
                d.group_sort,
                d.depth_chart_line,
                d.position_sort,
                d.player
        `;

        const [rows] =
            await bigquery.query({
                query: sql,
                params: {
                    team: team.toUpperCase(),
                },
            });

        const players = rows.map((row) => ({
            team_code: row.team_code,
            team_name: row.team_name,

            player: row.player,
            playerId: row.playerId ?? null,
            headshot_url:
                row.headshot_url ?? null,

            position: row.position ?? null,
            depth_chart_position:
                row.depth_chart_position ?? null,
            depth_chart_line:
                row.depth_chart_line ?? null,

            leadership_role:
                row.leadership_role ?? null,
            sweater_number:
                row.sweater_number ?? null,
            age: row.age ?? null,

            cap_hit: row.cap_hit ?? null,
            term: row.term ?? null,
            total_value:
                row.total_value ?? null,

            expiry_status:
                row.expiry_status ?? null,
            expiry_year:
                row.expiry_year ?? null,

            agent: row.agent ?? null,

            is_depth_chart:
                row.is_depth_chart ?? false,
            depth_group:
                row.depth_group,
            position_sort:
                row.position_sort,
            group_sort:
                row.group_sort,
        }));

        const depthChart =
            players.filter(
                (player) =>
                    player.is_depth_chart
            );

        const organisationalDepth =
            players.filter(
                (player) =>
                    !player.is_depth_chart
            );

        const forwards =
            depthChart.filter(
                (player) =>
                    player.depth_group ===
                    "Forwards"
            );

        const defence =
            depthChart.filter(
                (player) =>
                    player.depth_group ===
                    "Defence"
            );

        const goalies =
            depthChart.filter(
                (player) =>
                    player.depth_group ===
                    "Goalies"
            );

        return NextResponse.json({
            team,
            teamName:
                players[0]?.team_name ?? null,

            summary: {
                forwards:
                    forwards.length,
                defence:
                    defence.length,
                goalies:
                    goalies.length,
                nhlRoster:
                    depthChart.length,
                organisationalDepth:
                    organisationalDepth.length,
                totalContracts:
                    players.length,
            },

            forwards,
            defence,
            goalies,
            organisationalDepth,
        });
    } catch (error) {
        console.error(
            "Depth chart API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to load depth chart data",
            },
            { status: 500 }
        );
    }
}