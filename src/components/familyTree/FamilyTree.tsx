import { nanoid } from 'nanoid';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { FamilyTreeConfig, FamilyTreeState, SimEntry, TrackerConfig, UnionNode } from '../../types/tracker';
import SimNode from './SimNode';
import UnionNodeView from './UnionNode';
import TrunkEdge from './TrunkEdge';
import MarriageEdge from './MarriageEdge';
import FamilyEdge from './FamilyEdge';
import { buildFamilyTree } from './familyTreeBuild';
import { deriveUnionsFromSims } from './deriveUnions';
import { genealogyLayout } from './genealogyLayout';

const nodeTypes = {
  sim: SimNode,
  union: UnionNodeView,
};

const edgeTypes = {
  trunk: TrunkEdge,
  marriage: MarriageEdge,
  family: FamilyEdge,
};

interface Props {
  sims: SimEntry[];
  unions: UnionNode[];
  saved: FamilyTreeState;
  config: FamilyTreeConfig;
  trackerConfig: TrackerConfig;
  currentDay: number;
  onSavedChange: (next: FamilyTreeState) => void;
  onConfigChange: (next: FamilyTreeConfig) => void;
  onUnionsChange: (next: UnionNode[]) => void;
  onSimsChange: (next: SimEntry[]) => void;
}

export default function FamilyTree({ sims, unions, saved, config, trackerConfig, currentDay, onSavedChange, onConfigChange, onUnionsChange, onSimsChange }: Props) {
  // Capture saved positions only on mount — never re-read after that to avoid rebuild loops
  const savedOnMount = useRef(saved);

  // Build graph structure from sims/unions/config — NOT from saved positions
  // Positions are managed separately in ReactFlow state to avoid rebuild loops
  const built = useMemo(() => buildFamilyTree(sims, unions, savedOnMount.current, config, trackerConfig, currentDay), [sims, unions, config, trackerConfig, currentDay]); // eslint-disable-line react-hooks/exhaustive-deps

  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(built.edges);
  const [selectedSimId, setSelectedSimId] = useState<string | null>(null);

  // When underlying sims/unions change, rebuild the graph.
  useEffect(() => {
    setNodes(built.nodes);
    const mappedEdges = built.edges.map((e) => {
      const kind = (e.data as { kind?: string } | undefined)?.kind;
      if (kind === 'spouse') return { ...e, type: 'marriage', zIndex: 10 };
      if (kind === 'parent') return { ...e, type: 'family' };
      return { ...e, style: { strokeWidth: 2, stroke: 'rgba(0,0,0,0.35)' } };
    });
    // Inject midX into edges using saved node positions (don't re-layout, just enrich edges)
    const { edges: enrichedEdges } = genealogyLayout(built.nodes, mappedEdges);
    setEdges(enrichedEdges.map((e) => {
      const kind = (e.data as { kind?: string } | undefined)?.kind;
      if (kind === 'spouse') return { ...e, type: 'marriage', zIndex: 10 };
      if (kind === 'parent') return { ...e, type: 'family' };
      return e;
    }));
    // Try to bring something into view shortly after rebuild.
    setTimeout(() => {
      if (!rf) return;
      if (built.nodes.length === 0) return;
      rf.fitView({ padding: 0.2, duration: 250 });
    }, 60);
  }, [built.nodes, built.edges, rf, setEdges, setNodes]);

    // Positions are always managed by auto-arrange, not manual dragging
  const savedRef = useRef(saved);
  savedRef.current = saved;

  // Console diagnostics (disabled by default)
  // const lastDiagRef = useRef<string>('');
  // useEffect(() => {
  //   const simIds = new Set(sims.map((s) => s.id));
  //   const withParents = sims.filter((s) => s.fatherId || s.motherId).length;
  //   const missingParentRefs = sims.filter(
  //     (s) => (s.fatherId && !simIds.has(s.fatherId)) || (s.motherId && !simIds.has(s.motherId))
  //   ).length;
  //   const parentEdges = edges.filter((e) => (e.data as { kind?: string } | undefined)?.kind === 'parent').length;
  //   const partnerEdges = edges.filter((e) => (e.data as { kind?: string } | undefined)?.kind === 'partner').length;

  //   const diag = {
  //     sims: sims.length,
  //     unions: unions.length,
  //     nodes: nodes.length,
  //     edges: edges.length,
  //     withParents,
  //     missingParentRefs,
  //     parentEdges,
  //     partnerEdges,
  //   };
  //   const sig = JSON.stringify(diag);
  //   if (sig !== lastDiagRef.current) {
  //     lastDiagRef.current = sig;
  //     // eslint-disable-next-line no-console
  //     console.log('[FamilyTree]', diag);
  //   }
  // }, [sims, unions, nodes.length, edges.length, edges]);

  const simOptions = useMemo(
    () => sims.map((s) => ({ id: s.id, label: (s.firstName || s.name || s.id) + (s.lastName ? ` ${s.lastName}` : '') })),
    [sims]
  );

  // Children with parents where multiple unions exist and we can't auto-pick
  const needsAssignment = useMemo(() => {
    const unionsByParents = new Map<string, UnionNode[]>();
    for (const u of unions) {
      if (!u.partnerAId || !u.partnerBId) continue;
      const key = [u.partnerAId, u.partnerBId].sort().join('|');
      unionsByParents.set(key, [...(unionsByParents.get(key) ?? []), u]);
    }

    const res: { child: SimEntry; unions: UnionNode[] }[] = [];
    for (const child of sims) {
      if (child.birthUnionId) continue;
      if (!child.fatherId || !child.motherId) continue;
      const key = [child.fatherId, child.motherId].sort().join('|');
      const candidates = unionsByParents.get(key) ?? [];
      if (candidates.length > 1) res.push({ child, unions: candidates });
    }
    return res;
  }, [sims, unions]);

  const centerView = useCallback(() => {
    rf?.fitView({ padding: 0.2, duration: 300 });
  }, [rf]);

  return (
    <div className="family-tree">
      <div className="sheet-header">
        <h2>Family Tree</h2>
        <span className="field-hint">Drag nodes to arrange. Tree auto-populates from Sims Info.</span>
        <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="btn-secondary btn-sm"
            onClick={() => {
              // 1) derive unions automatically from sims
              const derived = deriveUnionsFromSims(sims, unions);
              onUnionsChange(derived.unions);
              onSimsChange(derived.sims);
            }}
            title="Auto-create unions from Sims info"
          >
            Auto-link
          </button>
          <button
            className="btn-secondary btn-sm"
            onClick={() => {
              // Run generational layout on sims + edges
              const { nodes: laidOut, edges: laidEdges } = genealogyLayout(nodes, edges);
              // Update BOTH nodes and edges
              setNodes(laidOut);
              setEdges(laidEdges.map((e) => {
                const kind = (e.data as { kind?: string } | undefined)?.kind;
                if (kind === 'spouse') return { ...e, type: 'marriage', zIndex: 10 };
                if (kind === 'parent') return { ...e, type: 'family' };
                return e;
              }));
              const next = {
                ...savedRef.current,
                nodes: laidOut
                  .filter((n) => !String(n.id).startsWith('union:'))
                  .map((n) => ({ id: n.id, type: 'sim' as const, position: n.position })),
                edges: savedRef.current.edges ?? [],
              };
              onSavedChange(next);
              setTimeout(() => rf?.fitView({ padding: 0.2, duration: 300 }), 50);
            }}
            title="Auto-arrange nodes"
          >
            Auto-arrange
          </button>
          <button className="btn-secondary btn-sm" onClick={centerView}>
            Center View
          </button>
        </div>
      </div>

      <div className="family-tree-layout">
        <div className="family-tree-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            onEdgesChange={onEdgesChange}
            onInit={setRf}
            onNodeClick={(_, n) => {
              if (String(n.id).startsWith('sim:')) {
                setSelectedSimId(String(n.id).replace(/^sim:/, ''));
              }
            }}
            defaultEdgeOptions={{
              type: 'smoothstep',
              style: { stroke: 'rgba(0,0,0,0.35)', strokeWidth: 2 },
            }}
            minZoom={0.1}
            maxZoom={2}
            fitView
            fitViewOptions={{ padding: 0.2 }}
          >
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        <aside className="family-tree-sidebar">
          <h3>Display</h3>
          <div className="sidebar-card">
            <div className="field-group">
              <label>Avatar shape</label>
              <select
                value={config.avatarShape}
                onChange={(e) => onConfigChange({ ...config, avatarShape: e.target.value as 'circle' | 'rounded' | 'square' })}
              >
                <option value="circle">Circle</option>
                <option value="rounded">Rounded</option>
                <option value="square">Square</option>
              </select>
            </div>

            <div className="field-group">
              <label>Ring color by</label>
              <select
                value={config.display.ringColorMode ?? 'generation'}
                onChange={(e) => onConfigChange({ ...config, display: { ...config.display, ringColorMode: e.target.value as 'generation' | 'gender' | 'lastName' } })}
              >
                <option value="generation">Generation</option>
                <option value="gender">Gender</option>
                <option value="lastName">Last name</option>
              </select>
            </div>

            <label className="checkbox-center" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={!!config.display.compactNodes}
                onChange={(e) => onConfigChange({ ...config, display: { ...config.display, compactNodes: e.target.checked } })}
              />
              Compact nodes (avatar + name only)
            </label>

            <label className="checkbox-center" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={config.display.showLifeStage}
                onChange={(e) => onConfigChange({ ...config, display: { ...config.display, showLifeStage: e.target.checked } })}
                disabled={!!config.display.compactNodes}
              />
              Show life stage
            </label>
            <label className="checkbox-center" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={config.display.showAge}
                onChange={(e) => onConfigChange({ ...config, display: { ...config.display, showAge: e.target.checked } })}
                disabled={!!config.display.compactNodes}
              />
              Show age
            </label>
            <label className="checkbox-center" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={config.display.showBirthYear}
                onChange={(e) => onConfigChange({ ...config, display: { ...config.display, showBirthYear: e.target.checked } })}
                disabled={!!config.display.compactNodes}
              />
              Show birth year
            </label>
            <label className="checkbox-center" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={config.display.showDeathYear}
                onChange={(e) => onConfigChange({ ...config, display: { ...config.display, showDeathYear: e.target.checked } })}
                disabled={!!config.display.compactNodes}
              />
              Show death year
            </label>
            <label className="checkbox-center" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={config.display.showGeneration}
                onChange={(e) => onConfigChange({ ...config, display: { ...config.display, showGeneration: e.target.checked } })}
                disabled={!!config.display.compactNodes}
              />
              Show generation
            </label>
          </div>

          <h3>Filters</h3>
          <div className="sidebar-card">
            <label className="checkbox-center" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={config.filters.hideDeadSims}
                onChange={(e) => onConfigChange({ ...config, filters: { ...config.filters, hideDeadSims: e.target.checked } })}
              />
              Hide dead sims
            </label>
            <label className="checkbox-center" style={{ justifyContent: 'flex-start', gap: '0.5rem', marginTop: '0.35rem' }}>
              <input
                type="checkbox"
                checked={config.filters.hideDeadBranches}
                onChange={(e) => onConfigChange({ ...config, filters: { ...config.filters, hideDeadBranches: e.target.checked } })}
              />
              Hide dead branches (no living descendants)
            </label>
            <div className="field-group" style={{ marginTop: '0.75rem' }}>
              <label>Hide life stages</label>
              <div className="stage-filter">
                {(trackerConfig.humanAging.lifeStages ?? []).map((ls) => {
                  const checked = (config.filters.hiddenLifeStages ?? []).includes(ls.name);
                  return (
                    <label key={ls.id} className="checkbox-center" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const cur = new Set(config.filters.hiddenLifeStages ?? []);
                          if (e.target.checked) cur.add(ls.name);
                          else cur.delete(ls.name);
                          onConfigChange({ ...config, filters: { ...config.filters, hiddenLifeStages: Array.from(cur) } });
                        }}
                      />
                      {ls.name}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <h3>Unions</h3>
          <button
            className="btn-secondary btn-sm"
            onClick={() => {
              onUnionsChange([
                ...unions,
                { id: nanoid(), partnerAId: undefined, partnerBId: undefined, startYear: undefined, endYear: undefined },
              ]);
            }}
          >
            + Add Union
          </button>

          <div className="sidebar-list">
            {unions.map((u) => (
              <div key={u.id} className="sidebar-card">
                <div className="field-group">
                  <label>Partner A</label>
                  <select
                    value={u.partnerAId ?? ''}
                    onChange={(e) => onUnionsChange(unions.map((x) => (x.id === u.id ? { ...x, partnerAId: e.target.value || undefined } : x)))}
                  >
                    <option value="">—</option>
                    {simOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label>Partner B</label>
                  <select
                    value={u.partnerBId ?? ''}
                    onChange={(e) => onUnionsChange(unions.map((x) => (x.id === u.id ? { ...x, partnerBId: e.target.value || undefined } : x)))}
                  >
                    <option value="">—</option>
                    {simOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label>Start Year</label>
                  <input
                    type="number"
                    value={u.startYear ?? ''}
                    onChange={(e) => onUnionsChange(unions.map((x) => (x.id === u.id ? { ...x, startYear: e.target.value ? Number(e.target.value) : undefined } : x)))}
                  />
                </div>
                <div className="field-group">
                  <label>End Year</label>
                  <input
                    type="number"
                    value={u.endYear ?? ''}
                    onChange={(e) => onUnionsChange(unions.map((x) => (x.id === u.id ? { ...x, endYear: e.target.value ? Number(e.target.value) : undefined } : x)))}
                  />
                </div>
                <button className="btn-ghost btn-sm btn-danger" onClick={() => onUnionsChange(unions.filter((x) => x.id !== u.id))}>Remove</button>
              </div>
            ))}
            {unions.length === 0 && <p className="empty-state">No unions yet.</p>}
          </div>

          {needsAssignment.length > 0 && (
            <>
              <h3 style={{ marginTop: '1.5rem' }}>Needs Assignment</h3>
              <p className="field-hint">Child has multiple possible unions. Pick which union they belong to.</p>
              <div className="sidebar-list">
                {needsAssignment.map(({ child, unions: cand }) => (
                  <div key={child.id} className="sidebar-card">
                    <strong>{child.firstName} {child.lastName}</strong>
                    <select
                      value={child.birthUnionId ?? ''}
                      onChange={(e) => {
                        const unionId = e.target.value || undefined;
                        onSimsChange(sims.map((s) => (s.id === child.id ? { ...s, birthUnionId: unionId } : s)));
                      }}
                    >
                      <option value="">— select union —</option>
                      {cand.map((u) => {
                        const a = simOptions.find((s) => s.id === u.partnerAId)?.label ?? '—';
                        const b = simOptions.find((s) => s.id === u.partnerBId)?.label ?? '—';
                        const range = `${u.startYear ?? '?'}–${u.endYear ?? 'present'}`;
                        const label = `${a} + ${b} (${range})`;
                        return (
                          <option key={u.id} value={u.id}>{label}</option>
                        );
                      })}
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>

      {selectedSimId && (
        <div className="modal-overlay" onClick={() => setSelectedSimId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const sim = sims.find((s) => s.id === selectedSimId);
              if (!sim) return <p>Sim not found.</p>;

              return (
                <>
                  <h3>Edit Sim</h3>

                  <div className="field-group">
                    <label>First Name</label>
                    <input
                      value={sim.firstName}
                      onChange={(e) => onSimsChange(sims.map((x) => (x.id === sim.id ? { ...x, firstName: e.target.value } : x)))}
                    />
                  </div>
                  <div className="field-group">
                    <label>Last Name</label>
                    <input
                      value={sim.lastName}
                      onChange={(e) => onSimsChange(sims.map((x) => (x.id === sim.id ? { ...x, lastName: e.target.value } : x)))}
                    />
                  </div>
                  <div className="field-group">
                    <label>Birth Year</label>
                    <input
                      type="number"
                      value={sim.birthYear ?? ''}
                      onChange={(e) => onSimsChange(sims.map((x) => (x.id === sim.id ? { ...x, birthYear: e.target.value ? Number(e.target.value) : undefined } : x)))}
                    />
                  </div>
                  <div className="field-group">
                    <label>Death Year</label>
                    <input
                      type="number"
                      value={sim.deathYear ?? ''}
                      onChange={(e) => onSimsChange(sims.map((x) => (x.id === sim.id ? { ...x, deathYear: e.target.value ? Number(e.target.value) : undefined } : x)))}
                    />
                  </div>

                  <div className="modal-actions">
                    <button className="btn-primary" onClick={() => setSelectedSimId(null)}>Done</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
