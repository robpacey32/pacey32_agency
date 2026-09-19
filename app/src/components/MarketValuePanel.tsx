"use client";

import {
    useEffect,
    useState,
} from "react";

// ---------------------------------------------------------
// TYPES
// ---------------------------------------------------------

export type ContractMarketType =
    | "RFA_TO_RFA"
    | "RFA_TO_UFA"
    | "UFA_SIGNING";

export interface MarketValueComparable {
    rank: number;
    playerId: number;
    player: string | null;
    position: string | null;
    similarity: number;
    models_available: number;
    contracts_found: number;
}

export interface MarketValueEvidence {
    playerId: number;
    player: string | null;

    contract_id: number;
    contract_number: number | null;

    signed_date: string;

    cap_hit: number | null;
    cap_pct_at_signing: number;

    term: number | null;

    signing_age: number | null;
    signing_status: string | null;
    expiry_status: string | null;

    contract_market_type:
        ContractMarketType | null;

    comparable_rank: number;
    comparable_player: string | null;
    comparable_position: string | null;

    player_similarity: number;

    similarity_weight: number;
    recency_weight: number;
    contract_weight: number;

    market_relevance_weight: number;
    final_contract_weight: number;

    peer_contract_weight: number;

    is_peer_value_contract: boolean;
}

export interface ValuationRange {
    contracts_used: number;
    players_used: number;

    cap_pct_low: number;
    cap_pct_median: number;
    cap_pct_high: number;

    aav_low: number;
    aav_median: number;
    aav_high: number;

    term_low: number;
    term_median: number;
    term_high: number;
}

export interface MarketValueData {
    playerId: number;
    player: string | null;
    position: string | null;

    settings: {
        top_n: number;

        market_type:
            ContractMarketType;

        market_type_source:
            "user" |
            "current_contract";

        recency_half_life_months:
            number;
    };

    current_contract: {
        contract_id: number | null;
        season_from: string | null;
        season_to: string | null;

        signing_status: string | null;
        expiry_status: string | null;

        default_market_type:
            ContractMarketType | null;
    };

    valuation: {

        negotiation_benchmark: {
            source:
                | "peer_value"
                | "recent_market";

            cap_pct: number;
            aav: number;
            term: number;
        };

        peer_value:
            ValuationRange;

        recent_market:
            ValuationRange;

        // Compatibility fields
        cap_pct_low: number;
        cap_pct_median: number;
        cap_pct_high: number;

        aav_low: number;
        aav_median: number;
        aav_high: number;

        term_low: number;
        term_median: number;
        term_high: number;
    };

    evidence_summary: {
        comparable_players_selected:
            number;

        contracts_found:
            number;

        contracts_used:
            number;

        players_used:
            number;
    };

    comparables:
        MarketValueComparable[];

    evidence:
        MarketValueEvidence[];

    model: {
        current_salary_cap:
            number;

        target_market_type:
            ContractMarketType;

        contracts_used:
            number;

        players_used:
            number;
    };
}


// ---------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------

const MIN_PEERS = 3;
const MAX_PEERS = 20;

const PEER_PRESETS = [
    5,
    10,
    20,
];


// ---------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------

export default function MarketValuePanel({
    data: initialData,
}: {
    data: MarketValueData;
}) {

    const [
        data,
        setData,
    ] =
        useState<MarketValueData>(
            initialData
        );

    const [
        topN,
        setTopN,
    ] =
        useState<number>(
            initialData.settings.top_n
        );

    const [
        customTopN,
        setCustomTopN,
    ] =
        useState<string>(
            String(
                initialData.settings.top_n
            )
        );

    const [
        marketType,
        setMarketType,
    ] =
        useState<ContractMarketType>(
            initialData.settings.market_type
        );

    const [
        loading,
        setLoading,
    ] =
        useState(false);


    // -----------------------------------------------------
    // RESET WHEN PLAYER CHANGES
    // -----------------------------------------------------

    useEffect(
        () => {

            setData(
                initialData
            );

            setTopN(
                initialData.settings.top_n
            );

            setCustomTopN(
                String(
                    initialData.settings.top_n
                )
            );

            setMarketType(
                initialData.settings.market_type
            );

        },
        [
            initialData,
        ]
    );


    // -----------------------------------------------------
    // RELOAD VALUATION
    // -----------------------------------------------------

    async function reloadValuation(
        nextTopN:
            number,

        nextMarketType:
            ContractMarketType
    ) {

        try {

            setLoading(
                true
            );

            const params =
                new URLSearchParams({
                    playerId:
                        String(
                            initialData.playerId
                        ),

                    topN:
                        String(
                            nextTopN
                        ),

                    marketType:
                        nextMarketType,
                });

            const response =
                await fetch(
                    `/api/market-value?${params.toString()}`
                );

            if (!response.ok) {

                const error =
                    await response.json();

                throw new Error(
                    error.error ??
                    "Failed to calculate market value"
                );
            }

            const result:
                MarketValueData =
                await response.json();

            setData(
                result
            );

        } catch (error) {

            console.error(
                "Failed to reload market value:",
                error
            );

        } finally {

            setLoading(
                false
            );
        }
    }


    // -----------------------------------------------------
    // TOP N
    // -----------------------------------------------------

    function changeTopN(
        value: number
    ) {

        setTopN(
            value
        );

        setCustomTopN(
            String(
                value
            )
        );

        void reloadValuation(
            value,
            marketType
        );
    }


    function applyCustomTopN() {

        const parsed =
            Number(
                customTopN
            );

        if (
            !Number.isInteger(
                parsed
            ) ||
            parsed < MIN_PEERS ||
            parsed > MAX_PEERS
        ) {

            setCustomTopN(
                String(
                    topN
                )
            );

            return;
        }

        if (
            parsed === topN
        ) {
            return;
        }

        setTopN(
            parsed
        );

        void reloadValuation(
            parsed,
            marketType
        );
    }


    // -----------------------------------------------------
    // MARKET TYPE
    // -----------------------------------------------------

    function changeMarketType(
        value:
            ContractMarketType
    ) {

        setMarketType(
            value
        );

        void reloadValuation(
            topN,
            value
        );
    }


    const playerName =
        data.player ??
        "Unknown Player";

    const benchmark =
        data.valuation
            .negotiation_benchmark;

    const peerValue =
        data.valuation
            .peer_value;

    const recentMarket =
        data.valuation
            .recent_market;


    return (
        <div className="w-full min-w-0 max-w-full space-y-5">

            {/* INTRO */}

            <div className="flex min-w-0 flex-col gap-3 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">

                <div className="min-w-0">

                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                        Market Value
                    </div>

                    <div className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">
                        Contract valuation using both comparable-player
                        contracts and recent NHL market activity.
                    </div>

                </div>

                <div className="shrink-0 text-xs text-slate-500">
                    Historical comparable valuation
                </div>

            </div>


            {/* PLAYER / CONTRACT CONTEXT */}

            <div className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/30 p-4 sm:p-5">

                <div className="flex min-w-0 flex-col justify-between gap-5 lg:flex-row lg:items-center">

                    <div className="min-w-0">

                        <div className="break-words text-xl font-bold text-white sm:text-2xl">
                            {playerName}
                        </div>

                        <div className="mt-1 text-sm text-slate-400">
                            {data.position ?? "—"}
                        </div>

                    </div>

                    <div className="grid w-full min-w-0 grid-cols-2 gap-x-5 gap-y-4 text-sm sm:grid-cols-4 lg:w-auto">

                        <Info
                            label="Current Deal"
                            value={
                                contractRange(
                                    data.current_contract
                                        .season_from,
                                    data.current_contract
                                        .season_to
                                )
                            }
                        />

                        <Info
                            label="Signed As"
                            value={
                                data.current_contract
                                    .signing_status ??
                                "—"
                            }
                        />

                        <Info
                            label="Expires As"
                            value={
                                data.current_contract
                                    .expiry_status ??
                                "—"
                            }
                        />

                        <Info
                            label="Salary Cap"
                            value={
                                money(
                                    data.model
                                        .current_salary_cap
                                )
                            }
                        />

                    </div>

                </div>

            </div>


            {/* MODEL CONTROLS */}

            <div className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/30 p-4 sm:p-5">

                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

                    <div>

                        <div className="text-sm font-semibold text-white">
                            Valuation Settings
                        </div>

                        <div className="mt-1 text-xs leading-5 text-slate-500">
                            Choose the comparable-player population and
                            contract market being valued.
                        </div>

                    </div>

                    {loading && (
                        <div className="text-xs text-emerald-400">
                            Recalculating…
                        </div>
                    )}

                </div>


                <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">

                    {/* PEERS */}

                    <div>

                        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                            Comparable Players
                        </div>

                        <div className="flex flex-wrap items-center gap-2">

                            {PEER_PRESETS.map(
                                value => (
                                    <button
                                        key={
                                            value
                                        }
                                        type="button"
                                        disabled={
                                            loading
                                        }
                                        onClick={() =>
                                            changeTopN(
                                                value
                                            )
                                        }
                                        className={`
                                            rounded-lg
                                            border
                                            px-4
                                            py-2
                                            text-sm
                                            font-medium
                                            transition
                                            ${
                                                topN === value
                                                    ? "border-emerald-500 bg-emerald-950/40 text-emerald-300"
                                                    : "border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-600"
                                            }
                                            ${
                                                loading
                                                    ? "cursor-not-allowed opacity-60"
                                                    : ""
                                            }
                                        `}
                                    >
                                        Top {value}
                                    </button>
                                )
                            )}


                            <div className="ml-0 flex items-center gap-2 sm:ml-2">

                                <input
                                    type="number"
                                    min={
                                        MIN_PEERS
                                    }
                                    max={
                                        MAX_PEERS
                                    }
                                    step={1}
                                    value={
                                        customTopN
                                    }
                                    disabled={
                                        loading
                                    }
                                    onChange={
                                        event =>
                                            setCustomTopN(
                                                event.target.value
                                            )
                                    }
                                    onBlur={
                                        applyCustomTopN
                                    }
                                    onKeyDown={
                                        event => {

                                            if (
                                                event.key ===
                                                "Enter"
                                            ) {

                                                event
                                                    .currentTarget
                                                    .blur();
                                            }
                                        }
                                    }
                                    className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                                    aria-label="Custom number of comparable players"
                                />

                                <span className="text-xs text-slate-500">
                                    peers
                                </span>

                            </div>

                        </div>

                        <div className="mt-2 text-xs text-slate-500">
                            Recommended: 5, 10 or 20. Custom range: 3–20.
                        </div>

                    </div>


                    {/* MARKET TYPE */}

                    <div>

                        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                            Contract Market
                        </div>

                        <select
                            value={
                                marketType
                            }
                            disabled={
                                loading
                            }
                            onChange={
                                event =>
                                    changeMarketType(
                                        event.target.value as
                                            ContractMarketType
                                    )
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                        >
                            <option value="RFA_TO_RFA">
                                RFA → RFA
                            </option>

                            <option value="RFA_TO_UFA">
                                RFA → UFA
                            </option>

                            <option value="UFA_SIGNING">
                                UFA Signing
                            </option>
                        </select>

                        <div className="mt-2 text-xs text-slate-500">
                            Default inferred from current contract expiry status.
                        </div>

                    </div>

                </div>

            </div>


            {/* NEGOTIATION BENCHMARK */}

            <div className="w-full min-w-0 rounded-xl border border-emerald-900/60 bg-emerald-950/10 p-4 sm:p-5">

                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">

                    <div>

                        <div className="text-sm font-semibold text-slate-300">
                            Negotiation Benchmark
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                            Higher of Peer Value and Recent Market
                        </div>

                    </div>

                    <div className="text-xs font-medium text-emerald-400">
                        Driven by{" "}
                        {benchmark.source ===
                        "peer_value"
                            ? "Peer Value"
                            : "Recent Market"}
                    </div>

                </div>


                <div className="mt-5 grid grid-cols-1 gap-0 sm:grid-cols-3">

                    <ValuationMetric
                        value={
                            money(
                                benchmark.aav
                            )
                        }
                        label="Benchmark AAV"
                    />

                    <ValuationMetric
                        value={
                            `${benchmark.cap_pct.toFixed(
                                2
                            )}%`
                        }
                        label="Cap %"
                    />

                    <ValuationMetric
                        value={
                            years(
                                benchmark.term
                            )
                        }
                        label="Term"
                    />

                </div>

            </div>


            {/* TWO VALUATION LENSES */}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

                <ValuationLens
                    title="Peer Value"
                    description="Most relevant contract from each selected comparable player, weighted by similarity and contract market."
                    valuation={
                        peerValue
                    }
                    selected={
                        benchmark.source ===
                        "peer_value"
                    }
                />

                <ValuationLens
                    title="Recent Market"
                    description={`Current contract market using similarity, market relevance and a ${data.settings.recency_half_life_months}-month recency half-life.`}
                    valuation={
                        recentMarket
                    }
                    selected={
                        benchmark.source ===
                        "recent_market"
                    }
                />

            </div>


            {/* EVIDENCE SUMMARY */}

            <div className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/30 p-4 sm:p-5">

                <div className="text-sm font-semibold text-white">
                    Contract Evidence
                </div>

                <div className="mt-1 text-xs leading-5 text-slate-500">
                    Peer Value uses one relevant contract per comparable.
                    Recent Market uses the wider historical contract set with
                    recency weighting.
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">

                    <Info
                        label="Comparables Selected"
                        value={
                            String(
                                data.evidence_summary
                                    .comparable_players_selected
                            )
                        }
                    />

                    <Info
                        label="Peer Contracts"
                        value={
                            String(
                                peerValue
                                    .contracts_used
                            )
                        }
                    />

                    <Info
                        label="Recent Market Contracts"
                        value={
                            String(
                                recentMarket
                                    .contracts_used
                            )
                        }
                    />

                    <Info
                        label="Recency Half-Life"
                        value={
                            `${data.settings.recency_half_life_months} months`
                        }
                    />

                </div>

            </div>


            {/* COMPARABLE PLAYERS */}

            <div className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/30 p-4 sm:p-5">

                <div className="text-sm font-semibold text-white">
                    Selected Comparable Players
                </div>

                <div className="mt-1 text-xs leading-5 text-slate-500">
                    Ranked by the player similarity model. Select a player
                    to view the historical contracts used in the valuation.
                </div>

                <div className="mt-4 space-y-2">

                    {data.comparables.map(
                        player => (
                            <ComparablePlayerRow
                                key={
                                    player.playerId
                                }
                                player={
                                    player
                                }
                                contracts={
                                    data.evidence.filter(
                                        contract =>
                                            contract.playerId ===
                                            player.playerId
                                    )
                                }
                            />
                        )
                    )}

                </div>

            </div>


            {/* DISCLAIMER */}

            <div className="w-full min-w-0 rounded-lg border border-emerald-900/50 bg-emerald-950/10 px-4 py-3 text-xs leading-relaxed text-slate-400">
                Market Value uses historical contracts signed by statistically
                similar players. It is a modelling estimate rather than a
                prediction of the exact contract a player will sign.
            </div>

        </div>
    );
}


// ---------------------------------------------------------
// VALUATION LENS
// ---------------------------------------------------------

function ValuationLens({
    title,
    description,
    valuation,
    selected,
}: {
    title: string;
    description: string;
    valuation: ValuationRange;
    selected: boolean;
}) {

    return (
        <div
            className={`
                min-w-0
                rounded-xl
                border
                p-4
                sm:p-5
                ${
                    selected
                        ? "border-emerald-800 bg-emerald-950/10"
                        : "border-slate-800 bg-slate-950/30"
                }
            `}
        >

            <div className="flex items-start justify-between gap-4">

                <div>

                    <div className="text-sm font-semibold text-white">
                        {title}
                    </div>

                    <div className="mt-1 text-xs leading-5 text-slate-500">
                        {description}
                    </div>

                </div>

                {selected && (
                    <div className="shrink-0 rounded-full border border-emerald-800 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                        Benchmark
                    </div>
                )}

            </div>


            <div className="mt-5">

                <div className="text-2xl font-bold text-emerald-400">
                    {money(
                        valuation.aav_median
                    )}
                </div>

                <div className="mt-1 text-sm text-slate-400">
                    {valuation.cap_pct_median.toFixed(
                        2
                    )}% of cap ·{" "}
                    {years(
                        valuation.term_median
                    )}
                </div>

            </div>


            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-800 pt-4">

                <Info
                    label="AAV Range"
                    value={
                        `${money(
                            valuation.aav_low
                        )} – ${money(
                            valuation.aav_high
                        )}`
                    }
                />

                <Info
                    label="Cap Range"
                    value={
                        `${valuation.cap_pct_low.toFixed(
                            2
                        )}% – ${valuation.cap_pct_high.toFixed(
                            2
                        )}%`
                    }
                />

                <Info
                    label="Term Range"
                    value={
                        rangeYears(
                            valuation.term_low,
                            valuation.term_high
                        )
                    }
                />

            </div>

            <div className="mt-4 text-xs text-slate-500">
                {valuation.players_used} players ·{" "}
                {valuation.contracts_used} contracts
            </div>

        </div>
    );
}


// ---------------------------------------------------------
// COMPARABLE PLAYER
// ---------------------------------------------------------

function ComparablePlayerRow({
    player,
    contracts,
}: {
    player:
        MarketValueComparable;

    contracts:
        MarketValueEvidence[];
}) {

    const [
        open,
        setOpen,
    ] =
        useState(false);


    const sortedContracts =
        [...contracts].sort(
            (a, b) =>
                Date.parse(
                    b.signed_date
                ) -
                Date.parse(
                    a.signed_date
                )
        );


    return (
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/20">

            {/* PLAYER */}

            <button
                type="button"
                onClick={() =>
                    setOpen(
                        value =>
                            !value
                    )
                }
                className="grid w-full min-w-0 grid-cols-[40px_minmax(0,1fr)] gap-3 px-3 py-3 text-left transition hover:bg-slate-800/30 sm:grid-cols-[40px_minmax(0,1fr)_180px_120px_24px] sm:items-center sm:px-4"
                aria-expanded={
                    open
                }
            >

                <div className="text-sm font-semibold text-slate-500">
                    #{player.rank}
                </div>


                <div className="min-w-0">

                    <div className="truncate font-medium text-white">
                        {player.player ??
                            "Unknown Player"}
                    </div>

                    <div className="mt-0.5 text-xs text-slate-500">
                        {player.position ??
                            "—"}
                    </div>

                </div>


                <div className="col-span-2 sm:col-span-1">

                    <div className="flex items-center gap-3">

                        <div className="min-w-0 flex-1">
                            <SimilarityBar
                                value={
                                    player.similarity
                                }
                            />
                        </div>

                        <div className="w-14 shrink-0 text-right text-sm font-semibold text-white">
                            {player.similarity.toFixed(
                                1
                            )}%
                        </div>

                    </div>

                </div>


                <div className="col-span-2 text-xs text-slate-500 sm:col-span-1 sm:text-right">
                    {player.contracts_found}{" "}
                    {player.contracts_found === 1
                        ? "contract"
                        : "contracts"}
                </div>


                <div className="hidden text-right text-slate-500 sm:block">
                    {open
                        ? "−"
                        : "+"}
                </div>

            </button>


            {/* CONTRACTS */}

            {open && (

                <div className="border-t border-slate-800 bg-slate-950/30 px-3 py-3 sm:px-4">

                    {sortedContracts.length ===
                    0 ? (

                        <div className="text-xs text-slate-500">
                            No historical contract evidence available.
                        </div>

                    ) : (

                        <div className="space-y-2">

                            {sortedContracts.map(
                                contract => (
                                    <ComparableContractRow
                                        key={
                                            `${contract.playerId}-${contract.contract_id}`
                                        }
                                        contract={
                                            contract
                                        }
                                    />
                                )
                            )}

                        </div>

                    )}

                </div>

            )}

        </div>
    );
}


// ---------------------------------------------------------
// COMPARABLE CONTRACT
// ---------------------------------------------------------

function ComparableContractRow({
    contract,
}: {
    contract:
        MarketValueEvidence;
}) {

    return (
        <div
            className={`
                rounded-lg
                border
                px-3
                py-3
                ${
                    contract
                        .is_peer_value_contract
                        ? "border-emerald-900/70 bg-emerald-950/10"
                        : "border-slate-800 bg-slate-900/20"
                }
            `}
        >

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

                {/* CONTRACT IDENTITY */}

                <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                        <div className="text-sm font-medium text-slate-300">
                            {formatDate(
                                contract.signed_date
                            )}
                        </div>

                        <div className="text-xs text-slate-500">
                            {marketLabel(
                                contract.contract_market_type
                            )}
                        </div>

                        {contract
                            .is_peer_value_contract && (

                            <div className="rounded-full border border-emerald-800 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                                Peer Value
                            </div>

                        )}

                    </div>

                </div>


                {/* CONTRACT VALUES */}

                <div className="grid grid-cols-3 gap-x-6 gap-y-3 lg:min-w-[390px]">

                    <Info
                        label="AAV"
                        value={
                            contract.cap_hit !=
                            null
                                ? money(
                                      contract.cap_hit
                                  )
                                : "—"
                        }
                    />

                    <Info
                        label="Cap %"
                        value={
                            `${contract.cap_pct_at_signing.toFixed(
                                2
                            )}%`
                        }
                    />

                    <Info
                        label="Term"
                        value={
                            contract.term !=
                            null
                                ? years(
                                      contract.term
                                  )
                                : "—"
                        }
                    />

                </div>

            </div>


            {/* MODEL CONTEXT */}

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-800 pt-3 text-xs text-slate-500">

                <span>
                    Similarity{" "}
                    <span className="font-medium text-slate-400">
                        {contract.player_similarity.toFixed(
                            1
                        )}%
                    </span>
                </span>

                <span>
                    Market relevance{" "}
                    <span className="font-medium text-slate-400">
                        {(
                            contract.market_relevance_weight *
                            100
                        ).toFixed(
                            0
                        )}%
                    </span>
                </span>

                <span>
                    Recency{" "}
                    <span className="font-medium text-slate-400">
                        {(
                            contract.recency_weight *
                            100
                        ).toFixed(
                            1
                        )}%
                    </span>
                </span>

            </div>

        </div>
    );
}


// ---------------------------------------------------------
// VALUATION KPI
// ---------------------------------------------------------

function ValuationMetric({
    value,
    label,
}: {
    value: string;
    label: string;
}) {

    return (
        <div className="min-w-0 border-b border-slate-800 py-4 first:pt-0 last:border-b-0 last:pb-0 sm:border-b-0 sm:border-r sm:px-5 sm:py-0 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0">

            <div className="break-words text-2xl font-bold text-emerald-400 lg:text-3xl">
                {value}
            </div>

            <div className="mt-1 text-sm text-slate-500">
                {label}
            </div>

        </div>
    );
}


// ---------------------------------------------------------
// INFO
// ---------------------------------------------------------

function Info({
    label,
    value,
}: {
    label: string;
    value: string;
}) {

    return (
        <div className="min-w-0">

            <div className="text-xs text-slate-500">
                {label}
            </div>

            <div className="mt-0.5 break-words text-sm font-medium text-slate-300">
                {value}
            </div>

        </div>
    );
}


// ---------------------------------------------------------
// SIMILARITY BAR
// ---------------------------------------------------------

function SimilarityBar({
    value,
}: {
    value: number;
}) {

    const safeValue =
        Math.max(
            0,
            Math.min(
                100,
                value
            )
        );

    return (
        <div className="h-2 w-full min-w-0 overflow-hidden rounded-full bg-slate-800">

            <div
                className={`h-full rounded-full ${similarityColour(
                    value
                )}`}
                style={{
                    width:
                        `${safeValue}%`,
                }}
            />

        </div>
    );
}


function similarityColour(
    value: number
) {

    if (value >= 80) {
        return "bg-emerald-400";
    }

    if (value >= 60) {
        return "bg-lime-400";
    }

    if (value >= 40) {
        return "bg-yellow-400";
    }

    if (value >= 20) {
        return "bg-orange-400";
    }

    return "bg-rose-500";
}


// ---------------------------------------------------------
// FORMATTERS
// ---------------------------------------------------------

function money(
    value: number
) {

    const rounded =
        Math.round(
            value
        );

    if (
        rounded >=
        1_000_000
    ) {

        return `$${(
            rounded /
            1_000_000
        ).toFixed(
            2
        )}m`;
    }

    if (
        rounded >=
        1_000
    ) {

        return `$${(
            rounded /
            1_000
        ).toFixed(
            0
        )}k`;
    }

    return `$${rounded.toLocaleString()}`;
}


function years(
    value: number
) {

    return `${value} ${
        value === 1
            ? "year"
            : "years"
    }`;
}


function rangeYears(
    low: number,
    high: number
) {

    if (
        low === high
    ) {
        return years(
            low
        );
    }

    return `${low} – ${high} years`;
}


function contractRange(
    from: string | null,
    to: string | null
) {

    if (
        !from &&
        !to
    ) {
        return "—";
    }

    if (
        from &&
        to
    ) {
        return `${from} – ${to}`;
    }

    return from ??
        to ??
        "—";
}


function marketLabel(
    value:
        ContractMarketType | null
) {

    switch (value) {

        case "RFA_TO_RFA":
            return "RFA → RFA";

        case "RFA_TO_UFA":
            return "RFA → UFA";

        case "UFA_SIGNING":
            return "UFA Signing";

        default:
            return "Unknown";
    }
}


function formatDate(
    value: string
) {

    const date =
        new Date(
            `${value}T00:00:00`
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }

    return date.toLocaleDateString(
        "en-GB",
        {
            month:
                "short",
            year:
                "numeric",
        }
    );
}