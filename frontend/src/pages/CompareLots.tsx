import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Loader2,
    ServerCrash,
    Plus,
    X,
    Shield,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Users,
    Clock,
    Tag,
    CheckCircle2,
} from 'lucide-react';
import { formatBudget, GoszakupApiClient, type RiskLevel } from '@/types/api';
import { useLots } from '@/hooks/useApi';

const riskConfig: Record<string, { label: string; class: string; color: string }> = {
    LOW: { label: 'Низкий', class: 'risk-low', color: 'hsl(var(--risk-low))' },
    MEDIUM: { label: 'Средний', class: 'risk-medium', color: 'hsl(var(--risk-medium))' },
    HIGH: { label: 'Высокий', class: 'risk-high', color: 'hsl(var(--risk-high))' },
    CRITICAL: { label: 'Критический', class: 'risk-critical', color: 'hsl(var(--risk-critical))' },
};

export default function CompareLots() {
    const navigate = useNavigate();
    const apiClient = useMemo(() => new GoszakupApiClient(), []);
    const resultsRef = useRef<HTMLDivElement>(null);

    const [lotIds, setLotIds] = useState<string[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [comparisonData, setComparisonData] = useState<any>(null);
    const [searchFilter, setSearchFilter] = useState('');
    const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('');
    const [showSuccess, setShowSuccess] = useState(false);

    // Fetch high-risk lots for selection
    const { data: lotsData, loading: lotsLoading } = useLots({
        page: 0,
        size: 50,
        sort_by: 'risk_score',
        sort_desc: true,
        risk_level: (selectedRiskLevel || undefined) as RiskLevel | undefined,
        search: searchFilter || undefined,
    });

    const addLotId = (id?: string) => {
        const lotId = id || currentInput.trim();
        if (lotId) {
            if (!lotIds.includes(lotId)) {
                if (lotIds.length >= 10) {
                    setError('Максимум 10 лотов для сравнения');
                    return;
                }
                setLotIds([...lotIds, lotId]);
                setCurrentInput('');
                setError('');
            } else {
                setError('Этот лот уже добавлен');
            }
        }
    };

    const removeLotId = (id: string) => {
        setLotIds(lotIds.filter(lid => lid !== id));
    };

    const handleCompare = async () => {
        if (lotIds.length < 2) {
            setError('Выберите минимум 2 лота для сравнения');
            return;
        }

        setLoading(true);
        setError('');
        setShowSuccess(false);
        try {
            const data = await apiClient.compareLots(lotIds);
            setComparisonData(data);
            setShowSuccess(true);

            // Scroll to results after a brief delay
            setTimeout(() => {
                resultsRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }, 100);

            // Hide success message after 3 seconds
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка при сравнении лотов');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <button onClick={() => navigate(-1)} className="btn-secondary text-xs mb-4">
                        <ArrowLeft className="w-3.5 h-3.5" /> Назад
                    </button>
                    <h1 className="text-2xl font-bold">Сравнение лотов</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                        Выберите лоты для детального анализа и сравнения характеристик
                    </p>
                </div>
            </div>

            {/* Lot Selection */}
            <div className="glass-card p-5">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[hsl(var(--primary))]" />
                    Выбранные лоты ({lotIds.length}/10)
                </h2>

                {/* Input */}
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={currentInput}
                        onChange={(e) => setCurrentInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addLotId()}
                        placeholder="ID лота (например: 12345678-ЗЦП1)"
                        className="flex-1 px-3 py-2 text-sm rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />
                    <button
                        onClick={() => addLotId()}
                        className="btn-primary text-xs flex items-center gap-1"
                    >
                        <Plus className="w-3.5 h-3.5" /> Добавить
                    </button>
                </div>

                {/* Selected Lots */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {lotIds.map((id) => (
                        <div key={id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--primary))]  bg-opacity-10 border border-[hsl(var(--primary))] text-xs">
                            <span className="font-mono text-[hsl(var(--primary))]">{id}</span>
                            <button onClick={() => removeLotId(id)} className="hover:text-[hsl(var(--destructive))]">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="text-xs text-[hsl(var(--destructive))] mb-4 p-2 bg-[hsl(var(--destructive))] bg-opacity-10 rounded">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleCompare}
                    disabled={loading || lotIds.length < 2}
                    className="btn-primary text-sm w-full flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Анализ...
                        </>
                    ) : (
                        <>
                            <Shield className="w-4 h-4" />
                            Сравнить лоты
                        </>
                    )}
                </button>
            </div>

            {/* Available Lots List */}
            <div className="glass-card p-5">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[hsl(var(--primary))]" />
                    Доступные лоты
                </h2>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <input
                        type="text"
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        placeholder="Поиск по названию или ID..."
                        className="px-3 py-2 text-sm rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />
                    <select
                        value={selectedRiskLevel}
                        onChange={(e) => setSelectedRiskLevel(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    >
                        <option value="">Все уровни риска</option>
                        <option value="CRITICAL">Критический</option>
                        <option value="HIGH">Высокий</option>
                        <option value="MEDIUM">Средний</option>
                        <option value="LOW">Низкий</option>
                    </select>
                </div>

                {/* Lots List */}
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {lotsLoading ? (
                        <div className="text-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[hsl(var(--muted-foreground))]" />
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">Загрузка лотов...</p>
                        </div>
                    ) : lotsData && lotsData.items.length > 0 ? (
                        lotsData.items.map((lot) => {
                            const cfg = riskConfig[lot.risk_level] || riskConfig.HIGH;
                            const isSelected = lotIds.includes(lot.lot_id);

                            return (
                                <div
                                    key={lot.lot_id}
                                    onClick={() => !isSelected && addLotId(lot.lot_id)}
                                    className={`p-3 rounded-lg border transition-all ${isSelected
                                        ? 'bg-[hsl(var(--primary))] bg-opacity-10 border-[hsl(var(--primary))] cursor-not-allowed'
                                        : 'bg-[hsl(var(--secondary))] border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] cursor-pointer'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                {isSelected && (
                                                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--primary))] flex-shrink-0" />
                                                )}
                                                <h3 className="text-sm font-medium truncate">{lot.name_ru}</h3>
                                            </div>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] font-mono mb-2">
                                                {lot.lot_id}
                                            </p>
                                            <div className="flex flex-wrap gap-2 text-[10px]">
                                                <span className="flex items-center gap-1">
                                                    <DollarSign className="w-3 h-3" />
                                                    {formatBudget(lot.budget)}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Users className="w-3 h-3" />
                                                    {lot.participants_count} уч.
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {lot.deadline_days} дн.
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <div
                                                className="score-ring text-sm"
                                                style={{
                                                    border: `2px solid ${cfg.color}`,
                                                    color: cfg.color,
                                                    width: 45,
                                                    height: 45,
                                                    fontSize: '11px',
                                                }}
                                            >
                                                {lot.risk_score?.toFixed(0)}
                                            </div>
                                            <span className={`risk-badge ${cfg.class}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                                                {cfg.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-8 text-sm text-[hsl(var(--muted-foreground))]">
                            Лоты не найдены
                        </div>
                    )}
                </div>
            </div>

            {/* Success notification */}
            {showSuccess && (
                <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
                    <div className="glass-card p-4 bg-[hsl(var(--primary))] bg-opacity-20 border-[hsl(var(--primary))] shadow-lg">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-[hsl(var(--primary))]" />
                            <p className="text-sm font-medium">
                                Сравнение завершено! Результаты ниже ↓
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Comparison Results */}
            {comparisonData && (
                <div ref={resultsRef} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Summary Stats */}
                    <div className="glass-card p-5">
                        <h2 className="text-sm font-semibold mb-4">Статистика сравнения</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-3 rounded-lg bg-[hsl(var(--secondary))]">
                                <div className="text-xs text-[hsl(var(--muted-foreground))]">Всего лотов</div>
                                <div className="text-2xl font-bold mt-1">{comparisonData.count}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-[hsl(var(--secondary))]">
                                <div className="text-xs text-[hsl(var(--muted-foreground))]">Высок. риск</div>
                                <div className="text-2xl font-bold text-[hsl(var(--risk-high))] mt-1">
                                    {comparisonData.high_risk_count}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-[hsl(var(--secondary))]">
                                <div className="text-xs text-[hsl(var(--muted-foreground))]">Средний риск</div>
                                <div className="text-2xl font-bold text-[hsl(var(--primary))] mt-1">
                                    {comparisonData.avg_risk_score}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Side-by-side Comparison */}
                    <div className="space-y-4">
                        {comparisonData.lots.map((lot: any, idx: number) => {
                            const cfg = riskConfig[lot.final_level] || riskConfig.HIGH;
                            return (
                                <div key={idx} className="glass-card p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-sm">{lot.lot_data?.name_ru || 'N/A'}</h3>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] font-mono mt-1">
                                                {lot.lot_id}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="score-ring text-lg"
                                                style={{
                                                    border: `3px solid ${cfg.color}`,
                                                    color: cfg.color,
                                                    width: 60,
                                                    height: 60,
                                                }}
                                            >
                                                {lot.final_score?.toFixed(0)}
                                            </div>
                                            <span className={`risk-badge ${cfg.class} text-xs`}>{cfg.label}</span>
                                        </div>
                                    </div>

                                    {/* Lot Details */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                        <div>
                                            <span className="text-[hsl(var(--muted-foreground))]">Категория:</span>
                                            <p className="font-medium mt-1">{lot.lot_data?.category_name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
                                                <DollarSign className="w-3 h-3" /> Бюджет:
                                            </span>
                                            <p className="font-medium mt-1">{formatBudget(lot.lot_data?.budget || 0)}</p>
                                        </div>
                                        <div>
                                            <span className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
                                                <Users className="w-3 h-3" /> Участников:
                                            </span>
                                            <p className="font-medium mt-1">{lot.lot_data?.participants_count || 0}</p>
                                        </div>
                                        <div>
                                            <span className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
                                                <Clock className="w-3 h-3" /> Срок:
                                            </span>
                                            <p className="font-medium mt-1">{lot.lot_data?.deadline_days || 0} дней</p>
                                        </div>
                                    </div>

                                    {/* Risk Rules */}
                                    {lot.rule_analysis?.rules_triggered && lot.rule_analysis.rules_triggered.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
                                            <h4 className="text-xs font-semibold mb-2">Обнаруженные нарушения:</h4>
                                            <div className="flex flex-wrap gap-1">
                                                {lot.rule_analysis.rules_triggered.slice(0, 3).map((rule: any, i: number) => (
                                                    <span key={i} className="text-[10px] px-2 py-1 rounded bg-[hsl(var(--risk-high))] bg-opacity-10 text-[hsl(var(--risk-high))]">
                                                        {rule.rule_name_ru}
                                                    </span>
                                                ))}
                                                {lot.rule_analysis.rules_triggered.length > 3 && (
                                                    <span className="text-[10px] px-2 py-1 rounded bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                                                        +{lot.rule_analysis.rules_triggered.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
