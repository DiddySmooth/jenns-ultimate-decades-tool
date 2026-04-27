import { memo, useState } from 'react';
import type { TrackerConfig } from '../types/tracker';

interface Props {
  config: TrackerConfig;
  onRename: (scope: { kind: 'human' | 'pet'; type?: string; stageId: string; }, newLabel: string) => void;
}

function LabelRow({
  label,
  onCommit,
}: {
  label: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(label);

  return (
    <input
      className="col-label-input"
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      onBlur={() => {
        const next = draft.trim();
        if (next && next !== label) onCommit(next);
        if (!next) setDraft(label); // refuse empty labels
      }}
    />
  );
}

const Group = memo(function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="col-group">
      <h4>{title}</h4>
      <div className="col-group-grid">{children}</div>
    </div>
  );
});

export default function ColumnLabelEditor({ config, onRename }: Props) {
  return (
    <div className="col-editor">
      <p className="settings-meta">
        Rename life stage columns without breaking your data. This only changes the header labels.
      </p>

      <Group title="Human">
        {config.humanAging.lifeStages.map((ls) => (
          <div key={ls.id} className="col-row">
            <span className="col-id">{ls.id}</span>
            <LabelRow
              label={ls.name}
              onCommit={(value) => onRename({ kind: 'human', stageId: ls.id }, value)}
            />
          </div>
        ))}
      </Group>

      {(config.pets ?? []).length > 0 && (
        <Group title="Pets">
          {(config.pets ?? []).flatMap((pet) =>
            pet.lifeStages.map((ls) => (
              <div key={ls.id} className="col-row">
                <span className="col-id">{pet.label}</span>
                <LabelRow
                  label={ls.name}
                  onCommit={(value) => onRename({ kind: 'pet', type: String(pet.type), stageId: ls.id }, value)}
                />
              </div>
            ))
          )}
        </Group>
      )}

      <p className="settings-meta" style={{ marginTop: '1rem' }}>
        Tip: for pets, you can rename “Puppy / Kitten” → “Puppy” for Dogs and “Kitten” for Cats.
      </p>
    </div>
  );
}
