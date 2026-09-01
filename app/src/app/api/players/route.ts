import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET() {
    const query = `
        SELECT
            playerID AS playerId,
            player_name AS name,
            triCode AS team,
            position,
            headshot_url
        FROM \`pacey32-agency.Player.PlayerDetail_NHLAPI\`
        WHERE playerID IS NOT NULL
          AND player_name IS NOT NULL
          AND rn = 1
        ORDER BY player_name
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
}