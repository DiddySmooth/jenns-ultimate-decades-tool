import type { AgingConfig } from '../../types/tracker';

interface Props {
  configs: AgingConfig[];
}

export default function AgingReference({ configs }: Props) {
  return (
    <div className="aging-reference">
      <h2>Aging Reference</h2>
      {configs.map((config) => (
        <div key={config.type} className="aging-ref-block">
          <h3>{config.label}</h3>
          <table className="aging-ref-table">
            <thead>
              <tr>
                <th>Life Stage</th>
                <th>Sim Days</th>
                <th>≈ Years</th>
              </tr>
            </thead>
            <tbody>
              {config.lifeStages.map((ls) => (
                <tr key={ls.id}>
                  <td>{ls.name}</td>
                  <td>{ls.simDays}</td>
                  <td>{ls.yearsEquivalent > 0 ? `${ls.yearsEquivalent} yr${ls.yearsEquivalent !== 1 ? 's' : ''}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
