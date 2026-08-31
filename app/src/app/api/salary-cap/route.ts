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

        const summarySql = `
            SELECT s.*
            FROM \`pacey32-agency.Cap.TeamSalaryCapSummary\` s
            INNER JOIN \`pacey32-agency.Team.TeamList\` t
                ON s.team_name = t.fullName
            WHERE t.triCode = @team
            LIMIT 1
        `;

        const futureSql = `
            SELECT f.*
            FROM \`pacey32-agency.Cap.TeamSalaryCapFuture\` f
            INNER JOIN \`pacey32-agency.Team.TeamList\` t
                ON f.team_name = t.fullName
            WHERE t.triCode = @team
            ORDER BY f.year
        `;

        const contractsSql = `
            SELECT
                c.*,
                r.playerId,
                n.headshot_url

            FROM \`pacey32-agency.Cap.TeamSalaryCapContracts\` c

            INNER JOIN \`pacey32-agency.Team.TeamList\` t
                ON c.team = t.fullName

            LEFT JOIN \`pacey32-agency.Cap.PlayerReference\` r
                ON (
                    c.player_url = r.player_url
                    OR LOWER(TRIM(c.player)) = LOWER(TRIM(r.puckpedia_player))
                )

            LEFT JOIN \`pacey32-agency.Player.PlayerDetail_NHLAPI\` n
                ON r.playerId = n.playerID

            WHERE t.triCode = @team

            QUALIFY ROW_NUMBER() OVER (
                PARTITION BY c.player
                ORDER BY
                    CASE
                        WHEN c.player_url = r.player_url THEN 1
                        ELSE 2
                    END,
                    r.playerId
            ) = 1

            ORDER BY c.cap_hit DESC, c.player
        `;

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
                    UPPER(COALESCE(c.expiry_status, '')) = 'RFA'
                ) AS rfa_players,

                SUM(
                    CASE
                        WHEN UPPER(COALESCE(c.expiry_status, '')) = 'RFA'
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

            GROUP BY c.expiry_year
            ORDER BY c.expiry_year
        `;

        const positionCountsSql = `
            WITH latest AS (
                SELECT *
                FROM \`pacey32-agency.Cap.Player\`

                QUALIFY ROW_NUMBER() OVER (
                    PARTITION BY team_slug, player_url, year
                    ORDER BY scrape_datetime DESC
                ) = 1
            ),

            selected_team AS (
                SELECT p.*
                FROM latest p

                INNER JOIN \`pacey32-agency.Team.TeamList\` t
                    ON p.team_name = t.fullName

                WHERE t.triCode = @team
            ),

            current_year AS (
                SELECT MIN(year) AS year
                FROM selected_team
            ),

            team_counts AS (
                SELECT
                    team_slug,

                    COUNT(DISTINCT IF(
                        contract_section = 'Forwards',
                        player,
                        NULL
                    )) AS forward_players,

                    COUNT(DISTINCT IF(
                        contract_section = 'Defence',
                        player,
                        NULL
                    )) AS defense_players,

                    COUNT(DISTINCT IF(
                        contract_section = 'Goaltenders',
                        player,
                        NULL
                    )) AS goalie_players

                FROM latest

                WHERE year = (
                    SELECT year
                    FROM current_year
                )

                GROUP BY team_slug
            ),

            selected_counts AS (
                SELECT
                    COUNT(DISTINCT IF(
                        contract_section = 'Forwards',
                        player,
                        NULL
                    )) AS forward_players,

                    COUNT(DISTINCT IF(
                        contract_section = 'Defence',
                        player,
                        NULL
                    )) AS defense_players,

                    COUNT(DISTINCT IF(
                        contract_section = 'Goaltenders',
                        player,
                        NULL
                    )) AS goalie_players

                FROM selected_team

                WHERE year = (
                    SELECT year
                    FROM current_year
                )
            )

            SELECT
                s.forward_players,
                s.defense_players,
                s.goalie_players,

                AVG(t.forward_players) AS nhl_avg_forward_players,
                AVG(t.defense_players) AS nhl_avg_defense_players,
                AVG(t.goalie_players) AS nhl_avg_goalie_players

            FROM selected_counts s
            CROSS JOIN team_counts t

            GROUP BY
                s.forward_players,
                s.defense_players,
                s.goalie_players
        `;

        const [
            [summaryRows],
            [futureRows],
            [contractRows],
            [expiryRows],
            [positionCountRows],
        ] = await Promise.all([
            bigquery.query({
                query: summarySql,
                params: { team },
            }),
            bigquery.query({
                query: futureSql,
                params: { team },
            }),
            bigquery.query({
                query: contractsSql,
                params: { team },
            }),
            bigquery.query({
                query: expirySql,
                params: { team },
            }),
            bigquery.query({
                query: positionCountsSql,
                params: { team },
            }),
        ]);

        return NextResponse.json({
            team,

            summary:
                summaryRows.length > 0
                    ? summaryRows[0]
                    : null,

            future: futureRows,

            contracts: contractRows,

            expiries: expiryRows,

            positionCounts:
                positionCountRows.length > 0
                    ? positionCountRows[0]
                    : {
                          forward_players: 0,
                          defense_players: 0,
                          goalie_players: 0,
                          nhl_avg_forward_players: 0,
                          nhl_avg_defense_players: 0,
                          nhl_avg_goalie_players: 0,
                      },
        });
    } catch (error) {
        console.error(
            "Salary Cap API error:",
            error
        );

        return NextResponse.json(
            {
                error: "Failed to load salary cap data",
            },
            { status: 500 }
        );
    }
}