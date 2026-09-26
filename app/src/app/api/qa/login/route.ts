import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function safeEqual(
    supplied: string,
    expected: string
): boolean {
    const suppliedBuffer = Buffer.from(supplied);
    const expectedBuffer = Buffer.from(expected);

    if (suppliedBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        suppliedBuffer,
        expectedBuffer
    );
}

export async function POST(request: NextRequest) {
    const password = process.env.QA_PASSWORD;
    const sessionSecret = process.env.QA_SESSION_SECRET;

    if (!password || !sessionSecret) {
        console.error(
            "QA_PASSWORD or QA_SESSION_SECRET is not configured."
        );

        return NextResponse.json(
            {
                error: "QA authentication is not configured.",
            },
            {
                status: 500,
            }
        );
    }

    let body: { password?: string };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            {
                error: "Invalid request.",
            },
            {
                status: 400,
            }
        );
    }

    if (
        typeof body.password !== "string" ||
        !safeEqual(body.password, password)
    ) {
        return NextResponse.json(
            {
                error: "Invalid password.",
            },
            {
                status: 401,
            }
        );
    }

    const response = NextResponse.json({
        success: true,
    });

    response.cookies.set(
        "qa_session",
        sessionSecret,
        {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 60 * 60 * 12,
        }
    );

    return response;
}
