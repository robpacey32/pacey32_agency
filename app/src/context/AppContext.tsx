"use client";

import {
    createContext,
    useContext,
    useState,
} from "react";

type SelectedPlayer = {
    playerId: number;
    name: string;
    team: string | null;
    position: string | null;
    headshot_url: string | null;
};

type AppContextType = {
    player: string;
    setPlayer: (player: string) => void;

    selectedPlayer: SelectedPlayer | null;
    setSelectedPlayer: (
        player: SelectedPlayer | null
    ) => void;

    team: string;
    setTeam: (team: string) => void;
};

const AppContext =
    createContext<AppContextType | undefined>(
        undefined
    );

export function AppProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [player, setPlayer] =
        useState("8477492");

    const [
        selectedPlayer,
        setSelectedPlayer,
    ] =
        useState<SelectedPlayer | null>(
            null
        );

    const [team, setTeam] =
        useState("COL");

    return (
        <AppContext.Provider
            value={{
                player,
                setPlayer,
                selectedPlayer,
                setSelectedPlayer,
                team,
                setTeam,
            }}
        >
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext() {
    const context =
        useContext(AppContext);

    if (!context) {
        throw new Error(
            "useAppContext must be used inside AppProvider"
        );
    }

    return context;
}