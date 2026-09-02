type ExpandableCardProps = {
    title: string;
    value: string;
    detail?: string;
    openDetail?: string;
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
            className={`cursor-pointer rounded-2xl border border-slate-800 bg-slate-900 transition hover:border-slate-600 ${
                compact ? "p-4" : "p-6"
            }`}
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className={`${compact ? "mb-1 text-xs" : "mb-4 text-sm"} font-medium text-slate-400`}>
                        {title}
                    </p>

                    <p
                        className={
                            uniformValueDetail
                                ? `${compact ? "text-base" : "text-lg"} font-semibold text-white`
                                : `${compact ? "text-xl" : "text-3xl"} font-semibold`
                        }
                    >
                        {value}
                    </p>

                    {!compact && displayedDetail && (
                        <p
                            className={
                                uniformValueDetail
                                    ? "mt-1 text-lg font-semibold text-white"
                                    : "mt-2 text-sm text-slate-500"
                            }
                        >
                            {displayedDetail}
                        </p>
                    )}
                </div>

                <span className="text-xl text-slate-500">
                    {open ? "−" : "+"}
                </span>
            </div>

            {open && children && (
                <div
                    className="mt-6 border-t border-slate-800 pt-6"
                    onClick={(e) => e.stopPropagation()}
                >
                    {children}
                </div>
            )}
        </div>
    );
}