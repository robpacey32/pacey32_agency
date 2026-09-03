import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET() {
    const query = `
        WITH latest_season AS (
            SELECT MAX(season) AS season
            FROM \`pacey32-agency.Player.PlayerDetail_NHLAPI\`
        )

        SELECT
            playerID AS playerId,
            player_name AS name,
            triCode AS team,

            CASE
                WHEN position = 'L' THEN 'LW'
                WHEN position = 'R' THEN 'RW'
                ELSE position
            END AS position,

            headshot_url

        FROM \`pacey32-agency.Player.PlayerDetail_NHLAPI\`

        WHERE playerID IS NOT NULL
          AND player_name IS NOT NULL
          AND rn = 1
          AND season = (
              SELECT season
              FROM latest_season
          )

        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY playerID
            ORDER BY RunDate DESC
        ) = 1

        ORDER BY player_name
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
}