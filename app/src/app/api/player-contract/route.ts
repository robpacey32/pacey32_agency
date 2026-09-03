import { NextRequest, NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const player =
            request.nextUrl.searchParams.get("player");

        const playerId =
            request.nextUrl.searchParams.get("playerId");

        if (!player) {
            return NextResponse.json(
                { error: "player is required" },
                { status: 400 }
            );
        }

        if (!playerId) {
            return NextResponse.json(
                { error: "playerId is required" },
                { status: 400 }
            );
        }

        const query = `
            WITH latest AS (
                SELECT
                    *,
                    ROW_NUMBER() OVER (
                        PARTITION BY player, contract_number
                        ORDER BY scrape_datetime DESC
                    ) AS rn
                FROM \`pacey32-agency.Cap.PlayerDetail\`
                WHERE player = @player
            ),

            player_contracts AS (
                SELECT
                    playerId,
                    signingDate,
                    signingTeam,
                    startSeason,
                    expirySeason
                FROM \`pacey32-agency.Comparison.07_PlayerContracts\`
                WHERE playerId = @playerId
            )

            SELECT
                p.player,
                p.contract_number,
                p.current_contract,

                COALESCE(p.season_from, c.startSeason) AS season_from,
                COALESCE(p.season_to, c.expirySeason) AS season_to,
                p.cap_hit,
                p.term,
                p.total_value,

                p.signing_status,
                p.signing_age,

                p.expiry_status,
                p.expiry_year,
                p.expiry_age,

                p.signed_date,
                p.pct_cap_contract_start,

                p.signing_GM,
                p.signing_agent,
                p.offer_sheet,

                p.cap_hit_yr1,
                p.cap_hit_yr2,
                p.cap_hit_yr3,
                p.cap_hit_yr4,
                p.cap_hit_yr5,
                p.cap_hit_yr6,
                p.cap_hit_yr7,
                p.cap_hit_yr8,

                p.agent,
                p.ufa_year,
                p.estimated_career_earnings,

                c.signingTeam AS signing_team,
                t.triCode AS signing_team_code,
                t.home_logo AS signing_team_logo,

                p.scrape_datetime

            FROM latest p

            LEFT JOIN player_contracts c
                ON p.signed_date = c.signingDate

            LEFT JOIN \`pacey32-agency.Team.TeamList\` t
                ON c.signingTeam = t.fullName

            WHERE p.rn = 1

            ORDER BY
                p.current_contract DESC,
                p.season_from DESC,
                p.contract_number DESC
        `;

        const [rows] = await bigquery.query({
            query,
            params: {
                player,
                playerId: Number(playerId),
            },
        });

        return NextResponse.json({
            player,
            contracts: rows,
        });

    } catch (error) {
        console.error(
            "Player contract API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to load player contract",
            },
            { status: 500 }
        );
    }
}