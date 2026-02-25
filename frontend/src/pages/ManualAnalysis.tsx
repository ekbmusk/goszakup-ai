import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTextAnalysis } from '@/hooks/useApi';
import { formatBudget } from '@/types/api';
import {
    FileSearch,
    Loader2,
    Send,
    Shield,
    Brain,
    AlertTriangle,
    CheckCircle2,
    RotateCcw,
} from 'lucide-react';

const severityColors: Record<string, string> = {
    low: 'hsl(var(--risk-low))',
    medium: 'hsl(var(--risk-medium))',
    high: 'hsl(var(--risk-high))',
    critical: 'hsl(var(--risk-critical))',
};

export default function ManualAnalysis() {
    const { t } = useTranslation();
    const [text, setText] = useState('');
    const [budget, setBudget] = useState('');
    const [participants, setParticipants] = useState('');
    const [deadline, setDeadline] = useState('');
    const [categoryCode, setCategoryCode] = useState('');

    const { data: analysis, loading, error, analyze } = useTextAnalysis();

    const riskConfig: Record<string, { label: string; class: string; color: string }> = {
        LOW: { label: t('common.riskLow'), class: 'risk-low', color: 'hsl(var(--risk-low))' },
        MEDIUM: { label: t('common.riskMedium'), class: 'risk-medium', color: 'hsl(var(--risk-medium))' },
        HIGH: { label: t('common.riskHigh'), class: 'risk-high', color: 'hsl(var(--risk-high))' },
        CRITICAL: { label: t('common.riskCritical'), class: 'risk-critical', color: 'hsl(var(--risk-critical))' },
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;

        await analyze({
            text: text.trim(),
            budget: budget ? parseFloat(budget) : undefined,
            participants_count: participants ? parseInt(participants) : undefined,
            deadline_days: deadline ? parseInt(deadline) : undefined,
            category_code: categoryCode || undefined,
        });
    };

    const handleReset = () => {
        setText('');
        setBudget('');
        setParticipants('');
        setDeadline('');
        setCategoryCode('');
    };

    const cfg = analysis ? riskConfig[analysis.final_level] || riskConfig.HIGH : null;

    const getScoreMessage = (score: number) => {
        if (score >= 75) return t('manualAnalysis.recommendReformulate');
        if (score >= 50) return t('manualAnalysis.potentialRisks');
        if (score >= 25) return t('manualAnalysis.minorRemarks');
        return t('manualAnalysis.specOk');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <FileSearch className="w-6 h-6 text-[hsl(var(--primary))]" />
                    {t('manualAnalysis.title')}
                </h1>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                    {t('manualAnalysis.subtitle')}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="glass-card p-5 space-y-4">
                        {/* Text Area */}
                        <div>
                            <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5">
                                {t('manualAnalysis.specLabel')}
                            </label>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder={t('manualAnalysis.specPlaceholder')}
                                className="textarea-field min-h-[200px]"
                                required
                            />
                        </div>

                        {/* Optional Params */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">
                                    {t('manualAnalysis.budgetLabel')}
                                </label>
                                <input
                                    type="number"
                                    value={budget}
                                    onChange={(e) => setBudget(e.target.value)}
                                    placeholder="0"
                                    className="input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">
                                    {t('manualAnalysis.participantsLabel')}
                                </label>
                                <input
                                    type="number"
                                    value={participants}
                                    onChange={(e) => setParticipants(e.target.value)}
                                    placeholder="0"
                                    className="input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">
                                    {t('manualAnalysis.deadlineLabel')}
                                </label>
                                <input
                                    type="number"
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                    placeholder="0"
                                    className="input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">
                                    {t('manualAnalysis.categoryCodeLabel')}
                                </label>
                                <input
                                    type="text"
                                    value={categoryCode}
                                    onChange={(e) => setCategoryCode(e.target.value)}
                                    placeholder="101111.400.000006"
                                    className="input-field"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <button type="submit" className="btn-primary flex-1" disabled={loading || !text.trim()}>
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('manualAnalysis.analyzing')}
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        {t('manualAnalysis.analyze')}
                                    </>
                                )}
                            </button>
                            <button type="button" onClick={handleReset} className="btn-secondary">
                                <RotateCcw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-[hsla(var(--destructive),0.1)] border border-[hsla(var(--destructive),0.3)] text-sm text-[hsl(var(--destructive))]">
                            {error}
                        </div>
                    )}
                </form>

                {/* Results */}
                <div className="space-y-4">
                    {!analysis && !loading && (
                        <div className="glass-card p-8 text-center">
                            <FileSearch className="w-12 h-12 text-[hsl(var(--muted-foreground))] mx-auto opacity-30" />
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-3">
                                {t('manualAnalysis.emptyPrompt')}
                            </p>
                        </div>
                    )}

                    {loading && (
                        <div className="glass-card p-8 text-center">
                            <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))] mx-auto" />
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-3">
                                {t('manualAnalysis.aiAnalyzing')}
                            </p>
                        </div>
                    )}

                    {analysis && cfg && (
                        <>
                            {/* Score Summary */}
                            <div className="glass-card p-5 neon-border">
                                <div className="flex items-center gap-4">
                                    <div
                                        className="score-ring text-2xl"
                                        style={{ border: `4px solid ${cfg.color}`, color: cfg.color, width: 80, height: 80 }}
                                    >
                                        {analysis.final_score.toFixed(0)}
                                    </div>
                                    <div>
                                        <span className={`risk-badge ${cfg.class} text-sm`}>{cfg.label}</span>
                                        <p className="text-sm text-[hsl(var(--foreground))] mt-2 font-medium">
                                            {getScoreMessage(analysis.final_score)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Rules */}
                            {analysis.rule_analysis.rules_triggered.length > 0 && (
                                <div className="glass-card p-5">
                                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                                        <Shield className="w-4 h-4 text-[hsl(var(--primary))]" />
                                        {t('manualAnalysis.detectedRisks')}
                                    </h3>
                                    <div className="space-y-2.5">
                                        {analysis.rule_analysis.rules_triggered.map((rule, i) => (
                                            <div
                                                key={i}
                                                className="p-3 rounded-lg bg-[hsl(var(--secondary))] border-l-[3px]"
                                                style={{ borderLeftColor: severityColors[rule.severity] }}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <AlertTriangle className="w-3.5 h-3.5" style={{ color: severityColors[rule.severity] }} />
                                                    <span className="text-sm font-medium">{rule.rule_name_ru}</span>
                                                </div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">{rule.explanation_ru}</p>
                                                {rule.law_reference && (
                                                    <p className="text-[10px] text-[hsl(var(--primary))] mt-1">📖 {rule.law_reference}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {analysis.rule_analysis.rules_triggered.length === 0 && (
                                <div className="glass-card p-5 flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-[hsl(var(--primary))]" />
                                    <span className="text-sm text-[hsl(var(--primary))]">{t('manualAnalysis.noViolations')}</span>
                                </div>
                            )}

                            {/* ML */}
                            <div className="glass-card p-5">
                                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                                    <Brain className="w-4 h-4 text-[hsl(var(--primary))]" />
                                    {t('manualAnalysis.mlPrediction')}
                                </h3>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="p-2.5 rounded-lg bg-[hsl(var(--secondary))] text-center">
                                        <p className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase">CatBoost</p>
                                        <p className="text-lg font-bold mt-0.5">{(analysis.ml_prediction.catboost_proba * 100).toFixed(0)}%</p>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-[hsl(var(--secondary))] text-center">
                                        <p className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase">Isolation</p>
                                        <p className="text-lg font-bold mt-0.5">
                                            {analysis.ml_prediction.isolation_anomaly ? '⚠️' : '✅'}
                                        </p>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-[hsl(var(--secondary))] text-center">
                                        <p className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase">ML Score</p>
                                        <p className="text-lg font-bold mt-0.5">{analysis.ml_prediction.ml_score.toFixed(0)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Explanation */}
                            {analysis.explanation.length > 0 && (
                                <div className="glass-card p-5">
                                    <h3 className="text-sm font-semibold mb-3">{t('manualAnalysis.explanation')}</h3>
                                    <ul className="space-y-1.5">
                                        {analysis.explanation.map((text, i) => (
                                            <li key={i} className="flex gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                                                <span className="text-[hsl(var(--primary))] flex-shrink-0">→</span>
                                                {text}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
