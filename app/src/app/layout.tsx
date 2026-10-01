import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
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
        <html
            lang="en"
            className="w-full min-w-0 bg-slate-950"
        >
            <body className="w-full min-w-0 max-w-full overflow-x-hidden bg-slate-950 text-white">
                <AppProvider>
                    <Header />

                    <div className="w-full min-w-0 max-w-full">
                        {children}
                    </div>
                </AppProvider>

                <GoogleAnalytics gaId="G-J2C9X7Y3BX" />
            </body>
        </html>
    );
}