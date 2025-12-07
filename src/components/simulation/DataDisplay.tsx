import type { DisplayValue } from '@/experiments/base';

interface DataDisplayProps {
    data: Record<string, DisplayValue>;
}

export function DataDisplay({ data }: DataDisplayProps) {
    const entries = Object.entries(data);

    if (entries.length === 0) return null;

    return (
        <div className="absolute bottom-4 left-4 min-w-64 rounded-xl bg-slate-800/90 backdrop-blur-sm border border-white/10 p-4">
            <h4 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">
                实时数据
            </h4>
            <div className="space-y-2">
                {entries.map(([key, item]) => (
                    <div key={key} className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">{item.label}</span>
                        <span className="text-sm font-mono text-white">
                            {typeof item.value === 'number' && item.precision !== undefined
                                ? item.value.toFixed(item.precision)
                                : item.value}
                            {item.unit && (
                                <span className="text-slate-500 ml-1">{item.unit}</span>
                            )}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default DataDisplay;
