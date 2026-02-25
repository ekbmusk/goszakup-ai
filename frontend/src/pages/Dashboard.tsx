import { useDashboardStats } from '@/hooks/useApi';
import { formatBudget, RiskLevel } from '@/types/api';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

export default function Dashboard() {
    const { t } = useTranslation();
    const { data: stats, loading, error } = useDashboardStats();
    const navigate = useNavigate();

    const riskLevelConfig = {
        LOW: { label: t('common.riskLow'), class: 'risk-low', color: 'hsl(var(--risk-low))' },
        MEDIUM: { label: t('common.riskMedium'), class: 'risk-medium', color: 'hsl(var(--risk-medium))' },
        HIGH: { label: t('common.riskHigh'), class: 'risk-high', color: 'hsl(var(--risk-high))' },
        CRITICAL: { label: t('common.riskCritical'), class: 'risk-critical', color: 'hsl(var(--risk-critical))' },
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-[hsl(var(--primary))] mx-auto" />
                    <p className="text-[hsl(var(--muted-foreground))] text-sm">{t('dashboard.loadingStats')}</p>
                </div>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-4 glass-card p-8">
                    <ServerCrash className="w-12 h-12 text-[hsl(var(--destructive))] mx-auto" />
                    <p className="text-[hsl(var(--foreground))] font-semibold">{t('common.errorLoadData')}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{error || t('common.checkApiConnection')}</p>
                </div>
            </div>
        );
    }

    const statCards = [
        {
            icon: BarChart3,
            label: t('dashboard.totalLots'),
            value: stats.total_lots.toLocaleString(),
            sub: t('dashboard.processed', { count: stats.processed_lots }),
        },
        {
            icon: TrendingUp,
            label: t('dashboard.avgRisk'),
            value: stats.avg_score.toFixed(1),
            sub: t('dashboard.outOf100'),
            highlight: stats.avg_score > 50,
        },
        {
            icon: AlertTriangle,
            label: t('dashboard.highCritical'),
            value: ((stats.by_level.HIGH || 0) + (stats.by_level.CRITICAL || 0)).toLocaleString(),
            sub: t('dashboard.highRiskLots'),
            highlight: true,
        },
        {
            icon: DollarSign,
            label: t('dashboard.totalBudget'),
            value: formatBudget(stats.total_budget),
            sub: t('dashboard.budgetNote'),
        },
    ];

    const totalLevels = Object.values(stats.by_level).reduce((a, b) => a + b, 0) || 1;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                    {t('dashboard.subtitle')}
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
                    <h2 className="text-sm font-semibold mb-4">{t('dashboard.riskDistribution')}</h2>
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
                    <h2 className="text-sm font-semibold mb-4">{t('dashboard.procurementCategories')}</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="table-header">
                                    <th className="text-left p-2.5 rounded-l-md">{t('dashboard.category')}</th>
                                    <th className="text-right p-2.5">{t('dashboard.count')}</th>
                                    <th className="text-right p-2.5">{t('dashboard.highRisk')}</th>
                                    <th className="text-right p-2.5 rounded-r-md">{t('dashboard.avgScore')}</th>
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

            {/* Synthetic vs Real Data Comparison */}
            {stats.data_type_stats && (
                <div className="glass-card p-5">
                    <h2 className="text-sm font-semibold mb-4">{t('dashboard.testVsReal')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Data Type Breakdown */}
                        <div>
                            <h3 className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase mb-3">
                                {t('dashboard.dataDistribution')}
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                                    <div>
                                        <p className="text-sm font-semibold text-blue-900">{t('dashboard.realProcurements')}</p>
                                        <p className="text-xs text-blue-700 mt-0.5">{t('dashboard.verifiedData')}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-blue-900">
                                            {stats.data_type_stats.total_real.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-blue-700">
                                            {((stats.data_type_stats.total_real / stats.total_lots) * 100).toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-200">
                                    <div>
                                        <p className="text-sm font-semibold text-purple-900">{t('dashboard.testData')}</p>
                                        <p className="text-xs text-purple-700 mt-0.5">{t('dashboard.syntheticLots')}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-purple-900">
                                            {stats.data_type_stats.total_synthetic.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-purple-700">
                                            {((stats.data_type_stats.total_synthetic / stats.total_lots) * 100).toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Risk Comparison */}
                        <div>
                            <h3 className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase mb-3">
                                {t('dashboard.riskComparison')}
                            </h3>
                            <div className="space-y-2">
                                {(Object.keys(riskLevelConfig) as RiskLevel[]).map((level) => {
                                    if (!stats.data_type_stats) return null;

                                    const realCount = stats.data_type_stats.real_risk_dist[level] || 0;
                                    const synthCount = stats.data_type_stats.synthetic_risk_dist[level] || 0;
                                    const realPct = stats.data_type_stats.total_real > 0
                                        ? (realCount / stats.data_type_stats.total_real * 100).toFixed(1)
                                        : '0.0';
                                    const synthPct = stats.data_type_stats.total_synthetic > 0
                                        ? (synthCount / stats.data_type_stats.total_synthetic * 100).toFixed(1)
                                        : '0.0';
                                    const cfg = riskLevelConfig[level];

                                    return (
                                        <div key={level} className="space-y-1">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className={`risk-badge ${cfg.class} text-[10px]`}>{cfg.label}</span>
                                                <div className="flex gap-4">
                                                    <span className="text-blue-700 font-medium">
                                                        {realCount} ({realPct}%)
                                                    </span>
                                                    <span className="text-purple-700 font-medium">
                                                        {synthCount} ({synthPct}%)
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="flex-1 h-1.5 rounded-full bg-blue-100 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-blue-500 transition-all duration-500"
                                                        style={{ width: `${realPct}%` }}
                                                    />
                                                </div>
                                                <div className="flex-1 h-1.5 rounded-full bg-purple-100 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-purple-500 transition-all duration-500"
                                                        style={{ width: `${synthPct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex gap-4 mt-4 text-xs">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded bg-blue-500"></div>
                                    <span className="text-[hsl(var(--muted-foreground))]">{t('dashboard.real')}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded bg-purple-500"></div>
                                    <span className="text-[hsl(var(--muted-foreground))]">{t('dashboard.test')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Risks */}
            <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-[hsl(var(--risk-critical))]" />
                        {t('dashboard.topRisks')}
                    </h2>
                    <button
                        onClick={() => navigate('/lots?risk_level=HIGH')}
                        className="btn-secondary text-xs"
                    >
                        {t('dashboard.allLots')} <ArrowRight className="w-3.5 h-3.5" />
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
                                                    {typeof h === 'string' ? h : String(h)}
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
