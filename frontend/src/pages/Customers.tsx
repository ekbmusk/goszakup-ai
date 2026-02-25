import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatBudget } from '@/types/api';
import {
    Building2,
    SearchIcon,
    AlertTriangle,
    Loader2,
    ChevronRight,
} from 'lucide-react';

interface Customer {
    customer_bin: string;
    customer_name: string;
    lot_count: number;
    total_budget: number;
    avg_risk_score: number;
    category_count: number;
    risk_distribution: Record<string, number>;
    high_critical_count: number;
}

export default function Customers() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'lot_count' | 'total_budget' | 'avg_risk_score'>('lot_count');
    const [sortDesc] = useState(true);
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const pageSize = 20;

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                setLoading(true);
                const query = new URLSearchParams({
                    page: page.toString(),
                    size: pageSize.toString(),
                    sort_by: sortBy,
                    sort_desc: sortDesc.toString(),
                    ...(search && { search }),
                });

                const response = await fetch(`/api/customers?${query}`);
                if (!response.ok) throw new Error('Failed to fetch customers');

                const data = await response.json();
                setCustomers(data.items);
                setTotal(data.total);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        fetchCustomers();
    }, [page, search, sortBy, sortDesc]);

    const getRiskColor = (score: number) => {
        if (score >= 75) return 'text-[hsl(var(--risk-critical))]';
        if (score >= 50) return 'text-[hsl(var(--risk-high))]';
        if (score >= 25) return 'text-[hsl(var(--risk-medium))]';
        return 'text-[hsl(var(--risk-low))]';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Building2 className="w-6 h-6" />
                    {t('customers.title')}
                </h1>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                    {t('customers.subtitle')}
                </p>
            </div>

            {/* Search & Sort */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex-1 relative">
                    <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    <input
                        type="text"
                        placeholder={t('customers.searchPlaceholder')}
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

            {/* Customers List */}
            {!loading && !error && (
                <>
                    <div className="space-y-2">
                        {customers.map((customer) => (
                            <div
                                key={customer.customer_bin}
                                onClick={() => navigate(`/customers/${customer.customer_bin}`)}
                                className="glass-card p-4 hover:bg-[hsl(var(--secondary))] cursor-pointer transition-colors"
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-[hsl(var(--foreground))] truncate">
                                            {customer.customer_name}
                                        </h3>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                            BIN: {customer.customer_bin}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-6 flex-wrap justify-end">
                                        <div className="text-right">
                                            <div className="text-sm font-semibold text-[hsl(var(--foreground))]">
                                                {customer.lot_count}
                                            </div>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('customers.lots')}</p>
                                        </div>

                                        <div className="text-right">
                                            <div className="text-sm font-semibold text-[hsl(var(--foreground))]">
                                                {formatBudget(customer.total_budget)}
                                            </div>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('customers.budget')}</p>
                                        </div>

                                        <div className="text-right">
                                            <div className={`text-sm font-semibold ${getRiskColor(customer.avg_risk_score)}`}>
                                                {customer.avg_risk_score}
                                            </div>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('customers.risk')}</p>
                                        </div>

                                        <div className="text-right">
                                            <div className="flex gap-1">
                                                <span className="px-2 py-1 rounded text-xs bg-[hsl(var(--primary))] text-white">
                                                    {customer.category_count}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('customers.categories')}</p>
                                        </div>

                                        {customer.high_critical_count > 0 && (
                                            <div className="text-right">
                                                <div className="flex items-center gap-1 text-sm font-semibold text-[hsl(var(--risk-high))]">
                                                    <AlertTriangle className="w-4 h-4" />
                                                    {customer.high_critical_count}
                                                </div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('customers.critical')}</p>
                                            </div>
                                        )}

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
