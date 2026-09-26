import { NextRequest, NextResponse } from "next/server";

import { isQAAuthenticated } from "@/lib/qa/auth";

export async function GET(
    request: NextRequest
) {
    if (!isQAAuthenticated(request)) {
        return NextResponse.json(
            {
                error: "Unauthorized",
            },
            {
                status: 401,
            }
        );
    }

    return NextResponse.json({
        authenticated: true,
    });
}
