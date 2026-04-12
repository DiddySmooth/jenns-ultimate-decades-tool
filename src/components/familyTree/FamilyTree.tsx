import { nanoid } from 'nanoid';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { FamilyTreeState, SimEntry, UnionNode } from '../../types/tracker';
import SimNode from './SimNode';
import UnionNodeView from './UnionNode';
import { buildFamilyTree } from './familyTreeBuild';

const nodeTypes = {
  sim: SimNode,
  union: UnionNodeView,
};

interface Props {
  sims: SimEntry[];
  unions: UnionNode[];
  saved: FamilyTreeState;
  onSavedChange: (next: FamilyTreeState) => void;
  onUnionsChange: (next: UnionNode[]) => void;
  onSimsChange: (next: SimEntry[]) => void;
}

export default function FamilyTree({ sims, unions, saved, onSavedChange, onUnionsChange, onSimsChange }: Props) {
  const built = useMemo(() => buildFamilyTree(sims, unions, saved), [sims, unions, saved]);

  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(built.edges);

  // When underlying sims/unions change, rebuild the graph.
  useEffect(() => {
    setNodes(built.nodes);
    setEdges(built.edges);
    // Try to bring something into view shortly after rebuild.
    setTimeout(() => {
      if (!rf) return;
      if (built.nodes.length === 0) return;
      rf.fitView({ padding: 0.2, duration: 250 });
    }, 60);
  }, [built.nodes, built.edges]);

  // Persist node positions (only) back into save
  const lastPosSig = useRef<string>('');
  useEffect(() => {
    const pos = nodes.map((n) => ({ id: n.id, type: (n.type as any) ?? 'sim', position: n.position }));
    const sig = JSON.stringify(pos);
    if (sig === lastPosSig.current) return;
    lastPosSig.current = sig;
    onSavedChange({ ...saved, nodes: pos, edges: saved.edges ?? [] });
  }, [nodes]);

  // Console diagnostics (enabled in prod temporarily)
  const lastDiagRef = useRef<string>('');
  useEffect(() => {
    const simIds = new Set(sims.map((s) => s.id));
    const withParents = sims.filter((s) => s.fatherId || s.motherId).length;
    const missingParentRefs = sims.filter(
      (s) => (s.fatherId && !simIds.has(s.fatherId)) || (s.motherId && !simIds.has(s.motherId))
    ).length;
    const parentEdges = edges.filter((e) => (e as any).type === 'parent').length;
    const partnerEdges = edges.filter((e) => (e as any).type === 'partner').length;

    const diag = {
      sims: sims.length,
      unions: unions.length,
      nodes: nodes.length,
      edges: edges.length,
      withParents,
      missingParentRefs,
      parentEdges,
      partnerEdges,
    };
    const sig = JSON.stringify(diag);
    if (sig !== lastDiagRef.current) {
      lastDiagRef.current = sig;
      // eslint-disable-next-line no-console
      console.log('[FamilyTree]', diag);
    }
  }, [sims, unions, nodes.length, edges.length]);

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
        <button className="btn-secondary btn-sm" onClick={centerView}>
          Center View
        </button>
      </div>

      <div className="family-tree-layout">
        <div className="family-tree-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onInit={setRf}
            minZoom={0.1}
            maxZoom={2}
            fitView
            fitViewOptions={{ padding: 0.2 }}
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        <aside className="family-tree-sidebar">
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
    </div>
  );
}
