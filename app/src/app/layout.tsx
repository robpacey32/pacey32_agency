import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import { AppProvider } from "@/context/AppContext";

export const metadata: Metadata = {
    title: "Pacey32 Analytics",
    description: "NHL player, team and city analytics",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="bg-slate-950 text-white">
                <AppProvider>
                    <Header />
                    {children}
                </AppProvider>
            </body>
        </html>
    );
}