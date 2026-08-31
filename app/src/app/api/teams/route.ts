import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET() {
    const query = `
        SELECT
            triCode AS code,
            fullName AS name,
            conferenceName AS conference,
            divisionName AS division
        FROM \`pacey32-agency.Team.TeamList\`
        WHERE triCode IS NOT NULL
          AND fullName IS NOT NULL
          AND conferenceName IS NOT NULL
          AND divisionName IS NOT NULL
        ORDER BY
            CASE conferenceName
                WHEN 'Eastern' THEN 1
                WHEN 'Western' THEN 2
                ELSE 3
            END,
            divisionName,
            fullName
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
}