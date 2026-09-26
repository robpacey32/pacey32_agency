"use client";

import { FormEvent, useState } from "react";

export default function LoginForm() {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setError("");
        setLoading(true);

        try {
            const response = await fetch(
                "/api/qa/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        password,
                    }),
                }
            );

            if (!response.ok) {
                setError("Incorrect password.");
                return;
            }

            window.location.reload();
        } catch {
            setError("Unable to sign in.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen p-8">
            <div className="mx-auto mt-20 max-w-md">
                <h1 className="text-3xl font-bold">
                    Pacey32 Data Quality
                </h1>

                <p className="mt-2 text-gray-500">
                    Private administration area
                </p>

                <form
                    onSubmit={handleSubmit}
                    className="mt-8"
                >
                    <label
                        htmlFor="password"
                        className="block text-sm font-medium"
                    >
                        Password
                    </label>

                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(event) =>
                            setPassword(event.target.value)
                        }
                        autoComplete="current-password"
                        className="
                            mt-2
                            w-full
                            rounded-lg
                            border
                            border-gray-700
                            bg-transparent
                            px-4
                            py-3
                            outline-none
                        "
                    />

                    {error && (
                        <p className="mt-3 text-sm text-red-400">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="
                            mt-6
                            rounded-lg
                            bg-white
                            px-5
                            py-3
                            font-semibold
                            text-black
                            disabled:opacity-50
                        "
                    >
                        {loading
                            ? "Signing in..."
                            : "Sign in"}
                    </button>
                </form>
            </div>
        </main>
    );
}
