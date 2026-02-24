import { useState, useEffect, useCallback } from 'react';
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
import { Loader2, ServerCrash, Network as NetworkIcon, Building2, Users } from 'lucide-react';

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
    const [data, setData] = useState<NetworkGraphData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [minConnections, setMinConnections] = useState(2);
    const [maxNodes, setMaxNodes] = useState(100);
    const [layout, setLayout] = useState<LayoutType>('horizontal');

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
                setError('Нет данных для отображения. Попробуйте изменить фильтры.');
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

                const typeIndex = isCustomer
                    ? customers.findIndex(c => c.bin === node.bin)
                    : suppliers.findIndex(s => s.bin === node.bin);

                return {
                    id: node.bin,
                    type: 'default',
                    data: {
                        label: (
                            <div className="text-xs">
                                <div className="font-semibold truncate max-w-[120px]" title={node.name}>
                                    {node.name || node.bin}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                    {node.total_lots} лотов
                                </div>
                            </div>
                        )
                    },
                    position: calculatePosition(node, idx, result.nodes.length, node.type, typeIndex),
                    style: {
                        background: isCustomer
                            ? 'hsl(var(--primary))'
                            : riskPct > 50
                                ? 'hsl(var(--risk-high))'
                                : 'hsl(var(--secondary))',
                        color: isCustomer || riskPct > 50 ? '#000' : 'hsl(var(--foreground))',
                        border: `2px solid ${riskPct > 50 ? 'hsl(var(--risk-critical))' : 'hsl(var(--border))'}`,
                        borderRadius: '8px',
                        padding: '8px',
                        fontSize: '11px',
                        width: 140,
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
                    <p className="text-[hsl(var(--muted-foreground))] text-sm">Построение графа связей...</p>
                </div>
            </div>
        );
    }

    if (error || !data || !data.stats) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-4 glass-card p-8">
                    <ServerCrash className="w-12 h-12 text-[hsl(var(--destructive))] mx-auto" />
                    <p className="text-[hsl(var(--foreground))] font-semibold">Ошибка загрузки</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        {error || 'Не удалось загрузить данные графа'}
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
                        Граф связей заказчик-поставщик
                    </h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                        Визуализация сети взаимоотношений в государственных закупках
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
                        <label className="text-xs text-[hsl(var(--muted-foreground))]">Мин. связей</label>
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
                        Всего узлов
                    </div>
                    <div className="text-xl font-bold">{data.stats.total_nodes}</div>
                </div>
                <div className="glass-card p-3">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        Заказчиков
                    </div>
                    <div className="text-xl font-bold">{data.stats.customer_count}</div>
                </div>
                <div className="glass-card p-3">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Поставщиков
                    </div>
                    <div className="text-xl font-bold">{data.stats.supplier_count}</div>
                </div>
                <div className="glass-card p-3">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
                        Связей
                    </div>
                    <div className="text-xl font-bold">{data.stats.total_edges}</div>
                </div>
            </div>

            {/* Legend */}
            <div className="glass-card p-3 flex items-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ background: 'hsl(var(--primary))' }}></div>
                    <span>Заказчик</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ background: 'hsl(var(--secondary))' }}></div>
                    <span>Поставщик</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2" style={{
                        background: 'hsl(var(--risk-high))',
                        borderColor: 'hsl(var(--risk-critical))'
                    }}></div>
                    <span>Высокий риск</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 bg-[hsl(var(--muted-foreground))]"></div>
                    <span>Связь (толщина = кол-во контрактов)</span>
                </div>
            </div>

            {/* Graph */}
            <div className="flex-1 glass-card rounded-lg overflow-hidden">
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
            </div>
        </div>
    );
}
