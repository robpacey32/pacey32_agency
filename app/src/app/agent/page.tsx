"use client";

import { useRouter } from "next/navigation";
import {
    FormEvent,
    useEffect,
    useRef,
    useState,
} from "react";
import ReactMarkdown from "react-markdown";

type PlayerContext = {
    playerId: number;
    playerName: string;
    teamId: number | null;
    teamCode: string | null;
    teamName: string | null;
    position: string | null;
};

type TeamContext = {
    teamId: number;
    teamCode: string;
    teamName: string;
    venueLocation: string | null;
};

type CityContext = {
    cityName?: string;
    [key: string]: unknown;
};

type AgentContext = {
    player: PlayerContext | null;
    team: TeamContext | null;
    city: CityContext | null;
    awaiting: string | null;
};

type HistoryItem = {
    question: string;
    answer: string;
};

type ConversationItem = {
    question: string;
    answer: string | null;
};

type AgentResponse = {
    answer: string;
    context: AgentContext;
    estimatedMB: number | null;
};

type PlayerProfile = {
    playerId: number;
    player_name: string;
    current_team_id: number | null;
    team_code: string | null;
    team_name: string | null;
    team_logo: string | null;
    sweater_number: number | null;
    position: string | null;
    shoots_catches: string | null;
    height_inches: number | null;
    weight_lbs: number | null;
    age: number | null;
    headshot: string | null;
    hero_image: string | null;
};

type StoredAgentSession = {
    conversation: ConversationItem[];
    history: HistoryItem[];
    context: AgentContext;
};

const INITIAL_CONTEXT: AgentContext = {
    player: null,
    team: null,
    city: null,
    awaiting: null,
};

const SESSION_STORAGE_KEY =
    "pacey32-agent-session";

export default function AgentPage() {
    const [
        conversation,
        setConversation,
    ] = useState<ConversationItem[]>([]);

    const [
        history,
        setHistory,
    ] = useState<HistoryItem[]>([]);

    const [
        context,
        setContext,
    ] =
        useState<AgentContext>(
            INITIAL_CONTEXT
        );

    const [
        profile,
        setProfile,
    ] =
        useState<PlayerProfile | null>(
            null
        );

    const [
        input,
        setInput,
    ] = useState("");

    const [
        loading,
        setLoading,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState<string | null>(
        null
    );

    const [
        sessionLoaded,
        setSessionLoaded,
    ] = useState(false);

    const bottomRef =
        useRef<HTMLDivElement | null>(
            null
        );

    // ---------------------------------------------------------
    // RESTORE AGENT SESSION
    // ---------------------------------------------------------

    useEffect(() => {
        try {
            const stored =
                sessionStorage.getItem(
                    SESSION_STORAGE_KEY
                );

            if (stored) {
                const session =
                    JSON.parse(
                        stored
                    ) as StoredAgentSession;

                if (
                    Array.isArray(
                        session.conversation
                    )
                ) {
                    setConversation(
                        session.conversation
                    );
                }

                if (
                    Array.isArray(
                        session.history
                    )
                ) {
                    setHistory(
                        session.history
                    );
                }

                if (session.context) {
                    setContext(
                        session.context
                    );
                }
            }
        } catch (err) {
            console.error(
                "Failed to restore agent session:",
                err
            );

            sessionStorage.removeItem(
                SESSION_STORAGE_KEY
            );
        } finally {
            setSessionLoaded(true);
        }
    }, []);

    // ---------------------------------------------------------
    // SAVE AGENT SESSION
    // ---------------------------------------------------------

    useEffect(() => {
        if (!sessionLoaded) {
            return;
        }

        const session: StoredAgentSession =
            {
                conversation,
                history,
                context,
            };

        try {
            sessionStorage.setItem(
                SESSION_STORAGE_KEY,
                JSON.stringify(
                    session
                )
            );
        } catch (err) {
            console.error(
                "Failed to save agent session:",
                err
            );
        }
    }, [
        conversation,
        history,
        context,
        sessionLoaded,
    ]);

    // ---------------------------------------------------------
    // LOAD PLAYER PROFILE
    // ---------------------------------------------------------

    useEffect(() => {
        const playerId =
            context.player?.playerId;

        if (!playerId) {
            setProfile(null);
            return;
        }

        let cancelled = false;

        async function loadProfile() {
            try {
                const response =
                    await fetch(
                        `/api/player-profile?playerId=${playerId}`
                    );

                if (!response.ok) {
                    return;
                }

                const result =
                    (await response.json()) as
                        PlayerProfile;

                if (!cancelled) {
                    setProfile(
                        result
                    );
                }
            } catch (err) {
                console.error(
                    "Failed to load agent player profile:",
                    err
                );
            }
        }

        loadProfile();

        return () => {
            cancelled = true;
        };
    }, [context.player?.playerId]);

    // ---------------------------------------------------------
    // AUTO SCROLL
    // ---------------------------------------------------------

    useEffect(() => {
        if (!sessionLoaded) {
            return;
        }

        bottomRef.current?.scrollIntoView({
            behavior: "smooth",
        });
    }, [
        conversation,
        loading,
        sessionLoaded,
    ]);

    // ---------------------------------------------------------
    // SUBMIT
    // ---------------------------------------------------------

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        const question =
            input.trim();

        if (!question || loading) {
            return;
        }

        setInput("");
        setError(null);
        setLoading(true);

        setConversation(
            current => [
                ...current,
                {
                    question,
                    answer: null,
                },
            ]
        );

        try {
            const response =
                await fetch(
                    "/api/agent",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            question,
                            history,
                            context,
                        }),
                    }
                );

            const data =
                (await response.json()) as
                    | AgentResponse
                    | {
                          error?: string;
                      };

            if (!response.ok) {
                throw new Error(
                    "error" in data &&
                    data.error
                        ? data.error
                        : "The agent could not answer that question."
                );
            }

            const result =
                data as AgentResponse;

            setConversation(
                current => {
                    const next =
                        [...current];

                    next[
                        next.length - 1
                    ] = {
                        question,
                        answer:
                            result.answer,
                    };

                    return next;
                }
            );

            setHistory(
                current => [
                    ...current,
                    {
                        question,
                        answer:
                            result.answer,
                    },
                ]
            );

            setContext(
                result.context
            );
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Something went wrong.";

            setError(message);

            setConversation(
                current => {
                    const next =
                        [...current];

                    next[
                        next.length - 1
                    ] = {
                        question,
                        answer:
                            "I couldn't complete that analysis.",
                    };

                    return next;
                }
            );
        } finally {
            setLoading(false);
        }
    }

    // ---------------------------------------------------------
    // RESET
    // ---------------------------------------------------------

    function resetConversation() {
        sessionStorage.removeItem(
            SESSION_STORAGE_KEY
        );

        setConversation([]);
        setHistory([]);
        setContext(
            INITIAL_CONTEXT
        );
        setProfile(null);
        setInput("");
        setError(null);
    }

    // ---------------------------------------------------------
    // PAGE
    // ---------------------------------------------------------

    if (!sessionLoaded) {
        return (
            <main className="min-h-screen bg-slate-50" />
        );
    }

    return (
        <main className="min-h-screen bg-slate-950">
            <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">

                {/* Heading */}

                <div className="mb-7 flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Pacey32 Intelligence
                        </p>

                        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
                            Player & Agent Copilot
                        </h1>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                            Explore players,
                            destinations,
                            contracts, teams and
                            NHL cities through
                            Pacey32 data.
                        </p>
                    </div>

                    {conversation.length >
                        0 && (
                        <button
                            type="button"
                            onClick={
                                resetConversation
                            }
                            className="shrink-0 rounded-lg border border-slate-700 bg-transparent px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
                        >
                            New conversation
                        </button>
                    )}
                </div>

                {/* Player context */}

                {context.player && (
                    <PlayerContextPanel
                        player={
                            context.player
                        }
                        team={
                            context.team
                        }
                        profile={
                            profile
                        }
                    />
                )}

                {/* Main analysis area */}

                <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-50 shadow-xl">

                    {conversation.length ===
                        0 ? (
                        <EmptyState
                            setInput={
                                setInput
                            }
                        />
                    ) : (
                        <div className="divide-y divide-slate-100 px-5 sm:px-8">
                            {conversation.map(
                                (
                                    item,
                                    index
                                ) => (
                                    <AnalysisBlock
                                        key={
                                            index
                                        }
                                        item={
                                            item
                                        }
                                        context={
                                            context
                                        }
                                        isLatest={
                                            index ===
                                            conversation.length -
                                                1
                                        }
                                    />
                                )
                            )}

                            {loading && (
                                <div className="py-8">
                                    <div className="flex items-center gap-3 text-sm text-slate-400">
                                        <span className="flex gap-1">
                                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
                                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
                                        </span>

                                        Analysing Pacey32 data...
                                    </div>
                                </div>
                            )}

                            <div
                                ref={
                                    bottomRef
                                }
                            />
                        </div>
                    )}

                    {/* Error */}

                    {error && (
                        <div className="mx-5 mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-8">
                            {error}
                        </div>
                    )}

                    {/* Input */}

                    <form
                        onSubmit={
                            handleSubmit
                        }
                        className="border-t border-slate-200 bg-slate-100/80 p-4 sm:p-5"
                    >
                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-sm focus-within:border-slate-400">
                            <input
                                type="text"
                                value={
                                    input
                                }
                                onChange={event =>
                                    setInput(
                                        event
                                            .target
                                            .value
                                    )
                                }
                                placeholder={
                                    context.player
                                        ? `Ask about ${context.player.playerName}...`
                                        : "Ask a question..."
                                }
                                disabled={
                                    loading
                                }
                                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-50"
                            />

                            <button
                                type="submit"
                                disabled={
                                    loading ||
                                    !input.trim()
                                }
                                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                                Ask
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}

// ---------------------------------------------------------
// PLAYER CONTEXT
// ---------------------------------------------------------

function PlayerContextPanel({
    player,
    team,
    profile,
}: {
    player: PlayerContext;
    team: TeamContext | null;
    profile: PlayerProfile | null;
}) {
    return (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm">
            <div className="flex min-h-36 items-stretch">

                {/* Headshot */}

                <div className="relative flex w-32 shrink-0 items-end justify-center overflow-hidden bg-slate-900 sm:w-40">
                    {profile?.headshot ? (
                        <img
                            src={
                                profile.headshot
                            }
                            alt={
                                player.playerName
                            }
                            className="h-full w-full object-cover object-top"
                        />
                    ) : (
                        <div className="pb-6 text-3xl font-bold text-slate-700">
                            {initials(
                                player.playerName
                            )}
                        </div>
                    )}
                </div>

                {/* Player */}

                <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-5 sm:px-7">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Current player
                    </p>

                    <h2 className="mt-1 truncate text-xl font-bold text-white sm:text-2xl">
                        {
                            player.playerName
                        }
                    </h2>

                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
                        {profile?.sweater_number !=
                            null && (
                            <span>
                                #
                                {
                                    profile.sweater_number
                                }
                            </span>
                        )}

                        <span>
                            {player.position ??
                                "—"}
                        </span>

                        {profile?.age !=
                            null && (
                            <span>
                                Age{" "}
                                {
                                    profile.age
                                }
                            </span>
                        )}

                        {profile?.height_inches !=
                            null && (
                            <span>
                                {formatHeight(
                                    profile.height_inches
                                )}
                            </span>
                        )}

                        {profile?.weight_lbs !=
                            null && (
                            <span>
                                {
                                    profile.weight_lbs
                                }{" "}
                                lbs
                            </span>
                        )}
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                        {profile?.team_logo && (
                            <img
                                src={
                                    profile.team_logo
                                }
                                alt=""
                                className="h-6 w-6 object-contain"
                            />
                        )}

                        <span>
                            {player.teamName ??
                                player.teamCode}
                        </span>
                    </div>
                </div>

                {/* Destination */}

                {team &&
                    team.teamId !==
                        player.teamId && (
                    <div className="hidden min-w-64 border-l border-slate-800 px-7 py-5 sm:flex sm:flex-col sm:justify-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Exploring
                        </p>

                        <p className="mt-1 text-lg font-semibold text-white">
                            {
                                team.teamName
                            }
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                            {
                                team.venueLocation
                            }
                            {team.teamCode
                                ? ` · ${team.teamCode}`
                                : ""}
                        </p>
                    </div>
                )}
            </div>

            {team &&
                team.teamId !==
                    player.teamId && (
                <div className="border-t border-slate-800 px-5 py-3 sm:hidden">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Exploring
                    </span>

                    <span className="ml-2 text-sm font-medium text-white">
                        {team.teamName}
                    </span>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------
// ANALYSIS BLOCK
// ---------------------------------------------------------

function AnalysisBlock({
    item,
    context,
    isLatest,
}: {
    item: ConversationItem;
    context: AgentContext;
    isLatest: boolean;
}) {
    return (
        <section className="py-7 sm:py-8">

            {/* Question */}

            <div className="flex items-start gap-3">
                <div className="mt-1 h-6 w-1 shrink-0 rounded-full bg-slate-900" />

                <h2 className="text-lg font-semibold leading-7 text-slate-950">
                    {item.question}
                </h2>
            </div>

            {/* Answer */}

            {item.answer && (
                <div className="ml-4 mt-4 max-w-4xl">
                    <div className="agent-markdown text-[15px] leading-7 text-slate-600">
                        <ReactMarkdown
                            components={{
                                p: ({
                                    children,
                                }) => (
                                    <p className="mb-4 last:mb-0">
                                        {
                                            children
                                        }
                                    </p>
                                ),

                                strong: ({
                                    children,
                                }) => (
                                    <strong className="font-semibold text-slate-900">
                                        {
                                            children
                                        }
                                    </strong>
                                ),

                                ul: ({
                                    children,
                                }) => (
                                    <ul className="mb-4 ml-5 list-disc space-y-2">
                                        {
                                            children
                                        }
                                    </ul>
                                ),

                                ol: ({
                                    children,
                                }) => (
                                    <ol className="mb-4 ml-5 list-decimal space-y-2">
                                        {
                                            children
                                        }
                                    </ol>
                                ),

                                li: ({
                                    children,
                                }) => (
                                    <li className="pl-1">
                                        {
                                            children
                                        }
                                    </li>
                                ),

                                h1: ({
                                    children,
                                }) => (
                                    <h3 className="mb-3 mt-5 text-lg font-bold text-slate-950">
                                        {
                                            children
                                        }
                                    </h3>
                                ),

                                h2: ({
                                    children,
                                }) => (
                                    <h3 className="mb-3 mt-5 text-lg font-bold text-slate-950">
                                        {
                                            children
                                        }
                                    </h3>
                                ),

                                h3: ({
                                    children,
                                }) => (
                                    <h3 className="mb-2 mt-5 font-semibold text-slate-950">
                                        {
                                            children
                                        }
                                    </h3>
                                ),
                            }}
                        >
                            {item.answer}
                        </ReactMarkdown>
                    </div>

                    {isLatest && (
                        <ExploreLinks
                            context={
                                context
                            }
                            question={
                                item.question
                            }
                        />
                    )}
                </div>
            )}
        </section>
    );
}

// ---------------------------------------------------------
// EXPLORE LINKS
// ---------------------------------------------------------

function ExploreLinks({
    context,
    question,
}: {
    context: AgentContext;
    question: string;
}) {
    const router =
        useRouter();

    const text =
        question
            .trim()
            .toLowerCase();

    // Don't show Explore links when the
    // user has simply identified the player.
    const isPlayerIdentification =
        context.player &&
        (
            text ===
                context.player.playerName
                    .toLowerCase() ||
            text ===
                `i'm ${context.player.playerName.toLowerCase()}` ||
            text ===
                `i am ${context.player.playerName.toLowerCase()}` ||
            text ===
                `my name is ${context.player.playerName.toLowerCase()}`
        );

    if (isPlayerIdentification) {
        return null;
    }

    const links: {
        label: string;
        action: () => void;
    }[] = [];

    if (context.player) {
        links.push({
            label: "Your Analysis",
            action: () =>
                router.push(
                    `/player?playerId=${context.player!.playerId}`
                ),
        });
    }

    if (context.team) {
        links.push({
            label: `${context.team.teamName} Analysis`,
            action: () =>
                router.push(
                    `/team?team=${encodeURIComponent(
                        context.team!
                            .teamCode
                    )}`
                ),
        });

        links.push({
            label: `${
                context.team
                    .venueLocation ??
                context.team.teamName
            } Analysis`,
            action: () =>
                router.push(
                    `/city?team=${encodeURIComponent(
                        context.team!
                            .teamCode
                    )}`
                ),
        });
    }

    if (links.length === 0) {
        return null;
    }

    return (
        <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Explore in Pacey32
            </p>

            <div className="flex flex-wrap gap-2">
                {links.map(link => (
                    <button
                        key={
                            link.label
                        }
                        type="button"
                        onClick={
                            link.action
                        }
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950"
                    >
                        {link.label}

                        <span className="ml-2 text-slate-400">
                            →
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------
// EMPTY STATE
// ---------------------------------------------------------

function EmptyState({
    setInput,
}: {
    setInput: (
        value: string
    ) => void;
}) {
    const examples = [
        "Where is best for me?",
        "Compare two NHL teams",
        "What is it like to live in Detroit?",
        "Who are a player's closest comparables?",
    ];

    return (
        <div className="px-6 py-14 text-center sm:px-10 sm:py-20">
            <div className="mx-auto max-w-xl">
                <p className="text-lg font-semibold text-slate-900">
                    Start with a player,
                    team or question.
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                    Use natural language to
                    explore the data behind
                    players, destinations,
                    contracts and NHL cities.
                </p>

                <div className="mt-7 flex flex-wrap justify-center gap-2">
                    {examples.map(
                        example => (
                            <button
                                key={
                                    example
                                }
                                type="button"
                                onClick={() =>
                                    setInput(
                                        example
                                    )
                                }
                                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                            >
                                {
                                    example
                                }
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function initials(
    name: string
) {
    return name
        .split(" ")
        .map(part => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

function formatHeight(
    inches: number
) {
    const feet =
        Math.floor(inches / 12);

    const remaining =
        inches % 12;

    return `${feet}'${remaining}"`;
}