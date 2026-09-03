import {
    NextRequest,
    NextResponse,
} from "next/server";

import { bigquery } from "@/lib/bigquery";

export async function GET(
    request: NextRequest
) {
    try {
        const playerId =
            request.nextUrl.searchParams.get(
                "playerId"
            );

        if (!playerId) {
            return NextResponse.json(
                {
                    error:
                        "playerId is required",
                },
                {
                    status: 400,
                }
            );
        }

        const query = `
            SELECT
                season,
                seasonPart,
                playerId,
                team_code,

                games_played,
                goals,
                assists,
                points,

                toi_minutes,
                avg_toi_minutes,

                goals_per_game,
                assists_per_game,
                points_per_game,

                goals_per_60,
                assists_per_60,
                points_per_60,

                team_points_rank,
                team_goals_rank,
                team_assists_rank,

                league_points_rank,
                league_goals_rank,
                league_assists_rank,

                team_games_played_rank,
                team_toi_rank,
                team_avg_toi_rank,

                team_goals_per_game_rank,
                team_assists_per_game_rank,
                team_points_per_game_rank,

                team_goals_per_60_rank,
                team_points_per_60_rank

            FROM
                \`pacey32-agency.Comparison.03_PlayerSeasonStats\`

            WHERE
                playerId = @playerId
                AND seasonPart = 'RegularSeason'

            ORDER BY
                season ASC
        `;

        const [rows] =
            await bigquery.query({
                query,
                params: {
                    playerId,
                },
            });

        return NextResponse.json(
            {
                playerId,
                seasons: rows,
            }
        );
    } catch (error) {
        console.error(
            "Player performance API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to load player performance",
            },
            {
                status: 500,
            }
        );
    }
}