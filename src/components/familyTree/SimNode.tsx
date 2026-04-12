import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import type { FamilyTreeConfig, SimEntry, TrackerConfig } from '../../types/tracker';
import { computeLifeStage, getFullName } from '../../utils/lifeStage';
import { computeAgeYears, formatYear, getBirthYear, getDeathYear } from '../../utils/simDates';

export default function SimNode(props: NodeProps<{ sim: SimEntry; treeConfig: FamilyTreeConfig; trackerConfig: TrackerConfig; currentDay: number }>) {
  const sim = props.data.sim;
  const treeConfig = props.data.treeConfig;
  const trackerConfig = props.data.trackerConfig;
  const currentDay = props.data.currentDay;

  const name = getFullName(sim);
  const avatar = sim.avatarUrl;

  const stage = computeLifeStage(sim, trackerConfig, currentDay);
  const age = computeAgeYears(sim, trackerConfig, currentDay);
  const by = getBirthYear(sim, trackerConfig);
  const dy = getDeathYear(sim, trackerConfig);

  const d = treeConfig.display;
  const avatarClass = treeConfig.avatarShape === 'circle' ? 'circle' : treeConfig.avatarShape === 'rounded' ? 'rounded' : 'square';

  return (
    <div className="ft-node ft-sim">
      {/* incoming: parents/union */}
      <Handle type="target" position={Position.Top} id="parent-in" />
      {/* outgoing: to children (fallback) */}
      <Handle type="source" position={Position.Bottom} id="parent-out" />

      {/* spouse/marriage */}
      <Handle type="source" position={Position.Right} id="spouse-out" />
      <Handle type="target" position={Position.Left} id="spouse-in" />

      <div className={`ft-avatar ${avatarClass}`}>
        {avatar ? <img src={avatar} alt={name} /> : <div className="ft-avatar-fallback">{name.slice(0, 1).toUpperCase()}</div>}
      </div>
      <div className="ft-name" title={name}>{name}</div>
      <div className="ft-meta">
        {d.showLifeStage && stage ? <div>{stage}</div> : null}
        {d.showAge && age != null ? <div>{age}y</div> : null}
        {d.showBirthYear ? <div>Born: {formatYear(by)}</div> : null}
        {d.showDeathYear && dy ? <div>Died: {formatYear(dy)}</div> : null}
        {d.showGeneration ? <div>Gen: {sim.generation}</div> : null}
      </div>
    </div>
  );
}
