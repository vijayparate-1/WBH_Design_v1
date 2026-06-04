'use client';
// src/components/layout/ProjectHeaderBar.tsx

import { useState } from 'react';

export interface ProjectMeta {
  jobNo: string;
  tagNo: string;
  service: string;
  location: string;
  docNo: string;
  revision: string;
  date: string;
  preparedBy: string;
  checkedBy: string;
}

interface Props {
  meta?: ProjectMeta;
  onChange?: (meta: ProjectMeta) => void;
  onSave?: (meta: ProjectMeta) => void;
}

const EMPTY: ProjectMeta = {
  jobNo: '', tagNo: '', service: '', location: '',
  docNo: '', revision: 'A', date: '', preparedBy: '', checkedBy: '',
};

const FIELDS: { key: keyof ProjectMeta; label: string; placeholder: string; width?: number }[] = [
  { key: 'jobNo',      label: 'Enquiry / Job No.',    placeholder: 'e.g. Q14201' },
  { key: 'tagNo',      label: 'Customer Tag No.',     placeholder: 'e.g. H-101A' },
  { key: 'service',    label: 'Service Description',  placeholder: 'e.g. Fuel gas pre-heating' },
  { key: 'location',   label: 'Site / Location',      placeholder: 'e.g. Berwick, VIC' },
  { key: 'docNo',      label: 'Document No.',         placeholder: 'e.g. Q14201-DS001' },
  { key: 'revision',   label: 'Revision',             placeholder: 'A', width: 50 },
  { key: 'date',       label: 'Date',                 placeholder: 'DD/MM/YYYY' },
  { key: 'preparedBy', label: 'Prepared by',          placeholder: 'Initials' },
  { key: 'checkedBy',  label: 'Checked / Approved',   placeholder: 'Initials' },
];

export default function ProjectHeaderBar({ meta, onChange, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<ProjectMeta>(meta ?? EMPTY);
  const [saving, setSaving] = useState(false);

  const update = (key: keyof ProjectMeta, val: string) => {
    const next = { ...local, [key]: val };
    setLocal(next);
    onChange?.(next);
  };

  const summary = [local.jobNo, local.tagNo, local.service, local.location]
    .filter(Boolean).join(' · ');

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    await onSave(local);
    setSaving(false);
  };

  return (
    <div style={{ background: 'var(--panel)', borderBottom: '2px solid var(--accent)', padding: '8px 24px' }}>
      {/* Toggle row */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: open ? 8 : 0, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1 }}>
          📋 Project / Document Header
        </span>
        <span style={{ color: 'var(--accent)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        {summary && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', marginLeft: 12 }}>
            {summary}
          </span>
        )}
      </div>

      {/* Fields */}
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="field-label" style={{ fontSize: 10 }}>{f.label}</label>
              <input
                type="text"
                value={local[f.key]}
                placeholder={f.placeholder}
                style={{ width: f.width ?? '100%' }}
                onChange={e => update(f.key, e.target.value)}
              />
            </div>
          ))}
          {onSave && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-green btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? '⏳ Saving…' : '💾 Save to DB'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
