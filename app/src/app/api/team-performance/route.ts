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

        const sql = `
            WITH performance AS (
                SELECT
                    *,

                    AVG(goals_for) OVER (
                        PARTITION BY seasonId
                    ) AS nhl_avg_goals_for,

                    AVG(goals_against) OVER (
                        PARTITION BY seasonId
                    ) AS nhl_avg_goals_against,

                    AVG(power_play_pct) OVER (
                        PARTITION BY seasonId
                    ) AS nhl_avg_power_play_pct,

                    AVG(penalty_kill_pct) OVER (
                        PARTITION BY seasonId
                    ) AS nhl_avg_penalty_kill_pct

                FROM \`pacey32-agency.Team.TeamPerformance\`
            )

            SELECT
                seasonId,
                season_label,
                date,

                team_code,
                team_name,
                team_common_name,
                team_logo,

                conference_name,
                division_name,

                games_played,
                wins,
                losses,
                ot_losses,
                points,

                point_pctg,
                point_pctg_change,
                win_pctg,

                goals_for,
                goals_against,
                goal_differential,
                goal_differential_change,

                goals_for_per_game,
                goals_against_per_game,

                nhl_avg_goals_for,
                nhl_avg_goals_against,

                division_rank,
                conference_rank,
                league_rank,
                league_rank_change,

                home_games_played,
                home_wins,
                home_losses,
                home_ot_losses,
                home_points,
                home_point_pctg,
                home_goal_differential,

                road_games_played,
                road_wins,
                road_losses,
                road_ot_losses,
                road_points,
                road_point_pctg,
                road_goal_differential,

                l10_games_played,
                l10_wins,
                l10_losses,
                l10_ot_losses,
                l10_points,
                l10_point_pctg,
                l10_goal_differential,

                streak_code,
                streak_count,

                power_play_pct,
                power_play_net_pct,
                penalty_kill_pct,
                penalty_kill_net_pct,

                nhl_avg_power_play_pct,
                nhl_avg_penalty_kill_pct,

                faceoff_win_pct,
                shots_for_per_game,
                shots_against_per_game,
                team_shutouts,

                playoff_result

            FROM performance

            WHERE team_code = @team

            ORDER BY seasonId DESC

            LIMIT 5
        `;

        const [rows] = await bigquery.query({
            query: sql,
            params: {
                team: team.toUpperCase(),
            },
        });

        return NextResponse.json({
            team: team.toUpperCase(),
            seasons: rows,
        });
    } catch (error) {
        console.error(
            "Team performance API error:",
            error
        );

        return NextResponse.json(
            {
                error: "Failed to load team performance data",
            },
            { status: 500 }
        );
    }
}