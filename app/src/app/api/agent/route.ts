import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { bigquery } from "@/lib/bigquery";
import schema from "@/data/llm/schema.json";
import semantics from "@/data/llm/semantics.json";

// ---------------------------------------------------------
// CONFIG
// ---------------------------------------------------------

const PROJECT_ID = "pacey32-agency";

const MAX_BYTES_PROCESSED =
    100 * 1024 * 1024;

const MAX_BYTES_BILLED =
    String(100 * 1024 * 1024);

const MAX_HISTORY = 5;

const SQL_MODELS = [
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
];

const ANSWER_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-3.6-flash",
];

// ---------------------------------------------------------
// TYPES
// ---------------------------------------------------------

type HistoryItem = {
    question: string;
    answer: string;
};

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
    cityName: string;
};

type AgentContext = {
    player: PlayerContext | null;
    team: TeamContext | null;
    city: CityContext | null;
    awaiting: "player" | null;
};

type AgentRequest = {
    question: string;
    history?: HistoryItem[];
    context?: AgentContext;
};

type SchemaTable = {
    table?: string;
    full_table_id?: string;
    description?: string | null;
    columns?: unknown[];
};

type SemanticRelationship = {
    from: string;
    to: string;
    type?: string;
};

type SemanticData = {
    general?: unknown;
    context_requirements?: unknown;
    relationships?: SemanticRelationship[];
    tables?: Record<string, unknown>;
    [key: string]: unknown;
};

// ---------------------------------------------------------
// GEMINI CLIENT
// ---------------------------------------------------------

function getGeminiClient() {
    const apiKey =
        process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error(
            "GEMINI_API_KEY is not configured."
        );
    }

    return new GoogleGenAI({
        apiKey,
    });
}

// ---------------------------------------------------------
// SESSION CONTEXT
// ---------------------------------------------------------

function newContext(): AgentContext {
    return {
        player: null,
        team: null,
        city: null,
        awaiting: null,
    };
}

function normaliseContext(
    context?: AgentContext
): AgentContext {
    if (!context) {
        return newContext();
    }

    return {
        player: context.player ?? null,
        team: context.team ?? null,
        city: context.city ?? null,
        awaiting: context.awaiting ?? null,
    };
}

function formatContext(
    context: AgentContext
) {
    const parts: string[] = [];

    const player = context.player;
    const team = context.team;
    const city = context.city;

    if (player) {
        parts.push(
            `Current player: ` +
            `${player.playerName} ` +
            `(playerId ${player.playerId}, ` +
            `position ${player.position})`
        );
    }

    if (team) {
        parts.push(
            `Team currently being discussed: ` +
            `${team.teamName} ` +
            `(${team.teamCode}, ` +
            `teamId ${team.teamId})`
        );
    }

    if (city) {
        parts.push(
            `Current city: ${city.cityName}`
        );
    }

    if (!parts.length) {
        return "No established session context.";
    }

    return parts.join("\n");
}

// ---------------------------------------------------------
// FORMAT CONVERSATION HISTORY
// ---------------------------------------------------------

function formatHistory(
    history: HistoryItem[]
) {
    if (!history.length) {
        return "No previous conversation.";
    }

    const recentHistory =
        history.slice(-MAX_HISTORY);

    return recentHistory
        .map(
            (item) => `
USER:
${item.question}

ASSISTANT:
${item.answer}
`
        )
        .join("\n");
}

// ---------------------------------------------------------
// TEMPORARY GEMINI ERROR CHECK
// ---------------------------------------------------------

function isTemporaryError(
    error: unknown
) {
    const text =
        error instanceof Error
            ? error.message.toLowerCase()
            : String(error).toLowerCase();

    return (
        text.includes("429") ||
        text.includes(
            "resource_exhausted"
        ) ||
        text.includes("quota exceeded") ||
        text.includes("503") ||
        text.includes("504") ||
        text.includes("timeout") ||
        text.includes("timed out") ||
        text.includes(
            "deadline_exceeded"
        ) ||
        text.includes("deadline expired")
    );
}

// ---------------------------------------------------------
// PLAYER REQUIREMENT
// ---------------------------------------------------------

function requiresPlayer(
    question: string
) {
    const text =
        question.toLowerCase().trim();

    const patterns = [
        /\bme\b/,
        /\bmy\b/,
        /\bmyself\b/,
        /\bfor me\b/,
        /\bafford me\b/,
        /\bmy position\b/,
        /\bmy contract\b/,
        /\bmy career\b/,
        /\bmy comparables\b/,
        /\bwhere should i\b/,
    ];

    return patterns.some(
        (pattern) => pattern.test(text)
    );
}

// ---------------------------------------------------------
// PLAYER LOOKUP
// ---------------------------------------------------------

async function findPlayer(
    playerName: string
): Promise<PlayerContext | null> {
    const [rows] =
        (await bigquery.query({
            query: `
                SELECT
                    playerId,
                    playerName,
                    teamId,
                    teamCode,
                    teamName,
                    position
                FROM \`${PROJECT_ID}.LLM.Player\`
                WHERE LOWER(playerName) =
                    LOWER(@playerName)
                LIMIT 2
            `,
            params: {
                playerName,
            },
            maximumBytesBilled:
                MAX_BYTES_BILLED,
        })) as [any[], any];

    if (rows.length !== 1) {
        return null;
    }

    const row = rows[0];

    return {
        playerId: Number(row.playerId),
        playerName:
            String(row.playerName),
        teamId:
            row.teamId == null
                ? null
                : Number(row.teamId),
        teamCode:
            row.teamCode == null
                ? null
                : String(row.teamCode),
        teamName:
            row.teamName == null
                ? null
                : String(row.teamName),
        position:
            row.position == null
                ? null
                : String(row.position),
    };
}

// ---------------------------------------------------------
// PLAYER INTRODUCTION
// ---------------------------------------------------------

function extractPlayerIntroduction(
    question: string
) {
    const text = question.trim();

    const patterns = [
        /^i['’]?m\s+(.+?)[.!]?$/i,
        /^i am\s+(.+?)[.!]?$/i,
        /^my name is\s+(.+?)[.!]?$/i,
    ];

    for (const pattern of patterns) {
        const match =
            text.match(pattern);

        if (match) {
            return match[1].trim();
        }
    }

    return null;
}

// ---------------------------------------------------------
// TEAM LOOKUP
// ---------------------------------------------------------

let teamCache:
    Promise<TeamContext[]> | null =
    null;

async function getAllTeams() {
    if (teamCache) {
        return teamCache;
    }

    teamCache = (async () => {
        const [rows] =
            (await bigquery.query({
                query: `
                    SELECT
                        teamId,
                        teamCode,
                        teamName,
                        venueLocation
                    FROM \`${PROJECT_ID}.LLM.Team\`
                `,
                maximumBytesBilled:
                    MAX_BYTES_BILLED,
            })) as [any[], any];

        return rows.map(
            (row): TeamContext => ({
                teamId:
                    Number(row.teamId),
                teamCode:
                    String(row.teamCode),
                teamName:
                    String(row.teamName),
                venueLocation:
                    row.venueLocation == null
                        ? null
                        : String(
                              row.venueLocation
                          ),
            })
        );
    })();

    try {
        return await teamCache;
    } catch (error) {
        teamCache = null;
        throw error;
    }
}

function escapeRegex(
    value: string
) {
    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}

async function findTeamInText(
    text: string
): Promise<TeamContext | null> {
    const textLower =
        text.toLowerCase();

    const teams =
        await getAllTeams();

    const matches:
        TeamContext[] = [];

    for (const team of teams) {
        const teamName =
            (
                team.teamName ?? ""
            ).toLowerCase();

        const teamCode =
            (
                team.teamCode ?? ""
            ).toLowerCase();

        const homeLocation =
            (
                team.venueLocation ?? ""
            ).toLowerCase();

        // Full team name.
        if (
            teamName &&
            textLower.includes(teamName)
        ) {
            matches.push(team);
            continue;
        }

        // Home location.
        if (
            homeLocation &&
            new RegExp(
                `\\b${escapeRegex(
                    homeLocation
                )}\\b`,
                "i"
            ).test(textLower)
        ) {
            matches.push(team);
            continue;
        }

        // Nickname.
        if (
            teamName &&
            homeLocation
        ) {
            let nickname =
                teamName;

            if (
                nickname.startsWith(
                    `${homeLocation} `
                )
            ) {
                nickname =
                    nickname.slice(
                        homeLocation.length +
                            1
                    );

                if (
                    nickname.length >= 4 &&
                    textLower.includes(
                        nickname
                    )
                ) {
                    matches.push(team);
                    continue;
                }
            }
        }

        // Team code.
        if (
            teamCode &&
            teamCode.length >= 3 &&
            new RegExp(
                `\\b${escapeRegex(
                    teamCode
                )}\\b`,
                "i"
            ).test(textLower)
        ) {
            matches.push(team);
        }
    }

    const uniqueMatches =
        new Map<
            number,
            TeamContext
        >();

    for (const team of matches) {
        uniqueMatches.set(
            team.teamId,
            team
        );
    }

    const result =
        Array.from(
            uniqueMatches.values()
        );

    if (result.length === 1) {
        return result[0];
    }

    return null;
}

// ---------------------------------------------------------
// HANDLE SESSION CONTEXT
// ---------------------------------------------------------

async function handleContext(
    question: string,
    context: AgentContext
): Promise<string | null> {
    // User is answering player clarification.
    if (
        context.awaiting ===
        "player"
    ) {
        const player =
            await findPlayer(question);

        if (!player) {
            return (
                "I couldn't identify that NHL player. " +
                "Which player are you or do you represent?"
            );
        }

        context.player = player;
        context.awaiting = null;

        return (
            `Got it — I'll treat you as ` +
            `${player.playerName}.`
        );
    }

    // Explicit player introduction.
    const playerName =
        extractPlayerIntroduction(
            question
        );

    if (playerName) {
        const player =
            await findPlayer(
                playerName
            );

        if (player) {
            context.player =
                player;

            context.awaiting =
                null;
        }

        // Preserve Python behaviour:
        // continue through normal SQL flow.
    }

    // Player required but unknown.
    if (
        requiresPlayer(question) &&
        !context.player
    ) {
        context.awaiting =
            "player";

        return (
            "Which player are you or do you represent?"
        );
    }

    // Explicit team reference.
    const team =
        await findTeamInText(
            question
        );

    if (team) {
        context.team = team;
    }

    return null;
}

// ---------------------------------------------------------
// RELEVANT TABLE ROUTER
// ---------------------------------------------------------

function getRelevantTables(
    question: string,
    history: HistoryItem[]
) {
    const text = (
        formatHistory(history) +
        "\n" +
        question
    ).toLowerCase();

    const tables =
        new Set<string>([
            "LLM.Player",
        ]);

    if (
        [
            "best for me",
            "best team",
            "where should",
            "destination",
            "fit",
            "afford me",
            "afford him",
            "afford",
        ].some((term) =>
            text.includes(term)
        )
    ) {
        tables.add(
            "LLM.PlayerTeamFit"
        );
        tables.add(
            "LLM.PlayerCurrentContract"
        );
        tables.add(
            "LLM.TeamCap"
        );
    }

    if (
        [
            "comparable",
            "comparables",
            "similar player",
            "similar players",
        ].some((term) =>
            text.includes(term)
        )
    ) {
        tables.add(
            "LLM.PlayerComparables"
        );
    }

    if (
        [
            "points",
            "goals",
            "assists",
            "ppg",
            "performance",
            "production",
            "trajectory",
            "toi",
        ].some((term) =>
            text.includes(term)
        )
    ) {
        tables.add(
            "LLM.PlayerPerformance"
        );
    }

    if (
        [
            "contract",
            "cap hit",
            "aav",
            "salary",
            "agent",
            "term",
            "expiry",
        ].some((term) =>
            text.includes(term)
        )
    ) {
        tables.add(
            "LLM.PlayerCurrentContract"
        );
        tables.add(
            "LLM.PlayerContracts"
        );
    }

    if (
        [
            "team",
            "roster",
            "depth",
            "lineup",
            "position",
        ].some((term) =>
            text.includes(term)
        )
    ) {
        tables.add(
            "LLM.Team"
        );
        tables.add(
            "LLM.TeamRoster"
        );
    }

    if (
        [
            "coach",
            "general manager",
            " gm ",
            "owner",
            "captain",
            "organisation",
            "organization",
            "ahl",
        ].some((term) =>
            text.includes(term)
        )
    ) {
        tables.add(
            "LLM.TeamOrganisation"
        );
    }

    if (
        [
            "travel",
            "miles",
            "road trip",
        ].some((term) =>
            text.includes(term)
        )
    ) {
        tables.add(
            "LLM.TeamTravel"
        );
    }

    if (
        [
            "tax",
            "take home",
            "take-home",
        ].some((term) =>
            text.includes(term)
        )
    ) {
        tables.add(
            "LLM.CityTax"
        );
    }

    if (
        [
            "cost of living",
            "cost to live",
            "expensive",
            "cheap",
            "affordability",
            "housing",
        ].some((term) =>
            text.includes(term)
        )
    ) {
        tables.add(
            "LLM.CityCostOfLiving"
        );
    }

    if (
        [
            "climate",
            "weather",
            "sun",
            "sunshine",
            "temperature",
            "snow",
        ].some((term) =>
            text.includes(term)
        )
    ) {
        tables.add(
            "LLM.CityClimate"
        );
    }

    if (
        [
            "city",
            "where is",
            "location",
            "live in",
            "living in",
        ].some((term) =>
            text.includes(term)
        )
    ) {
        tables.add(
            "LLM.City"
        );
    }

    if (
        [
            "live in",
            "living in",
            "like to live",
            "lifestyle",
            "quality of life",
            "what's it like",
            "what is it like",
        ].some((term) =>
            text.includes(term)
        )
    ) {
        tables.add(
            "LLM.City"
        );
        tables.add(
            "LLM.CityClimate"
        );
        tables.add(
            "LLM.CityCostOfLiving"
        );
        tables.add(
            "LLM.CityTax"
        );
    }

    return tables;
}

// ---------------------------------------------------------
// BUILD SQL PROMPT
// ---------------------------------------------------------

function buildSqlPrompt(
    question: string,
    history: HistoryItem[],
    context: AgentContext
) {
    const conversation =
        formatHistory(history);

    const relevantTables =
        getRelevantTables(
            question,
            history
        );

    const typedSchema =
        schema as SchemaTable[];

    const typedSemantics =
        semantics as SemanticData;

    const filteredSchema =
        typedSchema.filter(
            (table) =>
                table.table &&
                relevantTables.has(
                    table.table
                )
        );

    const filteredRelationships =
        (
            typedSemantics
                .relationships ?? []
        ).filter(
            (relationship) =>
                Array.from(
                    relevantTables
                ).some(
                    (table) =>
                        relationship.from.includes(
                            table
                        ) ||
                        relationship.to.includes(
                            table
                        )
                )
        );

    const filteredTables =
        Object.fromEntries(
            Object.entries(
                typedSemantics.tables ??
                    {}
            ).filter(([table]) =>
                relevantTables.has(
                    table
                )
            )
        );

    const filteredSemantics = {
        ...typedSemantics,
        relationships:
            filteredRelationships,
        tables: filteredTables,
    };

    const sessionContext =
        formatContext(context);

    return `
You are an expert BigQuery SQL generator for an NHL analytics database.

Your task is to convert the user's latest question into valid Google BigQuery SQL.

RULES:

- Return ONLY valid Google BigQuery SQL.
- Do not include markdown fences, explanations or commentary.
- Generate SELECT or WITH queries only.
- Use only tables and columns supplied in the database schema.
- Never invent table names or column names.
- Prefer LLM semantic views over underlying source tables.

- ESTABLISHED SESSION CONTEXT is authoritative. Never replace, reinterpret or infer a different playerId, teamId or city when one is explicitly established there.
- If ESTABLISHED SESSION CONTEXT contains a team currently being discussed, use that team's exact teamId for contextual references such as "there", "that team", "them", "their", "what about the travel?" or similar follow-up questions.
- Never infer a different teamId from conversation history when an explicit teamId exists in ESTABLISHED SESSION CONTEXT.
- The player's current NHL team is separate from the team currently being discussed. Do not substitute the player's current team for the discussed team.
- When comparing the discussed team with the player's current team, use the discussed team's exact teamId as the destination and the player's exact teamId as the current team.
- Use conversation history to resolve other references such as "him", "there", "that team" or "that city".
- Reuse an established player, team or city from session context when appropriate.
- Use canonical playerId and teamId when available.

- Prefer filtering a target table directly when it already contains the required player or team identifier.
- Do not add unnecessary joins.
- When a query joins multiple tables, always qualify every selected, filtered, grouped and ordered column with its table alias.
- Never use an unqualified column name in a multi-table query.
- Do not join LLM.Team solely to identify or filter a team when the target table already contains teamId, teamCode or teamName.
- Select only columns needed to answer the question.
- Do not create arbitrary scores, weights, similarity thresholds or rankings.
- Lower rank values are better unless the semantic definitions explicitly state otherwise.

- IMPORTANT: For questions about "my position", use ONLY the established player's position from ESTABLISHED SESSION CONTEXT.
- Never add or infer additional positions when answering a "my position" question.
- For example, if the established player's position is C, match C only. Do NOT also match LW or RW.
- LLM.TeamRoster.position may contain comma-separated positions such as "C,LW" or "C,RW".
- A multi-position roster player counts as a match when the established player's position appears in that comma-separated list.
- Use SPLIT(position, ',') and IN UNNEST(...) for this matching.
- Example: if the established player's position is C, use exactly: 'C' IN UNNEST(SPLIT(position, ','))
- Do not use POSITION() for positional matching.
- For current positional competition, always filter LLM.TeamRoster.isDepthChart = TRUE.

- For player-specific destination questions such as "Where is best for me?", "Where should I go?", "Which teams fit me?" or similar:
  - Use LLM.PlayerTeamFit as the primary source.
  - Treat the question as a multi-dimensional destination comparison.
  - For broad player-specific destination searches such as "Where is best for me?", "Where should I go?" or "Which teams fit me?", unless the user explicitly asks to consider teams requiring roster or cap-management moves, filter to canAffordCurrent = TRUE.
    - When the user explicitly names or establishes a specific destination team, NEVER filter that destination out using canAffordCurrent or canAffordProjected.
    - For a specific destination, return canAffordCurrent, canAffordProjected, currentCapGap and projectedCapGap and explain the cap situation as part of the analysis.
    - A negative cap gap or canAffordCurrent = FALSE means the destination does not currently have enough cap space without roster or cap-management moves. It does not mean there is no matching data or that the destination is impossible.
  - Return currentCapGap, playersAtPosition, incomeTaxRank, affordabilityRank, sunshineRank, distanceRank and roadTripRank when available.
  - Do not select a single best team unless the user has supplied priorities or weighting.
  - Do not create an overall score or arbitrary weighting.

DATABASE SCHEMA:

${JSON.stringify(
    filteredSchema,
    null,
    2
)}

SEMANTIC DEFINITIONS:

${JSON.stringify(
    filteredSemantics,
    null,
    2
)}

ESTABLISHED SESSION CONTEXT:

${sessionContext}

CONVERSATION HISTORY:

${conversation}

LATEST USER QUESTION:

${question}
`;
}

// ---------------------------------------------------------
// GENERATE SQL
// ---------------------------------------------------------

async function generateSql(
    question: string,
    history: HistoryItem[],
    context: AgentContext
) {
    const prompt =
        buildSqlPrompt(
            question,
            history,
            context
        );

    const client =
        getGeminiClient();

    let lastError:
        unknown = null;

    for (
        const model of SQL_MODELS
    ) {
        try {
            console.log(
                `[Agent] Generating SQL with ${model}`
            );

            const response =
                await client.models.generateContent(
                    {
                        model,
                        contents:
                            prompt,
                    }
                );

            const text =
                response.text?.trim();

            if (!text) {
                throw new Error(
                    `${model} returned an empty response.`
                );
            }

            return text;
        } catch (error) {
            lastError = error;

            if (
                !isTemporaryError(
                    error
                )
            ) {
                throw error;
            }

            console.warn(
                `[Agent] ${model} unavailable; trying fallback.`
            );
        }
    }

    console.error(
        "[Agent] All SQL models unavailable:",
        lastError
    );

    throw new Error(
        "All Gemini models are temporarily unavailable."
    );
}

// ---------------------------------------------------------
// VALIDATE SQL
// ---------------------------------------------------------

function validateSql(
    sql: string
) {
    let cleaned =
        sql.trim();

    cleaned =
        cleaned.replace(
            /^```(?:sql)?\s*/i,
            ""
        );

    cleaned =
        cleaned.replace(
            /\s*```$/,
            ""
        );

    cleaned =
        cleaned.trim();

    if (!cleaned) {
        throw new Error(
            "Blocked: Gemini returned empty SQL."
        );
    }

    cleaned =
        cleaned
            .replace(/;+$/, "")
            .trim();

    const firstWord =
        cleaned
            .split(/\s+/)[0]
            .toUpperCase();

    if (
        firstWord !== "SELECT" &&
        firstWord !== "WITH"
    ) {
        throw new Error(
            "Blocked: only SELECT queries are allowed."
        );
    }

    if (
        cleaned.includes(";")
    ) {
        throw new Error(
            "Blocked: multiple SQL statements are not allowed."
        );
    }

    const blockedWords = [
        "INSERT",
        "UPDATE",
        "DELETE",
        "DROP",
        "CREATE",
        "ALTER",
        "MERGE",
        "TRUNCATE",
        "GRANT",
        "REVOKE",
    ];

    const upperSql =
        cleaned.toUpperCase();

    for (
        const word of blockedWords
    ) {
        const pattern =
            new RegExp(
                `\\b${word}\\b`
            );

        if (
            pattern.test(
                upperSql
            )
        ) {
            throw new Error(
                `Blocked unsafe SQL keyword: ${word}`
            );
        }
    }

    return cleaned;
}

// ---------------------------------------------------------
// BIGQUERY DRY RUN
// ---------------------------------------------------------

async function dryRunQuery(
    sql: string
) {
    const [job] =
        await bigquery.createQueryJob({
            query: sql,
            dryRun: true,
            useQueryCache: false,
        });

    const metadata =
        job.metadata;

    const rawBytes =
        metadata?.statistics
            ?.totalBytesProcessed ??
        metadata?.statistics?.query
            ?.totalBytesProcessed ??
        "0";

    return Number(rawBytes);
}

// ---------------------------------------------------------
// EXECUTE BIGQUERY
// ---------------------------------------------------------

async function executeQuery(
    sql: string
) {
    const [rows] =
        (await bigquery.query({
            query: sql,
            maximumBytesBilled:
                MAX_BYTES_BILLED,
        })) as [any[], any];

    return rows;
}

// ---------------------------------------------------------
// SERIALISE BIGQUERY RESULTS
// ---------------------------------------------------------

function serialiseRows(
    rows: unknown[]
) {
    return JSON.parse(
        JSON.stringify(
            rows,
            (_key, value) => {
                if (
                    typeof value ===
                    "bigint"
                ) {
                    return Number(
                        value
                    );
                }

                return value;
            }
        )
    );
}

// ---------------------------------------------------------
// GENERATE NATURAL-LANGUAGE ANSWER
// ---------------------------------------------------------

async function generateAnswer(
    question: string,
    rows: unknown[],
    history: HistoryItem[],
    context: AgentContext
) {
    const resultData =
        serialiseRows(rows);

    const conversation =
        formatHistory(history);

    const sessionContext =
        formatContext(context);

    const prompt = `
You are an NHL analytics assistant.

Answer the user's latest question using ONLY the query results provided.

RULES:

- Give a concise, natural-language answer.
- Do not mention SQL, BigQuery, databases or the query.
- Do not invent information.
- Do not use outside NHL knowledge.
- Preserve all numbers accurately.
- Treat ESTABLISHED SESSION CONTEXT as authoritative for the current player and the team or city currently being discussed.
- Do not confuse the team currently being discussed with the player's actual current NHL team.
- Use the conversation history to understand the context of the question.
- The query results are the authoritative source for the answer.
- If the results do not contain enough information to answer the question, say so.
- Never state personal facts about the user or player unless they explicitly appear in the session context, conversation history or query results.

- Distinguish factual lookup questions from analytical or comparative questions.
- For analytical or comparative questions, interpret ALL relevant returned dimensions rather than answering from only one field.
- Translate rankings and metrics into plain-English advantages and disadvantages.
- Highlight meaningful strengths and weaknesses rather than mechanically listing every returned value.
- Explain meaningful trade-offs between the strongest relevant options.
- Do not create an overall score, weighting or ranking unless one is explicitly present in the results or supplied by the user.
- Do not describe one option as objectively best when different dimensions favour different options and the user's priorities are unknown.
- If priorities are needed to determine what "best" means, explain the trade-offs and ask what matters most to the user.

- When comparing player destination options:
  - Lower rank numbers are better.
  - A larger positive currentCapGap means greater current cap flexibility.
  - Fewer playersAtPosition means less basic positional competition, but does not prove greater playing opportunity.
  - incomeTaxRank is a location tax comparison, not the player's actual effective tax rate.
  - affordabilityRank is a cost-of-living comparison.
  - sunshineRank is a climate comparison.
  - distanceRank and roadTripRank are travel comparisons.
  - Compare cap flexibility, positional competition, tax, cost of living, climate and travel when those fields are present.
  - State the meaningful advantages and disadvantages of the leading options.
  - Do not merely repeat the returned values.
  - If different options lead on different dimensions, explain that there is no single best option without knowing the user's priorities.
  - Do not assume a team with insufficient current cap space is impossible as a destination; it only means the team cannot accommodate the current cap hit using the cap space shown without other roster or cap-management changes.

ESTABLISHED SESSION CONTEXT:

${sessionContext}

CONVERSATION HISTORY:

${conversation}

LATEST USER QUESTION:

${question}

QUERY RESULTS:

${JSON.stringify(
    resultData,
    null,
    2
)}
`;

    const client =
        getGeminiClient();

    for (
        const model of
        ANSWER_MODELS
    ) {
        try {
            const response =
                await client.models.generateContent(
                    {
                        model,
                        contents:
                            prompt,
                    }
                );

            const text =
                response.text?.trim();

            if (text) {
                return text;
            }
        } catch (error) {
            if (
                !isTemporaryError(
                    error
                )
            ) {
                throw error;
            }

            console.warn(
                `[Agent] ${model} unavailable for answer; trying fallback.`
            );
        }
    }

    return null;
}

// ---------------------------------------------------------
// PROCESS QUESTION
// ---------------------------------------------------------

async function processQuestion(
    question: string,
    history: HistoryItem[],
    context: AgentContext
) {
    // Deterministic context.
    const contextAnswer =
        await handleContext(
            question,
            context
        );

    if (contextAnswer) {
        return {
            answer:
                contextAnswer,
            context,
            estimatedMB: null,
        };
    }

    // Gemini -> SQL.
    const generatedSql =
        await generateSql(
            question,
            history,
            context
        );

    // Safety validation.
    const sql =
        validateSql(
            generatedSql
        );

    console.log(
        "[Agent] SQL:\n",
        sql
    );

    // BigQuery dry run.
    const bytesProcessed =
        await dryRunQuery(sql);

    const estimatedMB =
        bytesProcessed /
        (1024 * 1024);

    console.log(
        `[Agent] Estimated scan: ${estimatedMB.toFixed(
            3
        )} MB`
    );

    // Cost safety.
    if (
        bytesProcessed >
        MAX_BYTES_PROCESSED
    ) {
        throw new Error(
            "Query blocked: estimated processing exceeds the 100 MB prototype limit."
        );
    }

    // Execute.
    const rows =
        await executeQuery(sql);

    if (!rows.length) {
        return {
            answer:
                "I couldn't find any matching data.",
            context,
            estimatedMB,
        };
    }

    // Natural-language answer.
    const answer =
        await generateAnswer(
            question,
            rows,
            history,
            context
        );

    if (answer) {
        return {
            answer,
            context,
            estimatedMB,
        };
    }

    return {
        answer:
            "I found the data, but Gemini was temporarily unavailable to format the answer.",
        context,
        estimatedMB,
    };
}

// ---------------------------------------------------------
// POST /api/agent
// ---------------------------------------------------------

export async function POST(
    request: NextRequest
) {
    try {
        const body =
            (await request.json()) as
                AgentRequest;

        const question =
            body.question?.trim();

        if (!question) {
            return NextResponse.json(
                {
                    error:
                        "question is required",
                },
                {
                    status: 400,
                }
            );
        }

        const history =
            Array.isArray(
                body.history
            )
                ? body.history.slice(
                      -MAX_HISTORY
                  )
                : [];

        const context =
            normaliseContext(
                body.context
            );

        const result =
            await processQuestion(
                question,
                history,
                context
            );

        return NextResponse.json(
            result
        );
    } catch (error) {
        console.error(
            "Agent API error:",
            error
        );

        const message =
            error instanceof Error
                ? error.message
                : "Unknown error";

        // Keep detailed errors in
        // server logs, not the public UI.
        if (
            message.startsWith(
                "Query blocked:"
            ) ||
            message.startsWith(
                "Blocked:"
            )
        ) {
            return NextResponse.json(
                {
                    error: message,
                },
                {
                    status: 400,
                }
            );
        }

        if (
            message.includes(
                "temporarily unavailable"
            )
        ) {
            return NextResponse.json(
                {
                    error:
                        "The AI service is temporarily unavailable. Please try again.",
                },
                {
                    status: 503,
                }
            );
        }

        return NextResponse.json(
            {
                error:
                    "Failed to process the question.",
            },
            {
                status: 500,
            }
        );
    }
}