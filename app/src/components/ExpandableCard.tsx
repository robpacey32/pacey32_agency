type ExpandableCardProps = {
    title: string;
    value: React.ReactNode;
    detail?: React.ReactNode;
    openDetail?: React.ReactNode;
    open: boolean;
    compact?: boolean;
    uniformValueDetail?: boolean;
    onClick: () => void;
    children?: React.ReactNode;
};

export default function ExpandableCard({
    title,
    value,
    detail,
    openDetail,
    open,
    compact = false,
    uniformValueDetail = false,
    onClick,
    children
}: ExpandableCardProps) {
    const displayedDetail =
        open
            ? openDetail ?? detail
            : detail;

    return (
        <div
            onClick={onClick}
            className={`w-full min-w-0 max-w-full cursor-pointer overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 transition hover:border-slate-600 ${
                compact
                    ? "p-4"
                    : "p-4 sm:p-6"
            }`}
        >
            <div className="flex min-w-0 items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <p
                        className={`${compact ? "mb-1 text-xs" : "mb-4 text-sm"} font-medium text-slate-400`}
                    >
                        {title}
                    </p>

                    <div
                        className={`min-w-0 break-words ${
                            uniformValueDetail
                                ? `${compact ? "text-base" : "text-lg"} font-semibold text-white`
                                : `${compact ? "text-xl" : "text-3xl"} font-semibold`
                        }`}
                    >
                        {value}
                    </div>

                    {!compact && displayedDetail && (
                        <div
                            className={`min-w-0 break-words ${
                                uniformValueDetail
                                    ? "mt-1 text-lg font-semibold text-white"
                                    : "mt-2 text-sm text-slate-500"
                            }`}
                        >
                            {displayedDetail}
                        </div>
                    )}
                </div>

                <span className="shrink-0 text-xl text-slate-500">
                    {open ? "−" : "+"}
                </span>
            </div>

            {open && children && (
                <div
                    className="mt-6 w-full min-w-0 max-w-full border-t border-slate-800 pt-6"
                    onClick={(e) => e.stopPropagation()}
                >
                    {children}
                </div>
            )}
        </div>
    );
}