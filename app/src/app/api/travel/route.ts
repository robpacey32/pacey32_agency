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

        const summarySql = `
            WITH summary AS (
                SELECT
                    *,

                    AVG(average_leg_km)
                        OVER (PARTITION BY season)
                        AS nhl_avg_average_leg_km,

                    AVG(median_leg_km)
                        OVER (PARTITION BY season)
                        AS nhl_avg_median_leg_km,

                    AVG(travel_legs)
                        OVER (PARTITION BY season)
                        AS nhl_avg_travel_legs,

                    AVG(legs_over_500km)
                        OVER (PARTITION BY season)
                        AS nhl_avg_legs_over_500km,

                    AVG(legs_over_1000km)
                        OVER (PARTITION BY season)
                        AS nhl_avg_legs_over_1000km,

                    AVG(legs_over_2000km)
                        OVER (PARTITION BY season)
                        AS nhl_avg_legs_over_2000km,

                    AVG(legs_over_3000km)
                        OVER (PARTITION BY season)
                        AS nhl_avg_legs_over_3000km

                FROM \`pacey32-agency.Team.Travel_3_LastSeasonSummary\`
            )

            SELECT *
            FROM summary
            WHERE team_abbrev = @team
            LIMIT 1
        `;

        const historySql = `
            SELECT *
            FROM \`pacey32-agency.Team.Travel_4_FiveYearSummary\`
            WHERE team_abbrev = @team
            ORDER BY season DESC
        `;

        const legsSql = `
            SELECT
                season,
                leg_sequence,
                leg_type,
                game_id,

                FORMAT_DATE(
                    '%Y-%m-%d',
                    game_date
                ) AS game_date,

                opponent_team_abbrev,
                opponent_team_name,
                is_home,
                is_away,
                road_trip_id,

                travel_from_city,
                travel_from_state_province,
                travel_from_country,
                travel_from_latitude,
                travel_from_longitude,

                travel_to_city,
                travel_to_state_province,
                travel_to_country,
                travel_to_latitude,
                travel_to_longitude,

                travel_reason,
                travel_km,
                travel_miles,
                involves_travel,

                team_home_city,
                team_home_latitude,
                team_home_longitude

            FROM \`pacey32-agency.Team.Travel_2_Legs\`

            WHERE team_abbrev = @team
              AND involves_travel = TRUE

            ORDER BY
                season DESC,
                leg_sequence
        `;

        const [
            [summaryRows],
            [historyRows],
            [legRows],
        ] = await Promise.all([
            bigquery.query({
                query: summarySql,
                params: {
                    team: teamCode,
                },
            }),

            bigquery.query({
                query: historySql,
                params: {
                    team: teamCode,
                },
            }),

            bigquery.query({
                query: legsSql,
                params: {
                    team: teamCode,
                },
            }),
        ]);

        const summary =
            summaryRows[0] ?? null;

        if (!summary) {
            return NextResponse.json(
                {
                    error:
                        "Travel data not found",
                },
                {
                    status: 404,
                }
            );
        }

        const currentSeason =
            Number(summary.season);

        const legs =
            legRows.filter(
                (row) =>
                    Number(row.season) ===
                    currentSeason
            );

        return NextResponse.json({
            team: teamCode,
            summary,
            history: historyRows,
            legs,
        });

    } catch (error) {
        console.error(
            "Travel API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to load travel data",
            },
            {
                status: 500,
            }
        );
    }
}