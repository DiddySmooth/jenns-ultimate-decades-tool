import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import type { AvatarCrop, FamilyTreeConfig, SimEntry, TrackerConfig } from '../../types/tracker';
import { computeLifeStage, getFullName } from '../../utils/lifeStage';
import { computeAgeYears, getBirthYear, getDeathYear } from '../../utils/simDates';

export default function SimNode(props: NodeProps<{ sim: SimEntry; treeConfig: FamilyTreeConfig; trackerConfig: TrackerConfig; currentDay: number }>) {
  const sim = props.data.sim;
  const treeConfig = props.data.treeConfig;
  const trackerConfig = props.data.trackerConfig;
  const currentDay = props.data.currentDay;

  const name = getFullName(sim);
  const avatar = sim.avatarUrl;
  const crop = sim.avatarCrop as AvatarCrop | undefined;

  const stage = computeLifeStage(sim, trackerConfig, currentDay);
  const age = computeAgeYears(sim, trackerConfig, currentDay);
  const by = getBirthYear(sim, trackerConfig);
  const dy = getDeathYear(sim, trackerConfig);

  const d = treeConfig.display;
  const avatarClass = treeConfig.avatarShape === 'circle' ? 'circle' : treeConfig.avatarShape === 'rounded' ? 'rounded' : 'square';

  const tooltip = [
    stage ? `Stage: ${stage}` : null,
    age != null ? `Age: ${age}` : null,
    d.showBirthYear ? `Born: ${formatYear(by)}` : (by ? `Born: ${formatYear(by)}` : null),
    d.showDeathYear && dy ? `Died: ${formatYear(dy)}` : (dy ? `Died: ${formatYear(dy)}` : null),
    sim.generation != null ? `Gen: ${sim.generation}` : null,
  ].filter(Boolean).join('\n');

  const sexClass = sim.sex === 'Female' ? 'ft-node-female' : sim.sex === 'Male' ? 'ft-node-male' : 'ft-node-other';

  return (
    <div className={`ft-node ft-sim ${sexClass}${d.compactNodes ? ' compact' : ''}`} title={tooltip}>
      {/* incoming: parents/union */}
      <Handle type="target" position={Position.Top} id="parent-in" />
      {/* outgoing: to children (fallback) */}
      <Handle type="source" position={Position.Bottom} id="parent-out" />

      {/* spouse/marriage */}
      <Handle type="source" position={Position.Right} id="spouse-out" />
      <Handle type="target" position={Position.Left} id="spouse-in" />

      {/* Name at top */}
      <div className="ft-name" title={name}>{name}</div>

      {/* Avatar centered and larger */}
      <div className={`ft-avatar ${avatarClass}`}>
        {avatar ? (
          crop ? (
            <div
              className="ft-avatar-cropped"
              style={{
                backgroundImage: `url(${avatar})`,
                backgroundPosition: `${crop.x ?? 50}% ${crop.y ?? 50}%`,
                backgroundSize: `${(crop.zoom ?? 1) * 100}% ${(crop.zoom ?? 1) * 100}%`,
              }}
              aria-label={name}
            />
          ) : (
            <img src={avatar} alt={name} />
          )
        ) : (
          <div className="ft-avatar-fallback">{name.slice(0, 1).toUpperCase()}</div>
        )}
      </div>

      {/* Dates (birth–death) on one line */}
      {!d.compactNodes && (by != null) && (
        <div className="ft-dates">
          {by}{dy ? `–${dy}` : '–'}
        </div>
      )}

      {/* Other meta below dates */}
      {!d.compactNodes && (d.showLifeStage || d.showAge || d.showGeneration) && (
        <div className="ft-meta">
          {d.showLifeStage && stage ? <span>{stage}</span> : null}
          {d.showAge && age != null ? <span>{age}y</span> : null}
          {d.showGeneration && sim.generation != null ? <span>Gen {sim.generation}</span> : null}
        </div>
      )}
    </div>
  );
}
