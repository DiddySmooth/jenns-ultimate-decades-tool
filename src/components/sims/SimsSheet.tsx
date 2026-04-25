import type { SimEntry, TrackerConfig, SimsSheetConfig, UnionNode } from '../../types/tracker';
import { nanoid } from 'nanoid';
import { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import SortableSimRow from './SortableSimRow';
import { getFullName } from '../../utils/lifeStage';
import { migrateSimEntry } from '../../utils/migrateSim';
import SimEditPanel from './SimEditPanel';

interface Props {
  sims: SimEntry[];
  unions: UnionNode[];
  config: TrackerConfig;
  currentDay: number;
  userId: string;
  saveId: string;
  isPremium: boolean;
  sheetConfig: SimsSheetConfig;
  onSheetConfigChange: (next: SimsSheetConfig) => void;
  onAdd: (sim: SimEntry) => void;
  onUpdate: (sim: SimEntry) => void;
  onDelete: (id: string) => void;
  onUnionsChange: (next: UnionNode[]) => void;
  onReorder: (next: SimEntry[]) => void;
}

const blankSim = (): SimEntry => ({
  id: nanoid(),
  firstName: '',
  lastName: '',
  sex: 'Unknown',
  generation: 1,
});

export default function SimsSheet({ sims, unions, config, currentDay, userId, saveId, isPremium, sheetConfig, onSheetConfigChange, onAdd, onUpdate, onDelete, onUnionsChange, onReorder }: Props) {
  const [editing, setEditing] = useState<SimEntry | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);


  const simsNormalized = useMemo(() => sims.map(migrateSimEntry), [sims]);

  const sortUnions = (list: UnionNode[]) => [...list].sort((a, b) => {
    const aActive = a.endYear == null ? 1 : 0;
    const bActive = b.endYear == null ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    const aStart = a.startYear ?? -Infinity;
    const bStart = b.startYear ?? -Infinity;
    if (aStart !== bStart) return bStart - aStart;
    const aStartDay = a.startDayOfYear ?? -Infinity;
    const bStartDay = b.startDayOfYear ?? -Infinity;
    if (aStartDay !== bStartDay) return bStartDay - aStartDay;
    return String(a.id).localeCompare(String(b.id));
  });

  const unionsForSim = (simId?: string) => sortUnions((unions ?? []).filter((u) => u.partnerAId === simId || u.partnerBId === simId));

  const syncLegacyPartnerFields = (sim: SimEntry, nextUnions: UnionNode[]): SimEntry => {
    const related = nextUnions
      .filter((u) => u.partnerAId === sim.id || u.partnerBId === sim.id)
      .sort((a, b) => {
        const aActive = a.endYear == null ? 1 : 0;
        const bActive = b.endYear == null ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return (b.startYear ?? -Infinity) - (a.startYear ?? -Infinity);
      });
    const primary = related[0];
    if (!primary) return { ...sim, spouseId: undefined, marriageYear: undefined };
    const partnerId = primary.partnerAId === sim.id ? primary.partnerBId : primary.partnerAId;
    return { ...sim, spouseId: partnerId, marriageYear: primary.startYear };
  };

  const startNew = () => { setEditing(blankSim()); setIsNew(true); };

  const byId = useMemo(() => new Map(simsNormalized.map((s) => [s.id, s])), [simsNormalized]);

  const resolveName = (id?: string) => {
    if (!id) return '—';
    const sim = byId.get(id);
    return sim ? getFullName(sim) : '—';
  };

  const formatUnionLabel = (u: UnionNode, simId?: string) => {
    const partnerId = u.partnerAId === simId ? u.partnerBId : u.partnerAId;
    const partnerName = resolveName(partnerId);
    const start = u.startYear != null ? `Year ${u.startYear}${u.startDayOfYear ? ` Day ${u.startDayOfYear}` : ''}` : 'Unknown start';
    const end = u.endYear != null ? `Year ${u.endYear}${u.endDayOfYear ? ` Day ${u.endDayOfYear}` : ''}` : 'Present';
    const state = u.endYear == null ? 'Active' : (u.endReason === 'death' ? 'Ended by death' : u.endReason === 'divorce' ? 'Ended by divorce' : 'Ended');
    return `${partnerName} · ${start} → ${end} · ${state}`;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (String(active.id) === String(over.id)) return;

    const oldIndex = simsNormalized.findIndex((s) => String(s.id) === String(active.id));
    const newIndex = simsNormalized.findIndex((s) => String(s.id) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    onReorder(arrayMove(simsNormalized, oldIndex, newIndex));
  };

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const toggleExpanded = (id: string) => setExpandedIds((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div className="sims-sheet">
      <div className="sheet-header">
        <h2>Sims Info Sheet</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn-secondary btn-sm" onClick={() => setShowDisplaySettings(true)} title="Display settings">
            ⚙️ Display
          </button>
          <button className="btn-primary btn-sm" onClick={startNew}>+ Add Sim</button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
      <div className="sim-table-header">
        <span style={{ textAlign: 'center', letterSpacing: '0.04em' }}>Actions</span>
        <span>Name</span>
        <span>Stage</span>
        {sheetConfig.showAge && <span>Age</span>}
        {sheetConfig.showSex && <span>Sex</span>}
        {sheetConfig.showGeneration && <span>Gen</span>}
        <span>Born</span>
        {sheetConfig.showBirthplace && <span>Birthplace</span>}
        {sheetConfig.showParents && <span>Father</span>}
        {sheetConfig.showParents && <span>Mother</span>}
        {sheetConfig.showPartners && <span>Spouse</span>}
        {sheetConfig.showPartners && <span>Married</span>}
        <span>Died</span>
        {sheetConfig.showCauseOfDeath && <span>COD</span>}
        {sheetConfig.showTraits && <span>Traits</span>}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={simsNormalized.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="sims-list rows">
            {simsNormalized.map((sim) => {
              const hydratedSim = syncLegacyPartnerFields(sim, unions);
              return (
              <SortableSimRow
                key={sim.id}
                sim={hydratedSim}
                config={config}
                sheetConfig={sheetConfig}
                currentDay={currentDay}
                resolveName={resolveName}
                relationshipLabels={unionsForSim(sim.id).map((u) => formatUnionLabel(u, sim.id))}
                expanded={!!expandedIds[sim.id]}
                onToggleExpanded={() => toggleExpanded(sim.id)}
                onEdit={() => { setEditing({ ...sim }); setIsNew(false); }}
                onDelete={() => onDelete(sim.id)}
              />
            );})}
          </div>
        </SortableContext>
      </DndContext>
      </div>

      {sims.length === 0 && (
        <p className="empty-state">No sims yet. Add your founder to get started.</p>
      )}

      {showDisplaySettings && (
        <div className="modal-overlay" onClick={() => setShowDisplaySettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Sims Info Sheet Display</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.45rem 1rem' }}>
              <label><input type="checkbox" checked={sheetConfig.showAge} onChange={(e) => onSheetConfigChange({ ...sheetConfig, showAge: e.target.checked })} /> Age</label>
              <label><input type="checkbox" checked={sheetConfig.showSex} onChange={(e) => onSheetConfigChange({ ...sheetConfig, showSex: e.target.checked })} /> Sex</label>
              <label><input type="checkbox" checked={sheetConfig.showGeneration} onChange={(e) => onSheetConfigChange({ ...sheetConfig, showGeneration: e.target.checked })} /> Generation</label>
              <label><input type="checkbox" checked={sheetConfig.showBirthplace} onChange={(e) => onSheetConfigChange({ ...sheetConfig, showBirthplace: e.target.checked })} /> Birthplace</label>
              <label><input type="checkbox" checked={sheetConfig.showParents} onChange={(e) => onSheetConfigChange({ ...sheetConfig, showParents: e.target.checked })} /> Parents</label>
              <label><input type="checkbox" checked={sheetConfig.showPartners} onChange={(e) => onSheetConfigChange({ ...sheetConfig, showPartners: e.target.checked })} /> Partners</label>
              <label><input type="checkbox" checked={sheetConfig.showCauseOfDeath} onChange={(e) => onSheetConfigChange({ ...sheetConfig, showCauseOfDeath: e.target.checked })} /> Cause of death</label>
              <label><input type="checkbox" checked={sheetConfig.showNotes} onChange={(e) => onSheetConfigChange({ ...sheetConfig, showNotes: e.target.checked })} /> Notes</label>
              <label><input type="checkbox" checked={sheetConfig.showTraits} onChange={(e) => onSheetConfigChange({ ...sheetConfig, showTraits: e.target.checked })} /> Traits</label>
            </div>
            <div className="field-hint" style={{ marginTop: '0.75rem' }}>Always shown: Name, Date of birth, Date of death, Life stage, and traits in expanded sim details.</div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setShowDisplaySettings(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <SimEditPanel
          sim={editing}
          allSims={sims}
          unions={unions}
          open={true}
          onClose={() => { setEditing(null); setIsNew(false); }}
          onSave={(next) => {
            // Keep legacy name field populated for any old code paths
            const normalized = syncLegacyPartnerFields({ ...next, name: `${next.firstName} ${next.lastName}`.trim() }, unions);
            if (isNew) onAdd(normalized); else onUpdate(normalized);
            setEditing(null); setIsNew(false);
          }}
          trackerConfig={config}
          treeConfig={undefined}
          sheetConfig={sheetConfig}
          onUnionsChange={onUnionsChange}
          isPremium={isPremium}
          userId={userId}
          saveId={saveId}
          currentDay={currentDay}
        />
      )}
    </div>
  );
}
