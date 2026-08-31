"use client";

import { createContext, useContext, useState } from "react";

type AppContextType = {
    player: string;
    setPlayer: (player: string) => void;
    team: string;
    setTeam: (team: string) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [player, setPlayer] = useState("8477492");
    const [team, setTeam] = useState("COL");

    return (
        <AppContext.Provider value={{ player, setPlayer, team, setTeam }}>
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext() {
    const context = useContext(AppContext);

    if (!context) {
        throw new Error("useAppContext must be used inside AppProvider");
    }

    return context;
}