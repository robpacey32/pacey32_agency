import { NextRequest, NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET(
    request: NextRequest
) {
    const playerId =
        request.nextUrl.searchParams.get(
            "playerId"
        );

    if (!playerId) {
        return NextResponse.json(
            {
                error:
                    "Missing playerId",
            },
            {
                status: 400,
            }
        );
    }

    const query = `
        SELECT
            playerId,
            player_name,
            is_active,

            current_team_id,
            team_code,
            team_name,
            team_logo,

            sweater_number,
            position,
            shoots_catches,

            height_inches,
            height_cm,
            weight_lbs,
            weight_kg,

            birth_date,
            age,
            birth_city,
            birth_country,
            nationality,

            draft_year,
            draft_team,
            draft_round,
            draft_pick_in_round,
            draft_overall,

            headshot,
            hero_image,

            top_100_all_time,
            hall_of_fame,

            rs_games,
            rs_goals,
            rs_assists,
            rs_points,
            rs_pim,
            rs_shots,
            rs_shooting_pct,
            rs_pp_goals,
            rs_pp_points,
            rs_sh_goals,
            rs_sh_points,
            rs_gw_goals,
            rs_ot_goals,
            rs_plus_minus,
            rs_faceoff_pct,
            rs_avg_toi,

            rs_games_started,
            rs_wins,
            rs_losses,
            rs_ot_losses,
            rs_ties,
            rs_goals_against,
            rs_goals_against_avg,
            rs_shots_against,
            rs_save_pct,
            rs_shutouts,
            rs_time_on_ice,

            po_games,
            po_goals,
            po_assists,
            po_points,
            po_pim,
            po_shots,
            po_shooting_pct,
            po_pp_goals,
            po_pp_points,
            po_sh_goals,
            po_sh_points,
            po_gw_goals,
            po_ot_goals,
            po_plus_minus,
            po_faceoff_pct,
            po_avg_toi,

            po_games_started,
            po_wins,
            po_losses,
            po_ot_losses,
            po_ties,
            po_goals_against,
            po_goals_against_avg,
            po_shots_against,
            po_save_pct,
            po_shutouts,
            po_time_on_ice

        FROM \`pacey32-agency.Player.PlayerProfile\`

        WHERE playerId = @playerId

        LIMIT 1
    `;

    const [rows] =
        await bigquery.query({
            query,
            params: {
                playerId:
                    Number(playerId),
            },
        });

    if (
        rows.length === 0
    ) {
        return NextResponse.json(
            {
                error:
                    "Player not found",
            },
            {
                status: 404,
            }
        );
    }

    return NextResponse.json(
        rows[0]
    );
}