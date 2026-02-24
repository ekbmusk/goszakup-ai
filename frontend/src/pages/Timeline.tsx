import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Loader2, ServerCrash, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';

type PeriodType = 'day' | 'week' | 'month' | 'quarter';

interface TimelineData {
    period: string;
    count: number;
    avg_risk: number;
    risk_dist: {
        LOW: number;
        MEDIUM: number;
        HIGH: number;
        CRITICAL: number;
    };
    total_budget: number;
    high_risk_count: number;
    high_risk_pct: number;
}

interface TimelineResponse {
    period_type: PeriodType;
    timeline: TimelineData[];
    total_periods: number;
}

export default function Timeline() {
    const [data, setData] = useState<TimelineResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState<PeriodType>('month');
    const [limit, setLimit] = useState(12);

    useEffect(() => {
        fetchTimeline();
    }, [period, limit]);

    const fetchTimeline = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/stats/timeline?period=${period}&limit=${limit}`);
            if (!response.ok) throw new Error('Failed to fetch timeline');
            const result = await response.json();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-[hsl(var(--primary))] mx-auto" />
                    <p className="text-[hsl(var(--muted-foreground))] text-sm">Загрузка временной динамики...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
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

    const chartData = data.timeline.map(item => ({
        period: item.period,
        'Лотов': item.count,
        'Средний риск': item.avg_risk,
        'Высокий риск %': item.high_risk_pct,
        'LOW': item.risk_dist.LOW,
        'MEDIUM': item.risk_dist.MEDIUM,
        'HIGH': item.risk_dist.HIGH,
        'CRITICAL': item.risk_dist.CRITICAL,
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <TrendingUp className="w-7 h-7 text-[hsl(var(--primary))]" />
                        Временная динамика рисков
                    </h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                        Анализ изменения уровней риска во времени
                    </p>
                </div>

                {/* Period Selector */}
                <div className="flex gap-2">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as PeriodType)}
                        className="input-field text-sm"
                    >
                        <option value="day">По дням</option>
                        <option value="week">По неделям</option>
                        <option value="month">По месяцам</option>
                        <option value="quarter">По кварталам</option>
                    </select>
                    <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="input-field text-sm"
                    >
                        <option value="6">6 периодов</option>
                        <option value="12">12 периодов</option>
                        <option value="24">24 периода</option>
                        <option value="36">36 периодов</option>
                    </select>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-4">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
                        Всего периодов
                    </div>
                    <div className="text-2xl font-bold">{data.total_periods}</div>
                </div>
                <div className="glass-card p-4">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
                        Всего лотов
                    </div>
                    <div className="text-2xl font-bold">
                        {data.timeline.reduce((sum, item) => sum + item.count, 0).toLocaleString()}
                    </div>
                </div>
                <div className="glass-card p-4">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
                        Средний риск
                    </div>
                    <div className="text-2xl font-bold">
                        {(data.timeline.reduce((sum, item) => sum + item.avg_risk, 0) / data.timeline.length).toFixed(1)}
                    </div>
                </div>
                <div className="glass-card p-4">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
                        Ср. высокий риск
                    </div>
                    <div className="text-2xl font-bold text-[hsl(var(--risk-high))]">
                        {(data.timeline.reduce((sum, item) => sum + item.high_risk_pct, 0) / data.timeline.length).toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="space-y-6">
                {/* Lots Count & Risk Score */}
                <div className="glass-card p-6">
                    <h2 className="text-sm font-semibold mb-4">Количество лотов и средний риск</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px'
                                }}
                            />
                            <Legend />
                            <Area
                                yAxisId="left"
                                type="monotone"
                                dataKey="Лотов"
                                stroke="hsl(var(--primary))"
                                fill="hsla(var(--primary), 0.2)"
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="Средний риск"
                                stroke="hsl(var(--risk-high))"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Risk Distribution Stack */}
                <div className="glass-card p-6">
                    <h2 className="text-sm font-semibold mb-4">Распределение по уровням риска</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px'
                                }}
                            />
                            <Legend />
                            <Bar dataKey="LOW" stackId="a" fill="hsl(var(--risk-low))" />
                            <Bar dataKey="MEDIUM" stackId="a" fill="hsl(var(--risk-medium))" />
                            <Bar dataKey="HIGH" stackId="a" fill="hsl(var(--risk-high))" />
                            <Bar dataKey="CRITICAL" stackId="a" fill="hsl(var(--risk-critical))" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* High Risk Percentage Trend */}
                <div className="glass-card p-6">
                    <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-[hsl(var(--risk-high))]" />
                        Процент лотов с высоким риском
                    </h2>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px'
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="Высокий риск %"
                                stroke="hsl(var(--risk-critical))"
                                strokeWidth={3}
                                dot={{ fill: 'hsl(var(--risk-critical))', r: 4 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
