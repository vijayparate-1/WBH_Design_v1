'use client';
// src/components/ui/ResultCard.tsx

interface ResultCardProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  variant?: 'default' | 'highlight' | 'green' | 'red';
  decimals?: number;
}

export function ResultCard({ label, value, unit, variant = 'default', decimals }: ResultCardProps) {
  const displayVal = value === null || value === undefined ? '—'
    : typeof value === 'number' && decimals !== undefined ? value.toFixed(decimals)
    : String(value);

  return (
    <div className={`result-card ${variant !== 'default' ? variant : ''}`}>
      <div className="result-label">{label}</div>
      <div className="result-value">{displayVal}</div>
      {unit && <div className="result-unit">{unit}</div>}
    </div>
  );
}

interface ResultGridProps {
  children: React.ReactNode;
  cols?: number;
}

export function ResultGrid({ children, cols = 4 }: ResultGridProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 10,
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

// ── Simple results table ──────────────────────────────────────────────────────
interface ResultRow {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  highlight?: 'accent' | 'blue' | 'green' | 'red';
  decimals?: number;
}

interface ResultTableProps {
  rows: ResultRow[];
  headers?: [string, string, string?];
}

export function ResultTable({ rows, headers = ['Parameter', 'Value', 'Unit'] }: ResultTableProps) {
  const fmt = (v: string | number | null | undefined, d?: number) =>
    v === null || v === undefined ? '—'
    : typeof v === 'number' && d !== undefined ? v.toFixed(d)
    : String(v);

  const colorMap: Record<string, string> = {
    accent: 'var(--accent)', blue: 'var(--blue)', green: 'var(--green)', red: 'var(--red)',
  };

  return (
    <table className="res-table">
      <thead>
        <tr>
          {headers.map(h => h && <th key={h}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <td>{row.label}</td>
            <td className={row.highlight ? '' : 'val'}
                style={row.highlight ? { color: colorMap[row.highlight], fontWeight: 600 } : {}}>
              {fmt(row.value, row.decimals)}
            </td>
            {headers[2] !== undefined && <td style={{ color: 'var(--text-dim)', fontSize: 11 }}>{row.unit ?? ''}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
