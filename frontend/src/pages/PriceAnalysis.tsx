import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategoryPricing, useLots } from '@/hooks/useApi';
import { formatBudget } from '@/types/api';
import type { LotSummary } from '@/types/api';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    ArrowUpDown,
    Loader2,
    ServerCrash,
    DollarSign,
    LayoutGrid,
    List,
} from 'lucide-react';

type SortField = 'count' | 'median' | 'high_risk_pct' | 'category_name';
type ViewMode = 'categories' | 'lots';
type LotSortField = 'price_deviation_pct' | 'budget' | 'name_ru' | 'risk_score';

export default function PriceAnalysis() {
    const navigate = useNavigate();
    const [sortBy, setSortBy] = useState<SortField>('count');
    const [sortDesc, setSortDesc] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('categories');
    const [lotSortBy, setLotSortBy] = useState<LotSortField>('price_deviation_pct');
    const [lotSortDesc, setLotSortDesc] = useState(true);

    const { data, loading, error } = useCategoryPricing({ sort_by: 'count', min_count: 1 });
    const { data: lotsData, loading: lotsLoading, error: lotsError } = useLots({
        page: 0,
        size: 100,
        sort_by: 'budget',
        sort_desc: true
    });

    const sortedCategories = useMemo(() => {
        if (!data?.categories) return [];

        const sorted = [...data.categories];
        sorted.sort((a, b) => {
            let aVal: number | string;
            let bVal: number | string;

            switch (sortBy) {
                case 'count':
                    aVal = a.count;
                    bVal = b.count;
                    break;
                case 'median':
                    aVal = a.median;
                    bVal = b.median;
                    break;
                case 'high_risk_pct':
                    aVal = a.high_risk_pct;
                    bVal = b.high_risk_pct;
                    break;
                case 'category_name':
                    aVal = a.category_name;
                    bVal = b.category_name;
                    break;
                default:
                    return 0;
            }

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortDesc ? bVal.localeCompare(aVal, 'ru') : aVal.localeCompare(bVal, 'ru');
            }

            return sortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
        });

        return sorted;
    }, [data?.categories, sortBy, sortDesc]);

    const sortedLots = useMemo(() => {
        if (!lotsData?.items) return [];

        const sorted = [...lotsData.items].filter(lot =>
            lot.price_deviation_pct !== null && lot.price_deviation_pct !== undefined
        );

        sorted.sort((a, b) => {
            let aVal: number | string;
            let bVal: number | string;

            switch (lotSortBy) {
                case 'price_deviation_pct':
                    aVal = a.price_deviation_pct ?? 0;
                    bVal = b.price_deviation_pct ?? 0;
                    break;
                case 'budget':
                    aVal = a.budget;
                    bVal = b.budget;
                    break;
                case 'risk_score':
                    aVal = a.risk_score;
                    bVal = b.risk_score;
                    break;
                case 'name_ru':
                    aVal = a.name_ru;
                    bVal = b.name_ru;
                    break;
                default:
                    return 0;
            }

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return lotSortDesc ? bVal.localeCompare(aVal, 'ru') : aVal.localeCompare(bVal, 'ru');
            }

            return lotSortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
        });

        return sorted;
    }, [lotsData?.items, lotSortBy, lotSortDesc]);

    const toggleSort = (field: SortField) => {
        if (sortBy === field) {
            setSortDesc(!sortDesc);
        } else {
            setSortBy(field);
            setSortDesc(true);
        }
    };

    const toggleLotSort = (field: LotSortField) => {
        if (lotSortBy === field) {
            setLotSortDesc(!lotSortDesc);
        } else {
            setLotSortBy(field);
            setLotSortDesc(true);
        }
    };

    const currentError = viewMode === 'categories' ? error : lotsError;
    const currentLoading = viewMode === 'categories' ? loading : lotsLoading;

    if (currentError) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-4 glass-card p-8">
                    <ServerCrash className="w-12 h-12 text-[hsl(var(--destructive))] mx-auto" />
                    <p className="text-[hsl(var(--foreground))] font-semibold">Ошибка загрузки</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{currentError}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <DollarSign className="w-7 h-7 text-[hsl(var(--primary))]" />
                        Анализ лотов по ценам
                    </h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                        {viewMode === 'categories'
                            ? 'Статистика цен по категориям ТРУ с медианными значениями'
                            : 'Лоты с отклонением от медианной цены категории'
                        }
                    </p>
                </div>

                {/* View Mode Toggle */}
                <div className="flex gap-2 bg-[hsl(var(--secondary))] p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('categories')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'categories'
                                ? 'bg-[hsl(var(--primary))] text-black shadow-sm'
                                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                            }`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        Категории
                    </button>
                    <button
                        onClick={() => setViewMode('lots')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'lots'
                                ? 'bg-[hsl(var(--primary))] text-black shadow-sm'
                                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                            }`}
                    >
                        <List className="w-4 h-4" />
                        Лоты
                    </button>
                </div>
            </div>

            {/* Stats Summary */}
            {viewMode === 'categories' && data && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="glass-card p-4">
                        <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
                            Категорий
                        </div>
                        <div className="text-2xl font-bold">{data.total.toLocaleString()}</div>
                    </div>
                    <div className="glass-card p-4">
                        <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
                            Всего лотов
                        </div>
                        <div className="text-2xl font-bold">
                            {data.categories.reduce((sum, cat) => sum + cat.count, 0).toLocaleString()}
                        </div>
                    </div>
                    <div className="glass-card p-4">
                        <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
                            Средняя медиана
                        </div>
                        <div className="text-2xl font-bold">
                            {formatBudget(
                                data.categories.reduce((sum, cat) => sum + cat.median, 0) / data.categories.length
                            )}
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'lots' && lotsData && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="glass-card p-4">
                        <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
                            Лотов показано
                        </div>
                        <div className="text-2xl font-bold">{sortedLots.length.toLocaleString()}</div>
                    </div>
                    <div className="glass-card p-4">
                        <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
                            Макс. отклонение
                        </div>
                        <div className="text-2xl font-bold text-[hsl(var(--risk-high))]">
                            {sortedLots.length > 0
                                ? `+${Math.max(...sortedLots.map(l => l.price_deviation_pct ?? 0)).toFixed(0)}%`
                                : '—'
                            }
                        </div>
                    </div>
                    <div className="glass-card p-4">
                        <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
                            Мин. отклонение
                        </div>
                        <div className="text-2xl font-bold text-[hsl(var(--risk-low))]">
                            {sortedLots.length > 0
                                ? `${Math.min(...sortedLots.map(l => l.price_deviation_pct ?? 0)).toFixed(0)}%`
                                : '—'
                            }
                        </div>
                    </div>
                    <div className="glass-card p-4">
                        <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
                            Средний бюджет
                        </div>
                        <div className="text-2xl font-bold">
                            {sortedLots.length > 0
                                ? formatBudget(sortedLots.reduce((sum, l) => sum + l.budget, 0) / sortedLots.length)
                                : '—'
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    {viewMode === 'categories' ? (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="table-header">
                                    <th
                                        className="text-left p-3 rounded-tl-lg cursor-pointer select-none hover:text-[hsl(var(--foreground))] transition-colors"
                                        onClick={() => toggleSort('category_name')}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            Категория <ArrowUpDown className="w-3 h-3" />
                                        </span>
                                    </th>
                                    <th
                                        className="text-right p-3 cursor-pointer select-none hover:text-[hsl(var(--foreground))] transition-colors"
                                        onClick={() => toggleSort('count')}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            Лотов <ArrowUpDown className="w-3 h-3" />
                                        </span>
                                    </th>
                                    <th
                                        className="text-right p-3 cursor-pointer select-none hover:text-[hsl(var(--foreground))] transition-colors"
                                        onClick={() => toggleSort('median')}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            Медиана <ArrowUpDown className="w-3 h-3" />
                                        </span>
                                    </th>
                                    <th className="text-right p-3">Средняя</th>
                                    <th className="text-right p-3">Мин / Макс</th>
                                    <th
                                        className="text-right p-3 rounded-tr-lg cursor-pointer select-none hover:text-[hsl(var(--foreground))] transition-colors"
                                        onClick={() => toggleSort('high_risk_pct')}
                                        title="Процент лотов с высоким или критическим уровнем риска в категории"
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            Высокий риск <ArrowUpDown className="w-3 h-3" />
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedCategories.map((cat) => (
                                    <tr
                                        key={cat.category_code}
                                        className="table-row cursor-pointer"
                                        onClick={() => navigate(`/lots?search=${encodeURIComponent(cat.category_name)}`)}
                                    >
                                        <td className="p-3 max-w-[350px]">
                                            <p className="font-medium truncate">{cat.category_name}</p>
                                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                                                {cat.category_code}
                                            </p>
                                        </td>
                                        <td className="p-3 text-right font-medium">
                                            {cat.count.toLocaleString()}
                                        </td>
                                        <td className="p-3 text-right font-semibold">
                                            {formatBudget(cat.median)}
                                        </td>
                                        <td className="p-3 text-right text-[hsl(var(--muted-foreground))]">
                                            {formatBudget(cat.avg)}
                                        </td>
                                        <td className="p-3 text-right text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                                            <div>{formatBudget(cat.min)}</div>
                                            <div>{formatBudget(cat.max)}</div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <span className={
                                                cat.high_risk_pct >= 50 ? 'text-[hsl(var(--risk-critical))] font-bold' :
                                                    cat.high_risk_pct >= 25 ? 'text-[hsl(var(--risk-high))] font-semibold' :
                                                        cat.high_risk_pct >= 10 ? 'text-[hsl(var(--risk-medium))]' :
                                                            'text-[hsl(var(--risk-low))]'
                                            }>
                                                {cat.high_risk_pct.toFixed(1)}%
                                            </span>
                                            <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-1">
                                                ({cat.high_risk_count})
                                            </span>
                                        </td>
                                    </tr>
                                ))}

                                {currentLoading && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center">
                                            <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary))] mx-auto" />
                                        </td>
                                    </tr>
                                )}

                                {!currentLoading && sortedCategories.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-[hsl(var(--muted-foreground))]">
                                            Нет данных
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="table-header">
                                    <th
                                        className="text-left p-3 rounded-tl-lg cursor-pointer select-none hover:text-[hsl(var(--foreground))] transition-colors"
                                        onClick={() => toggleLotSort('name_ru')}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            Лот <ArrowUpDown className="w-3 h-3" />
                                        </span>
                                    </th>
                                    <th className="text-left p-3">Категория</th>
                                    <th
                                        className="text-right p-3 cursor-pointer select-none hover:text-[hsl(var(--foreground))] transition-colors"
                                        onClick={() => toggleLotSort('budget')}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            Бюджет <ArrowUpDown className="w-3 h-3" />
                                        </span>
                                    </th>
                                    <th className="text-right p-3">Медиана категории</th>
                                    <th
                                        className="text-right p-3 cursor-pointer select-none hover:text-[hsl(var(--foreground))] transition-colors"
                                        onClick={() => toggleLotSort('price_deviation_pct')}
                                        title="Отклонение от медианной цены категории"
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            Отклонение <ArrowUpDown className="w-3 h-3" />
                                        </span>
                                    </th>
                                    <th
                                        className="text-right p-3 rounded-tr-lg cursor-pointer select-none hover:text-[hsl(var(--foreground))] transition-colors"
                                        onClick={() => toggleLotSort('risk_score')}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            Риск <ArrowUpDown className="w-3 h-3" />
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedLots.map((lot) => {
                                    const deviation = lot.price_deviation_pct ?? 0;
                                    const isHighDeviation = Math.abs(deviation) > 100;

                                    return (
                                        <tr
                                            key={lot.lot_id}
                                            className="table-row cursor-pointer"
                                            onClick={() => navigate(`/lots/${encodeURIComponent(lot.lot_id)}`)}
                                        >
                                            <td className="p-3 max-w-[300px]">
                                                <p className="font-medium truncate flex items-center gap-2">
                                                    {lot.name_ru}
                                                    {lot.is_synthetic && (
                                                        <span className="inline-flex items-center gap-0.5 bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0">
                                                            🤖 Тест
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                                                    {lot.lot_id}
                                                </p>
                                            </td>
                                            <td className="p-3 text-[hsl(var(--muted-foreground))] max-w-[200px]">
                                                <p className="truncate text-xs">{lot.category_name}</p>
                                            </td>
                                            <td className="p-3 text-right font-semibold whitespace-nowrap">
                                                {formatBudget(lot.budget)}
                                            </td>
                                            <td className="p-3 text-right text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                                                {lot.category_median ? formatBudget(lot.category_median) : '—'}
                                            </td>
                                            <td className="p-3 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1">
                                                    {deviation > 0 ? (
                                                        <TrendingUp className={`w-4 h-4 ${isHighDeviation
                                                                ? 'text-[hsl(var(--risk-critical))]'
                                                                : 'text-[hsl(var(--risk-high))]'
                                                            }`} />
                                                    ) : deviation < 0 ? (
                                                        <TrendingDown className="w-4 h-4 text-[hsl(var(--risk-low))]" />
                                                    ) : (
                                                        <Minus className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                                    )}
                                                    <span className={`font-semibold ${deviation > 200 ? 'text-[hsl(var(--risk-critical))]' :
                                                            deviation > 100 ? 'text-[hsl(var(--risk-high))]' :
                                                                deviation > 50 ? 'text-[hsl(var(--risk-medium))]' :
                                                                    deviation < 0 ? 'text-[hsl(var(--risk-low))]' :
                                                                        'text-[hsl(var(--muted-foreground))]'
                                                        }`}>
                                                        {deviation > 0 ? '+' : ''}{deviation.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-right">
                                                <span className={
                                                    lot.risk_score >= 75 ? 'text-[hsl(var(--risk-critical))] font-bold' :
                                                        lot.risk_score >= 50 ? 'text-[hsl(var(--risk-high))] font-semibold' :
                                                            lot.risk_score >= 25 ? 'text-[hsl(var(--risk-medium))]' :
                                                                'text-[hsl(var(--risk-low))]'
                                                }>
                                                    {lot.risk_score.toFixed(1)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {currentLoading && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center">
                                            <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary))] mx-auto" />
                                        </td>
                                    </tr>
                                )}

                                {!currentLoading && sortedLots.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-[hsl(var(--muted-foreground))]">
                                            Нет данных
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
