import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLots } from '@/hooks/useApi';
import { formatBudget, RiskLevel, SortBy } from '@/types/api';
import {
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    Loader2,
    ServerCrash,
    ArrowUpDown,
} from 'lucide-react';

const riskLevelConfig: Record<string, { label: string; class: string }> = {
    LOW: { label: 'Низкий', class: 'risk-low' },
    MEDIUM: { label: 'Средний', class: 'risk-medium' },
    HIGH: { label: 'Высокий', class: 'risk-high' },
    CRITICAL: { label: 'Критический', class: 'risk-critical' },
};

const PAGE_SIZE = 20;

export default function LotsList() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [riskFilter, setRiskFilter] = useState<RiskLevel | ''>(
        (searchParams.get('risk_level') as RiskLevel) || ''
    );
    const [sortBy, setSortBy] = useState<SortBy>(SortBy.RISK_SCORE);
    const [sortDesc, setSortDesc] = useState(true);
    const [page, setPage] = useState(0);

    // Debounce search
    const handleSearch = (value: string) => {
        setSearch(value);
        setPage(0);
        // Simple debounce
        setTimeout(() => setDebouncedSearch(value), 300);
    };

    const params = useMemo(() => ({
        page,
        size: PAGE_SIZE,
        risk_level: riskFilter || undefined,
        search: debouncedSearch || undefined,
        sort_by: sortBy,
        sort_desc: sortDesc,
    }), [page, riskFilter, debouncedSearch, sortBy, sortDesc]);

    const { data, loading, error } = useLots(params);

    const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

    const toggleSort = (field: SortBy) => {
        if (sortBy === field) {
            setSortDesc(!sortDesc);
        } else {
            setSortBy(field);
            setSortDesc(true);
        }
        setPage(0);
    };

    if (error) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-4 glass-card p-8">
                    <ServerCrash className="w-12 h-12 text-[hsl(var(--destructive))] mx-auto" />
                    <p className="text-[hsl(var(--foreground))] font-semibold">Ошибка загрузки</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Лоты закупок</h1>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                    Просмотр и фильтрация лотов государственных закупок
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    <input
                        type="text"
                        placeholder="Поиск по названию лота..."
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="input-field pl-10"
                    />
                </div>

                {/* Risk Level Filter */}
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    <select
                        value={riskFilter}
                        onChange={(e) => {
                            setRiskFilter(e.target.value as RiskLevel | '');
                            setPage(0);
                        }}
                        className="input-field pl-10 pr-8 appearance-none cursor-pointer min-w-[180px]"
                    >
                        <option value="">Все уровни</option>
                        <option value="LOW">Низкий</option>
                        <option value="MEDIUM">Средний</option>
                        <option value="HIGH">Высокий</option>
                        <option value="CRITICAL">Критический</option>
                    </select>
                </div>
            </div>

            {/* Results Info */}
            <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
                <span>
                    {data ? `Найдено: ${data.total.toLocaleString()} лотов` : 'Загрузка...'}
                </span>
                {loading && <Loader2 className="w-4 h-4 animate-spin text-[hsl(var(--primary))]" />}
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="table-header">
                                <th className="text-left p-3 rounded-tl-lg">Название лота</th>
                                <th className="text-left p-3">Категория</th>
                                <th className="text-left p-3">Город</th>
                                <th
                                    className="text-right p-3 cursor-pointer select-none hover:text-[hsl(var(--foreground))] transition-colors"
                                    onClick={() => toggleSort(SortBy.BUDGET)}
                                >
                                    <span className="inline-flex items-center gap-1">
                                        Бюджет <ArrowUpDown className="w-3 h-3" />
                                    </span>
                                </th>
                                <th
                                    className="text-right p-3 cursor-pointer select-none hover:text-[hsl(var(--foreground))] transition-colors"
                                    onClick={() => toggleSort(SortBy.RISK_SCORE)}
                                >
                                    <span className="inline-flex items-center gap-1">
                                        Риск <ArrowUpDown className="w-3 h-3" />
                                    </span>
                                </th>
                                <th className="text-center p-3 rounded-tr-lg">Уровень</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data?.items.map((lot) => {
                                const cfg = riskLevelConfig[lot.risk_level] || riskLevelConfig.MEDIUM;
                                return (
                                    <tr
                                        key={lot.lot_id}
                                        className="table-row cursor-pointer"
                                        onClick={() => navigate(`/lots/${encodeURIComponent(lot.lot_id)}`)}
                                    >
                                        <td className="p-3 max-w-[300px]">
                                            <p className="font-medium truncate">{lot.name_ru}</p>
                                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                                                {lot.lot_id}
                                            </p>
                                        </td>
                                        <td className="p-3 text-[hsl(var(--muted-foreground))]">
                                            {lot.category_name}
                                        </td>
                                        <td className="p-3 text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                                            {lot.city}
                                        </td>
                                        <td className="p-3 text-right font-medium whitespace-nowrap">
                                            {formatBudget(lot.budget)}
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
                                        <td className="p-3 text-center">
                                            <span className={`risk-badge ${cfg.class}`}>{cfg.label}</span>
                                        </td>
                                    </tr>
                                );
                            })}

                            {!loading && data?.items.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-[hsl(var(--muted-foreground))]">
                                        Лоты не найдены
                                    </td>
                                </tr>
                            )}

                            {loading && !data && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary))] mx-auto" />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button
                        className="btn-secondary"
                        disabled={page === 0}
                        onClick={() => setPage(Math.max(0, page - 1))}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-[hsl(var(--muted-foreground))] px-3">
                        Страница {page + 1} из {totalPages}
                    </span>
                    <button
                        className="btn-secondary"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage(page + 1)}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
