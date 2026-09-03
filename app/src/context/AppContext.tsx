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
    player: string | null;
    setPlayer: (
        player: string | null
    ) => void;

    selectedPlayer: SelectedPlayer | null;
    setSelectedPlayer: (
        player: SelectedPlayer | null
    ) => void;

    team: string | null;
    setTeam: (
        team: string | null
    ) => void;
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
    const [
        player,
        setPlayer,
    ] =
        useState<string | null>(
            null
        );

    const [
        selectedPlayer,
        setSelectedPlayer,
    ] =
        useState<SelectedPlayer | null>(
            null
        );

    const [
        team,
        setTeam,
    ] =
        useState<string | null>(
            null
        );

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