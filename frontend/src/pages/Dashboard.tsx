import { useDashboardStats } from '@/hooks/useApi';
import { formatBudget, RiskLevel } from '@/types/api';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp,
    AlertTriangle,
    DollarSign,
    BarChart3,
    ShieldAlert,
    ArrowRight,
    Loader2,
    ServerCrash,
} from 'lucide-react';

const riskLevelConfig = {
    LOW: { label: 'Низкий', class: 'risk-low', color: 'hsl(var(--risk-low))' },
    MEDIUM: { label: 'Средний', class: 'risk-medium', color: 'hsl(var(--risk-medium))' },
    HIGH: { label: 'Высокий', class: 'risk-high', color: 'hsl(var(--risk-high))' },
    CRITICAL: { label: 'Критический', class: 'risk-critical', color: 'hsl(var(--risk-critical))' },
};

export default function Dashboard() {
    const { data: stats, loading, error } = useDashboardStats();
    const navigate = useNavigate();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-[hsl(var(--primary))] mx-auto" />
                    <p className="text-[hsl(var(--muted-foreground))] text-sm">Загрузка статистики...</p>
                </div>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-4 glass-card p-8">
                    <ServerCrash className="w-12 h-12 text-[hsl(var(--destructive))] mx-auto" />
                    <p className="text-[hsl(var(--foreground))] font-semibold">Не удалось загрузить данные</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{error || 'Проверьте подключение к API'}</p>
                </div>
            </div>
        );
    }

    const statCards = [
        {
            icon: BarChart3,
            label: 'Всего лотов',
            value: stats.total_lots.toLocaleString(),
            sub: `Обработано: ${stats.processed_lots.toLocaleString()}`,
        },
        {
            icon: TrendingUp,
            label: 'Средний риск',
            value: stats.avg_score.toFixed(1),
            sub: 'Баллов из 100',
            highlight: stats.avg_score > 50,
        },
        {
            icon: AlertTriangle,
            label: 'Высокий + Критический',
            value: ((stats.by_level.HIGH || 0) + (stats.by_level.CRITICAL || 0)).toLocaleString(),
            sub: 'Лотов с высоким риском',
            highlight: true,
        },
        {
            icon: DollarSign,
            label: 'Общий бюджет',
            value: formatBudget(stats.total_budget),
            sub: 'Закупки в тенге',
        },
    ];

    const totalLevels = Object.values(stats.by_level).reduce((a, b) => a + b, 0) || 1;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Дашборд</h1>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                    Обзор рисков государственных закупок РК
                </p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((card, i) => (
                    <div key={i} className="glass-card p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium uppercase tracking-wide">
                                    {card.label}
                                </p>
                                <p className={`text-2xl font-bold mt-2 ${card.highlight ? 'text-[hsl(var(--risk-high))]' : 'text-[hsl(var(--foreground))]'}`}>
                                    {card.value}
                                </p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{card.sub}</p>
                            </div>
                            <div className={`p-2.5 rounded-lg ${card.highlight ? 'bg-[hsla(var(--risk-high),0.12)]' : 'bg-[hsla(var(--primary),0.1)]'}`}>
                                <card.icon className={`w-5 h-5 ${card.highlight ? 'text-[hsl(var(--risk-high))]' : 'text-[hsl(var(--primary))]'}`} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Risk Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bar Distribution */}
                <div className="glass-card p-5 lg:col-span-1">
                    <h2 className="text-sm font-semibold mb-4">Распределение по рискам</h2>
                    <div className="space-y-3">
                        {(Object.keys(riskLevelConfig) as RiskLevel[]).map((level) => {
                            const count = stats.by_level[level] || 0;
                            const pct = ((count / totalLevels) * 100).toFixed(1);
                            const cfg = riskLevelConfig[level];
                            return (
                                <div key={level} className="space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                        <span className={`risk-badge ${cfg.class}`}>{cfg.label}</span>
                                        <span className="text-[hsl(var(--muted-foreground))]">{count} ({pct}%)</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-[hsl(var(--secondary))] overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{
                                                width: `${pct}%`,
                                                background: cfg.color,
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Categories */}
                <div className="glass-card p-5 lg:col-span-2">
                    <h2 className="text-sm font-semibold mb-4">Категории закупок</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="table-header">
                                    <th className="text-left p-2.5 rounded-l-md">Категория</th>
                                    <th className="text-right p-2.5">Кол-во</th>
                                    <th className="text-right p-2.5">Высокий риск</th>
                                    <th className="text-right p-2.5 rounded-r-md">Ср. балл</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(stats.by_category)
                                    .sort(([, a], [, b]) => b.avg_score - a.avg_score)
                                    .slice(0, 8)
                                    .map(([name, cat]) => (
                                        <tr key={name} className="table-row">
                                            <td className="p-2.5 font-medium">{name}</td>
                                            <td className="p-2.5 text-right text-[hsl(var(--muted-foreground))]">{cat.count}</td>
                                            <td className="p-2.5 text-right">
                                                <span className="text-[hsl(var(--risk-high))]">{cat.high_risk}</span>
                                            </td>
                                            <td className="p-2.5 text-right">
                                                <span className={
                                                    cat.avg_score >= 75 ? 'text-[hsl(var(--risk-critical))]' :
                                                        cat.avg_score >= 50 ? 'text-[hsl(var(--risk-high))]' :
                                                            cat.avg_score >= 25 ? 'text-[hsl(var(--risk-medium))]' :
                                                                'text-[hsl(var(--risk-low))]'
                                                }>
                                                    {cat.avg_score.toFixed(1)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Top Risks */}
            <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-[hsl(var(--risk-critical))]" />
                        ТОП рискованных лотов
                    </h2>
                    <button
                        onClick={() => navigate('/lots?risk_level=HIGH')}
                        className="btn-secondary text-xs"
                    >
                        Все лоты <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
                <div className="space-y-3">
                    {stats.top_risks.slice(0, 5).map((lot, i) => {
                        const level = lot.final_level as RiskLevel;
                        const cfg = riskLevelConfig[level] || riskLevelConfig.HIGH;
                        return (
                            <div
                                key={lot.lot_id || i}
                                className="flex items-center gap-4 p-3 rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsla(var(--primary),0.06)] transition-colors cursor-pointer"
                                onClick={() => lot.lot_id && navigate(`/lots/${encodeURIComponent(lot.lot_id)}`)}
                            >
                                {/* Score Circle */}
                                <div
                                    className="score-ring flex-shrink-0"
                                    style={{
                                        border: `3px solid ${cfg.color}`,
                                        color: cfg.color,
                                    }}
                                >
                                    {lot.final_score.toFixed(0)}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {lot.lot_data?.name_ru || lot.lot_id}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                                        {lot.lot_data?.budget && (
                                            <span>{formatBudget(lot.lot_data.budget)}</span>
                                        )}
                                        {lot.lot_data?.city && (
                                            <span>• {lot.lot_data.city}</span>
                                        )}
                                    </div>
                                    {lot.rule_analysis?.highlights && (
                                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                                            {lot.rule_analysis.highlights.slice(0, 2).map((h, j) => (
                                                <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-[hsla(var(--risk-high),0.1)] text-[hsl(var(--risk-high))]">
                                                    {h.replace(/^⚠️\s*/, '')}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Badge */}
                                <span className={`risk-badge ${cfg.class} flex-shrink-0`}>
                                    {cfg.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
