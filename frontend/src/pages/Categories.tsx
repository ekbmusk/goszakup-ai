import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatBudget } from '@/types/api';
import {
    FolderOpen,
    SearchIcon,
    AlertTriangle,
    Loader2,
    ChevronRight,
} from 'lucide-react';

interface Category {
    category_code: string;
    category_name: string;
    lot_count: number;
    total_budget: number;
    avg_risk_score: number;
    risk_distribution: Record<string, number>;
    high_critical_count: number;
}

export default function Categories() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'lot_count' | 'total_budget' | 'avg_risk_score'>('lot_count');
    const [sortDesc] = useState(true);
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const pageSize = 20;

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                setLoading(true);
                const query = new URLSearchParams({
                    page: page.toString(),
                    size: pageSize.toString(),
                    sort_by: sortBy,
                    sort_desc: sortDesc.toString(),
                    ...(search && { search }),
                });

                const response = await fetch(`/api/categories-list?${query}`);
                if (!response.ok) throw new Error('Failed to fetch categories');

                const data = await response.json();
                setCategories(data.items);
                setTotal(data.total);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, [page, search, sortBy, sortDesc]);

    const getRiskColor = (score: number) => {
        if (score >= 75) return 'text-[hsl(var(--risk-critical))]';
        if (score >= 50) return 'text-[hsl(var(--risk-high))]';
        if (score >= 25) return 'text-[hsl(var(--risk-medium))]';
        return 'text-[hsl(var(--risk-low))]';
    };

    const getRiskDistributionBadges = (dist: Record<string, number>) => {
        const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
        const colors: Record<typeof levels[number], string> = {
            LOW: 'bg-[hsl(var(--risk-low))]',
            MEDIUM: 'bg-[hsl(var(--risk-medium))]',
            HIGH: 'bg-[hsl(var(--risk-high))]',
            CRITICAL: 'bg-[hsl(var(--risk-critical))]',
        };

        return levels
            .filter(level => dist[level] > 0)
            .map(level => (
                <span
                    key={level}
                    className={`px-2 py-1 rounded text-xs text-white ${colors[level]}`}
                >
                    {dist[level]}
                </span>
            ));
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <FolderOpen className="w-6 h-6" />
                    {t('categories.title')}
                </h1>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                    {t('categories.subtitle')}
                </p>
            </div>

            {/* Search & Sort */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex-1 relative">
                    <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    <input
                        type="text"
                        placeholder={t('categories.searchPlaceholder')}
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(0);
                        }}
                        className="w-full pl-9 pr-4 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />
                </div>
                <select
                    value={sortBy}
                    onChange={(e) => {
                        setSortBy(e.target.value as typeof sortBy);
                        setPage(0);
                    }}
                    className="px-4 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                >
                    <option value="lot_count">{t('common.sortByLotCount')}</option>
                    <option value="total_budget">{t('common.sortByBudget')}</option>
                    <option value="avg_risk_score">{t('common.sortByRisk')}</option>
                </select>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="glass-card p-6 text-center">
                    <AlertTriangle className="w-8 h-8 text-[hsl(var(--destructive))] mx-auto mb-2" />
                    <p className="text-[hsl(var(--foreground))]">{error}</p>
                </div>
            )}

            {/* Categories List */}
            {!loading && !error && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categories.map((category) => (
                            <div
                                key={category.category_code}
                                onClick={() => navigate(`/categories/${category.category_code}`)}
                                className="glass-card p-4 hover:bg-[hsl(var(--secondary))] cursor-pointer transition-colors"
                            >
                                <div className="space-y-3">
                                    <div>
                                        <h3 className="font-semibold text-[hsl(var(--foreground))] line-clamp-2">
                                            {category.category_name}
                                        </h3>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                            {category.category_code}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <p className="text-[hsl(var(--muted-foreground))] text-xs">{t('categories.lotsCount')}</p>
                                            <p className="font-semibold text-[hsl(var(--foreground))]">
                                                {category.lot_count}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[hsl(var(--muted-foreground))] text-xs">{t('categories.budget')}</p>
                                            <p className="font-semibold text-[hsl(var(--foreground))]">
                                                {formatBudget(category.total_budget)}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[hsl(var(--muted-foreground))] text-xs mb-2">{t('categories.avgRisk')}</p>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-[hsl(var(--secondary))] rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full transition-all ${category.avg_risk_score >= 75
                                                        ? 'bg-[hsl(var(--risk-critical))]'
                                                        : category.avg_risk_score >= 50
                                                            ? 'bg-[hsl(var(--risk-high))]'
                                                            : category.avg_risk_score >= 25
                                                                ? 'bg-[hsl(var(--risk-medium))]'
                                                                : 'bg-[hsl(var(--risk-low))]'
                                                        }`}
                                                    style={{ width: `${category.avg_risk_score}%` }}
                                                />
                                            </div>
                                            <span className={`text-sm font-semibold ${getRiskColor(category.avg_risk_score)}`}>
                                                {category.avg_risk_score}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-1 flex-wrap">
                                        {getRiskDistributionBadges(category.risk_distribution)}
                                    </div>

                                    {category.high_critical_count > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-[hsl(var(--risk-high))]">
                                            <AlertTriangle className="w-4 h-4" />
                                            {category.high_critical_count} {t('categories.critical')}
                                        </div>
                                    )}

                                    <div className="pt-2 border-t border-[hsl(var(--border))] flex items-center justify-between">
                                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                            {t('common.details')}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-6">
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            {t('common.showing', { from: page * pageSize + 1, to: Math.min((page + 1) * pageSize, total), total })}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(Math.max(0, page - 1))}
                                disabled={page === 0}
                                className="px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[hsl(var(--primary))] hover:text-white transition-colors"
                            >
                                {t('common.back')}
                            </button>
                            <button
                                onClick={() => setPage(page + 1)}
                                disabled={(page + 1) * pageSize >= total}
                                className="px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[hsl(var(--primary))] hover:text-white transition-colors"
                            >
                                {t('common.forward')}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
