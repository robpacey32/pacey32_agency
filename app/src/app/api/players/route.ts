import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET() {
    const query = `
        SELECT
            playerId,
            CONCAT(firstName, ' ', lastName) AS name,
            currentTeamAbbrev AS team
        FROM \`nhl-pacey32-github.NHL_FromGithub.PlayerLanding\`
        WHERE playerId IS NOT NULL
          AND firstName IS NOT NULL
          AND lastName IS NOT NULL
          AND isActive = TRUE
        ORDER BY lastName, firstName
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
}