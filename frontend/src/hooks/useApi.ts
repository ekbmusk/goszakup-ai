import { useState, useEffect, useCallback } from 'react';
import type {
    GetLotsResponse,
    GetLotsRequest,
    FullAnalysis,
    DashboardStats,
    AnalyzeTextRequest,
    HealthResponse,
    CategoryPricingResponse,
    CategoryPricingDetail,
} from '@/types/api';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://77.42.43.153:8080').replace(/\/$/, '');

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    return response.json();
}

// ─── Health ────────────────────────────────────────────────
export function useHealth() {
    const [data, setData] = useState<HealthResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch<HealthResponse>('/api/health')
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, []);

    return { data, loading };
}

// ─── Dashboard Stats ──────────────────────────────────────
export function useDashboardStats() {
    const [data, setData] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch_ = useCallback(() => {
        setLoading(true);
        apiFetch<DashboardStats>('/api/stats/dashboard')
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetch_(); }, [fetch_]);

    return { data, loading, error, refetch: fetch_ };
}

// ─── Lots List ────────────────────────────────────────────
export function useLots(params: GetLotsRequest = {}) {
    const [data, setData] = useState<GetLotsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch_ = useCallback(() => {
        setLoading(true);
        const query = new URLSearchParams();
        if (params.page !== undefined) query.append('page', String(params.page));
        if (params.size !== undefined) query.append('size', String(params.size));
        if (params.risk_level) query.append('risk_level', params.risk_level);
        if (params.search) query.append('search', params.search);
        if (params.sort_by) query.append('sort_by', params.sort_by);
        if (params.sort_desc !== undefined) query.append('sort_desc', String(params.sort_desc));

        const qs = query.toString();
        apiFetch<GetLotsResponse>(`/api/lots${qs ? `?${qs}` : ''}`)
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [params.page, params.size, params.risk_level, params.search, params.sort_by, params.sort_desc]);

    useEffect(() => { fetch_(); }, [fetch_]);

    return { data, loading, error, refetch: fetch_ };
}

// ─── Lot Analysis ─────────────────────────────────────────
export function useLotAnalysis(lotId: string | null) {
    const [data, setData] = useState<FullAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!lotId) return;
        setLoading(true);
        setError(null);
        apiFetch<FullAnalysis>(`/api/lots/${encodeURIComponent(lotId)}/analysis`)
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [lotId]);

    return { data, loading, error };
}

// ─── Text Analysis ────────────────────────────────────────
export function useTextAnalysis() {
    const [data, setData] = useState<FullAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const analyze = useCallback(async (request: AnalyzeTextRequest) => {
        setLoading(true);
        setError(null);
        setData(null);
        try {
            const result = await apiFetch<FullAnalysis>('/api/analyze', {
                method: 'POST',
                body: JSON.stringify(request),
            });
            setData(result);
            return result;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    return { data, loading, error, analyze };
}

// ─── Feedback ─────────────────────────────────────────────
export async function submitFeedback(lotId: string, label: 0 | 1, comment?: string) {
    return apiFetch<{ status: string }>('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({ lot_id: lotId, label, comment }),
    });
}

// ─── Category Pricing ─────────────────────────────────────
export function useCategoryPricing(params?: { sort_by?: string; min_count?: number }) {
    const [data, setData] = useState<CategoryPricingResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch_ = useCallback(() => {
        setLoading(true);
        const query = new URLSearchParams();
        if (params?.sort_by) query.append('sort_by', params.sort_by);
        if (params?.min_count) query.append('min_count', String(params.min_count));

        const qs = query.toString();
        apiFetch<CategoryPricingResponse>(`/api/stats/category-pricing${qs ? `?${qs}` : ''}`)
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [params?.sort_by, params?.min_count]);

    useEffect(() => { fetch_(); }, [fetch_]);

    return { data, loading, error, refetch: fetch_ };
}

// ─── Category Pricing Detail ──────────────────────────────
export function useCategoryPricingDetail(categoryCode: string | null) {
    const [data, setData] = useState<CategoryPricingDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!categoryCode) return;
        setLoading(true);
        setError(null);
        apiFetch<CategoryPricingDetail>(`/api/categories/${encodeURIComponent(categoryCode)}/pricing`)
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [categoryCode]);

    return { data, loading, error };
}
