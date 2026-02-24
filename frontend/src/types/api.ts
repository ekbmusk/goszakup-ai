/**
 * GoszakupAI Backend API Types and Client
 * Full TypeScript support for Backend API integration
 * 
 * @see ../../../docs/API.md for full documentation
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Risk level classification for procurement lots
 */
export const RiskLevel = {
    LOW: 'LOW',           // score: 0-25
    MEDIUM: 'MEDIUM',     // score: 25-50
    HIGH: 'HIGH',         // score: 50-75
    CRITICAL: 'CRITICAL'  // score: 75-100
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

/**
 * Severity level for individual risk rules
 */
export const RuleSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
} as const;
export type RuleSeverity = (typeof RuleSeverity)[keyof typeof RuleSeverity];

/**
 * Sort options for procurement lots
 */
export const SortBy = {
    RISK_SCORE: 'risk_score',
    BUDGET: 'budget',
    DEADLINE_DAYS: 'deadline_days'
} as const;
export type SortBy = (typeof SortBy)[keyof typeof SortBy];

/**
 * Categories for risk rules
 */
export const RuleCategory = {
    SPECIFICATION: 'specification',
    SUPPLIER_RESTRICTION: 'supplier_restriction',
    TIMELINE: 'timeline',
    PRICE: 'price',
    PROCESS: 'process'
} as const;
export type RuleCategory = (typeof RuleCategory)[keyof typeof RuleCategory];

// ============================================================================
// HEALTH CHECK
// ============================================================================

export interface HealthResponse {
    status: 'ok' | 'error';
    total_lots?: number;
    analyzer_ready?: boolean;
}

// ============================================================================
// LOT STRUCTURES
// ============================================================================

export interface LotData {
    name_ru: string;
    category_code: string;
    category_name: string;
    budget: number;
    participants_count: number;
    deadline_days: number;
    city: string;
}

export interface LotSummary {
    lot_id: string;
    name_ru: string;
    category_name: string;
    budget: number;
    participants_count: number;
    deadline_days: number;
    city: string;
    risk_score: number;
    risk_level: RiskLevel;
    rules_count: number;
}

// ============================================================================
// RISK ANALYSIS
// ============================================================================

/**
 * Individual rule match when a risk factor is detected
 */
export interface RuleMatch {
    rule_id: string;
    datanomix_code: string;
    rule_name_ru: string;
    category: RuleCategory;
    weight: number;
    raw_score: number;
    explanation_ru: string;
    evidence: string;
    severity: RuleSeverity;
    law_reference: string;
}

/**
 * Aggregated rule analysis for a lot
 */
export interface RuleAnalysis {
    lot_id: string;
    risk_score: number;
    risk_level: RiskLevel;
    rules_triggered: RuleMatch[];
    rules_passed_count: number;
    total_rules_checked: number;
    summary_ru: string;
    highlights: string[];
    datanomix_codes: string[];
}

// ============================================================================
// ML FEATURES & PREDICTIONS
// ============================================================================

/**
 * Engineered features used in ML models
 */
export interface LotFeatures {
    lot_id: string;
    has_brand: boolean;
    brand_count: number;
    brand_names: string[];
    has_exclusive_phrase: boolean;
    has_no_analogs: boolean;
    dealer_requirement: boolean;
    geo_restriction: boolean;
    standard_count: number;
    text_length: number;
    participants_count: number;
    deadline_days: number;
    budget: number;
    is_copypaste: boolean;
    is_unique: boolean;
    category_code: string;
}

/**
 * ML model predictions with scores and anomaly detection
 */
export interface MLPrediction {
    isolation_anomaly: boolean;
    isolation_score: number;
    catboost_proba: number;
    ml_score: number;
}

// ============================================================================
// NETWORK ANALYSIS
// ============================================================================

export interface NetworkNode {
    type: 'supplier' | 'buyer' | 'other';
    degree: number;
    centrality: number;
    community_id: number;
    total_contracts: number;
}

export interface NetworkAnalysisResult {
    bin: string;
    node: NetworkNode;
    connections_count: number;
    flags: string[];
    community_size: number;
}

// ============================================================================
// FULL ANALYSIS
// ============================================================================

export interface SimilarLot {
    lot_id: string;
    similarity: number;
    name_ru: string;
}

/**
 * Complete analysis result for a procurement lot
 * Combines all risk factors, ML predictions, and explanations
 */
export interface FullAnalysis {
    lot_id: string;
    lot_data: LotData;
    final_score: number;
    final_level: RiskLevel;
    rule_analysis: RuleAnalysis;
    features: LotFeatures;
    similar_lots: SimilarLot[];
    ml_prediction: MLPrediction;
    network_flags: string[];
    explanation: string[];
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface GetLotsRequest {
    page?: number;
    size?: number;
    risk_level?: RiskLevel;
    search?: string;
    sort_by?: SortBy;
    sort_desc?: boolean;
}

export interface GetLotsResponse {
    total: number;
    page: number;
    size: number;
    items: LotSummary[];
}

export interface AnalyzeTextRequest {
    text: string;
    budget?: number;
    participants_count?: number;
    deadline_days?: number;
    category_code?: string;
}

export interface FeedbackRequest {
    lot_id: string;
    label: 0 | 1; // 0 = normal, 1 = risky
    comment?: string;
}

export interface FeedbackResponse {
    status: 'ok' | 'error';
}

export interface CategoryStats {
    count: number;
    high_risk: number;
    avg_score: number;
}

export interface DashboardStats {
    total_lots: number;
    processed_lots: number;
    all_lots: number;
    by_level: {
        [key in RiskLevel]: number;
    };
    avg_score: number;
    total_budget: number;
    by_category: {
        [key: string]: CategoryStats;
    };
    top_risks: FullAnalysis[];
}

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Configuration for API client
 */
export interface ApiClientConfig {
    baseUrl?: string;
    timeout?: number;
    retryAttempts?: number;
}

/**
 * Typed API client for GoszakupAI Backend
 * Handles all HTTP requests with proper typing
 */
export class GoszakupApiClient {
    private baseUrl: string;
    private timeout: number;
    private retryAttempts: number;

    constructor(config: ApiClientConfig = {}) {
        this.baseUrl = config.baseUrl || 'http://localhost:8000';
        this.timeout = config.timeout || 30000;
        this.retryAttempts = config.retryAttempts || 3;
    }

    /**
     * Generic fetch wrapper with error handling and retry logic
     */
    private async fetch<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(),
                    this.timeout
                );

                const response = await fetch(`${this.baseUrl}${endpoint}`, {
                    ...options,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new ApiError(
                        errorData.detail || `HTTP ${response.status}`,
                        response.status
                    );
                }

                return await response.json();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Don't retry on 4xx errors (except 503)
                if (
                    error instanceof ApiError &&
                    error.statusCode >= 400 &&
                    error.statusCode < 500 &&
                    error.statusCode !== 503
                ) {
                    throw error;
                }

                // Wait before retry (exponential backoff)
                if (attempt < this.retryAttempts) {
                    await new Promise(resolve =>
                        setTimeout(resolve, Math.pow(2, attempt) * 1000)
                    );
                }
            }
        }

        throw lastError || new Error('Failed after retries');
    }

    // Health Check
    // ============================================================================

    async getHealth(): Promise<HealthResponse> {
        return this.fetch<HealthResponse>('/api/health');
    }

    // Lots
    // ============================================================================

    /**
     * Get list of lots with filtering, sorting and pagination
     */
    async getLots(params: GetLotsRequest = {}): Promise<GetLotsResponse> {
        const query = new URLSearchParams();

        if (params.page !== undefined) query.append('page', String(params.page));
        if (params.size !== undefined) query.append('size', String(params.size));
        if (params.risk_level) query.append('risk_level', params.risk_level);
        if (params.search) query.append('search', params.search);
        if (params.sort_by) query.append('sort_by', params.sort_by);
        if (params.sort_desc !== undefined)
            query.append('sort_desc', String(params.sort_desc));

        const queryString = query.toString();
        const endpoint = `/api/lots${queryString ? `?${queryString}` : ''}`;

        return this.fetch<GetLotsResponse>(endpoint);
    }

    /**
     * Get HIGH and CRITICAL risk lots
     */
    async getHighRiskLots(
        page = 0,
        size = 20
    ): Promise<GetLotsResponse> {
        return this.getLots({
            page,
            size,
            risk_level: RiskLevel.HIGH,
            sort_by: SortBy.RISK_SCORE,
            sort_desc: true,
        });
    }

    /**
     * Get CRITICAL risk lots
     */
    async getCriticalRiskLots(
        page = 0,
        size = 20
    ): Promise<GetLotsResponse> {
        return this.getLots({
            page,
            size,
            risk_level: RiskLevel.CRITICAL,
            sort_by: SortBy.RISK_SCORE,
            sort_desc: true,
        });
    }

    /**
     * Search lots by name/description
     */
    async searchLots(
        query: string,
        riskLevel?: RiskLevel,
        page = 0
    ): Promise<GetLotsResponse> {
        return this.getLots({
            search: query,
            risk_level: riskLevel,
            page,
            size: 20,
        });
    }

    /**
     * Get full analysis of a specific lot
     */
    async analyzeLot(lotId: string): Promise<FullAnalysis> {
        return this.fetch<FullAnalysis>(
            `/api/lots/${encodeURIComponent(lotId)}/analysis`
        );
    }

    // Text Analysis
    // ============================================================================

    /**
     * Analyze arbitrary text specification/TZ
     */
    async analyzeText(request: AnalyzeTextRequest): Promise<FullAnalysis> {
        return this.fetch<FullAnalysis>('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });
    }

    /**
     * Analyze text with full context
     */
    async analyzeTextFull(
        text: string,
        budget = 0,
        participants_count = 0,
        deadline_days = 0,
        category_code = ''
    ): Promise<FullAnalysis> {
        return this.analyzeText({
            text,
            budget,
            participants_count,
            deadline_days,
            category_code,
        });
    }

    // Feedback
    // ============================================================================

    /**
     * Submit feedback about a lot (0 = normal, 1 = risky)
     */
    async submitFeedback(request: FeedbackRequest): Promise<FeedbackResponse> {
        return this.fetch<FeedbackResponse>('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });
    }

    /**
     * Submit feedback with specific parameters
     */
    async submitFeedbackFull(
        lot_id: string,
        label: 0 | 1,
        comment?: string
    ): Promise<FeedbackResponse> {
        return this.submitFeedback({
            lot_id,
            label,
            comment,
        });
    }

    // Dashboard Stats
    // ============================================================================

    /**
     * Get aggregated dashboard statistics
     */
    async getDashboardStats(): Promise<DashboardStats> {
        return this.fetch<DashboardStats>('/api/stats/dashboard');
    }

    // Network Analysis
    // ============================================================================

    /**
     * Analyze network relationships for an organization (by BIN)
     */
    async analyzeNetwork(binId: string): Promise<NetworkAnalysisResult> {
        return this.fetch<NetworkAnalysisResult>(
            `/api/network/${encodeURIComponent(binId)}`
        );
    }
}

// ============================================================================
// CUSTOM ERROR CLASS
// ============================================================================

export class ApiError extends Error {
    statusCode: number;
    constructor(
        message: string,
        statusCode: number
    ) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format risk score with emoji indicator
 */
export function formatRiskScore(score: number): string {
    if (score >= 75) return `🔴 ${score.toFixed(1)}`;
    if (score >= 50) return `🟠 ${score.toFixed(1)}`;
    if (score >= 25) return `🟡 ${score.toFixed(1)}`;
    return `🟢 ${score.toFixed(1)}`;
}

/**
 * Get risk level badge color for UI
 */
export function getRiskLevelColor(level: RiskLevel): string {
    switch (level) {
        case RiskLevel.CRITICAL:
            return '#dc2626'; // red
        case RiskLevel.HIGH:
            return '#f97316'; // orange
        case RiskLevel.MEDIUM:
            return '#eab308'; // yellow
        case RiskLevel.LOW:
        default:
            return '#22c55e'; // green
    }
}

/**
 * Format budget as currency
 */
export function formatBudget(amount: number): string {
    if (amount >= 1e9) {
        return `${(amount / 1e9).toFixed(1)}B ₸`;
    }
    if (amount >= 1e6) {
        return `${(amount / 1e6).toFixed(1)}M ₸`;
    }
    if (amount >= 1e3) {
        return `${(amount / 1e3).toFixed(1)}K ₸`;
    }
    return `${amount.toFixed(0)} ₸`;
}

/**
 * Get rule severity badge text
 */
export function getSeverityBadge(severity: RuleSeverity): {
    text: string;
    emoji: string;
} {
    switch (severity) {
        case RuleSeverity.CRITICAL:
            return { text: 'CRITICAL', emoji: '🔴' };
        case RuleSeverity.HIGH:
            return { text: 'HIGH', emoji: '🟠' };
        case RuleSeverity.MEDIUM:
            return { text: 'MEDIUM', emoji: '🟡' };
        case RuleSeverity.LOW:
        default:
            return { text: 'LOW', emoji: '🟢' };
    }
}

// ============================================================================
// DEMO USAGE EXAMPLES
// ============================================================================

/**
 * Example: Initialize API client and get high-risk lots
 * 
 * Usage in component:
 * const client = new GoszakupApiClient({ baseUrl: 'http://localhost:8000' });
 * const lots = await client.getHighRiskLots();
 */
export async function exampleGetHighRiskLots(): Promise<void> {
    const client = new GoszakupApiClient();

    try {
        const apiHealth = await client.getHealth();
        console.log('API Status:', apiHealth.status);

        const lots = await client.getHighRiskLots(0, 10);
        console.log(`Found ${lots.total} total lots`);
        console.log(`Showing ${lots.items.length} HIGH risk lots`);

        lots.items.forEach((lot) => {
            console.log(
                `- ${lot.name_ru} (${formatRiskScore(lot.risk_score)})`
            );
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

/**
 * Example: Analyze specific lot
 */
export async function exampleAnalyzeLot(lotId: string): Promise<void> {
    const client = new GoszakupApiClient();

    try {
        const analysis = await client.analyzeLot(lotId);

        console.log(`\n📋 Lot Analysis: ${analysis.lot_data.name_ru}`);
        console.log(`💰 Budget: ${formatBudget(analysis.lot_data.budget)}`);
        console.log(`⚠️ Risk Score: ${formatRiskScore(analysis.final_score)}`);
        console.log(`📊 Level: ${analysis.final_level}`);

        console.log('\n⚠️ Risk Factors:');
        analysis.rule_analysis.highlights.forEach((highlight) => {
            console.log(`  ${highlight}`);
        });

        console.log('\n🔝 Similar Lots:');
        analysis.similar_lots.slice(0, 3).forEach((similar) => {
            console.log(
                `  - ${similar.name_ru} (similarity: ${(similar.similarity * 100).toFixed(0)}%)`
            );
        });
    } catch (error) {
        console.error('Error analyzing lot:', error);
    }
}

/**
 * Example: Search lots and analyze top results
 */
export async function exampleSearchAndAnalyze(query: string): Promise<void> {
    const client = new GoszakupApiClient();

    try {
        const results = await client.searchLots(query, RiskLevel.HIGH);
        console.log(`Found ${results.total} HIGH-RISK lots matching "${query}"`);

        // Analyze top 3
        for (const lot of results.items.slice(0, 3)) {
            try {
                const analysis = await client.analyzeLot(lot.lot_id);
                console.log(
                    `\n${lot.name_ru} - ${formatRiskScore(analysis.final_score)}`
                );
                analysis.rule_analysis.rules_triggered.slice(0, 2).forEach((rule) => {
                    const badge = getSeverityBadge(rule.severity);
                    console.log(
                        `  ${badge.emoji} ${rule.rule_name_ru}: ${rule.explanation_ru}`
                    );
                });
            } catch (err) {
                console.error(`Failed to analyze ${lot.lot_id}:`, err);
            }
        }
    } catch (error) {
        console.error('Error in search and analyze:', error);
    }
}

/**
 * Example: Get dashboard statistics
 */
export async function exampleGetDashboardStats(): Promise<void> {
    const client = new GoszakupApiClient();

    try {
        const stats = await client.getDashboardStats();

        console.log('\n📊 GOSZAKUP DASHBOARD STATISTICS');
        console.log(`Total lots: ${stats.total_lots}`);
        console.log(`Processed: ${stats.processed_lots}`);
        console.log(`Average risk: ${formatRiskScore(stats.avg_score)}`);
        console.log(`Total budget: ${formatBudget(stats.total_budget)}`);

        console.log('\n📈 Risk Distribution:');
        Object.entries(stats.by_level).forEach(([level, count]) => {
            console.log(`  ${level}: ${count} lots`);
        });

        console.log('\n🔝 TOP 5 RISKY LOTS:');
        stats.top_risks.slice(0, 5).forEach((lot, idx) => {
            console.log(
                `${idx + 1}. ${lot.lot_data.name_ru} (${formatRiskScore(lot.final_score)})`
            );
        });
    } catch (error) {
        console.error('Error getting stats:', error);
    }
}

/**
 * Example: Analyze text before publication
 */
export async function exampleAnalyzeTextBeforePublish(): Promise<void> {
    const client = new GoszakupApiClient();

    const specText = `
    Говядина охлажденная, туша, I категория. 
    Требуется сертификат ISO 9001.
    Только поставщики с 5+ летним опытом работы с ГП.
  `;

    try {
        const analysis = await client.analyzeTextFull(
            specText,
            1872200,
            3,
            14,
            '101111.400.000006'
        );

        console.log(`\n📝 TEXT ANALYSIS BEFORE PUBLICATION`);
        console.log(`Risk Score: ${formatRiskScore(analysis.final_score)}`);

        if (analysis.final_score > 75) {
            console.warn('⚠️ HIGH RISK! Consider revising the specification.');
        } else {
            console.log('✅ Specification is acceptable.');
        }

        console.log('\n🔍 Issues Found:');
        analysis.rule_analysis.rules_triggered.forEach((rule) => {
            const badge = getSeverityBadge(rule.severity);
            console.log(`  ${badge.emoji} ${rule.rule_name_ru}`);
            console.log(`     → ${rule.explanation_ru}`);
        });
    } catch (error) {
        console.error('Error analyzing text:', error);
    }
}

export default GoszakupApiClient;
