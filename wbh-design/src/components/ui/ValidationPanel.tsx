'use client';
// src/components/ui/ValidationPanel.tsx

export interface ValidationMessage {
  code: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  reference?: string;
}

interface Props {
  messages: ValidationMessage[];
  title?: string;
  collapsed?: boolean;
}

const ICONS = { error: '✘', warning: '⚠', info: 'ℹ' };
const CLASS_MAP = { error: 'alert-fail', warning: 'alert-warn', info: 'alert-info' };

export default function ValidationPanel({ messages, title, collapsed }: Props) {
  if (messages.length === 0) return null;

  const errors   = messages.filter(m => m.severity === 'error');
  const warnings = messages.filter(m => m.severity === 'warning');
  const infos    = messages.filter(m => m.severity === 'info');

  return (
    <div style={{ marginBottom: 12 }}>
      {title && (
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 6,
          textTransform: 'uppercase', letterSpacing: 1 }}>
          {errors.length > 0 && <span style={{ color: 'var(--red)' }}>✘ {errors.length} Error{errors.length > 1 ? 's' : ''} · </span>}
          {warnings.length > 0 && <span style={{ color: 'var(--accent)' }}>⚠ {warnings.length} Warning{warnings.length > 1 ? 's' : ''} · </span>}
          {title}
        </div>
      )}
      {messages.map((m, i) => (
        <div key={i} className={`alert ${CLASS_MAP[m.severity]}`} style={{ marginBottom: 4, padding: '7px 12px' }}>
          <span style={{ fontSize: 13, marginRight: 6 }}>{ICONS[m.severity]}</span>
          <span style={{ flex: 1 }}>
            {m.message}
            {m.reference && (
              <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.75, fontFamily: 'var(--mono)' }}>
                [{m.reference}]
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
