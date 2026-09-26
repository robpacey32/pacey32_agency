"use client";

import {
    Fragment,
    useEffect,
    useMemo,
    useState,
} from "react";

type QAStatus = "PASS" | "WARN" | "FAIL";

interface QADomain {
    domain: string;
    test_prefix?: string;
    run_id: string;
    run_datetime: string;
    test_count: number;
    pass_count: number;
    warn_count: number;
    fail_count: number;
    overall_status: QAStatus;
    qa_date?: string;
}

interface QAResponse {
    project: string;
    layer: string;
    results: QADomain[];
}

interface QAHistoryResponse {
    project: string;
    layer: string;
    days: number;
    results: QADomain[];
}

interface QATest {
    test_id: string;
    test_name: string;
    category: string;
    source_dataset: string;
    source_object: string;
    season: number | null;
    severity: string;
    status: QAStatus;
    failure_count: number;
    description: string;
    details: string | null;
}

interface QATestsResponse {
    results: QATest[];
}

interface QAFailure {
    test_id: string;
    source_object: string;
    season: number | null;
    record_key: string;
    failure_reason: string;
    record_json: unknown;
}

interface QAFailuresResponse {
    failure_count: number;
    results: QAFailure[];
}

interface QASectionProps {
    title: string;
    project: string;
    endpoint: string;
    layer: "source" | "agency";
}

function statusClasses(status: QAStatus) {
    switch (status) {
        case "PASS":
            return "border-green-700 bg-green-950/40 text-green-300";

        case "WARN":
            return "border-amber-700 bg-amber-950/40 text-amber-300";

        case "FAIL":
            return "border-red-700 bg-red-950/40 text-red-300";
    }
}

function testStatusClasses(status: QAStatus) {
    switch (status) {
        case "PASS":
            return "text-green-400";

        case "WARN":
            return "text-amber-400";

        case "FAIL":
            return "text-red-400";
    }
}

function historyCellClasses(
    status?: QAStatus
) {
    switch (status) {
        case "PASS":
            return "border-green-800 bg-green-900/70 hover:bg-green-800";

        case "WARN":
            return "border-amber-800 bg-amber-900/70 hover:bg-amber-800";

        case "FAIL":
            return "border-red-800 bg-red-900/70 hover:bg-red-800";

        default:
            return "border-gray-800 bg-gray-900/50";
    }
}

function formatRecordJson(value: unknown) {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    if (typeof value === "string") {
        try {
            return JSON.stringify(
                JSON.parse(value),
                null,
                2
            );
        } catch {
            return value;
        }
    }

    return JSON.stringify(
        value,
        null,
        2
    );
}

function formatHistoryDate(
    date: string
) {
    const parsed = new Date(
        `${date}T00:00:00`
    );

    return parsed.toLocaleDateString(
        undefined,
        {
            day: "numeric",
            month: "short",
        }
    );
}

function formatHistoryDay(
    date: string
) {
    const parsed = new Date(
        `${date}T00:00:00`
    );

    return parsed.toLocaleDateString(
        undefined,
        {
            day: "numeric",
        }
    );
}

export default function QASection({
    title,
    project,
    endpoint,
    layer,
}: QASectionProps) {
    const [data, setData] =
        useState<QAResponse | null>(null);

    const [error, setError] =
        useState<string | null>(null);

    const [history, setHistory] =
        useState<QAHistoryResponse | null>(
            null
        );

    const [
        historyError,
        setHistoryError,
    ] =
        useState<string | null>(null);

    const [
        selectedDomain,
        setSelectedDomain,
    ] =
        useState<QADomain | null>(null);

    const [
        selectedHistoryDate,
        setSelectedHistoryDate,
    ] =
        useState<string | null>(null);

    const [tests, setTests] =
        useState<QATest[]>([]);

    const [
        testsLoading,
        setTestsLoading,
    ] =
        useState(false);

    const [
        testsError,
        setTestsError,
    ] =
        useState<string | null>(null);

    const [
        selectedTest,
        setSelectedTest,
    ] =
        useState<string | null>(null);

    const [failures, setFailures] =
        useState<QAFailure[]>([]);

    const [
        failuresLoading,
        setFailuresLoading,
    ] =
        useState(false);

    const [
        failuresError,
        setFailuresError,
    ] =
        useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const response =
                    await fetch(
                        endpoint,
                        {
                            cache: "no-store",
                        }
                    );

                if (!response.ok) {
                    throw new Error(
                        `Failed to load ${title} QA.`
                    );
                }

                const result =
                    (await response.json()) as QAResponse;

                setData(result);
            } catch {
                setError(
                    `Unable to load ${title} QA.`
                );
            }
        }

        load();
    }, [endpoint, title]);

    useEffect(() => {
        async function loadHistory() {
            try {
                const response =
                    await fetch(
                        `/api/qa/history?layer=${layer}`,
                        {
                            cache: "no-store",
                        }
                    );

                if (!response.ok) {
                    throw new Error(
                        "Failed to load QA history."
                    );
                }

                const result =
                    (await response.json()) as QAHistoryResponse;

                setHistory(result);
            } catch {
                setHistoryError(
                    "Unable to load 30-day history."
                );
            }
        }

        loadHistory();
    }, [layer]);

    const historyDates = useMemo(
        () => {
            const dates: string[] = [];

            const today =
                new Date();

            for (
                let offset = 29;
                offset >= 0;
                offset--
            ) {
                const date =
                    new Date(today);

                date.setDate(
                    today.getDate() -
                        offset
                );

                dates.push(
                    [
                        date.getFullYear(),
                        String(
                            date.getMonth() +
                                1
                        ).padStart(
                            2,
                            "0"
                        ),
                        String(
                            date.getDate()
                        ).padStart(
                            2,
                            "0"
                        ),
                    ].join("-")
                );
            }

            return dates;
        },
        []
    );

    const historyLookup = useMemo(
        () => {
            const lookup =
                new Map<
                    string,
                    QADomain
                >();

            if (!history) {
                return lookup;
            }

            for (
                const run of
                history.results
            ) {
                if (!run.qa_date) {
                    continue;
                }

                lookup.set(
                    `${run.domain}|${run.qa_date}`,
                    run
                );
            }

            return lookup;
        },
        [history]
    );

    function resetTestSelection() {
        setSelectedTest(null);
        setFailures([]);
        setFailuresError(null);
        setFailuresLoading(false);
    }

    function closeDomain() {
        setSelectedDomain(null);
        setSelectedHistoryDate(null);
        setTests([]);
        setTestsError(null);
        resetTestSelection();
    }

    async function loadDomain(
        domain: QADomain,
        historyDate:
            | string
            | null = null
    ) {
        if (
            selectedDomain?.run_id ===
                domain.run_id &&
            selectedHistoryDate ===
                historyDate
        ) {
            closeDomain();
            return;
        }

        setSelectedDomain(domain);
        setSelectedHistoryDate(
            historyDate
        );
        setTests([]);
        setTestsError(null);
        setTestsLoading(true);
        resetTestSelection();

        try {
            const params =
                new URLSearchParams({
                    layer,
                    run_id:
                        domain.run_id,
                });

            const response =
                await fetch(
                    `/api/qa/tests?${params.toString()}`,
                    {
                        cache: "no-store",
                    }
                );

            if (!response.ok) {
                throw new Error(
                    "Failed to load tests."
                );
            }

            const result =
                (await response.json()) as QATestsResponse;

            setTests(
                result.results
            );
        } catch {
            setTestsError(
                "Unable to load QA tests."
            );
        } finally {
            setTestsLoading(false);
        }
    }

    async function selectTest(
        test: QATest
    ) {
        if (
            test.failure_count === 0
        ) {
            return;
        }

        if (!selectedDomain) {
            return;
        }

        if (
            selectedTest ===
            test.test_id
        ) {
            resetTestSelection();
            return;
        }

        setSelectedTest(
            test.test_id
        );

        setFailures([]);
        setFailuresError(null);
        setFailuresLoading(true);

        try {
            const params =
                new URLSearchParams({
                    layer,
                    run_id:
                        selectedDomain.run_id,
                    test_id:
                        test.test_id,
                });

            const response =
                await fetch(
                    `/api/qa/failures?${params.toString()}`,
                    {
                        cache: "no-store",
                    }
                );

            if (!response.ok) {
                throw new Error(
                    "Failed to load failure records."
                );
            }

            const result =
                (await response.json()) as QAFailuresResponse;

            setFailures(
                result.results
            );
        } catch {
            setFailuresError(
                "Unable to load failure records."
            );
        } finally {
            setFailuresLoading(
                false
            );
        }
    }

    function renderTestDetails(
        test: QATest
    ) {
        if (
            selectedTest !==
            test.test_id
        ) {
            return null;
        }

        return (
            <tr>
                <td
                    colSpan={6}
                    className="border-b border-gray-800 bg-black/20 px-5 py-5"
                >
                    <div className="mb-4">
                        <div className="text-sm font-semibold text-white">
                            {test.test_id} failure records
                        </div>

                        {test.details && (
                            <div className="mt-1 text-sm text-gray-400">
                                {
                                    test.details
                                }
                            </div>
                        )}
                    </div>

                    {failuresLoading && (
                        <p className="text-sm text-gray-500">
                            Loading failure records...
                        </p>
                    )}

                    {failuresError && (
                        <p className="text-sm text-red-400">
                            {
                                failuresError
                            }
                        </p>
                    )}

                    {!failuresLoading &&
                        !failuresError &&
                        failures.length >
                            0 && (
                            <div className="space-y-3">
                                {failures.map(
                                    (
                                        failure,
                                        index
                                    ) => (
                                        <div
                                            key={`${failure.record_key}-${index}`}
                                            className="rounded-lg border border-gray-800 bg-black/20 p-4"
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-medium text-white">
                                                        {
                                                            failure.record_key
                                                        }
                                                    </div>

                                                    <div className="mt-1 text-sm text-gray-400">
                                                        {
                                                            failure.failure_reason
                                                        }
                                                    </div>
                                                </div>

                                                <div className="text-xs text-gray-500">
                                                    {
                                                        failure.source_object
                                                    }
                                                </div>
                                            </div>

                                            {failure.record_json !==
                                                null && (
                                                <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-md border border-gray-800 bg-black/30 p-3 text-xs text-gray-400">
                                                    {formatRecordJson(
                                                        failure.record_json
                                                    )}
                                                </pre>
                                            )}
                                        </div>
                                    )
                                )}
                            </div>
                        )}

                    {!failuresLoading &&
                        !failuresError &&
                        failures.length ===
                            0 && (
                            <p className="text-sm text-gray-500">
                                No failure records stored for this test.
                            </p>
                        )}
                </td>
            </tr>
        );
    }

    function renderExpandedDomain(
        domain: QADomain
    ) {
        if (
            selectedDomain?.run_id !==
            domain.run_id
        ) {
            return null;
        }

        return (
            <div className="col-span-full rounded-xl border border-gray-800 bg-black/10 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-semibold">
                                {
                                    domain.domain
                                }
                            </h3>

                            <span
                                className={`
                                    text-sm
                                    font-bold
                                    ${testStatusClasses(
                                        domain.overall_status
                                    )}
                                `}
                            >
                                {
                                    domain.overall_status
                                }
                            </span>
                        </div>

                        <p className="mt-1 text-sm text-gray-500">
                            {
                                domain.test_count
                            }{" "}
                            tests
                            {" · "}
                            {
                                domain.pass_count
                            }{" "}
                            passed
                            {" · "}
                            {
                                domain.warn_count
                            }{" "}
                            warnings
                            {" · "}
                            {
                                domain.fail_count
                            }{" "}
                            failures
                        </p>

                        {selectedHistoryDate && (
                            <p className="mt-1 text-xs text-gray-600">
                                Historical run:{" "}
                                {formatHistoryDate(
                                    selectedHistoryDate
                                )}
                                {" · "}
                                {new Date(
                                    domain.run_datetime
                                ).toLocaleString()}
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={
                            closeDomain
                        }
                        className="text-sm text-gray-400 hover:text-white"
                    >
                        Close
                    </button>
                </div>

                {testsLoading && (
                    <p className="mt-6 text-gray-500">
                        Loading tests...
                    </p>
                )}

                {testsError && (
                    <p className="mt-6 text-red-400">
                        {testsError}
                    </p>
                )}

                {!testsLoading &&
                    !testsError &&
                    tests.length > 0 && (
                        <div className="mt-6 overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-gray-800 text-gray-500">
                                    <tr>
                                        <th className="px-3 py-3">
                                            Test
                                        </th>

                                        <th className="px-3 py-3">
                                            Name
                                        </th>

                                        <th className="px-3 py-3">
                                            Object
                                        </th>

                                        <th className="px-3 py-3">
                                            Severity
                                        </th>

                                        <th className="px-3 py-3">
                                            Status
                                        </th>

                                        <th className="px-3 py-3 text-right">
                                            Failures
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {tests.map(
                                        (
                                            test
                                        ) => (
                                            <Fragment
                                                key={
                                                    test.test_id
                                                }
                                            >
                                                <tr
                                                    onClick={() =>
                                                        selectTest(
                                                            test
                                                        )
                                                    }
                                                    className={`
                                                        border-b
                                                        border-gray-900
                                                        ${
                                                            test.failure_count >
                                                            0
                                                                ? "cursor-pointer hover:bg-white/5"
                                                                : ""
                                                        }
                                                    `}
                                                >
                                                    <td className="px-3 py-3 font-mono">
                                                        {
                                                            test.test_id
                                                        }
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <div className="font-medium">
                                                            {
                                                                test.test_name
                                                            }
                                                        </div>

                                                        <div className="mt-1 text-xs text-gray-500">
                                                            {
                                                                test.description
                                                            }
                                                        </div>

                                                        {test.failure_count >
                                                            0 && (
                                                            <div className="mt-1 text-xs text-gray-600">
                                                                Click to view records
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="px-3 py-3 text-gray-400">
                                                        {
                                                            test.source_object
                                                        }
                                                    </td>

                                                    <td className="px-3 py-3 text-gray-400">
                                                        {
                                                            test.severity
                                                        }
                                                    </td>

                                                    <td
                                                        className={`
                                                            px-3
                                                            py-3
                                                            font-semibold
                                                            ${testStatusClasses(
                                                                test.status
                                                            )}
                                                        `}
                                                    >
                                                        {
                                                            test.status
                                                        }
                                                    </td>

                                                    <td className="px-3 py-3 text-right">
                                                        {
                                                            test.failure_count
                                                        }
                                                    </td>
                                                </tr>

                                                {renderTestDetails(
                                                    test
                                                )}
                                            </Fragment>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
            </div>
        );
    }

    function renderHistory() {
        if (historyError) {
            return (
                <div className="mt-5 rounded-xl border border-gray-800 p-5">
                    <p className="text-sm text-red-400">
                        {historyError}
                    </p>
                </div>
            );
        }

        if (!history) {
            return (
                <div className="mt-5 rounded-xl border border-gray-800 p-5">
                    <p className="text-sm text-gray-500">
                        Loading 30-day history...
                    </p>
                </div>
            );
        }

        return (
            <div className="mt-5 rounded-xl border border-gray-800 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="font-semibold">
                            30-day history
                        </h3>

                        <p className="mt-1 text-xs text-gray-500">
                            Click a coloured cell to inspect that run
                        </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-sm bg-green-900" />
                            PASS
                        </div>

                        <div className="flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-sm bg-amber-900" />
                            WARN
                        </div>

                        <div className="flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-sm bg-red-900" />
                            FAIL
                        </div>

                        <div className="flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-sm bg-gray-900" />
                            NO RUN
                        </div>
                    </div>
                </div>

                <div className="mt-5 w-full overflow-hidden">
                    <div className="w-full">
                        <div
                            className="grid gap-1"
                            style={{
                                gridTemplateColumns:
                                    "minmax(100px, 150px) 40px 1px repeat(30, minmax(0, 1fr))",
                            }}
                        >
                            <div />

                            <div className="flex h-10 items-end justify-center pb-1">
                                <span className="whitespace-nowrap text-[10px] font-medium text-gray-500">
                                    Latest
                                </span>
                            </div>

                            <div className="mx-auto h-full w-px bg-gray-800" />

                            {historyDates.map(
                                (
                                    date,
                                    index
                                ) => (
                                    <div
                                        key={
                                            date
                                        }
                                        className="flex h-10 items-end justify-center"
                                        title={formatHistoryDate(
                                            date
                                        )}
                                    >
                                        {index %
                                            3 ===
                                            0 && (
                                            <span className="-rotate-45 whitespace-nowrap text-[10px] text-gray-600">
                                                {formatHistoryDay(
                                                    date
                                                )}
                                            </span>
                                        )}
                                    </div>
                                )
                            )}

                            {data?.results.map(
                                (domain) => (
                                    <Fragment
                                        key={
                                            domain.domain
                                        }
                                    >
                                        <div className="flex h-7 items-center pr-3 text-xs text-gray-400">
                                            {
                                                domain.domain
                                            }
                                        </div>

                                        <button
                                            type="button"
                                            title={[
                                                `${domain.domain} · Latest`,
                                                domain.overall_status,
                                                `${domain.pass_count}/${domain.test_count} passed`,
                                                `${domain.warn_count} warnings`,
                                                `${domain.fail_count} failures`,
                                                new Date(
                                                    domain.run_datetime
                                                ).toLocaleString(),
                                            ].join(" · ")}
                                            onClick={() =>
                                                loadDomain(domain)
                                            }
                                            className={`
                                                h-7
                                                min-w-0
                                                rounded-sm
                                                border
                                                transition
                                                cursor-pointer
                                                ${historyCellClasses(
                                                    domain.overall_status
                                                )}
                                            `}
                                        />

                                        <div className="mx-auto h-7 w-px bg-gray-800" />

                                        {historyDates.map(
                                            (
                                                date
                                            ) => {
                                                const run =
                                                    historyLookup.get(
                                                        `${domain.domain}|${date}`
                                                    );

                                                const titleText =
                                                    run
                                                        ? [
                                                              domain.domain,
                                                              formatHistoryDate(
                                                                  date
                                                              ),
                                                              run.overall_status,
                                                              `${run.pass_count}/${run.test_count} passed`,
                                                              `${run.warn_count} warnings`,
                                                              `${run.fail_count} failures`,
                                                          ].join(
                                                              " · "
                                                          )
                                                        : `${domain.domain} · ${formatHistoryDate(
                                                              date
                                                          )} · No run`;

                                                return (
                                                    <button
                                                        key={`${domain.domain}-${date}`}
                                                        type="button"
                                                        disabled={
                                                            !run
                                                        }
                                                        title={
                                                            titleText
                                                        }
                                                        onClick={() => {
                                                            if (
                                                                run
                                                            ) {
                                                                loadDomain(
                                                                    run,
                                                                    date
                                                                );
                                                            }
                                                        }}
                                                        className={`
                                                            h-7
                                                            min-w-0
                                                            rounded-sm
                                                            border
                                                            transition
                                                            ${historyCellClasses(
                                                                run?.overall_status
                                                            )}
                                                            ${
                                                                run
                                                                    ? "cursor-pointer"
                                                                    : "cursor-default"
                                                            }
                                                        `}
                                                    />
                                                );
                                            }
                                        )}
                                    </Fragment>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <section className="mt-10">
                <h2 className="text-2xl font-semibold">
                    {title}
                </h2>

                <p className="mt-4 text-red-400">
                    {error}
                </p>
            </section>
        );
    }

    if (!data) {
        return (
            <section className="mt-10">
                <h2 className="text-2xl font-semibold">
                    {title}
                </h2>

                <p className="mt-4 text-gray-500">
                    Loading...
                </p>
            </section>
        );
    }

    return (
        <section className="mt-10">
            <div>
                <h2 className="text-2xl font-semibold">
                    {title}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                    {project}
                </p>
            </div>

            {renderHistory()}

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {data.results.map(
                    (domain) => (
                        <div
                            key={
                                domain.domain
                            }
                            className="contents"
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    loadDomain(
                                        domain
                                    )
                                }
                                className={`
                                    rounded-xl
                                    border
                                    p-5
                                    text-left
                                    transition
                                    hover:brightness-125
                                    ${statusClasses(
                                        domain.overall_status
                                    )}
                                `}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <h3 className="font-semibold">
                                        {
                                            domain.domain
                                        }
                                    </h3>

                                    <span className="text-xs font-bold">
                                        {
                                            domain.overall_status
                                        }
                                    </span>
                                </div>

                                <div className="mt-5 text-2xl font-bold">
                                    {
                                        domain.pass_count
                                    }

                                    <span className="text-sm font-normal opacity-70">
                                        {" "}
                                        /{" "}
                                        {
                                            domain.test_count
                                        }
                                    </span>
                                </div>

                                <div className="mt-2 text-xs opacity-70">
                                    {
                                        domain.warn_count
                                    }{" "}
                                    warnings
                                    {" · "}
                                    {
                                        domain.fail_count
                                    }{" "}
                                    failures
                                </div>

                                <div className="mt-4 text-xs opacity-50">
                                    {new Date(
                                        domain.run_datetime
                                    ).toLocaleString()}
                                </div>
                            </button>

                            {renderExpandedDomain(
                                domain
                            )}
                        </div>
                    )
                )}

                {selectedDomain &&
                    selectedHistoryDate &&
                    !data.results.some(
                        (domain) =>
                            domain.run_id ===
                            selectedDomain.run_id
                    ) && (
                        <div className="col-span-full">
                            {renderExpandedDomain(
                                selectedDomain
                            )}
                        </div>
                    )}
            </div>
        </section>
    );
}