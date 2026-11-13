import { db } from '@/server/db/client';
import { MAX_DAG_NODES_PER_RUN } from '@/lib/contracts/dag';
import { Prisma } from '@prisma/client';

export interface EdgeDef {
  pred: string;
  succ: string;
}

/**
 * Pure DFS cycle detection function over directed edges.
 * Checks for self-loops, simple cycles, and cycles formed across diamonds.
 */
export function detectCycle(
  existingEdges: EdgeDef[],
  newEdgeOrEdges: EdgeDef | EdgeDef[]
): boolean {
  const edgesToAdd = Array.isArray(newEdgeOrEdges) ? newEdgeOrEdges : [newEdgeOrEdges];
  const allEdges = [...existingEdges, ...edgesToAdd];

  const adj = new Map<string, string[]>();
  for (const e of allEdges) {
    if (e.pred === e.succ) {
      return true; // Self-loop cycle
    }
    if (!adj.has(e.pred)) adj.set(e.pred, []);
    adj.get(e.pred)!.push(e.succ);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string): boolean {
    visited.add(node);
    inStack.add(node);

    for (const neighbor of adj.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (inStack.has(neighbor)) {
        return true;
      }
    }

    inStack.delete(node);
    return false;
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      if (dfs(node)) return true;
    }
  }

  return false;
}

export interface DynamicNodeInput {
  id: string;
  claimId?: string;
  nodeType: string;
  state?: string;
  input?: Prisma.InputJsonValue;
}

export interface DynamicEdgeInput {
  predecessorId: string;
  successorId: string;
  condition?: string;
}

export interface ExpandDagParams {
  runId: string;
  newNodes: DynamicNodeInput[];
  newEdges: DynamicEdgeInput[];
}

/**
 * Protocol B: Atomic Dynamic DAG Expansion
 * Validates node ceiling (MAX_DAG_NODES_PER_RUN = 52), verifies acyclicity,
 * and atomically persists new nodes and edges to the database.
 */
export async function expandDag(params: ExpandDagParams, tx?: Prisma.TransactionClient) {
  const { runId, newNodes, newEdges } = params;

  const runner = async (client: Prisma.TransactionClient) => {
    // 1. Fetch current node count and existing edges
    const currentNodeCount = await client.dagNode.count({
      where: { runId },
    });

    if (currentNodeCount + newNodes.length > MAX_DAG_NODES_PER_RUN) {
      throw new Error(
        `Dynamic expansion exceeds ceiling of ${MAX_DAG_NODES_PER_RUN} nodes (current: ${currentNodeCount}, adding: ${newNodes.length})`
      );
    }

    const existingEdges = await client.dagEdge.findMany({
      where: { runId },
      select: { predecessorId: true, successorId: true },
    });

    const mappedExisting = existingEdges.map((e) => ({
      pred: e.predecessorId,
      succ: e.successorId,
    }));

    const mappedNew = newEdges.map((e) => ({
      pred: e.predecessorId,
      succ: e.successorId,
    }));

    // 2. Validate cycle check
    if (detectCycle(mappedExisting, mappedNew)) {
      throw new Error('Dynamic DAG expansion would create a cycle in graph topology');
    }

    // 3. Atomically insert new nodes
    for (const node of newNodes) {
      await client.dagNode.create({
        data: {
          id: node.id,
          runId,
          claimId: node.claimId,
          nodeType: node.nodeType,
          nodeKey: node.id,
          state: node.state ?? 'pending',
          status: (node.state ?? 'pending').toUpperCase(),
          input: node.input,
        },
      });
    }

    // 4. Atomically insert new edges
    for (const edge of newEdges) {
      const edgeId = `edge_${runId}_${edge.predecessorId}_${edge.successorId}`;
      await client.dagEdge.create({
        data: {
          id: edgeId,
          runId,
          predecessorId: edge.predecessorId,
          successorId: edge.successorId,
          condition: edge.condition ?? 'on_success',
        },
      });
    }

    return {
      expandedNodeCount: newNodes.length,
      expandedEdgeCount: newEdges.length,
    };
  };

  if (tx) {
    return await runner(tx);
  } else {
    return await db.$transaction(runner);
  }
}
