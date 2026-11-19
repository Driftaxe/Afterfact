'use client';

import React, { useState, useMemo } from 'react';
import type { DagStage, DagNodeState } from '@/lib/contracts/dag';

export interface SanitizedDagNode {
  id: string;
  nodeKey?: string | null;
  nodeType?: string;
  stage?: DagStage | string;
  claimId?: string | null;
  state?: DagNodeState | string;
  status?: string | null;
  attempt?: number;
  errorMessage?: string | null;
  error?: string | null;
  startedAt?: string | Date | null;
  finishedAt?: string | Date | null;
  query?: string | null;
  queries?: string[] | null;
  normalizedProposition?: string | null;
}

export interface DagInspectorProps {
  /** Array of sanitized DAG execution nodes from report or snapshot */
  nodes?: SanitizedDagNode[];
  /** Total node count in run */
  totalNodes?: number;
  /** Number of completed nodes */
  completedNodes?: number;
  /** Active stage description */
  activeStage?: string;
  /** Optional title override */
  title?: string;
  /** Whether the inspector starts expanded. Defaults to false (collapsed) */
  defaultExpanded?: boolean;
  className?: string;
}

// 4 Canonical High-Level Verification Steps
export type ExecutionStepCategory = 'retrieval' | 'extraction' | 'verification' | 'scoring';

interface CategoryConfig {
  id: ExecutionStepCategory;
  label: string;
  description: string;
  stages: string[];
}

const EXECUTION_STEPS: CategoryConfig[] = [
  {
    id: 'retrieval',
    label: '1. Retrieval',
    description: 'Tavily web search & authoritative source queries',
    stages: ['plan_research', 'search_evidence'],
  },
  {
    id: 'extraction',
    label: '2. Extraction',
    description: 'Grounding candidate passages & quote extraction',
    stages: ['root_extract_prep', 'extract_evidence', 'rank_evidence'],
  },
  {
    id: 'verification',
    label: '3. Verification',
    description: 'Temporal consistency & semantic relation checks',
    stages: ['assess_evidence', 'clarification_wait', 'reassess_evidence'],
  },
  {
    id: 'scoring',
    label: '4. Scoring',
    description: 'Rubric scoring, decision records & finalization',
    stages: ['decide_claim', 'finalize_run'],
  },
];

function getNodeStage(node: SanitizedDagNode): string {
  if (node.stage) return node.stage;
  if (node.nodeType && node.nodeType !== 'dag_node') return node.nodeType;
  if (node.nodeKey) {
    const parts = node.nodeKey.split(':');
    return parts[parts.length - 1] || 'node';
  }
  return 'dag_node';
}

function getNodeState(node: SanitizedDagNode): DagNodeState {
  const raw = (node.state || node.status || 'pending').toLowerCase();
  if (raw === 'completed' || raw === 'success') return 'completed';
  if (raw === 'running' || raw === 'leased' || raw === 'in_progress') return 'leased';
  if (raw === 'waiting_for_input' || raw === 'paused') return 'waiting_for_input';
  if (raw === 'failed' || raw === 'error') return 'failed';
  if (raw === 'skipped') return 'skipped';
  return 'pending';
}

function getStateBadge(state: DagNodeState) {
  switch (state) {
    case 'completed':
      return {
        label: 'Completed',
        className: 'bg-status-supported-bg text-status-supported-text border-status-supported-border',
      };
    case 'leased':
      return {
        label: 'In Flight',
        className: 'bg-accent/15 text-accent border-accent/40 animate-pulse',
      };
    case 'waiting_for_input':
      return {
        label: 'Awaiting Input',
        className: 'bg-status-outdated-bg text-status-outdated-text border-status-outdated-border',
      };
    case 'failed':
      return {
        label: 'Failed',
        className: 'bg-status-contradicted-bg text-status-contradicted-text border-status-contradicted-border',
      };
    case 'skipped':
      return {
        label: 'Skipped',
        className: 'bg-surface-raised text-text-muted border-border-subtle',
      };
    case 'pending':
    default:
      return {
        label: 'Queued',
        className: 'bg-surface-raised text-text-secondary border-border-subtle',
      };
  }
}

/**
 * DagInspector
 * Visualizes the 4 verification execution graph steps:
 * [Retrieval] -> [Extraction] -> [Verification] -> [Scoring]
 * Provides an expandable inspection drawer detailing node status, queries, and timing without exposing leases.
 */
export function DagInspector({
  nodes = [],
  totalNodes,
  completedNodes,
  activeStage,
  title = 'Verification Graph (DAG)',
  defaultExpanded = false,
  className = '',
}: DagInspectorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [selectedCategory, setSelectedCategory] = useState<ExecutionStepCategory | 'all'>('all');
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);

  const total = totalNodes ?? nodes.length;
  const completed =
    completedNodes ?? nodes.filter((n) => getNodeState(n) === 'completed').length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Group nodes into the 4 canonical pipeline steps
  const categorizedNodes = useMemo(() => {
    const map: Record<ExecutionStepCategory, SanitizedDagNode[]> = {
      retrieval: [],
      extraction: [],
      verification: [],
      scoring: [],
    };

    for (const node of nodes) {
      const stage = getNodeStage(node);
      const step = EXECUTION_STEPS.find((s) => s.stages.includes(stage));
      if (step) {
        map[step.id].push(node);
      } else {
        // Fallback categorization based on name keywords
        if (stage.includes('search') || stage.includes('research') || stage.includes('tavily')) {
          map.retrieval.push(node);
        } else if (stage.includes('extract') || stage.includes('rank') || stage.includes('prep')) {
          map.extraction.push(node);
        } else if (stage.includes('assess') || stage.includes('clarif')) {
          map.verification.push(node);
        } else {
          map.scoring.push(node);
        }
      }
    }

    return map;
  }, [nodes]);

  // Compute status summary for each of the 4 steps
  const stepSummaries = useMemo(() => {
    return EXECUTION_STEPS.map((step) => {
      const stepNodes = categorizedNodes[step.id];
      const count = stepNodes.length;
      const completedCount = stepNodes.filter((n) => getNodeState(n) === 'completed').length;
      const failedCount = stepNodes.filter((n) => getNodeState(n) === 'failed').length;
      const inFlightCount = stepNodes.filter(
        (n) => getNodeState(n) === 'leased' || getNodeState(n) === 'waiting_for_input'
      ).length;

      let status: 'completed' | 'in_progress' | 'failed' | 'pending' = 'pending';
      if (failedCount > 0) status = 'failed';
      else if (inFlightCount > 0) status = 'in_progress';
      else if (count > 0 && completedCount === count) status = 'completed';

      return {
        ...step,
        count,
        completedCount,
        status,
      };
    });
  }, [categorizedNodes]);

  const displayedNodes = useMemo(() => {
    if (selectedCategory === 'all') return nodes;
    return categorizedNodes[selectedCategory];
  }, [nodes, categorizedNodes, selectedCategory]);

  return (
    <div
      className={`rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 space-y-4 ${className}`}
      role="region"
      aria-label="Execution graph inspector"
    >
      {/* Collapsible Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold uppercase tracking-wider font-mono text-text-primary">
              {title}
            </h3>
            <span className="rounded bg-surface-raised border border-border-subtle px-2 py-0.5 text-[10px] font-mono text-text-muted">
              {completed}/{total} Nodes ({progressPercent}%)
            </span>
            {activeStage && (
              <span className="rounded bg-accent/15 border border-accent/30 px-2 py-0.5 text-[10px] font-mono text-accent">
                {activeStage}
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary">
            Dynamic Directed Acyclic Graph tracking evidence retrieval, passage extraction, and scoring.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-raised text-xs font-mono text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors"
        >
          <span>{isExpanded ? 'Collapse Graph' : 'Inspect Graph Nodes'}</span>
          <svg
            className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* High-Level Pipeline Step Progress Bar (always visible) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
        {stepSummaries.map((step) => {
          let stepBadgeClass = 'border-border-subtle bg-surface-raised/40 text-text-muted';
          let indicatorColor = 'bg-border-subtle';

          if (step.status === 'completed') {
            stepBadgeClass = 'border-status-supported-border/60 bg-status-supported-bg/20 text-status-supported-text';
            indicatorColor = 'bg-status-supported-text';
          } else if (step.status === 'in_progress') {
            stepBadgeClass = 'border-accent/40 bg-accent/10 text-accent';
            indicatorColor = 'bg-accent animate-pulse';
          } else if (step.status === 'failed') {
            stepBadgeClass = 'border-status-contradicted-border/60 bg-status-contradicted-bg/20 text-status-contradicted-text';
            indicatorColor = 'bg-status-contradicted-text';
          }

          const isSelected = selectedCategory === step.id;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                setSelectedCategory(isSelected ? 'all' : step.id);
                if (!isExpanded) setIsExpanded(true);
              }}
              className={`rounded-xl border p-3 text-left transition-all ${stepBadgeClass} ${
                isSelected ? 'ring-2 ring-accent' : 'hover:border-border-strong'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono font-medium mb-1">
                <span className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${indicatorColor}`} />
                  {step.label}
                </span>
                <span className="text-[10px] opacity-80">
                  {step.completedCount}/{step.count}
                </span>
              </div>
              <p className="text-[11px] opacity-75 line-clamp-1">{step.description}</p>
            </button>
          );
        })}
      </div>

      {/* Expanded Graph Detail Panel */}
      {isExpanded && (
        <div className="pt-3 border-t border-border-subtle space-y-4">
          {/* Sub-filter tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-text-muted text-[11px] mr-1">Filter Step:</span>
              {(['all', 'retrieval', 'extraction', 'verification', 'scoring'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                    selectedCategory === cat
                      ? 'bg-accent text-white font-medium shadow-sm'
                      : 'bg-surface-raised border border-border-subtle text-text-muted hover:text-text-primary'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <span className="text-xs font-mono text-text-muted">
              Showing {displayedNodes.length} of {nodes.length} nodes
            </span>
          </div>

          {/* Node List Grid */}
          {displayedNodes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-subtle p-6 text-center text-xs text-text-muted">
              No DAG nodes recorded in this pipeline step yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
              {displayedNodes.map((node) => {
                const stage = getNodeStage(node);
                const state = getNodeState(node);
                const badge = getStateBadge(state);
                const isInspected = inspectedNodeId === node.id;

                return (
                  <div
                    key={node.id}
                    onClick={() => setInspectedNodeId(isInspected ? null : node.id)}
                    className={`rounded-xl border p-3 cursor-pointer transition-all ${
                      isInspected
                        ? 'border-accent bg-surface-raised/70'
                        : 'border-border-subtle bg-surface-raised/30 hover:bg-surface-raised/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span className="text-text-primary font-medium">{stage}</span>
                        {node.claimId && (
                          <span className="text-[10px] text-text-muted">({node.claimId})</span>
                        )}
                      </div>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-mono border ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px] font-mono text-text-muted">
                      <span>ID: {node.id.slice(0, 16)}</span>
                      {typeof node.attempt === 'number' && node.attempt > 0 && (
                        <span>Attempt {node.attempt}</span>
                      )}
                    </div>

                    {node.normalizedProposition && (
                      <p className="mt-1.5 text-[11px] text-text-secondary font-sans italic bg-surface/80 p-2 rounded border border-border-subtle truncate">
                        <span className="font-mono text-accent not-italic">Proposition: </span>
                        “{node.normalizedProposition}”
                      </p>
                    )}

                    {node.queries && node.queries.length > 1 ? (
                      <div className="mt-1.5 space-y-1 bg-surface p-2 rounded border border-border-subtle">
                        <span className="text-[10px] font-mono text-text-muted uppercase">Tavily Subqueries ({node.queries.length}):</span>
                        {node.queries.map((q, qIdx) => (
                          <div key={qIdx} className="text-xs text-text-secondary font-mono truncate">
                            • “{q}”
                          </div>
                        ))}
                      </div>
                    ) : node.query ? (
                      <p className="mt-1.5 text-xs text-text-secondary font-mono bg-surface p-2 rounded border border-border-subtle truncate">
                        Query: “{node.query}”
                      </p>
                    ) : null}

                    {node.errorMessage && (
                      <p className="mt-1.5 text-xs text-status-contradicted-text font-mono bg-status-contradicted-bg/20 p-2 rounded border border-status-contradicted-border">
                        {node.errorMessage}
                      </p>
                    )}

                    {/* Expandable Technical Attributes */}
                    {isInspected && (
                      <div className="mt-2.5 pt-2 border-t border-border-subtle text-[11px] font-mono space-y-1.5 text-text-muted">
                        <div>Stage: {stage}</div>
                        <div>State: {state}</div>
                        {node.claimId && <div>Claim ID: {node.claimId}</div>}
                        {node.normalizedProposition && (
                          <div className="text-text-primary">
                            <span className="text-text-muted">Evaluated Proposition: </span>
                            {node.normalizedProposition}
                          </div>
                        )}
                        {node.queries && node.queries.length > 0 && (
                          <div className="space-y-1 text-text-primary">
                            <div className="text-text-muted">All Generated Queries:</div>
                            {node.queries.map((q, idx) => (
                              <div key={idx} className="pl-2 border-l border-accent/40 font-mono text-[11px]">
                                {q}
                              </div>
                            ))}
                          </div>
                        )}
                        {node.startedAt && <div>Started: {String(node.startedAt)}</div>}
                        {node.finishedAt && <div>Finished: {String(node.finishedAt)}</div>}
                        <div className="text-[10px] text-text-muted italic pt-0.5">
                          * Internal worker lease tokens & secrets strictly scrubbed for zero leakage.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
