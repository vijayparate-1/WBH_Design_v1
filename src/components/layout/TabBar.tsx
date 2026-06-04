'use client';
// src/components/layout/TabBar.tsx

export interface TabDef {
  id: string;
  label: string;
  color?: string;
}

interface Props {
  tabs: readonly TabDef[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onExportXLSX?: () => void;
  onPrint?: () => void;
}

export default function TabBar({ tabs, activeTab, onTabChange, onExportXLSX, onPrint }: Props) {
  return (
    <div className="tab-bar" style={{ paddingRight: 8 }}>
      {tabs.map(t => (
        <button
          key={t.id}
          className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
          style={t.color && activeTab !== t.id ? { color: t.color } : {}}
          onClick={() => onTabChange(t.id)}
        >
          {t.label}
        </button>
      ))}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0' }}>
        <button
          className="btn btn-sm"
          style={{ background: 'rgba(14,122,62,0.1)', border: '1px solid var(--green)', color: 'var(--green)' }}
          onClick={onExportXLSX}
        >
          ⬇ Export XLSX
        </button>
        <button
          className="btn btn-sm"
          style={{ background: 'rgba(176,96,0,0.1)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
          onClick={onPrint ?? (() => window.print())}
        >
          🖨 Print / PDF
        </button>
      </div>
    </div>
  );
}
