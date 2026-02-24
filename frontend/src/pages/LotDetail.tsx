import { useParams, useNavigate } from 'react-router-dom';
import { useLotAnalysis } from '@/hooks/useApi';
import { formatBudget, type RiskLevel } from '@/types/api';
import {
    ArrowLeft,
    Loader2,
    ServerCrash,
    Shield,
    Brain,
    Network,
    FileText,
    AlertTriangle,
    CheckCircle2,
    Scale,
    Clock,
    Users,
    MapPin,
    Tag,
} from 'lucide-react';

const riskConfig: Record<string, { label: string; class: string; color: string }> = {
    LOW: { label: 'Низкий', class: 'risk-low', color: 'hsl(var(--risk-low))' },
    MEDIUM: { label: 'Средний', class: 'risk-medium', color: 'hsl(var(--risk-medium))' },
    HIGH: { label: 'Высокий', class: 'risk-high', color: 'hsl(var(--risk-high))' },
    CRITICAL: { label: 'Критический', class: 'risk-critical', color: 'hsl(var(--risk-critical))' },
};

const severityColors: Record<string, string> = {
    low: 'hsl(var(--risk-low))',
    medium: 'hsl(var(--risk-medium))',
    high: 'hsl(var(--risk-high))',
    critical: 'hsl(var(--risk-critical))',
};

export default function LotDetail() {
    const { lotId } = useParams<{ lotId: string }>();
    const navigate = useNavigate();
    const { data: analysis, loading, error } = useLotAnalysis(lotId || null);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-[hsl(var(--primary))] mx-auto" />
                    <p className="text-[hsl(var(--muted-foreground))] text-sm">Загрузка анализа...</p>
                </div>
            </div>
        );
    }

    if (error || !analysis) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-4 glass-card p-8">
                    <ServerCrash className="w-12 h-12 text-[hsl(var(--destructive))] mx-auto" />
                    <p className="text-[hsl(var(--foreground))] font-semibold">Не удалось загрузить анализ</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{error}</p>
                    <button onClick={() => navigate(-1)} className="btn-secondary mt-2">
                        <ArrowLeft className="w-4 h-4" /> Назад
                    </button>
                </div>
            </div>
        );
    }

    const cfg = riskConfig[analysis.final_level] || riskConfig.HIGH;
    const lot = analysis.lot_data;
    const rules = analysis.rule_analysis;
    const ml = analysis.ml_prediction;

    return (
        <div className="space-y-6">
            {/* Back + Header */}
            <div>
                <button onClick={() => navigate(-1)} className="btn-secondary text-xs mb-4">
                    <ArrowLeft className="w-3.5 h-3.5" /> Назад к лотам
                </button>

                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Lot Info */}
                    <div className="flex-1">
                        <h1 className="text-xl font-bold tracking-tight">{lot.name_ru}</h1>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 font-mono">{analysis.lot_id}</p>

                        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[hsl(var(--muted-foreground))]">
                            <span className="inline-flex items-center gap-1"><Tag className="w-3 h-3" /> {lot.category_name}</span>
                            <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {lot.city}</span>
                            <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {lot.participants_count} участников</span>
                            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {lot.deadline_days} дней</span>
                            <span className="inline-flex items-center gap-1"><Scale className="w-3 h-3" /> {formatBudget(lot.budget)}</span>
                        </div>
                    </div>

                    {/* Score */}
                    <div className="flex items-center gap-4">
                        <div
                            className="score-ring text-2xl"
                            style={{ border: `4px solid ${cfg.color}`, color: cfg.color, width: 80, height: 80 }}
                        >
                            {analysis.final_score.toFixed(0)}
                        </div>
                        <div>
                            <span className={`risk-badge ${cfg.class} text-sm`}>{cfg.label}</span>
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Итоговый балл</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Risk Rules */}
            <div className="glass-card p-5">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                    <Shield className="w-4 h-4 text-[hsl(var(--primary))]" />
                    Правила риска ({rules.rules_triggered.length} из {rules.total_rules_checked})
                </h2>

                {rules.summary_ru && (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4 p-3 rounded-lg bg-[hsl(var(--secondary))]">
                        {rules.summary_ru}
                    </p>
                )}

                <div className="space-y-3">
                    {rules.rules_triggered.map((rule, i) => (
                        <div
                            key={i}
                            className="p-3 rounded-lg bg-[hsl(var(--secondary))] border-l-[3px]"
                            style={{ borderLeftColor: severityColors[rule.severity] || severityColors.medium }}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: severityColors[rule.severity] }} />
                                        <span className="text-sm font-medium">{rule.rule_name_ru}</span>
                                        <span className="risk-badge text-[9px]" style={{
                                            background: `${severityColors[rule.severity]}20`,
                                            color: severityColors[rule.severity],
                                            border: `1px solid ${severityColors[rule.severity]}40`,
                                        }}>
                                            {rule.severity.toUpperCase()}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5">{rule.explanation_ru}</p>
                                    {rule.evidence && (
                                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 font-mono bg-[hsl(var(--background))] p-1.5 rounded">
                                            📝 {rule.evidence}
                                        </p>
                                    )}
                                    {rule.law_reference && (
                                        <p className="text-[10px] text-[hsl(var(--primary))] mt-1">
                                            📖 {rule.law_reference}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-lg font-bold" style={{ color: severityColors[rule.severity] }}>
                                        {rule.raw_score.toFixed(0)}
                                    </p>
                                    <p className="text-[9px] text-[hsl(var(--muted-foreground))]">вес: {rule.weight}</p>
                                </div>
                            </div>
                        </div>
                    ))}

                    {rules.rules_triggered.length === 0 && (
                        <div className="flex items-center gap-2 text-sm text-[hsl(var(--primary))] p-3">
                            <CheckCircle2 className="w-4 h-4" />
                            Нарушений правил не обнаружено
                        </div>
                    )}
                </div>

                {/* Passed count */}
                <div className="mt-3 text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-[hsl(var(--primary))]" />
                    {rules.rules_passed_count} правил пройдено успешно
                </div>
            </div>

            {/* ML + Network row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ML Prediction */}
                <div className="glass-card p-5">
                    <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                        <Brain className="w-4 h-4 text-[hsl(var(--primary))]" />
                        ML-Предсказание
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-[hsl(var(--secondary))]">
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">CatBoost</p>
                            <p className="text-xl font-bold mt-1" style={{
                                color: ml.catboost_proba >= 0.75 ? 'hsl(var(--risk-critical))' :
                                    ml.catboost_proba >= 0.5 ? 'hsl(var(--risk-high))' : 'hsl(var(--risk-low))'
                            }}>
                                {(ml.catboost_proba * 100).toFixed(0)}%
                            </p>
                        </div>
                        <div className="p-3 rounded-lg bg-[hsl(var(--secondary))]">
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">Isolation Forest</p>
                            <p className="text-xl font-bold mt-1" style={{
                                color: ml.isolation_anomaly ? 'hsl(var(--risk-critical))' : 'hsl(var(--risk-low))'
                            }}>
                                {ml.isolation_anomaly ? 'Аномалия' : 'Норма'}
                            </p>
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">score: {ml.isolation_score.toFixed(2)}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-[hsl(var(--secondary))] col-span-2">
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">ML Score (итого)</p>
                            <div className="flex items-center gap-3 mt-1">
                                <div className="flex-1 h-2 rounded-full bg-[hsl(var(--background))] overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{
                                            width: `${ml.ml_score}%`,
                                            background: ml.ml_score >= 75 ? 'hsl(var(--risk-critical))' :
                                                ml.ml_score >= 50 ? 'hsl(var(--risk-high))' :
                                                    ml.ml_score >= 25 ? 'hsl(var(--risk-medium))' : 'hsl(var(--risk-low))',
                                        }}
                                    />
                                </div>
                                <span className="text-sm font-bold">{ml.ml_score.toFixed(1)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Network Flags + Explanation */}
                <div className="space-y-6">
                    {analysis.network_flags.length > 0 && (
                        <div className="glass-card p-5">
                            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
                                <Network className="w-4 h-4 text-[hsl(var(--risk-high))]" />
                                Сетевые флаги
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {analysis.network_flags.map((flag, i) => (
                                    <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-[hsla(var(--risk-high),0.1)] text-[hsl(var(--risk-high))] border border-[hsla(var(--risk-high),0.2)]">
                                        {flag.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {analysis.explanation.length > 0 && (
                        <div className="glass-card p-5">
                            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
                                <FileText className="w-4 h-4 text-[hsl(var(--primary))]" />
                                Объяснение
                            </h2>
                            <ul className="space-y-2">
                                {analysis.explanation.map((text, i) => (
                                    <li key={i} className="flex gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                                        <span className="text-[hsl(var(--primary))] flex-shrink-0">→</span>
                                        {text}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Similar Lots */}
            {analysis.similar_lots.length > 0 && (
                <div className="glass-card p-5">
                    <h2 className="text-sm font-semibold mb-3">Похожие лоты</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {analysis.similar_lots.map((s, i) => (
                            <div
                                key={i}
                                className="p-3 rounded-lg bg-[hsl(var(--secondary))] cursor-pointer hover:bg-[hsla(var(--primary),0.06)] transition-colors"
                                onClick={() => navigate(`/lots/${encodeURIComponent(s.lot_id)}`)}
                            >
                                <p className="text-sm font-medium truncate">{s.name_ru}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className="flex-1 h-1.5 rounded-full bg-[hsl(var(--background))] overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-[hsl(var(--primary))]"
                                            style={{ width: `${s.similarity * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-[hsl(var(--primary))] font-medium">
                                        {(s.similarity * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
