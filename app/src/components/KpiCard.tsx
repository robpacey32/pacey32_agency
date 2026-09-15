type KpiCardProps = {
    title: string;
    value: string;
    detail?: string;
};

export default function KpiCard({
    title,
    value,
    detail,
}: KpiCardProps) {
    return (
        <div className="w-full min-w-0 max-w-full rounded-2xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-600 sm:p-6">

            <p className="mb-3 break-words text-xs font-medium text-slate-400 sm:mb-4 sm:text-sm">
                {title}
            </p>

            <p className="break-words text-2xl font-semibold text-white sm:text-3xl">
                {value}
            </p>

            {detail && (
                <p className="mt-2 break-words text-xs leading-5 text-slate-500 sm:text-sm">
                    {detail}
                </p>
            )}

        </div>
    );
}