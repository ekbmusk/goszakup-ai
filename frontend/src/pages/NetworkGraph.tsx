import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
    MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
<<<<<<< HEAD
import { Loader2, ServerCrash, Network as NetworkIcon, Building2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
=======
import { Loader2, ServerCrash, Network as NetworkIcon, Building2, Users, AlertTriangle, TrendingUp, DollarSign, ShoppingCart, X, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
>>>>>>> 28937e76 (compare adde)

interface NetworkNode {
    bin: string;
    name: string;
    type: 'customer' | 'supplier';
    total_lots: number;
    total_budget: number;
    high_risk_lots: number;
}

interface NetworkEdge {
    source: string;
    target: string;
    weight: number;
    total_budget: number;
    lot_count: number;
    lot_ids: string[];
}

interface LotRiskInfo {
    lot_id: string;
    name_ru: string;
    budget: number;
    final_score: number;
    final_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    customer_name: string;
}

interface SupplierConnection {
    customer_bin: string;
    customer_name: string;
    lot_count: number;
    total_budget: number;
    suspicious_lots: LotRiskInfo[];
}

interface NetworkGraphData {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
    stats: {
        total_nodes: number;
        total_edges: number;
        customer_count: number;
        supplier_count: number;
    };
}

type LayoutType = 'horizontal' | 'vertical' | 'circular' | 'grid';

export default function NetworkGraph() {
<<<<<<< HEAD
    const { t } = useTranslation();
=======
    const navigate = useNavigate();
>>>>>>> 28937e76 (compare adde)
    const [data, setData] = useState<NetworkGraphData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [minConnections, setMinConnections] = useState(2);
    const [maxNodes, setMaxNodes] = useState(100);
    const [layout, setLayout] = useState<LayoutType>('horizontal');
    const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
    const [supplierConnections, setSupplierConnections] = useState<SupplierConnection[]>([]);
    const [loadingConnections, setLoadingConnections] = useState(false);
    const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    useEffect(() => {
        fetchNetwork();
    }, [minConnections, maxNodes]);

    // Обновляем позиции узлов при смене layout
    useEffect(() => {
        if (nodes.length > 0 && data) {
            applyLayout();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layout]);

    const calculatePosition = (node: NetworkNode, idx: number, totalNodes: number, nodeType: 'customer' | 'supplier', typeIndex: number): { x: number; y: number } => {
        const isCustomer = nodeType === 'customer';

        switch (layout) {
            case 'horizontal':
                // Заказчики слева, поставщики справа
                return {
                    x: isCustomer ? 100 : 700,
                    y: typeIndex * 80
                };

            case 'vertical':
                // Заказчики сверху, поставщики снизу
                return {
                    x: typeIndex * 160,
                    y: isCustomer ? 50 : 400
                };

            case 'circular':
                // Все узлы по кругу
                const angle = (2 * Math.PI * idx) / totalNodes;
                const radius = 300;
                return {
                    x: 400 + radius * Math.cos(angle),
                    y: 300 + radius * Math.sin(angle)
                };

            case 'grid':
                // Сетка 10 колонок
                const cols = 10;
                return {
                    x: (idx % cols) * 160,
                    y: Math.floor(idx / cols) * 100
                };

            default:
                return { x: 100, y: idx * 80 };
        }
    };

    const applyLayout = () => {
        if (!data) return;

        const customers = data.nodes.filter((n: NetworkNode) => n.type === 'customer');
        const suppliers = data.nodes.filter((n: NetworkNode) => n.type === 'supplier');

        const updatedNodes = nodes.map((node: Node, idx: number) => {
            const nodeData = data.nodes.find((n: NetworkNode) => n.bin === node.id);
            if (!nodeData) return node;

            const isCustomer = nodeData.type === 'customer';
            const typeIndex = isCustomer
                ? customers.findIndex((c: NetworkNode) => c.bin === nodeData.bin)
                : suppliers.findIndex((s: NetworkNode) => s.bin === nodeData.bin);

            return {
                ...node,
                position: calculatePosition(nodeData, idx, data.nodes.length, nodeData.type, typeIndex)
            };
        });

        setNodes(updatedNodes);
    };

    const fetchSupplierConnections = async (supplierBin: string) => {
        if (!data) return;

        setLoadingConnections(true);
        try {
            const connections = data.edges.filter(edge => edge.target === supplierBin);

            const connectionData: SupplierConnection[] = await Promise.all(
                connections.map(async (conn) => {
                    const customerNode = data.nodes.find(n => n.bin === conn.source);

                    const lotsInfo = await Promise.all(
                        conn.lot_ids.slice(0, 5).map(async (lotId) => {
                            try {
                                const response = await fetch(`/api/lots/${encodeURIComponent(lotId)}/analysis`);
                                if (!response.ok) return null;
                                const analysis = await response.json();

                                if (analysis.final_level === 'LOW') return null;

                                return {
                                    lot_id: analysis.lot_id,
                                    name_ru: analysis.lot_data.name_ru,
                                    budget: analysis.lot_data.budget,
                                    final_score: analysis.final_score,
                                    final_level: analysis.final_level,
                                    customer_name: analysis.lot_data.customer_name
                                } as LotRiskInfo;
                            } catch (err) {
                                return null;
                            }
                        })
                    );

                    const suspiciousLots = lotsInfo.filter((lot): lot is LotRiskInfo => lot !== null);

                    return {
                        customer_bin: conn.source,
                        customer_name: customerNode?.name || conn.source,
                        lot_count: conn.lot_count,
                        total_budget: conn.total_budget,
                        suspicious_lots: suspiciousLots
                    };
                })
            );

            const sorted = connectionData
                .sort((a, b) => b.suspicious_lots.length - a.suspicious_lots.length);

            setSupplierConnections(sorted);
        } catch (err) {
            console.error('Failed to fetch supplier connections:', err);
        } finally {
            setLoadingConnections(false);
        }
    };

    const fetchNetwork = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/network/graph?min_connections=${minConnections}&max_nodes=${maxNodes}`);
            if (!response.ok) throw new Error('Failed to fetch network');
            const result: NetworkGraphData = await response.json();

            // Проверяем что данные есть
            if (!result.nodes || !result.edges || !result.stats) {
                setData({
                    nodes: [],
                    edges: [],
                    stats: {
                        total_nodes: 0,
                        total_edges: 0,
                        customer_count: 0,
                        supplier_count: 0
                    }
                });
                setNodes([]);
                setEdges([]);
                setError(t('network.noData'));
                return;
            }

            setData(result);
            setError(null);

            // Separate customers and suppliers for layout calculation
            const customers = result.nodes.filter(n => n.type === 'customer');
            const suppliers = result.nodes.filter(n => n.type === 'supplier');

            // Convert to ReactFlow format
            const flowNodes: Node[] = result.nodes.map((node, idx) => {
                const isCustomer = node.type === 'customer';
                const riskPct = node.total_lots > 0 ? (node.high_risk_lots / node.total_lots * 100) : 0;
                const avgBudgetPerLot = node.total_lots > 0 ? node.total_budget / node.total_lots : 0;
                const isHighActivity = node.total_lots > 10; // Странность: много контрактов
                const isHighBudget = avgBudgetPerLot > 50000000; // Странность: большие суммы
                const hasAnomalies = !isCustomer && (riskPct > 60 || isHighActivity || isHighBudget);

                const typeIndex = isCustomer
                    ? customers.findIndex(c => c.bin === node.bin)
                    : suppliers.findIndex(s => s.bin === node.bin);

                const getNodeColor = () => {
                    if (isCustomer) return 'hsl(var(--primary))';
                    if (riskPct > 70) return '#ef4444'; // Критический риск - ярко-красный
                    if (riskPct > 50) return '#f97316'; // Высокий риск - оранжевый
                    if (hasAnomalies) return '#f59e0b'; // Есть странности - желтый
                    return 'hsl(var(--secondary))';
                };

                return {
                    id: node.bin,
                    type: 'default',
                    data: {
                        label: (
                            <div
                                className={`text-xs ${isCustomer ? 'cursor-pointer hover:opacity-80' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isCustomer) {
                                        navigate(`/customers/${node.bin}`);
                                    } else {
                                        setSelectedNode(node);
                                        setSupplierConnections([]);
                                        setExpandedCustomers(new Set());
                                        fetchSupplierConnections(node.bin);
                                    }
                                }}
                            >
                                <div className="font-semibold truncate max-w-[150px] relative" title={node.name}>
                                    {hasAnomalies && (
                                        <AlertTriangle className="w-3 h-3 absolute -left-3.5 top-0 text-orange-500" />
                                    )}
                                    {node.name || node.bin}
                                </div>
<<<<<<< HEAD
                                <div className="text-[10px] text-gray-500">
                                    {node.total_lots} {t('common.lots')}
=======
                                <div className="text-[10px] opacity-70 flex items-center gap-1">
                                    <ShoppingCart className="w-2.5 h-2.5" />
                                    {node.total_lots} лотов
>>>>>>> 28937e76 (compare adde)
                                </div>
                                {!isCustomer && riskPct > 50 && (
                                    <div className="text-[9px] font-bold text-red-900 mt-0.5">
                                        ⚠ Риск {riskPct.toFixed(0)}%
                                    </div>
                                )}
                            </div>
                        )
                    },
                    position: calculatePosition(node, idx, result.nodes.length, node.type, typeIndex),
                    style: {
                        background: getNodeColor(),
                        color: isCustomer || hasAnomalies ? '#fff' : 'hsl(var(--foreground))',
                        border: `3px solid ${hasAnomalies ? '#dc2626' : riskPct > 50 ? '#f97316' : 'hsl(var(--border))'}`,
                        borderRadius: '10px',
                        padding: '10px',
                        fontSize: '11px',
                        width: 170,
                        boxShadow: hasAnomalies ? '0 0 15px rgba(239, 68, 68, 0.5)' : 'none',
                        transition: 'all 0.2s ease',
                    },
                };
            });

            const flowEdges: Edge[] = result.edges.map((edge, idx) => ({
                id: `${edge.source}-${edge.target}-${idx}`,
                source: edge.source,
                target: edge.target,
                type: 'smoothstep',
                animated: edge.weight > 5,
                style: {
                    strokeWidth: Math.min(edge.weight / 2, 5),
                    stroke: edge.weight > 10
                        ? 'hsl(var(--risk-high))'
                        : 'hsl(var(--muted-foreground))',
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: edge.weight > 10
                        ? 'hsl(var(--risk-high))'
                        : 'hsl(var(--muted-foreground))',
                },
                label: edge.weight > 5 ? `${edge.weight}` : undefined,
                labelStyle: {
                    fontSize: '10px',
                    fill: 'hsl(var(--foreground))',
                    fontWeight: 'bold'
                },
                labelBgStyle: {
                    fill: 'hsl(var(--card))',
                    fillOpacity: 0.9,
                },
            }));

            setNodes(flowNodes);
            setEdges(flowEdges);
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
                    <p className="text-[hsl(var(--muted-foreground))] text-sm">{t('network.loading')}</p>
                </div>
            </div>
        );
    }

    if (error || !data || !data.stats) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-4 glass-card p-8">
                    <ServerCrash className="w-12 h-12 text-[hsl(var(--destructive))] mx-auto" />
                    <p className="text-[hsl(var(--foreground))] font-semibold">{t('network.loadError')}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        {error || t('network.noData')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 h-screen flex flex-col pb-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <NetworkIcon className="w-7 h-7 text-[hsl(var(--primary))]" />
                        {t('network.title')}
                    </h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                        {t('network.subtitle')}
                    </p>
                </div>

                {/* Controls */}
                <div className="flex gap-2">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-[hsl(var(--muted-foreground))]">Визуализация</label>
                        <select
                            value={layout}
                            onChange={(e) => setLayout(e.target.value as LayoutType)}
                            className="input-field text-sm py-1.5"
                        >
                            <option value="horizontal">Горизонтальная</option>
                            <option value="vertical">Вертикальная</option>
                            <option value="circular">Круговая</option>
                            <option value="grid">Сетка</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-[hsl(var(--muted-foreground))]">{t('network.minLots')}</label>
                        <select
                            value={minConnections}
                            onChange={(e) => setMinConnections(Number(e.target.value))}
                            className="input-field text-sm py-1.5"
                        >
                            <option value="1">1+</option>
                            <option value="2">2+</option>
                            <option value="3">3+</option>
                            <option value="5">5+</option>
                            <option value="10">10+</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-[hsl(var(--muted-foreground))]">Макс. узлов</label>
                        <select
                            value={maxNodes}
                            onChange={(e) => setMaxNodes(Number(e.target.value))}
                            className="input-field text-sm py-1.5"
                        >
                            <option value="50">50</option>
                            <option value="100">100</option>
                            <option value="200">200</option>
                            <option value="300">300</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <div className="glass-card p-3">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
                        {t('network.connections')}
                    </div>
                    <div className="text-xl font-bold">{data.stats.total_nodes}</div>
                </div>
                <div className="glass-card p-3">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {t('network.customers')}
                    </div>
                    <div className="text-xl font-bold">{data.stats.customer_count}</div>
                </div>
                <div className="glass-card p-3">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {t('network.suppliers')}
                    </div>
                    <div className="text-xl font-bold">{data.stats.supplier_count}</div>
                </div>
                <div className="glass-card p-3">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
                        {t('network.connections')}
                    </div>
                    <div className="text-xl font-bold">{data.stats.total_edges}</div>
                </div>
            </div>

            {/* Legend */}
<<<<<<< HEAD
            <div className="glass-card p-3 flex items-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ background: 'hsl(var(--primary))' }}></div>
                    <span>{t('network.customers')}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ background: 'hsl(var(--secondary))' }}></div>
                    <span>{t('network.suppliers')}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2" style={{
                        background: 'hsl(var(--risk-high))',
                        borderColor: 'hsl(var(--risk-critical))'
                    }}></div>
                    <span>{t('common.riskHigh')}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 bg-[hsl(var(--muted-foreground))]"></div>
                    <span>{t('network.connections')}</span>
=======
            <div className="glass-card p-3 space-y-2">
                <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2">Обозначения:</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ background: 'hsl(var(--primary))' }}></div>
                        <span>Заказчик (кликабельно)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ background: 'hsl(var(--secondary))' }}></div>
                        <span>Поставщик (норма)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border-2" style={{
                            background: '#ef4444',
                            borderColor: '#dc2626'
                        }}></div>
                        <span>Критический риск (70%+)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border-2" style={{
                            background: '#f97316',
                            borderColor: '#f97316'
                        }}></div>
                        <span>Высокий риск (50-70%)</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        <span>Странности ({'>'}10 контрактов)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5 bg-[hsl(var(--muted-foreground))]"></div>
                        <span>Связь (толщина = кол-во)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5 bg-[hsl(var(--risk-high))] animate-pulse"></div>
                        <span>Активная связь (5+ контрактов)</span>
                    </div>
>>>>>>> 28937e76 (compare adde)
                </div>
            </div>

            {/* Graph */}
            <div className="flex-1 glass-card rounded-lg overflow-hidden relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    fitView
                    attributionPosition="bottom-left"
                >
                    <Background />
                    <Controls />
                    <MiniMap
                        nodeStrokeWidth={3}
                        zoomable
                        pannable
                    />
                </ReactFlow>

                {/* Node Info Panel */}
                {selectedNode && (
                    <div className="absolute top-4 right-4 w-80 glass-card p-4 shadow-2xl border-2 border-[hsl(var(--primary))] animate-in slide-in-from-right-5 fade-in duration-300">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                {selectedNode.type === 'customer' ? (
                                    <Building2 className="w-5 h-5 text-[hsl(var(--primary))]" />
                                ) : (
                                    <Users className="w-5 h-5 text-orange-500" />
                                )}
                                <h3 className="font-semibold text-sm">
                                    {selectedNode.type === 'customer' ? 'Заказчик' : 'Поставщик'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setSelectedNode(null)}
                                className="hover:bg-[hsl(var(--secondary))] rounded p-1 transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Название</div>
                                <div className="text-sm font-medium">{selectedNode.name}</div>
                            </div>

                            <div>
                                <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">БИН</div>
                                <div className="text-sm font-mono">{selectedNode.bin}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="glass-card p-2">
                                    <div className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1 mb-1">
                                        <ShoppingCart className="w-3 h-3" />
                                        Всего лотов
                                    </div>
                                    <div className="text-lg font-bold">{selectedNode.total_lots}</div>
                                </div>
                                <div className="glass-card p-2">
                                    <div className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1 mb-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        Рисков. лотов
                                    </div>
                                    <div className="text-lg font-bold text-[hsl(var(--risk-high))]">
                                        {selectedNode.high_risk_lots}
                                    </div>
                                </div>
                            </div>

                            <div className="glass-card p-2">
                                <div className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1 mb-1">
                                    <DollarSign className="w-3 h-3" />
                                    Общий бюджет
                                </div>
                                <div className="text-base font-bold">
                                    {(selectedNode.total_budget / 1000000).toFixed(1)} млн ₸
                                </div>
                            </div>

                            {selectedNode.type === 'supplier' && (
                                <>
                                    <div className="glass-card p-2 bg-orange-500/10 border border-orange-500/30">
                                        <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Процент риска</div>
                                        <div className="text-lg font-bold text-orange-600">
                                            {selectedNode.total_lots > 0
                                                ? ((selectedNode.high_risk_lots / selectedNode.total_lots) * 100).toFixed(1)
                                                : 0}%
                                        </div>
                                    </div>

                                    {selectedNode.total_lots > 10 && (
                                        <div className="flex items-start gap-2 p-2 bg-yellow-500/10 rounded border border-yellow-500/30">
                                            <TrendingUp className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                            <div className="text-xs text-yellow-700">
                                                <strong>Высокая активность:</strong> Больше 10 контрактов может указывать на фаворитизм
                                            </div>
                                        </div>
                                    )}

                                    {selectedNode.total_budget / selectedNode.total_lots > 50000000 && (
                                        <div className="flex items-start gap-2 p-2 bg-red-500/10 rounded border border-red-500/30">
                                            <DollarSign className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                            <div className="text-xs text-red-700">
                                                <strong>Крупные суммы:</strong> Средний контракт {'>'}  50 млн ₸
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {selectedNode.type === 'supplier' && (
                                <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">
                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                        <Building2 className="w-4 h-4" />
                                        Связанные заказчики
                                    </h4>

                                    {loadingConnections ? (
                                        <div className="flex items-center justify-center py-4">
                                            <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--muted-foreground))]" />
                                        </div>
                                    ) : supplierConnections.length === 0 ? (
                                        <div className="text-xs text-[hsl(var(--muted-foreground))] text-center py-3">
                                            Нет данных о связях
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-96 overflow-y-auto">
                                            {supplierConnections.map((conn) => {
                                                const isExpanded = expandedCustomers.has(conn.customer_bin);
                                                const hasSuspicious = conn.suspicious_lots.length > 0;
                                                const suspiciousBadgeClass = hasSuspicious
                                                    ? 'bg-red-500/20 text-red-600'
                                                    : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]';
                                                return (
                                                    <div key={conn.customer_bin} className="glass-card p-3 space-y-2">
                                                        <div
                                                            className="flex items-start justify-between cursor-pointer"
                                                            onClick={() => {
                                                                const newExpanded = new Set(expandedCustomers);
                                                                if (isExpanded) {
                                                                    newExpanded.delete(conn.customer_bin);
                                                                } else {
                                                                    newExpanded.add(conn.customer_bin);
                                                                }
                                                                setExpandedCustomers(newExpanded);
                                                            }}
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <button
                                                                    type="button"
                                                                    className="text-xs font-medium truncate text-left hover:underline"
                                                                    title={conn.customer_name}
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        navigate(`/customers/${conn.customer_bin}`);
                                                                    }}
                                                                >
                                                                    {conn.customer_name}
                                                                </button>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                                                        {conn.lot_count} лотов
                                                                    </span>
                                                                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                                                        {(conn.total_budget / 1000000).toFixed(2)} млн ₸
                                                                    </span>
                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${suspiciousBadgeClass}`}>
                                                                        {conn.suspicious_lots.length} подозрительных
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {isExpanded ? (
                                                                <ChevronUp className="w-4 h-4 text-[hsl(var(--muted-foreground))] flex-shrink-0" />
                                                            ) : (
                                                                <ChevronDown className="w-4 h-4 text-[hsl(var(--muted-foreground))] flex-shrink-0" />
                                                            )}
                                                        </div>

                                                        {isExpanded && (
                                                            <div className="space-y-2 pl-2 border-l-2 border-red-500/30 animate-in fade-in slide-in-from-top-2 duration-200">
                                                                {hasSuspicious ? (
                                                                    conn.suspicious_lots.map((lot) => {
                                                                        const riskColor = lot.final_level === 'CRITICAL' ? 'text-red-600 bg-red-500/20'
                                                                            : lot.final_level === 'HIGH' ? 'text-orange-600 bg-orange-500/20'
                                                                                : 'text-yellow-600 bg-yellow-500/20';
                                                                        const riskLabel = lot.final_level === 'CRITICAL' ? 'Критический'
                                                                            : lot.final_level === 'HIGH' ? 'Высокий'
                                                                                : 'Средний';

                                                                        return (
                                                                            <div
                                                                                key={lot.lot_id}
                                                                                className="p-2 bg-[hsl(var(--secondary))]/30 rounded hover:bg-[hsl(var(--secondary))]/50 transition cursor-pointer group"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    navigate(`/lots/${encodeURIComponent(lot.lot_id)}`);
                                                                                }}
                                                                            >
                                                                                <div className="flex items-start justify-between gap-2">
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <div className="text-[11px] font-medium truncate" title={lot.name_ru}>
                                                                                            {lot.name_ru}
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2 mt-1">
                                                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${riskColor}`}>
                                                                                                {riskLabel} риск
                                                                                            </span>
                                                                                            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                                                                                {(lot.budget / 1000000).toFixed(2)} млн ₸
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <ExternalLink className="w-3 h-3 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                                                        Подозрительных лотов нет
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedNode.type === 'customer' && (
                                <button
                                    onClick={() => navigate(`/customers/${selectedNode.bin}`)}
                                    className="btn-primary w-full text-sm mt-2"
                                >
                                    Перейти к заказчику →
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
