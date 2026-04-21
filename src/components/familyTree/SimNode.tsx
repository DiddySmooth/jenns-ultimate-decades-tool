import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import type { AvatarCrop, FamilyTreeConfig, SimEntry, TrackerConfig } from '../../types/tracker';
import { computeLifeStage, getFullName } from '../../utils/lifeStage';
import { computeAgeYears, getBirthYear, getDeathYear } from '../../utils/simDates';

// Generation ring colors — cycles through these
const GEN_COLORS = [
  '#4a90d9', // blue
  '#27ae60', // green
  '#e67e22', // orange
  '#8e44ad', // purple
  '#e91e8c', // pink
  '#16a085', // teal
  '#c0392b', // red
  '#2c3e50', // dark
];

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
  const gen = sim.generation ?? 0;
  const ringColor = GEN_COLORS[gen % GEN_COLORS.length];

  const tooltip = [
    name,
    by != null ? `Born: ${by}` : null,
    dy != null ? `Died: ${dy}` : null,
    stage ? `Stage: ${stage}` : null,
    age != null ? `Age: ${age}` : null,
    sim.generation != null ? `Gen: ${sim.generation}` : null,
  ].filter(Boolean).join('\n');

  const isDead = dy != null;
  const sexBg = sim.sex === 'Female' ? 'rgba(249,168,201,0.12)' : sim.sex === 'Male' ? 'rgba(147,197,253,0.12)' : undefined;

  return (
    <div className={`ft-node ft-sim${d.compactNodes ? ' compact' : ''}${isDead ? ' ft-sim-dead' : ''}`} title={tooltip} style={sexBg ? { background: sexBg } : undefined}>
      {/* Handles — invisible */}
      <Handle type="target" position={Position.Top}    id="parent-in"  style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0 }} />
      <Handle type="source" position={Position.Bottom} id="parent-out" style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0 }} />
      <Handle type="source" position={Position.Right} id="spouse-out" style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, top: 50, bottom: 'auto' }} />
      <Handle type="target" position={Position.Left}  id="spouse-in"  style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, top: 50, bottom: 'auto' }} />

      {/* Avatar with generation ring */}
      <div className="ft-avatar-ring" style={{ borderColor: ringColor }}>
        <div className="ft-avatar circle">
          {avatar ? (
            crop ? (
              <div
                className="ft-avatar-cropped"
                style={{
                  backgroundImage: `url(${avatar})`,
                  backgroundPosition: `${crop.x ?? 50}% ${crop.y ?? 50}%`,
                  backgroundSize: `${(crop.zoom ?? 1) * 100}%`,
                }}
                aria-label={name}
              />
            ) : (
              <img src={avatar} alt={name} />
            )
          ) : (
            <div className="ft-avatar-fallback" style={{ background: ringColor + '22', color: ringColor }}>
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Name */}
      <div className="ft-name" title={name}>{name}</div>

      {/* Dates */}
      {!d.compactNodes && by != null && (
        <div className="ft-dates" style={{ color: ringColor }}>
          {by}{dy ? ` · ${dy}` : ' · Present'}
        </div>
      )}

      {/* Meta */}
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
