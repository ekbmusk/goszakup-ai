import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatBudget } from '@/types/api';
import {
    Building2,
    ArrowLeft,
    AlertTriangle,
    Loader2,
    BarChart3,
    Folder,
} from 'lucide-react';

interface CustomerDetailData {
    customer_bin: string;
    customer_name: string;
    total_lots: number;
    total_budget: number;
    avg_risk_score: number;
    categories: Array<{
        category_code: string;
        category_name: string;
        lot_count: number;
        budget: number;
        avg_risk_score: number;
    }>;
    recent_lots: Array<{
        lot_id: string;
        name_ru: string;
        category_code: string;
        category_name: string;
        budget: number;
        risk_score: number;
        risk_level: string;
        publish_date: string;
    }>;
}

export default function CustomerDetail() {
    const { t } = useTranslation();
    const { customerBin } = useParams();
    const navigate = useNavigate();
    const [customer, setCustomer] = useState<CustomerDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCustomer = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/customers/${customerBin}`);
                if (!response.ok) throw new Error('Failed to fetch customer');
                const data = await response.json();
                setCustomer(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        if (customerBin) fetchCustomer();
    }, [customerBin]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
            </div>
        );
    }

    if (error || !customer) {
        return (
            <div className="space-y-4">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[hsl(var(--primary))] hover:underline">
                    <ArrowLeft className="w-4 h-4" />
                    {t('common.back')}
                </button>
                <div className="glass-card p-6 text-center">
                    <AlertTriangle className="w-8 h-8 text-[hsl(var(--destructive))] mx-auto mb-2" />
                    <p className="text-[hsl(var(--foreground))]">{error || t('customerDetail.notFound')}</p>
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
                    {t('customerDetail.back')}
                </button>
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Building2 className="w-6 h-6" />
                            {customer.customer_name}
                        </h1>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                            {t('customerDetail.bin')}: {customer.customer_bin}
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="glass-card p-4">
                    <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase">{t('customerDetail.totalLots')}</p>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))] mt-2">{customer.total_lots}</p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase">{t('customerDetail.totalBudget')}</p>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))] mt-2">{formatBudget(customer.total_budget)}</p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase">{t('customerDetail.avgRisk')}</p>
                    <p className={`text-2xl font-bold mt-2 ${getRiskColor(customer.avg_risk_score)}`}>{customer.avg_risk_score}</p>
                </div>
            </div>

            {/* Categories */}
            <div className="glass-card p-6">
                <h2 className="text-lg font-bold text-[hsl(var(--foreground))] mb-4 flex items-center gap-2">
                    <Folder className="w-5 h-5" />
                    {t('categories.title')}
                </h2>
                <div className="space-y-3">
                    {customer.categories.length > 0 ? (
                        customer.categories.map((cat) => (
                            <div key={cat.category_code} className="p-3 bg-[hsl(var(--secondary))] rounded-lg border border-[hsl(var(--border))]">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="font-semibold text-[hsl(var(--foreground))]">{cat.category_name}</h4>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{cat.category_code}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                                            {cat.lot_count} {t('common.lots')}
                                        </p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{formatBudget(cat.budget)}</p>
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <div className="flex-1 bg-[hsl(var(--secondary))] rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${cat.avg_risk_score >= 75 ? 'bg-[hsl(var(--risk-critical))]' : cat.avg_risk_score >= 50 ? 'bg-[hsl(var(--risk-high))]' : cat.avg_risk_score >= 25 ? 'bg-[hsl(var(--risk-medium))]' : 'bg-[hsl(var(--risk-low))]'}`}
                                            style={{ width: `${cat.avg_risk_score}%` }}
                                        />
                                    </div>
                                    <span className={`text-sm font-semibold ${getRiskColor(cat.avg_risk_score)}`}>{cat.avg_risk_score}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-[hsl(var(--muted-foreground))]">{t('common.noData')}</p>
                    )}
                </div>
            </div>

            {/* Recent Lots */}
            <div className="glass-card p-6">
                <h2 className="text-lg font-bold text-[hsl(var(--foreground))] mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    {t('customerDetail.recentLots')}
                </h2>
                <div className="space-y-2">
                    {customer.recent_lots.length > 0 ? (
                        customer.recent_lots.map((lot) => (
                            <div
                                key={lot.lot_id}
                                className="p-3 bg-[hsl(var(--secondary))] rounded-lg border border-[hsl(var(--border))] cursor-pointer transition-colors hover:opacity-80"
                                onClick={() => navigate(`/lots/${lot.lot_id}`)}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-[hsl(var(--foreground))] truncate">{lot.name_ru}</h4>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                            {lot.category_name} • {new Date(lot.publish_date).toLocaleDateString('ru')}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{formatBudget(lot.budget)}</p>
                                        <p className={`text-sm font-semibold ${getRiskColor(lot.risk_score)}`}>{lot.risk_score}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-[hsl(var(--muted-foreground))]">{t('common.noData')}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
