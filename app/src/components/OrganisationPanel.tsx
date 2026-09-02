"use client";

import {
    useEffect,
    useState,
} from "react";

import {
    BriefcaseBusiness,
    CalendarDays,
    Clock3,
    Crown,
    Shield,
    Trophy,
    UsersRound,
} from "lucide-react";

export type OrganisationSuccess = {
    seasonId: number;
    season_label: string;
    opponent: string | null;
    score: string | null;
};

export type OrganisationDetail = {
    tricode: string;
    fullName: string;
    home_logo: string | null;

    head_coach: string | null;
    head_coach_since: string | null;

    general_manager: string | null;
    gm_since: string | null;
    gm_playing_career: string | null;

    principal_owner: string | null;
    owner_since: string | number | null;
    purchase_price_usd_m: number | null;

    captain: string | null;
    captain_since: string | null;
    captain_position: string | null;

    alternate_captain_1: string | null;
    alternate_captain_2: string | null;
    alternate_captain_3: string | null;
    alternate_captain_4: string | null;
    alternate_captain_5: string | null;
    alternate_captain_6: string | null;

    stanley_cups: number | null;

    organization_summary: string | null;
    fanbase_media_pressure: string | null;
};

export type OrganisationData = {
    team: string;
    organisation: OrganisationDetail;
    championships: OrganisationSuccess[];
    finalists: OrganisationSuccess[];
};

type Player = {
    playerId: number;
    name: string;
    team: string | null;
    position: string | null;
    headshot_url: string | null;
};

type Props = {
    data: OrganisationData;
};

export default function OrganisationPanel({
    data,
}: Props) {
    const organisation =
        data.organisation;

    const [
        players,
        setPlayers,
    ] = useState<Player[]>([]);

    useEffect(() => {
        let cancelled = false;

        async function loadPlayers() {
            try {
                const response =
                    await fetch(
                        "/api/players"
                    );

                if (!response.ok) {
                    return;
                }

                const result: Player[] =
                    await response.json();

                if (!cancelled) {
                    setPlayers(result);
                }
            } catch {
                if (!cancelled) {
                    setPlayers([]);
                }
            }
        }

        loadPlayers();

        return () => {
            cancelled = true;
        };
    }, []);

    const alternates = [
        organisation.alternate_captain_1,
        organisation.alternate_captain_2,
        organisation.alternate_captain_3,
        organisation.alternate_captain_4,
        organisation.alternate_captain_5,
        organisation.alternate_captain_6,
    ].filter(Boolean) as string[];

    const findPlayer = (
        name: string | null
    ) => {
        if (!name) {
            return null;
        }

        return (
            players.find(
                (player) =>
                    player.name
                        .trim()
                        .toLowerCase() ===
                    name
                        .trim()
                        .toLowerCase()
            ) ?? null
        );
    };

    const captain =
        findPlayer(
            organisation.captain
        );

    return (
        <div className="space-y-5">

            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                <SectionHeader
                    icon={
                        <UsersRound
                            size={20}
                            className="text-blue-400"
                        />
                    }
                    title="Management"
                    subtitle="Key leadership and ownership of the organisation."
                />

                <div className="mt-5 grid min-w-[900px] grid-cols-3 gap-5 overflow-x-auto">
                    <ManagementCard
                        type="GENERAL MANAGER"
                        name={
                            organisation.general_manager
                        }
                        sinceLabel="GM since"
                        since={
                            organisation.gm_since
                        }
                        icon={
                            <BriefcaseBusiness
                                size={26}
                            />
                        }
                        colour="blue"
                        footer={
                            organisation.gm_playing_career
                                ? `Playing career: ${organisation.gm_playing_career}`
                                : null
                        }
                    />

                    <ManagementCard
                        type="HEAD COACH"
                        name={
                            organisation.head_coach
                        }
                        sinceLabel="Coach since"
                        since={
                            organisation.head_coach_since
                        }
                        icon={
                            <Shield
                                size={26}
                            />
                        }
                        colour="rose"
                    />

                    <ManagementCard
                        type="OWNERSHIP"
                        name={
                            organisation.principal_owner
                        }
                        sinceLabel="Owner since"
                        since={
                            organisation.owner_since
                        }
                        icon={
                            <UsersRound
                                size={26}
                            />
                        }
                        colour="green"
                        footer={
                            organisation.purchase_price_usd_m !=
                            null
                                ? `Purchase price: $${organisation.purchase_price_usd_m}m`
                                : null
                        }
                    />
                </div>
            </section>

            <div className="grid min-w-[900px] grid-cols-2 gap-5 overflow-x-auto">
                <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                    <SectionHeader
                        icon={
                            <BriefcaseBusiness
                                size={20}
                                className="text-blue-400"
                            />
                        }
                        title="Organisation Profile"
                        subtitle="Structure, culture and player environment."
                    />

                    <p className="mt-5 text-sm leading-7 text-slate-300">
                        {organisation.organization_summary ??
                            "Organisation summary unavailable."}
                    </p>
                </section>

                <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                    <SectionHeader
                        icon={
                            <UsersRound
                                size={20}
                                className="text-violet-400"
                            />
                        }
                        title="Fanbase & Media Pressure"
                        subtitle="Supporter environment and external scrutiny."
                    />

                    <p className="mt-5 text-sm leading-7 text-slate-300">
                        {organisation.fanbase_media_pressure ??
                            "Fanbase and media information unavailable."}
                    </p>
                </section>
            </div>

            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                <SectionHeader
                    icon={
                        <Shield
                            size={20}
                            className="text-slate-300"
                        />
                    }
                    title="Leadership Group"
                    subtitle="On-ice leadership group."
                />

                <div className="mt-5 grid min-w-[1050px] grid-cols-[1.35fr_2fr] gap-5 overflow-x-auto">

                    <div className="overflow-hidden rounded-xl border border-blue-500/50 bg-slate-950/50">
                        <div className="grid min-h-[320px] grid-cols-[230px_1fr]">

                            <PlayerHeadshot
                                player={
                                    captain
                                }
                                name={
                                    organisation.captain
                                }
                            />

                            <div className="flex flex-col justify-center p-6">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500/20 text-lg font-bold text-blue-300">
                                        C
                                    </div>

                                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-400">
                                        Captain
                                    </div>
                                </div>

                                <div className="mt-5 text-3xl font-bold text-white">
                                    {organisation.captain ??
                                        "—"}
                                </div>

                                <div className="mt-6 flex gap-5 border-t border-slate-800 pt-4 text-sm text-slate-400">
                                    {organisation.captain_since && (
                                        <span className="flex items-center gap-2">
                                            <CalendarDays
                                                size={16}
                                            />
                                            Since{" "}
                                            {
                                                organisation.captain_since
                                            }
                                        </span>
                                    )}

                                    {organisation.captain_position && (
                                        <span>
                                            {
                                                organisation.captain_position
                                            }
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Alternate Captains
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            {alternates.length ? (
                                alternates.map(
                                    (name) => {
                                        const player =
                                            findPlayer(
                                                name
                                            );

                                        return (
                                            <div
                                                key={name}
                                                className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50"
                                            >
                                                <div className="relative h-[230px]">
                                                    <PlayerHeadshot
                                                        player={
                                                            player
                                                        }
                                                        name={
                                                            name
                                                        }
                                                    />

                                                    <div className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-blue-400/60 bg-slate-950/85 font-bold text-blue-300">
                                                        A
                                                    </div>
                                                </div>

                                                <div className="border-t border-slate-800 p-4 text-center">
                                                    <div className="text-xl font-semibold text-white">
                                                        {
                                                            name
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                )
                            ) : (
                                <div className="col-span-3 rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-500">
                                    No alternate
                                    captains listed.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                <SectionHeader
                    icon={
                        <Trophy
                            size={20}
                            className="text-yellow-400"
                        />
                    }
                    title="Franchise Success"
                    subtitle="Stanley Cup championships and final appearances."
                />

                <div className="mt-6">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-yellow-400">
                        Stanley Cup Champions
                    </div>

                    <SuccessRow
                        count={
                            organisation.stanley_cups ??
                            data.championships.length
                        }
                        seasons={
                            data.championships
                        }
                        winner
                    />
                </div>

                <div className="mt-7">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Stanley Cup Finalists
                    </div>

                    <SuccessRow
                        count={
                            data.finalists.length
                        }
                        seasons={
                            data.finalists
                        }
                    />
                </div>
            </section>
        </div>
    );
}

function PlayerHeadshot({
    player,
    name,
}: {
    player: Player | null;
    name: string | null;
}) {
    if (!player?.headshot_url) {
        return (
            <div className="flex h-full min-h-[230px] items-center justify-center bg-slate-900 text-slate-600">
                <UsersRound
                    size={72}
                />
            </div>
        );
    }

    return (
        <div className="h-full w-full overflow-hidden bg-slate-900">
            <img
                src={
                    player.headshot_url
                }
                alt={
                    name ??
                    "Player"
                }
                className="h-full w-full object-cover object-top"
            />
        </div>
    );
}

function SuccessRow({
    count,
    seasons,
    winner = false,
}: {
    count: number;
    seasons: OrganisationSuccess[];
    winner?: boolean;
}) {
    return (
        <div className="flex min-w-[700px] items-stretch gap-5 overflow-x-auto">

            <div className="flex w-20 shrink-0 items-center justify-center">
                <div
                    className={
                        winner
                            ? "text-4xl font-bold text-yellow-400"
                            : "text-4xl font-bold text-slate-300"
                    }
                >
                    {count}
                </div>
            </div>

            <div className="w-px shrink-0 bg-slate-700" />

            <div className="flex flex-1 gap-4">
                {seasons.map(
                    (season) => (
                        <CupCard
                            key={
                                season.seasonId
                            }
                            season={
                                season.season_label
                            }
                            opponent={
                                season.opponent
                            }
                            score={
                                season.score
                            }
                            winner={
                                winner
                            }
                        />
                    )
                )}

                {!seasons.length && (
                    <div className="flex min-h-[105px] flex-1 items-center text-sm text-slate-600">
                        Historical season
                        data loading.
                    </div>
                )}
            </div>
        </div>
    );
}

function SectionHeader({
    icon,
    title,
    subtitle,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
}) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5">
                {icon}
            </div>

            <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
                    {title}
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                    {subtitle}
                </p>
            </div>
        </div>
    );
}

function ManagementCard({
    type,
    name,
    sinceLabel,
    since,
    icon,
    colour,
    footer,
}: {
    type: string;
    name: string | null;
    sinceLabel: string;
    since: string | number | null;
    icon: React.ReactNode;
    colour: "blue" | "rose" | "green";
    footer?: string | null;
}) {
    const styles = {
        blue: {
            circle:
                "border-blue-500/50 bg-blue-500/10 text-blue-400",
            label: "text-blue-400",
        },
        rose: {
            circle:
                "border-rose-500/50 bg-rose-500/10 text-rose-400",
            label: "text-rose-400",
        },
        green: {
            circle:
                "border-green-500/50 bg-green-500/10 text-green-400",
            label: "text-green-400",
        },
    }[colour];

    const tenure =
        yearsSince(since);

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-6">
            <div className="flex flex-col items-center text-center">
                <div
                    className={`flex h-16 w-16 items-center justify-center rounded-full border ${styles.circle}`}
                >
                    {icon}
                </div>

                <div
                    className={`mt-5 text-xs font-semibold uppercase tracking-wide ${styles.label}`}
                >
                    {type}
                </div>

                <div className="mt-2 min-h-14 text-xl font-bold text-white">
                    {name ?? "—"}
                </div>
            </div>

            <div className="mt-5 space-y-3 border-t border-slate-800 pt-4 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                    <CalendarDays
                        size={17}
                        className={
                            styles.label
                        }
                    />

                    <span>
                        {sinceLabel}{" "}
                        {formatSince(
                            since
                        )}
                    </span>
                </div>

                {tenure != null && (
                    <div className="flex items-center gap-3">
                        <Clock3
                            size={17}
                            className={
                                styles.label
                            }
                        />

                        <span>
                            {tenure}{" "}
                            {tenure === 1
                                ? "year"
                                : "years"}
                        </span>
                    </div>
                )}

                {footer && (
                    <div className="border-t border-slate-800 pt-3 text-slate-400">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

function CupCard({
    season,
    opponent,
    score,
    winner = false,
}: {
    season: string;
    opponent: string | null;
    score: string | null;
    winner?: boolean;
}) {
    return (
        <div
            className={
                winner
                    ? "min-w-[210px] rounded-xl border border-yellow-500/50 bg-yellow-500/[0.04] p-5 text-center"
                    : "min-w-[210px] rounded-xl border border-slate-700 bg-slate-950/50 p-5 text-center"
            }
        >
            <div
                className={
                    winner
                        ? "mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-yellow-500/50 bg-yellow-500/10 text-yellow-400"
                        : "mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-800/50 text-slate-400"
                }
            >
                {winner ? (
                    <Trophy
                        size={24}
                    />
                ) : (
                    <Crown
                        size={22}
                    />
                )}
            </div>

            <div
                className={
                    winner
                        ? "mt-3 text-xl font-bold text-yellow-400"
                        : "mt-3 text-xl font-bold text-slate-300"
                }
            >
                {season}
            </div>

            <div className="mt-2 text-sm font-medium text-slate-300">
                vs. {opponent ?? "—"}
                {score &&
                    ` (${score})`}
            </div>
        </div>
    );
}

function formatSince(
    value: string | number | null
) {
    if (value == null) {
        return "—";
    }

    return String(value).replace(
        /^"|"$/g,
        ""
    );
}

function yearsSince(
    value: string | number | null
) {
    if (value == null) {
        return null;
    }

    const text =
        String(value).replace(
            /^"|"$/g,
            ""
        );

    let startYear:
        | number
        | null = null;

    if (/^\d{4}$/.test(text)) {
        startYear =
            Number(text);
    } else {
        const date =
            new Date(text);

        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {
            startYear =
                date.getFullYear();
        }
    }

    if (startYear == null) {
        return null;
    }

    return (
        new Date().getFullYear() -
        startYear
    );
}