import crypto from "crypto";
import { cookies } from "next/headers";

import LoginForm from "./LoginForm";
import QASection from "./QASection";

export const metadata = {
    title: "Data Quality | Pacey32",
    robots: {
        index: false,
        follow: false,
    },
};

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

export default async function QAPage() {
    const cookieStore = await cookies();

    const session = cookieStore.get(
        "qa_session"
    )?.value;

    const sessionSecret =
        process.env.QA_SESSION_SECRET;

    const authenticated =
        Boolean(session) &&
        Boolean(sessionSecret) &&
        safeEqual(
            session!,
            sessionSecret!
        );

    if (!authenticated) {
        return <LoginForm />;
    }

    return (
        <main className="min-h-screen p-8">
            <h1 className="text-3xl font-bold">
                Pacey32 Data Quality
            </h1>

            <p className="mt-2 text-gray-500">
                NHL source and Agency data quality monitoring
            </p>

            <QASection
                title="NHL Source"
                project="nhl-pacey32-github"
                endpoint="/api/qa/source"
                layer="source"
            />

            <QASection
                title="Agency"
                project="pacey32-agency"
                endpoint="/api/qa/agency"
                layer="agency"
            />
        </main>
    );
}