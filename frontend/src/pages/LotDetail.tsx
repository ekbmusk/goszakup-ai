import { useParams, useNavigate } from 'react-router-dom';
import { useLotAnalysis, useCategoryPricingDetail } from '@/hooks/useApi';
import { formatBudget, GoszakupApiClient, type RiskLevel } from '@/types/api';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
    TrendingUp,
    TrendingDown,
    Package,
    DollarSign,
    Building2,
    Phone,
    Mail,
    User,
    Calendar,
    ExternalLink,
    CircleDot,
    Download,
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

// Mapping: which rules use which lot fields
const ruleFieldMapping: Record<string, string[]> = {
    'R05': ['desc_ru', 'extra_desc_ru'], // Прямой запрет аналогов
    'R06': ['desc_ru', 'extra_desc_ru'], // Эквиваленты при брендированных названиях
    'R07': ['desc_ru', 'extra_desc_ru'], // Каталожные номера
    'R08': ['desc_ru', 'extra_desc_ru'], // Сверхточные характеристики
    'R09': ['desc_ru', 'extra_desc_ru'], // Представительский класс
    'R10': ['deadline_days'], // Короткий срок
    'R11': ['budget', 'category_code'], // Критическое завышение цены
    'R12': ['budget', 'category_code'], // Подозрительно низкая цена
    'R13': ['desc_ru', 'extra_desc_ru'], // Аномально подробное ТЗ
    'R14': ['desc_ru', 'extra_desc_ru'], // Минимальное ТЗ
};

const getFieldRules = (field: string, rules: any[]): any[] => {
    if (!rules) return [];
    return rules.filter(rule =>
        ruleFieldMapping[rule.rule_id]?.includes(field)
    );
};

export default function LotDetail() {
    const { t } = useTranslation();
    const { lotId } = useParams<{ lotId: string }>();
    const navigate = useNavigate();
    const { data: analysis, loading, error } = useLotAnalysis(lotId || null);
    const [exportingPDF, setExportingPDF] = useState(false);

    const apiClient = useMemo(() => new GoszakupApiClient(), []);

    // Load category pricing stats
    const categoryCode = analysis?.lot_data?.category_code;
    const { data: categoryPricing } = useCategoryPricingDetail(categoryCode || null);

    const riskConfig: Record<string, { label: string; class: string; color: string }> = {
        LOW: { label: t('common.riskLow'), class: 'risk-low', color: 'hsl(var(--risk-low))' },
        MEDIUM: { label: t('common.riskMedium'), class: 'risk-medium', color: 'hsl(var(--risk-medium))' },
        HIGH: { label: t('common.riskHigh'), class: 'risk-high', color: 'hsl(var(--risk-high))' },
        CRITICAL: { label: t('common.riskCritical'), class: 'risk-critical', color: 'hsl(var(--risk-critical))' },
    };

    const handleExportPDF = async () => {
        if (!lotId) return;

        setExportingPDF(true);
        try {
            await apiClient.downloadLotPDF(lotId);
        } catch (err) {
            console.error('PDF export failed:', err);
            alert('Ошибка экспорта в PDF. Попробуйте позже.');
        } finally {
            setExportingPDF(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-[hsl(var(--primary))] mx-auto" />
                    <p className="text-[hsl(var(--muted-foreground))] text-sm">{t('common.loading')}</p>
                </div>
            </div>
        );
    }

    if (error || !analysis) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-4 glass-card p-8">
                    <ServerCrash className="w-12 h-12 text-[hsl(var(--destructive))] mx-auto" />
                    <p className="text-[hsl(var(--foreground))] font-semibold">{t('lotDetail.loadError')}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{error}</p>
                    <button onClick={() => navigate(-1)} className="btn-secondary mt-2">
                        <ArrowLeft className="w-4 h-4" /> {t('common.back')}
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
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => navigate(-1)} className="btn-secondary text-xs">
                        <ArrowLeft className="w-3.5 h-3.5" /> {t('lotDetail.back')}
                    </button>
                    <button
                        onClick={handleExportPDF}
                        disabled={exportingPDF}
                        className="btn-secondary text-xs flex items-center gap-2"
                    >
                        {exportingPDF ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                {t('lots.exporting')}
                            </>
                        ) : (
                            <>
                                <Download className="w-3.5 h-3.5" />
                                PDF
                            </>
                        )}
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Lot Info */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-xl font-bold tracking-tight">{lot.name_ru}</h1>
                            {lot.is_synthetic && (
                                <span className="inline-flex items-center gap-0.5 bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-semibold">
                                    {t('lotDetail.testData')}
                                </span>
                            )}
                        </div>
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
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">{t('lotDetail.riskScore')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Price Context */}
            {categoryPricing && (
                <div className="glass-card p-5">
                    <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                        <TrendingUp className="w-4 h-4 text-[hsl(var(--primary))]" />
                        {t('lotDetail.riskFactors')}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Price Stats */}
                        <div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-[hsl(var(--muted-foreground))]">{t('lotDetail.budget')}:</span>
                                    <span className="font-semibold">{formatBudget(lot.budget)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[hsl(var(--muted-foreground))]">{t('lotDetail.priceDeviation')}:</span>
                                    <span className="font-medium">{formatBudget(categoryPricing.stats.median)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-[hsl(var(--border))]">
                                    <span className="text-[hsl(var(--muted-foreground))]">{t('lotDetail.priceDeviation')}:</span>
                                    <span className={`font-bold ${((lot.budget - categoryPricing.stats.median) / categoryPricing.stats.median * 100) > 200
                                        ? 'text-[hsl(var(--risk-critical))]'
                                        : ((lot.budget - categoryPricing.stats.median) / categoryPricing.stats.median * 100) > 100
                                            ? 'text-[hsl(var(--risk-high))]'
                                            : ((lot.budget - categoryPricing.stats.median) / categoryPricing.stats.median * 100) > 50
                                                ? 'text-[hsl(var(--risk-medium))]'
                                                : ((lot.budget - categoryPricing.stats.median) / categoryPricing.stats.median * 100) < 0
                                                    ? 'text-[hsl(var(--risk-low))]'
                                                    : 'text-[hsl(var(--muted-foreground))]'
                                        }`}>
                                        {((lot.budget - categoryPricing.stats.median) / categoryPricing.stats.median * 100) > 0 ? '+' : ''}
                                        {((lot.budget - categoryPricing.stats.median) / categoryPricing.stats.median * 100).toFixed(1)}%
                                        {((lot.budget - categoryPricing.stats.median) / categoryPricing.stats.median * 100) > 0 ? (
                                            <TrendingUp className="inline w-4 h-4 ml-1" />
                                        ) : (
                                            <TrendingDown className="inline w-4 h-4 ml-1" />
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Price Range Visual */}
                        <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-2">Диапазон цен в категории:</div>
                            <div className="relative h-12 bg-[hsl(var(--secondary))] rounded-lg overflow-hidden">
                                {/* Min to Max bar */}
                                <div className="absolute inset-0 flex items-center px-2">
                                    <div className="relative w-full h-2 bg-gradient-to-r from-[hsl(var(--risk-low))] via-[hsl(var(--muted))] to-[hsl(var(--risk-high))] rounded-full" />
                                </div>
                                {/* Median marker */}
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 w-0.5 h-8 bg-[hsl(var(--primary))]"
                                    style={{
                                        left: `${50}%`,
                                    }}
                                />
                                {/* Current lot marker */}
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 w-1 h-10 bg-[hsl(var(--foreground))] rounded-sm"
                                    style={{
                                        left: `${Math.min(95, Math.max(5,
                                            ((lot.budget - categoryPricing.stats.min) /
                                                (categoryPricing.stats.max - categoryPricing.stats.min)) * 100
                                        ))}%`,
                                    }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                                <span>{formatBudget(categoryPricing.stats.min)}</span>
                                <span>{t('priceAnalysis.median')}</span>
                                <span>{formatBudget(categoryPricing.stats.max)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lot Details */}
            <div className="glass-card p-5">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                    <FileText className="w-4 h-4 text-[hsl(var(--primary))]" />
                    Детали закупки
                    {rules && rules.rules_triggered && rules.rules_triggered.length > 0 && (
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-auto">
                            * поля, используемые в анализе
                        </span>
                    )}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Procurement Details */}
                    {(lot.unit || lot.quantity !== undefined || lot.unit_price !== undefined) && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase flex items-center gap-1">
                                <Package className="w-3 h-3" /> Параметры
                            </h3>
                            {lot.unit && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Единица:</span>
                                    <span className="font-medium">{lot.unit}</span>
                                </div>
                            )}
                            {lot.quantity !== undefined && lot.quantity > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Количество:</span>
                                    <span className="font-medium">{lot.quantity.toLocaleString()}</span>
                                </div>
                            )}
                            {lot.unit_price !== undefined && lot.unit_price > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Цена за ед.:</span>
                                    <span className="font-medium">{formatBudget(lot.unit_price)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Payment & Terms */}
                    {(lot.advance_payment_pct !== undefined || lot.financing_source || lot.incoterms || lot.dumping_status) && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase flex items-center gap-1">
                                <DollarSign className="w-3 h-3" /> Условия
                            </h3>
                            {lot.advance_payment_pct !== undefined && lot.advance_payment_pct > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Аванс:</span>
                                    <span className="font-medium text-[hsl(var(--primary))]">{lot.advance_payment_pct}%</span>
                                </div>
                            )}
                            {lot.financing_source && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Финансирование:</span>
                                    <span className="font-medium text-xs">{lot.financing_source}</span>
                                </div>
                            )}
                            {lot.incoterms && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">ИНКОТЕРМС:</span>
                                    <span className="font-medium text-xs">{lot.incoterms}</span>
                                </div>
                            )}
                            {lot.dumping_status && (
                                <div className="text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Демпинг:</span>
                                    <p className="font-medium text-xs mt-1 p-2 bg-[hsl(var(--secondary))] rounded">
                                        {lot.dumping_status}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Dates & Status */}
                    {(lot.publish_date || lot.deadline_date || lot.lot_status) && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Сроки
                            </h3>
                            {lot.publish_date && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Публикация:</span>
                                    <span className="font-medium text-xs">{lot.publish_date}</span>
                                </div>
                            )}
                            {lot.deadline_date && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Дедлайн:</span>
                                    <span className="font-medium text-xs">{lot.deadline_date}</span>
                                </div>
                            )}
                            {lot.lot_status && (
                                <div className="text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Статус:</span>
                                    <p className="font-medium text-xs mt-1 p-2 bg-[hsl(var(--secondary))] rounded flex items-center gap-1">
                                        <CircleDot className="w-3 h-3 text-[hsl(var(--primary))]" />
                                        {lot.lot_status}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Customer Info */}
                {(lot.customer_bin || lot.customer_name) && (
                    <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
                        <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase flex items-center gap-1 mb-2">
                            <Building2 className="w-3 h-3" /> Заказчик
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {lot.customer_name && (
                                <div className="text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Наименование:</span>
                                    <p className="font-medium mt-1">{lot.customer_name}</p>
                                </div>
                            )}
                            {lot.customer_bin && (
                                <div className="text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">БИН:</span>
                                    <p className="font-medium font-mono mt-1">{lot.customer_bin}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Contact Info */}
                {(lot.contact_person || lot.contact_position || lot.contact_phone || lot.contact_email) && (
                    <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
                        <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase flex items-center gap-1 mb-2">
                            <User className="w-3 h-3" /> Контактное лицо
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {lot.contact_person && (
                                <div className="text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">ФИО:</span>
                                    <p className="font-medium mt-1">{lot.contact_person}</p>
                                </div>
                            )}
                            {lot.contact_position && (
                                <div className="text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Должность:</span>
                                    <p className="font-medium mt-1">{lot.contact_position}</p>
                                </div>
                            )}
                            {lot.contact_phone && (
                                <div className="text-sm flex items-center gap-2">
                                    <Phone className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
                                    <a href={`tel:${lot.contact_phone}`} className="font-medium text-[hsl(var(--primary))] hover:underline">
                                        {lot.contact_phone}
                                    </a>
                                </div>
                            )}
                            {lot.contact_email && (
                                <div className="text-sm flex items-center gap-2">
                                    <Mail className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
                                    <a href={`mailto:${lot.contact_email}`} className="font-medium text-[hsl(var(--primary))] hover:underline">
                                        {lot.contact_email}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Link to goszakup */}
                {lot.url && (
                    <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
                        <a
                            href={lot.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-[hsl(var(--primary))] hover:underline"
                        >
                            <ExternalLink className="w-4 h-4" />
                            {t('lotDetail.viewOnPortal')}
                        </a>
                    </div>
                )}
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
                    {rules.rules_triggered.map((rule, i) => {
                        const usedFields = ruleFieldMapping[rule.rule_id] || [];
                        const fieldLabels: Record<string, string> = {
                            'desc_ru': 'Описание',
                            'extra_desc_ru': 'Доп. описание',
                            'deadline_days': 'Срок поставки',
                            'budget': 'Бюджет',
                            'category_code': 'Категория',
                        };

                        return (
                            <div
                                key={i}
                                className="p-3 rounded-lg bg-[hsl(var(--secondary))] border-l-[3px]"
                                style={{ borderLeftColor: severityColors[rule.severity] || severityColors.medium }}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
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

                                        {/* Show which fields this rule uses */}
                                        {usedFields.length > 0 && (
                                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                                                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Использует:</span>
                                                {usedFields.map((field, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--background))] text-[hsl(var(--primary))] border border-[hsl(var(--border))]"
                                                    >
                                                        {fieldLabels[field] || field}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

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
                        );
                    })}

                    {rules.rules_triggered.length === 0 && (
                        <div className="flex items-center gap-2 text-sm text-[hsl(var(--primary))] p-3">
                            <CheckCircle2 className="w-4 h-4" />
                            {t('manualAnalysis.noViolations')}
                        </div>
                    )}
                </div>

                {/* Passed count */}
                <div className="mt-3 text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-[hsl(var(--primary))]" />
                    {rules.rules_passed_count} правил пройдено успешно
                </div>
            </div>

            {/* ML Analysis - Full Breakdown */}
            <div className="glass-card p-5">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                    <Brain className="w-4 h-4 text-[hsl(var(--primary))]" />
                    ML-Анализ (Машинное обучение)
                </h2>

                {/* ML Model Scores */}
                <div className="mb-6 p-4 bg-[hsl(var(--secondary))] rounded-lg border border-[hsl(var(--border))]">
                    <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase mb-3">Предсказания моделей</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        {/* CatBoost */}
                        <div className="p-3 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-semibold">
                                🌳 CatBoost (Gradient Boosting)
                            </p>
                            <p className="text-2xl font-bold mt-2" style={{
                                color: ml.catboost_proba >= 0.75 ? 'hsl(var(--risk-critical))' :
                                    ml.catboost_proba >= 0.5 ? 'hsl(var(--risk-high))' : 'hsl(var(--risk-low))'
                            }}>
                                {(ml.catboost_proba * 100).toFixed(1)}%
                            </p>
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                                Вероятность риска
                            </p>
                            <div className="mt-2 w-full h-1.5 rounded-full bg-[hsl(var(--border))] overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                        width: `${ml.catboost_proba * 100}%`,
                                        background: ml.catboost_proba >= 0.75 ? 'hsl(var(--risk-critical))' :
                                            ml.catboost_proba >= 0.5 ? 'hsl(var(--risk-high))' :
                                                ml.catboost_proba >= 0.25 ? 'hsl(var(--risk-medium))' : 'hsl(var(--risk-low))',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Isolation Forest */}
                        <div className="p-3 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-semibold">
                                🔍 Isolation Forest (Аномалия)
                            </p>
                            <p className="text-2xl font-bold mt-2" style={{
                                color: ml.isolation_anomaly ? 'hsl(var(--risk-critical))' : 'hsl(var(--risk-low))'
                            }}>
                                {ml.isolation_anomaly ? '⚠️ Да' : '✓ Нет'}
                            </p>
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                                Обнаружена аномалия
                            </p>
                            <div className="mt-2 text-[10px] font-mono text-[hsl(var(--primary))]">
                                score: {ml.isolation_score.toFixed(3)}
                            </div>
                        </div>

                        {/* Combined ML Score */}
                        <div className="p-3 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-semibold">
                                📊 ML Итоговый балл
                            </p>
                            <div className="flex items-baseline gap-2 mt-2">
                                <span className="text-2xl font-bold" style={{
                                    color: ml.ml_score >= 75 ? 'hsl(var(--risk-critical))' :
                                        ml.ml_score >= 50 ? 'hsl(var(--risk-high))' :
                                            ml.ml_score >= 25 ? 'hsl(var(--risk-medium))' : 'hsl(var(--risk-low))',
                                }}>
                                    {ml.ml_score.toFixed(1)}
                                </span>
                                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">из 100</span>
                            </div>
                            <div className="mt-2 w-full h-1.5 rounded-full bg-[hsl(var(--border))] overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                        width: `${ml.ml_score}%`,
                                        background: ml.ml_score >= 75 ? 'hsl(var(--risk-critical))' :
                                            ml.ml_score >= 50 ? 'hsl(var(--risk-high))' :
                                                ml.ml_score >= 25 ? 'hsl(var(--risk-medium))' : 'hsl(var(--risk-low))',
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Model descriptions */}
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))] space-y-1 mt-3 pt-3 border-t border-[hsl(var(--border))]">
                        <p>
                            <strong>CatBoost:</strong> Предсказание вероятности риска на основе 21 признака закупки (цена, текст, переговоры, коллизии).
                        </p>
                        <p>
                            <strong>Isolation Forest:</strong> Обнаружение статистических аномалий в данных лота (выбросы по всем параметрам).
                        </p>
                    </div>
                </div>

                {/* Features Used */}
                {analysis.features && (
                    <div className="mb-6 p-4 bg-[hsl(var(--secondary))] rounded-lg border border-[hsl(var(--border))]">
                        <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase mb-3">📋 Признаки для ML (21 показатель)</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {/* Brand indicators */}
                            <div className="p-2.5 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-semibold">🏢 Бренды</p>
                                <div className="mt-1 flex items-center gap-2">
                                    {analysis.features.has_brand ? (
                                        <>
                                            <span className="text-lg">✓</span>
                                            <span className="text-sm font-medium text-[hsl(var(--primary))]">
                                                {analysis.features.brand_count} найдено
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-sm text-[hsl(var(--muted-foreground))]">Не найдено (рискованно)</span>
                                    )}
                                </div>
                                {analysis.features.brand_names && analysis.features.brand_names.length > 0 && (
                                    <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1">
                                        {analysis.features.brand_names.join(', ')}
                                    </p>
                                )}
                            </div>

                            {/* Text analysis */}
                            <div className="p-2.5 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-semibold">📝 Текст ТЗ</p>
                                <div className="mt-1 space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px]">Длина:</span>
                                        <span className="text-sm font-medium">{analysis.features.text_length} сим</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px]">Параметров:</span>
                                        <span className="text-sm font-medium">{analysis.features.precise_param_count}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Exclusive phrases */}
                            <div className="p-2.5 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-semibold">🚫 Ограничения</p>
                                <div className="mt-1 space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px]">Эксклюзив:</span>
                                        <span className={`text-sm font-medium ${analysis.features.has_exclusive_phrase ? 'text-[hsl(var(--risk-high))]' : 'text-[hsl(var(--primary))]'}`}>
                                            {analysis.features.exclusive_count}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px]">Без аналогов:</span>
                                        <span className={analysis.features.has_no_analogs ? 'text-[hsl(var(--risk-high))]' : ''}>
                                            {analysis.features.has_no_analogs ? '⚠️' : '✓'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Market metrics */}
                            <div className="p-2.5 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-semibold">💰 Рынок</p>
                                <div className="mt-1 space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px]">Бюджет/медиана:</span>
                                        <span className={`text-sm font-medium ${analysis.features.budget_ratio > 2 ? 'text-[hsl(var(--risk-high))]' : 'text-[hsl(var(--primary))]'}`}>
                                            {analysis.features.budget_ratio.toFixed(1)}x
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px]">Участников:</span>
                                        <span className={`text-sm font-medium ${analysis.features.participants_count <= 2 ? 'text-[hsl(var(--risk-high))]' : 'text-[hsl(var(--primary))]'}`}>
                                            {analysis.features.participants_count}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Deal terms */}
                            <div className="p-2.5 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-semibold">⏰ Условия</p>
                                <div className="mt-1 space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px]">Срок сделки:</span>
                                        <span className={`text-sm font-medium ${analysis.features.deadline_days <= 5 ? 'text-[hsl(var(--risk-high))]' : 'text-[hsl(var(--primary))]'}`}>
                                            {analysis.features.deadline_days} дн.
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px]">Стандарты:</span>
                                        <span className="text-sm font-medium">{analysis.features.standard_count}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Collusion indicators */}
                            <div className="p-2.5 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-semibold">🔗 Коллизии</p>
                                <div className="mt-1 space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px]">Победы поставщика:</span>
                                        <span className={`text-sm font-medium ${analysis.features.winner_repeat_count >= 5 ? 'text-[hsl(var(--risk-high))]' : 'text-[hsl(var(--primary))]'}`}>
                                            {analysis.features.winner_repeat_count}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px]">Дилер требуется:</span>
                                        <span>{analysis.features.dealer_requirement ? '⚠️' : '✓'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-3 pt-3 border-t border-[hsl(var(--border))]">
                            Все 21 признак используется CatBoost моделью для предсказания вероятности риска.
                            Рисковые значения обозначены красным цветом.
                        </p>
                    </div>
                )}

                {/* How ML Score is Calculated */}
                <div className="p-4 bg-[hsl(var(--background))] rounded-lg border border-[hsl(var(--border))]">
                    <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase mb-3">🔢 Как считается ML Балл</h3>
                    <div className="space-y-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                        <p>
                            <strong>1. CatBoost вероятность:</strong> {(ml.catboost_proba * 100).toFixed(1)}% (обучена на 5000+ размеченных лотов)
                        </p>
                        <p>
                            <strong>2. Аномалия Isolation Forest:</strong> {ml.isolation_anomaly ? 'обнаружена → +20 баллов' : 'не обнаружена → +0 баллов'}
                        </p>
                        <p>
                            <strong>ML_Score (компонента для итога):</strong>
                        </p>
                        <p className="ml-2 font-mono text-[9px]">
                            = CatBoost_% × 0.8 + (Аномалия ? 20 : 0)<br />
                            = {(ml.catboost_proba * 100).toFixed(1)} × 0.8 + {ml.isolation_anomaly ? '20' : '0'}<br />
                            = <strong>{ml.ml_score.toFixed(1)}</strong> баллов
                        </p>
                        <p className="text-[9px] pt-2 border-t border-[hsl(var(--border))]">
                            ℹ️ Это компонента ML используется при расчёте итогового балла (вес 40%).<br />
                            <strong>Итоговый балл = Правила × 50% + ML × 40% + Сеть × 10%</strong>
                        </p>
                    </div>
                </div>
            </div>

            {/* Final Score Breakdown */}
            {analysis.explanation && analysis.explanation.length > 0 && (
                <div className="glass-card p-5 border border-[hsl(var(--primary))]/20">
                    <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                        <TrendingUp className="w-4 h-4 text-[hsl(var(--primary))]" />
                        Разбор итогового балла: {analysis.final_score.toFixed(1)}/100
                    </h2>

                    <div className="space-y-3">
                        {analysis.explanation.map((line, idx) => (
                            <div key={idx} className="text-xs text-[hsl(var(--muted-foreground))] flex items-start gap-2">
                                <span className="text-[hsl(var(--primary))] flex-shrink-0">•</span>
                                <span>{line}</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] text-[9px] text-[hsl(var(--muted-foreground))] space-y-1">
                        <p>
                            <strong>Формула итогового балла:</strong>
                        </p>
                        <p className="font-mono ml-2">
                            мин(100, макс(0,<br />
                            &nbsp;&nbsp;Правила × 0.50 +<br />
                            &nbsp;&nbsp;ML × 0.40 +<br />
                            &nbsp;&nbsp;Copy-Paste × 0.05 +<br />
                            &nbsp;&nbsp;Сеть × 0.05<br />
                            ))
                        </p>
                    </div>
                </div>
            )}

            {/* Network Flags + Explanation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {analysis.network_flags.length > 0 && (
                    <div className="glass-card p-5">
                        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
                            <Network className="w-4 h-4 text-[hsl(var(--risk-high))]" />
                            Сетевые флаги
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {analysis.network_flags.map((flag, i) => (
                                <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-[hsla(var(--risk-high),0.1)] text-[hsl(var(--risk-high))] border border-[hsla(var(--risk-high),0.2)]">
                                    {typeof flag === 'string' ? flag.replace(/_/g, ' ') : String(flag)}
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
