import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatBudget } from '@/types/api';
import {
    FolderOpen,
    ArrowLeft,
    AlertTriangle,
    Loader2,
    Building2,
    TrendingUp,
} from 'lucide-react';

interface CategoryDetail {
    category_code: string;
    category_name: string;
    total_lots: number;
    total_budget: number;
    avg_risk_score: number;
    risk_distribution: Record<string, number>;
    price_stats: {
        count: number;
        median: number;
        min: number;
        max: number;
        avg: number;
        std_dev: number;
    };
    top_customers: Array<{
        customer_bin: string;
        customer_name: string;
        lot_count: number;
    }>;
    sample_high_risk_lots: Array<{
        lot_id: string;
        name_ru: string;
        budget: number;
        risk_score: number;
        risk_level: string;
    }>;
}

export default function CategoryDetail() {
    const { categoryCode } = useParams();
    const navigate = useNavigate();
    const [category, setCategory] = useState<CategoryDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCategory = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/categories/${categoryCode}`);
                if (!response.ok) throw new Error('Failed to fetch category');
                const data = await response.json();
                setCategory(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        if (categoryCode) {
            fetchCategory();
        }
    }, [categoryCode]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
            </div>
        );
    }

    if (error || !category) {
        return (
            <div className="space-y-4">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-[hsl(var(--primary))] hover:underline"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Назад
                </button>
                <div className="glass-card p-6 text-center">
                    <AlertTriangle className="w-8 h-8 text-[hsl(var(--destructive))] mx-auto mb-2" />
                    <p className="text-[hsl(var(--foreground))]">{error || 'Category not found'}</p>
                </div>
            </div>
        );
    }

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
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-[hsl(var(--primary))] hover:underline mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Назад к категориям
                </button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <FolderOpen className="w-6 h-6" />
                        {category.category_name}
                    </h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                        Код: {category.category_code}
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="glass-card p-4">
                    <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase">Всего лотов</p>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))] mt-2">
                        {category.total_lots}
                    </p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase">Общий бюджет</p>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))] mt-2">
                        {formatBudget(category.total_budget)}
                    </p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase">Средний риск</p>
                    <p className={`text-2xl font-bold mt-2 ${getRiskColor(category.avg_risk_score)}`}>
                        {category.avg_risk_score}
                    </p>
                </div>
            </div>

            {/* Risk Distribution */}
            <div className="glass-card p-6">
                <h2 className="text-lg font-bold text-[hsl(var(--foreground))] mb-4">Распределение рисков</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { level: 'LOW', label: 'Низкий', color: 'bg-[hsl(var(--risk-low))]' },
                        { level: 'MEDIUM', label: 'Средний', color: 'bg-[hsl(var(--risk-medium))]' },
                        { level: 'HIGH', label: 'Высокий', color: 'bg-[hsl(var(--risk-high))]' },
                        { level: 'CRITICAL', label: 'Критический', color: 'bg-[hsl(var(--risk-critical))]' },
                    ].map((item) => (
                        <div key={item.level} className="p-3 bg-[hsl(var(--secondary))] rounded-lg border border-[hsl(var(--border))]">
                            <div className={`inline-block w-4 h-4 rounded ${item.color} mb-2`} />
                            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                                {category.risk_distribution[item.level] || 0}
                            </p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{item.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Price Statistics */}
            <div className="glass-card p-6">
                <h2 className="text-lg font-bold text-[hsl(var(--foreground))] mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Статистика цен
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                        { label: 'Медиана', value: formatBudget(category.price_stats.median) },
                        { label: 'Минимум', value: formatBudget(category.price_stats.min) },
                        { label: 'Максимум', value: formatBudget(category.price_stats.max) },
                        { label: 'Среднее', value: formatBudget(category.price_stats.avg) },
                        { label: 'Станд. отклонение', value: formatBudget(category.price_stats.std_dev) },
                        { label: 'Выборка', value: category.price_stats.count },
                    ].map((stat, idx) => (
                        <div key={idx} className="p-3 bg-[hsl(var(--secondary))] rounded-lg border border-[hsl(var(--border))]">
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{stat.label}</p>
                            <p className="text-lg font-semibold text-[hsl(var(--foreground))] mt-1">
                                {stat.value}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top Customers */}
            <div className="glass-card p-6">
                <h2 className="text-lg font-bold text-[hsl(var(--foreground))] mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Основные заказчики в данной категории
                </h2>
                <div className="space-y-2">
                    {category.top_customers.length > 0 ? (
                        category.top_customers.map((customer) => (
                            <div
                                key={customer.customer_bin}
                                onClick={() => navigate(`/customers/${customer.customer_bin}`)}
                                className="p-3 bg-[hsl(var(--secondary))] rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] cursor-pointer transition-colors flex items-center justify-between"
                            >
                                <div>
                                    <h4 className="font-semibold text-[hsl(var(--foreground))]">
                                        {customer.customer_name}
                                    </h4>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                        {customer.customer_bin}
                                    </p>
                                </div>
                                <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                                    {customer.lot_count} лотов
                                </span>
                            </div>
                        ))
                    ) : (
                        <p className="text-[hsl(var(--muted-foreground))]">Нет заказчиков</p>
                    )}
                </div>
            </div>

            {/* High Risk Lots */}
            <div className="glass-card p-6">
                <h2 className="text-lg font-bold text-[hsl(var(--foreground))] mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Лоты с высоким риском
                </h2>
                <div className="space-y-2">
                    {category.sample_high_risk_lots.length > 0 ? (
                        category.sample_high_risk_lots.map((lot) => (
                            <div
                                key={lot.lot_id}
                                onClick={() => navigate(`/lots/${lot.lot_id}`)}
                                className="p-3 bg-[hsl(var(--secondary))] rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] cursor-pointer transition-colors"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-[hsl(var(--foreground))] truncate">
                                            {lot.name_ru}
                                        </h4>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                            ID: {lot.lot_id}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                                            {formatBudget(lot.budget)}
                                        </p>
                                        <p className={`text-sm font-semibold ${getRiskColor(lot.risk_score)}`}>
                                            {lot.risk_score}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-[hsl(var(--muted-foreground))]">Нет лотов с высоким риском</p>
                    )}
                </div>
            </div>
        </div>
    );
}
