"use client";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useAppContext } from "@/context/AppContext";

type Player = {
    playerId: number;
    name: string;
    team: string | null;
    position: string | null;
    headshot_url: string | null;
};

type Team = {
    code: string;
    name: string;
    conference: string;
    division: string;
};

export default function SelectorBar() {
    const {
        player,
        setPlayer,
        selectedPlayer,
        setSelectedPlayer,
        team,
        setTeam,
    } = useAppContext();

    const [players, setPlayers] =
        useState<Player[]>([]);

    const [teams, setTeams] =
        useState<Team[]>([]);

    const [
        playerSearch,
        setPlayerSearch,
    ] = useState("");

    const [
        playerOpen,
        setPlayerOpen,
    ] = useState(false);

    const playerDropdownRef =
        useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch("/api/players")
            .then((res) => res.json())
            .then((data: Player[]) => {
                setPlayers(data);

                const current =
                    data.find(
                        (item) =>
                            String(
                                item.playerId
                            ) === player
                    ) ?? null;

                setSelectedPlayer(
                    current
                );
            })
            .catch((err) =>
                console.error(
                    "Failed to load players:",
                    err
                )
            );

        fetch("/api/teams")
            .then((res) => res.json())
            .then((data) =>
                setTeams(data)
            )
            .catch((err) =>
                console.error(
                    "Failed to load teams:",
                    err
                )
            );
    }, []);

    useEffect(() => {
        const handleClickOutside = (
            event: MouseEvent
        ) => {
            if (
                playerDropdownRef.current &&
                !playerDropdownRef.current.contains(
                    event.target as Node
                )
            ) {
                setPlayerOpen(false);
                setPlayerSearch("");
            }
        };

        document.addEventListener(
            "mousedown",
            handleClickOutside
        );

        return () => {
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );
        };
    }, []);

    const filteredPlayers =
        useMemo(() => {
            const search =
                playerSearch
                    .trim()
                    .toLowerCase();

            if (!search) {
                return players.slice(
                    0,
                    100
                );
            }

            return players
                .filter((item) =>
                    item.name
                        .toLowerCase()
                        .includes(search)
                )
                .slice(0, 100);
        }, [
            players,
            playerSearch,
        ]);

    const selectPlayer = (
        item: Player
    ) => {
        setPlayer(
            String(item.playerId)
        );

        setSelectedPlayer(item);

        setPlayerSearch("");
        setPlayerOpen(false);
    };

    const conferences = [
        "Eastern",
        "Western",
    ];

    return (
        <div className="grid gap-3 md:grid-cols-2">
            <div
                ref={playerDropdownRef}
                className="relative"
            >
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Player
                </label>

                <button
                    type="button"
                    onClick={() =>
                        setPlayerOpen(
                            !playerOpen
                        )
                    }
                    className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-sm text-white outline-none hover:border-slate-700"
                >
                    <span>
                        {selectedPlayer?.name ||
                            "Select player"}
                    </span>

                    <span className="text-slate-500">
                        ⌄
                    </span>
                </button>

                {playerOpen && (
                    <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
                        <div className="border-b border-slate-800 p-2">
                            <input
                                autoFocus
                                type="text"
                                value={
                                    playerSearch
                                }
                                onChange={(
                                    e
                                ) =>
                                    setPlayerSearch(
                                        e
                                            .target
                                            .value
                                    )
                                }
                                placeholder="Search player..."
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-slate-500"
                            />
                        </div>

                        <div className="max-h-72 overflow-y-auto">
                            {filteredPlayers.map(
                                (
                                    item
                                ) => (
                                    <button
                                        key={
                                            item.playerId
                                        }
                                        type="button"
                                        onClick={() =>
                                            selectPlayer(
                                                item
                                            )
                                        }
                                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-800"
                                    >
                                        <div>
                                            <span>
                                                {
                                                    item.name
                                                }
                                            </span>

                                            {item.position && (
                                                <span className="ml-2 text-xs text-slate-500">
                                                    {
                                                        item.position
                                                    }
                                                </span>
                                            )}
                                        </div>

                                        {item.team && (
                                            <span className="ml-4 text-xs text-slate-500">
                                                {
                                                    item.team
                                                }
                                            </span>
                                        )}
                                    </button>
                                )
                            )}

                            {filteredPlayers.length ===
                                0 && (
                                <div className="px-3 py-4 text-sm text-slate-500">
                                    No players
                                    found
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Team
                </label>

                <select
                    value={team}
                    onChange={(e) =>
                        setTeam(
                            e.target.value
                        )
                    }
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-slate-600"
                >
                    {conferences.map(
                        (conference) => {
                            const conferenceTeams =
                                teams.filter(
                                    (
                                        item
                                    ) =>
                                        item.conference ===
                                        conference
                                );

                            const divisions =
                                [
                                    ...new Set(
                                        conferenceTeams.map(
                                            (
                                                item
                                            ) =>
                                                item.division
                                        )
                                    ),
                                ];

                            return divisions.map(
                                (
                                    division
                                ) => (
                                    <optgroup
                                        key={`${conference}-${division}`}
                                        label={`${conference.toUpperCase()} — ${division}`}
                                    >
                                        {conferenceTeams
                                            .filter(
                                                (
                                                    item
                                                ) =>
                                                    item.division ===
                                                    division
                                            )
                                            .map(
                                                (
                                                    item
                                                ) => (
                                                    <option
                                                        key={
                                                            item.code
                                                        }
                                                        value={
                                                            item.code
                                                        }
                                                    >
                                                        {
                                                            item.name
                                                        }
                                                    </option>
                                                )
                                            )}
                                    </optgroup>
                                )
                            );
                        }
                    )}
                </select>
            </div>
        </div>
    );
}