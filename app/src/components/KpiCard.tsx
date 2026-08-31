type KpiCardProps = {
    title: string;
    value: string;
    detail?: string;
};

export default function KpiCard({ title, value, detail }: KpiCardProps) {
    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-600">
            <p className="mb-4 text-sm font-medium text-slate-400">{title}</p>
            <p className="text-3xl font-semibold">{value}</p>
            {detail && <p className="mt-2 text-sm text-slate-500">{detail}</p>}
        </div>
    );
}