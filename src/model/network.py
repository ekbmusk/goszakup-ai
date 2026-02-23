"""Анализ связей заказчик-поставщик на графе NetworkX."""
import logging
from dataclasses import dataclass, field
from collections import Counter
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import networkx as nx
    HAS_NETWORKX = True
except ImportError:
    HAS_NETWORKX = False
    logger.warning("[Network] NetworkX not installed. pip install networkx")


@dataclass
class NetworkNode:
    """Узел сети закупок."""
    bin: str
    name: str = ""
    type: str = ""          
    degree: int = 0
    centrality: float = 0.0
    community_id: int = -1
    total_contracts: int = 0
    total_sum: float = 0.0


@dataclass
class NetworkEdge:
    """Ребро между заказчиком и поставщиком."""
    customer_bin: str
    supplier_bin: str
    contract_count: int = 0
    total_sum: float = 0.0
    lot_ids: list[str] = field(default_factory=list)


@dataclass
class NetworkAnalysisResult:
    """Результат сетевого анализа по БИН."""
    bin: str
    node: Optional[NetworkNode] = None
    connections: list[NetworkNode] = field(default_factory=list)
    edges: list[NetworkEdge] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)
    community_members: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "bin": self.bin,
            "node": {
                "type": self.node.type if self.node else "",
                "degree": self.node.degree if self.node else 0,
                "centrality": self.node.centrality if self.node else 0,
                "community_id": self.node.community_id if self.node else -1,
                "total_contracts": self.node.total_contracts if self.node else 0,
            } if self.node else None,
            "connections_count": len(self.connections),
            "flags": self.flags,
            "community_size": len(self.community_members),
        }


class NetworkAnalyzer:
    """Анализирует сеть взаимоотношений заказчик-поставщик."""

    def __init__(self):
        self._graph: Optional[object] = None
        self._nodes: dict[str, NetworkNode] = {}
        self._edges: dict[tuple, NetworkEdge] = {}
        self._communities: dict[str, int] = {}

    def build_graph(self, lots: list[dict]):
        """Строит граф по лотам и контрактам."""
        if not HAS_NETWORKX:
            logger.error("[Network] Cannot build graph: NetworkX not installed")
            return

        self._graph = nx.Graph()
        self._nodes.clear()
        self._edges.clear()

        for lot in lots:
            customer = lot.get("customer_bin", "")
            supplier = lot.get("winner_bin", "")

            if not customer or not supplier:
                continue

            if customer not in self._nodes:
                self._nodes[customer] = NetworkNode(
                    bin=customer,
                    name=lot.get("customer_name", ""),
                    type="customer",
                )
            if supplier not in self._nodes:
                self._nodes[supplier] = NetworkNode(
                    bin=supplier,
                    type="supplier",
                )

            if self._nodes[supplier].type == "customer":
                self._nodes[supplier].type = "both"
            if self._nodes[customer].type == "supplier":
                self._nodes[customer].type = "both"

            edge_key = (customer, supplier)
            if edge_key not in self._edges:
                self._edges[edge_key] = NetworkEdge(
                    customer_bin=customer,
                    supplier_bin=supplier,
                )
            self._edges[edge_key].contract_count += 1
            self._edges[edge_key].total_sum += lot.get("contract_sum", 0)
            self._edges[edge_key].lot_ids.append(lot.get("lot_id", ""))

            self._nodes[customer].total_contracts += 1
            self._nodes[customer].total_sum += lot.get("budget", 0)
            self._nodes[supplier].total_contracts += 1
            self._nodes[supplier].total_sum += lot.get("contract_sum", 0)

            self._graph.add_edge(
                customer, supplier,
                weight=self._edges[edge_key].contract_count,
            )

        if self._graph.number_of_nodes() > 0:
            centrality = nx.degree_centrality(self._graph)
            for bin_id, cent in centrality.items():
                if bin_id in self._nodes:
                    self._nodes[bin_id].centrality = round(cent, 4)
                    self._nodes[bin_id].degree = self._graph.degree(bin_id)

        try:
            from networkx.algorithms.community import greedy_modularity_communities
            communities = greedy_modularity_communities(self._graph)
            for comm_id, community in enumerate(communities):
                for node in community:
                    self._communities[node] = comm_id
                    if node in self._nodes:
                        self._nodes[node].community_id = comm_id
        except Exception as e:
            logger.warning(f"[Network] Community detection failed: {e}")

        logger.info(
            f"[Network] Graph built: {self._graph.number_of_nodes()} nodes, "
            f"{self._graph.number_of_edges()} edges, "
            f"{len(set(self._communities.values()))} communities"
        )

    def analyze_bin(self, bin_id: str) -> NetworkAnalysisResult:
        """Возвращает сетевой анализ для БИН."""
        result = NetworkAnalysisResult(bin=bin_id)

        if not HAS_NETWORKX or self._graph is None:
            return result

        if bin_id not in self._nodes:
            return result

        result.node = self._nodes[bin_id]

        if self._graph.has_node(bin_id):
            neighbors = list(self._graph.neighbors(bin_id))
            for neighbor in neighbors:
                if neighbor in self._nodes:
                    result.connections.append(self._nodes[neighbor])

        for (cust, supp), edge in self._edges.items():
            if cust == bin_id or supp == bin_id:
                result.edges.append(edge)

        comm_id = self._communities.get(bin_id, -1)
        if comm_id >= 0:
            result.community_members = [
                b for b, c in self._communities.items()
                if c == comm_id and b != bin_id
            ]

        result.flags = self._detect_flags(bin_id, result)

        return result

    def _detect_flags(self, bin_id: str, result: NetworkAnalysisResult) -> list[str]:
        """Ищет подозрительные паттерны."""
        flags = []

        node = result.node
        if not node:
            return flags

        if node.centrality > 0.3:
            flags.append(
                f"Высокая центральность в сети ({node.centrality:.2f}): "
                f"связан с большим числом участников"
            )

        for edge in result.edges:
            if edge.contract_count >= 3:
                other = edge.supplier_bin if edge.customer_bin == bin_id else edge.customer_bin
                flags.append(
                    f"Повторяющееся сотрудничество ({edge.contract_count} контрактов) "
                    f"с БИН ...{other[-4:]}"
                )

        if len(result.community_members) >= 5:
            flags.append(
                f"Входит в крупную группу связанных организаций "
                f"({len(result.community_members) + 1} участников)"
            )

        if node.type == "both":
            flags.append(
                "Организация выступает и как заказчик, и как поставщик"
            )

        return flags

    def get_repeat_pairs(self, min_contracts: int = 3) -> list[NetworkEdge]:
        """Возвращает пары с повторяющимися контрактами."""
        return [
            edge for edge in self._edges.values()
            if edge.contract_count >= min_contracts
        ]

    def get_graph_data(self) -> dict:
        """Экспортирует данные графа для визуализации."""
        if not self._graph:
            return {"nodes": [], "edges": []}

        nodes = []
        for bin_id, node in self._nodes.items():
            nodes.append({
                "id": bin_id,
                "label": f"...{bin_id[-4:]}",
                "type": node.type,
                "degree": node.degree,
                "centrality": node.centrality,
                "community": node.community_id,
                "contracts": node.total_contracts,
            })

        edges = []
        for (cust, supp), edge in self._edges.items():
            edges.append({
                "from": cust,
                "to": supp,
                "weight": edge.contract_count,
                "total_sum": edge.total_sum,
            })

        return {"nodes": nodes, "edges": edges}