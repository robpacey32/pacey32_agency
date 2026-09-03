import { NextRequest, NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const player =
            request.nextUrl.searchParams.get("player");

        if (!player) {
            return NextResponse.json(
                { error: "player is required" },
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
            )

            SELECT
                player,
                contract_number,
                current_contract,

                season_from,
                season_to,
                cap_hit,
                term,
                total_value,

                signing_status,
                signing_age,
                expiry_status,
                expiry_year,
                expiry_age,
                signed_date,
                pct_cap_contract_start,
                signing_GM,
                signing_agent,
                offer_sheet,

                cap_hit_yr1,
                cap_hit_yr2,
                cap_hit_yr3,
                cap_hit_yr4,
                cap_hit_yr5,
                cap_hit_yr6,
                cap_hit_yr7,
                cap_hit_yr8,

                agent,
                ufa_year,
                estimated_career_earnings,

                scrape_datetime

            FROM latest
            WHERE rn = 1

            ORDER BY
                current_contract DESC,
                season_from DESC,
                contract_number DESC
        `;

        const [rows] = await bigquery.query({
            query,
            params: {
                player,
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