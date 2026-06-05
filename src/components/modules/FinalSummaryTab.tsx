'use client';
import React, { useRef } from 'react';
// src/components/modules/FinalSummaryTab.tsx
// Final Summary — Engineering Datasheet (per Q13903-QDS01 format) + Vessel Sketches
// Two parts: (1) complete datasheet, (2) cross-section end view + longitudinal side view


import type { Stage1Results } from '@/lib/calculations/thermodynamics';
import type { Stage2Results, Stage3Results } from '@/lib/calculations/heater-sizing';
import type { SketcherResults } from './ShellSketcherTab';

interface DesignState {
  s1?: Stage1Results;
  s2?: Stage2Results;
  s3?: Stage3Results;
  sketcher?: SketcherResults;
  projectInfo?: {
    client: string; quotation: string; project: string;
    tagNo: string; rev: string; by: string; chkAppr: string;
    notes: string; date: string;
  };
}

interface Props { design: DesignState; }

// Material options for user selection
const SHELL_MATS = [
  { id:'a516_70',    label:'ASTM A516 Gr 70 — CS Plate (standard)',       ca_default: 3 },
  { id:'a240_316l',  label:'ASTM A240 316L — SS Plate (sour/cryogenic)',   ca_default: 0 },
  { id:'a516_60',    label:'ASTM A516 Gr 60 — CS Plate (low strength)',    ca_default: 3 },
  { id:'a285_c',     label:'ASTM A285 Gr C — CS Plate (pressure vessel)',  ca_default: 3 },
];
const FIRETUBE_MATS = [
  { id:'a178c',      label:'ASTM A178 Gr C — ERW CS Tube (standard WBH)',  },
  { id:'a214',       label:'ASTM A214 — ERW CS Heat Exchanger Tube',        },
  { id:'a312_316l',  label:'ASTM A312 TP316L — SS Tube (sour/CO₂ service)' },
  { id:'a335_p11',   label:'ASTM A335 P11 — Alloy Steel (high temp)',       },
];

// ─── Longitudinal (Side) View SVG ────────────────────────────────────────────
// Schematic-quality vessel profile for proposals — not GA drafting standard.
// Shows: shell outline, firetube passes, coil (dotted), bath level,
// nozzles (N1–N10), expansion tank connection, stack stub.
function LongitudinalSketch({ s2, s3, sketcher }: {
  s2?: Stage2Results; s3?: Stage3Results; sketcher?: SketcherResults;
}) {
  const shellOD = sketcher?.shellOD_mm ?? s2?.OD_shell_mm ?? 2000;
  const shellL  = s2?.L_shell_mm ?? 7500;
  const nPass   = s2?.nPass ?? 2;
  const nBurners = sketcher?.nBurners ?? 2;
  const fireOD  = sketcher?.fireOD_mm ?? 350;
  const coilOD  = sketcher?.coilOD_mm ?? 88.9;
  const nPaths  = s3?.n_pass ?? 3;

  // SVG canvas — scale to fit 800 wide
  const W = 800, H = 280;
  const scale = Math.min((W - 80) / shellL, (H - 60) / shellOD) * 1000;
  const sW = shellL * scale / 1000;    // shell length in px
  const sH = shellOD * scale / 1000;   // shell OD in px
  const x0 = (W - sW) / 2;            // shell left edge
  const y0 = (H - sH) / 2;            // shell top edge
  const cx = y0 + sH / 2;             // shell centreline Y

  // Firetube Y positions (rough schematic — evenly spaced in bottom half)
  const ftSpacing = sH / (nBurners + 1);
  const ftYs = Array.from({ length: nBurners }, (_, i) => y0 + sH * 0.65 - i * ftSpacing * 0.25);
  // 2-pass: two lines per burner; 4-pass: four lines
  const passesPer = nPass <= 2 ? 2 : 4;
  const ftRows: number[] = [];
  ftYs.forEach(fy => {
    for (let p = 0; p < passesPer; p++) {
      ftRows.push(fy - p * (fireOD * scale / 1000 + 2));
    }
  });

  // Coil rows (dotted lines in upper half)
  const coilPitch = (coilOD + 10) * scale / 1000;
  const coilRows = Array.from({ length: Math.min(nPaths * 2, 8) }, (_, i) =>
    y0 + sH * 0.2 + i * coilPitch
  );

  // Bath level (~60% of shell height from bottom)
  const bathY = y0 + sH * 0.38;

  // Nozzle positions (schematic)
  const nozzles = [
    { id:'N1', label:'GAS\nINLET', x: x0,                y: cx - sH*0.15, side:'left',  color:'#1a6ab8' },
    { id:'N2', label:'GAS\nOUTLET',x: x0 + sW,           y: cx - sH*0.15, side:'right', color:'#1a6ab8' },
    { id:'N5', label:'DRAIN',      x: x0 + sW*0.5,       y: y0 + sH,      side:'bot',   color:'#5a4a00' },
    { id:'N7', label:'FILL',       x: x0 + sW*0.3,       y: y0 + sH,      side:'bot',   color:'#5a4a00' },
    { id:'N9', label:'THERMO-\nWELL', x: x0 + sW*0.7,   y: y0,           side:'top',   color:'#7a1aa0' },
    { id:'vent',label:'VENT',      x: x0 + sW*0.85,      y: y0,           side:'top',   color:'#5a4a00' },
  ];

  // Burner stubs (left end, pointing left)
  const burnerY = ftYs[0] ?? cx + sH * 0.2;

  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1,
        color:'var(--text-dim)', marginBottom:4 }}>
        Longitudinal (Side) View — Schematic
        <span style={{ fontWeight:400, marginLeft:8, color:'#4a7090' }}>
          Shell Ø{shellOD.toFixed(0)} × {(shellL/1000).toFixed(2)} m L
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', background:'#0a1520', borderRadius:6 }}>
        {/* Shell outline */}
        <rect x={x0} y={y0} width={sW} height={sH}
          fill="none" stroke="#3a6a9a" strokeWidth={2.5} rx={4}/>
        {/* End caps (ellipses) */}
        <ellipse cx={x0} cy={cx} rx={sH*0.04} ry={sH/2}
          fill="#0a1520" stroke="#3a6a9a" strokeWidth={2.5}/>
        <ellipse cx={x0 + sW} cy={cx} rx={sH*0.04} ry={sH/2}
          fill="#0a1520" stroke="#3a6a9a" strokeWidth={2.5}/>

        {/* Centreline */}
        <line x1={x0-20} y1={cx} x2={x0+sW+20} y2={cx}
          stroke="#2a4a6a" strokeWidth={0.8} strokeDasharray="6 4"/>

        {/* Bath level line */}
        <line x1={x0+4} y1={bathY} x2={x0+sW-4} y2={bathY}
          stroke="#1a6ab8" strokeWidth={1.2} strokeDasharray="4 2" opacity={0.7}/>
        <text x={x0 + sW - 6} y={bathY - 4} textAnchor="end"
          fontSize={8} fill="#1a6ab8" fontFamily="monospace">BATH LEVEL</text>

        {/* Firetube passes */}
        {ftRows.map((fy, i) => {
          const fw = Math.max(6, fireOD * scale / 1000);
          return (
            <g key={`ft${i}`}>
              <rect x={x0 + 12} y={fy - fw/2} width={sW - 24} height={fw}
                fill="#c47d00" opacity={0.5} rx={fw/2}/>
              <rect x={x0 + 15} y={fy - fw*0.3} width={sW - 30} height={fw*0.6}
                fill="rgba(255,120,0,0.15)" rx={fw*0.3}/>
            </g>
          );
        })}

        {/* Coil rows (dotted) */}
        {coilRows.map((ry, i) => (
          <line key={`coil${i}`} x1={x0 + 20} y1={ry} x2={x0 + sW - 20} y2={ry}
            stroke="#1e8a40" strokeWidth={Math.max(1.5, coilOD * scale / 1000)}
            strokeDasharray="8 4" opacity={0.7}/>
        ))}

        {/* Burner stub (left side, forced draft inlet) */}
        <rect x={x0 - 28} y={burnerY - 10} width={28} height={20}
          fill="#e05000" opacity={0.7} rx={3}/>
        <text x={x0 - 14} y={burnerY + 3} textAnchor="middle"
          fontSize={7} fill="white" fontFamily="monospace" fontWeight={700}>BNR</text>

        {/* Stack stub (top right) */}
        <rect x={x0 + sW * 0.8 - 8} y={y0 - 24} width={16} height={24}
          fill="#5a5a5a" opacity={0.7} rx={2}/>
        <text x={x0 + sW * 0.8} y={y0 - 28} textAnchor="middle"
          fontSize={7} fill="#aaa" fontFamily="monospace">STACK</text>

        {/* Expansion tank connection */}
        <rect x={x0 + sW - 8} y={y0 - 20} width={12} height={20}
          fill="#7a3a00" opacity={0.6} rx={2}/>
        <text x={x0 + sW + 4} y={y0 - 14} fontSize={7} fill="#c87020" fontFamily="monospace">
          EXP.TANK
        </text>

        {/* Nozzles */}
        {nozzles.map(n => {
          const nL = 18;
          let x1=n.x, y1=n.y, x2=n.x, y2=n.y;
          if (n.side==='left')  { x1=n.x-nL; x2=n.x; }
          if (n.side==='right') { x1=n.x;    x2=n.x+nL; }
          if (n.side==='top')   { y1=n.y-nL; y2=n.y; }
          if (n.side==='bot')   { y1=n.y;    y2=n.y+nL; }
          const labelX = n.side==='left' ? x1-2 : n.side==='right' ? x2+2 : n.x;
          const labelY = n.side==='top'  ? y1-6 : n.side==='bot' ? y2+10 : n.y+3;
          const anchor = n.side==='left' ? 'end' : n.side==='right' ? 'start' : 'middle';
          return (
            <g key={n.id}>
              <line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={n.color} strokeWidth={3} strokeLinecap="round"/>
              <text x={labelX} y={labelY} textAnchor={anchor as any}
                fontSize={7} fill={n.color} fontFamily="monospace" fontWeight={700}>
                {n.id}
              </text>
            </g>
          );
        })}

        {/* Overall dimension line */}
        <line x1={x0} y1={y0+sH+18} x2={x0+sW} y2={y0+sH+18}
          stroke="#5a6e88" strokeWidth={0.8}/>
        <line x1={x0} y1={y0+sH+14} x2={x0} y2={y0+sH+22} stroke="#5a6e88" strokeWidth={0.8}/>
        <line x1={x0+sW} y1={y0+sH+14} x2={x0+sW} y2={y0+sH+22} stroke="#5a6e88" strokeWidth={0.8}/>
        <text x={(x0+x0+sW)/2} y={y0+sH+28} textAnchor="middle"
          fontSize={9} fill="#5a6e88" fontFamily="monospace">
          L = {(shellL/1000).toFixed(3)} m
        </text>

        {/* Legend */}
        <g transform="translate(8, 8)">
          {[
            { col:'#c47d00', label:'Firetube passes' },
            { col:'#1e8a40', label:'Process coil (schematic)' },
            { col:'#1a6ab8', label:'Bath level' },
          ].map((l, i) => (
            <g key={i} transform={`translate(0,${i*12})`}>
              <rect x={0} y={0} width={12} height={8} fill={l.col} opacity={0.7} rx={1}/>
              <text x={16} y={7} fontSize={8} fill="var(--text-dim)" fontFamily="sans-serif">
                {l.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

// ─── Datasheet Row helpers ───────────────────────────────────────────────────
function DSRow({ label, v1, v2, unit, sub, bold, section }:
  { label: string; v1?: string|number; v2?: string|number; unit?: string;
    sub?: string; bold?: boolean; section?: boolean }) {
  if (section) return (
    <tr>
      <td colSpan={4} style={{
        background:'rgba(176,96,0,0.12)', fontWeight:800, fontSize:11,
        padding:'6px 10px', color:'var(--accent)', textTransform:'uppercase', letterSpacing:1,
        borderTop:'2px solid var(--accent)', borderBottom:'1px solid var(--border)',
      }}>{label}</td>
    </tr>
  );
  const fmt = (v: string|number|undefined) => v === undefined || v === null ? '—' : String(v);
  return (
    <tr style={{ borderBottom:'1px solid rgba(180,190,200,0.1)' }}>
      <td style={{ padding:'4px 10px', fontSize:11, color:'var(--text-dim)',
        fontWeight: bold ? 700 : 400, verticalAlign:'top', width:'40%' }}>
        {label}
        {sub && <div style={{ fontSize:9, color:'var(--text-dim)', opacity:0.7 }}>{sub}</div>}
      </td>
      <td style={{ padding:'4px 10px', fontFamily:'var(--mono)', fontSize:11,
        fontWeight: bold ? 700 : 600, color: bold ? 'var(--accent)' : 'var(--text)',
        textAlign:'right', width:'22%' }}>{fmt(v1)}</td>
      <td style={{ padding:'4px 10px', fontFamily:'var(--mono)', fontSize:11,
        fontWeight: bold ? 700 : 600, color: bold ? 'var(--blue)' : 'var(--text)',
        textAlign:'right', width:'22%' }}>{fmt(v2)}</td>
      <td style={{ padding:'4px 10px', fontSize:10, color:'var(--text-dim)',
        width:'16%' }}>{unit ?? ''}</td>
    </tr>
  );
}

function DSSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <DSRow label={title} section />
      {children}
    </>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function FinalSummaryTab({ design }: Props) {
  const { s1, s2, s3, sketcher } = design;
  const printRef = useRef<HTMLDivElement>(null);
  // Local editable project info — pre-filled from design.projectInfo if available
  const [projInfo, setProjInfo] = React.useState({
    client:   design.projectInfo?.client   ?? '',
    quotation:design.projectInfo?.quotation ?? '',
    project:  design.projectInfo?.project  ?? '',
    tagNo:    design.projectInfo?.tagNo    ?? '',
    rev:      design.projectInfo?.rev      ?? '0',
    by:       design.projectInfo?.by       ?? '',
    chkAppr:  design.projectInfo?.chkAppr  ?? '',
    notes:    design.projectInfo?.notes    ?? '',
    date:     design.projectInfo?.date     ?? new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' }),
  });
  const setP = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setProjInfo(p => ({ ...p, [k]: e.target.value }));

  // Material selectors — default to typical WBH (CS), user can change for sour/cryogenic
  const [shellMat, setShellMat] = React.useState(
    s3?.mat_label?.includes('316') ? 'a240_316l' : 'a516_70'
  );
  const [fireMat, setFireMat] = React.useState('a178c');
  const [shellCA, setShellCA] = React.useState(3);

  const shellMatLabel = SHELL_MATS.find(m => m.id === shellMat)?.label ?? 'ASTM A516 Gr 70';
  const fireMatLabel  = FIRETUBE_MATS.find(m => m.id === fireMat)?.label ?? 'ASTM A178 Gr C';

  // Coil material from Stage 3 selector
  const coilMat = s3?.mat_label
    ? (() => {
        const ml = s3.mat_label.toLowerCase();
        if (ml.includes('316'))   return 'ASTM A312 TP316L SMLS Pipe / ASTM A403 WP316L';
        if (ml.includes('333'))   return 'ASTM A333 Gr 6 SMLS Pipe / ASTM A420 WPL6 (Low-Temp)';
        return 'ASTM A106 Gr B SMLS Pipe / ASTM A234 WPB';
      })()
    : 'ASTM A106 Gr B SMLS Pipe / ASTM A234 WPB';

  const headerMat = coilMat; // headers same spec as coil for simplicity
  const f = (v: number|undefined, d=1) => v !== undefined && isFinite(v) ? v.toFixed(d) : '—';
  const f0 = (v: number|undefined) => f(v, 0);
  const f2 = (v: number|undefined) => f(v, 2);
  const f4 = (v: number|undefined) => f(v, 4);

  const shellOD = sketcher?.shellOD_mm ?? s2?.OD_shell_mm;
  const shellL  = s2?.L_shell_mm;

  const ST_in  = s1?.ST_in  as any;
  const ST_out = s1?.ST_out as any;
  const today  = new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });

  if (!s1 && !s2 && !s3) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ padding:60, textAlign:'center', color:'var(--text-dim)' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:8 }}>Final Summary — Engineering Datasheet</div>
          <div style={{ fontSize:12 }}>
            Complete Stages 1 → 3 and Shell Sketcher to generate the full datasheet.
            <br/>The datasheet matches the format of Q13903-QDS01 (API 12K / ASME B31.3).
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Project Info + Material Selectors */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        {/* Project Info Form */}
        <div className="panel">
          <div className="panel-header"><div className="panel-title">Project Information</div></div>
          <div className="panel-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { k:'client',   label:'Client' },
                { k:'quotation',label:'Quotation No.' },
                { k:'project',  label:'Project / Service' },
                { k:'tagNo',    label:'Equipment Tag No.' },
                { k:'rev',      label:'Rev' },
                { k:'date',     label:'Date' },
                { k:'by',       label:'By' },
                { k:'chkAppr',  label:'Chk/Appr' },
              ].map(fi => (
                <div key={fi.k}>
                  <label className="field-label">{fi.label}</label>
                  <input type="text" value={projInfo[fi.k as keyof typeof projInfo]}
                    onChange={setP(fi.k)} style={{ fontSize:11 }} />
                </div>
              ))}
              <div style={{ gridColumn:'1/-1' }}>
                <label className="field-label">Notes</label>
                <input type="text" value={projInfo.notes} onChange={setP('notes')}
                  style={{ width:'100%', fontSize:11 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Material Selectors */}
        <div className="panel">
          <div className="panel-header"><div className="panel-title">Material Specification</div></div>
          <div className="panel-body">
            <div style={{ display:'grid', gap:10 }}>
              <div>
                <label className="field-label">Shell Material</label>
                <select value={shellMat} onChange={e => {
                  setShellMat(e.target.value);
                  const mat = SHELL_MATS.find(m => m.id === e.target.value);
                  setShellCA(mat?.ca_default ?? 3);
                }}>
                  {SHELL_MATS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Shell Corrosion Allowance</label>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type="number" value={shellCA} min="0" max="6" step="0.5"
                    onChange={e => setShellCA(parseFloat(e.target.value))}
                    style={{ width:70 }} />
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>mm</span>
                </div>
              </div>
              <div>
                <label className="field-label">Fire Tube Material</label>
                <select value={fireMat} onChange={e => setFireMat(e.target.value)}>
                  {FIRETUBE_MATS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Process Coil Material</label>
                <div style={{ fontFamily:'var(--mono)', fontSize:11, padding:'6px 8px',
                  background:'var(--panel2)', borderRadius:4, color:'var(--text-dim)' }}>
                  {coilMat.split('/')[0].trim()}
                  <div style={{ fontSize:9, marginTop:2 }}>From Stage 3 material selection</div>
                </div>
              </div>
              <div className="note-box" style={{ fontSize:10 }}>
                <strong>Typical WBH (sweet gas):</strong> Shell A516 Gr 70 CS, Firetube A178 Gr C ERW CS, Coil A106 Gr B CS.<br/>
                <strong>Sour service:</strong> All wetted parts SS 316L or NACE MR0175 CS with HIC testing.<br/>
                <strong>Cryogenic (LNG):</strong> A333 Gr 6 / A240 316L per service temperature.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print button */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12, gap:8 }}>
        <button className="btn btn-secondary btn-sm"
          onClick={() => window.print()}>
          🖨 Print Datasheet
        </button>
        <div style={{ fontSize:11, color:'var(--text-dim)', alignSelf:'center' }}>
          {sketcher ? `✔ Shell OD confirmed: ${sketcher.shellOD_mm} mm (geometric)`
                    : `⚠ Run Shell Sketcher to confirm shell OD`}
        </div>
      </div>

      <div ref={printRef}>
        {/* ── HEADER ── */}
        <div className="panel" style={{ marginBottom:12 }}>
          <div style={{ padding:'12px 16px', borderBottom:'2px solid var(--accent)',
            display:'grid', gridTemplateColumns:'1fr auto', alignItems:'start' }}>
            <div>
              <div style={{ fontSize:16, fontWeight:900, letterSpacing:1,
                textTransform:'uppercase', color:'var(--accent)', marginBottom:4 }}>
                Indirect Heater Data Sheet
              </div>
              <div style={{ fontSize:11, color:'var(--text-dim)' }}>
                API 12K · ASME Section VIII Div.1 · ASME B31.3 · AS 3814
              </div>
            </div>
            <div style={{ fontSize:10, textAlign:'right', color:'var(--text-dim)',
              fontFamily:'var(--mono)', lineHeight:1.8 }}>
              <div>REV: {projInfo.rev ?? '0'} &nbsp; DATE: {projInfo.date ?? today}</div>
              <div>BY: {projInfo.by ?? '—'} &nbsp; CHK/APPR: {projInfo.chkAppr ?? '—'}</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0,
            borderBottom:'1px solid var(--border)' }}>
            {[
              ['Client:', projInfo.client ?? '(not set)'],
              ['Quotation No.:', projInfo.quotation ?? '(not set)'],
              ['Project / Service:', projInfo.project ?? '(not set)'],
              ['Equipment Tag No.:', projInfo.tagNo ?? '(not set)'],
            ].map(([k, v]) => (
              <div key={k} style={{ padding:'6px 16px', borderBottom:'1px solid var(--border)',
                display:'flex', gap:8, fontSize:11 }}>
                <span style={{ color:'var(--text-dim)', minWidth:130 }}>{k}</span>
                <span style={{ fontWeight:700 }}>{v}</span>
              </div>
            ))}
          </div>
          {projInfo.notes && (
            <div style={{ padding:'6px 16px', fontSize:11, color:'var(--text-dim)',
              borderBottom:'1px solid var(--border)' }}>
              Notes: {projInfo.notes}
            </div>
          )}
        </div>

        {/* ── DATASHEET TABLE ── */}
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header">
            <div className="panel-title">Engineering Datasheet</div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'rgba(176,96,0,0.08)' }}>
                  <th style={{ padding:'6px 10px', fontSize:11, fontWeight:700,
                    textTransform:'uppercase', color:'var(--text-dim)',
                    textAlign:'left', width:'40%' }}>Parameter</th>
                  <th style={{ padding:'6px 10px', fontSize:11, fontWeight:700,
                    textTransform:'uppercase', color:'var(--accent)',
                    textAlign:'right', width:'22%' }}>
                    {s1?.T_in_C !== undefined ? `Inlet (${f(s1.T_in_C,1)}°C)` : 'Value / Case 1'}
                  </th>
                  <th style={{ padding:'6px 10px', fontSize:11, fontWeight:700,
                    textTransform:'uppercase', color:'var(--blue)',
                    textAlign:'right', width:'22%' }}>
                    {s1?.T_out_C !== undefined ? `Outlet (${f(s1.T_out_C,1)}°C)` : 'Value / Case 2'}
                  </th>
                  <th style={{ padding:'6px 10px', fontSize:11, fontWeight:700,
                    textTransform:'uppercase', color:'var(--text-dim)',
                    textAlign:'left', width:'16%' }}>Unit</th>
                </tr>
              </thead>
              <tbody>

                {/* SECTION 1: PROCESS CONDITIONS */}
                <DSSection title="1 — Process Conditions">
                  <DSRow label="Process Fluid" v1="Natural Gas" v2="Natural Gas" />
                  <DSRow label="Flow Rate" v1={f0(s1?.mdot_kgs ? s1.mdot_kgs*3600 : undefined)}
                    v2={f0(s1?.mdot_kgs ? s1.mdot_kgs*3600 : undefined)} unit="kg/hr" />
                  <DSRow label="Operating Pressure"
                    v1={f2(s1?.P_kPa ? s1.P_kPa/100-1.01325 : undefined)}
                    v2={f2(s1 ? (s1.P_kPa - s1.dP_kPa)/100-1.01325 : undefined)} unit="barg" />
                  <DSRow label="Operating Temperature"
                    v1={f2(s1?.T_in_C)} v2={f2(s1?.T_out_C)} unit="°C" />
                  <DSRow label="Gas Density"
                    v1={f4(ST_in?.rho)} v2={f4(ST_out?.rho)} unit="kg/m³" />
                  <DSRow label="Mass Heat Capacity (Cp)"
                    v1={f4(ST_in?.Cp5_kgK)} v2={f4(ST_out?.Cp5_kgK)} unit="kJ/kg·°C" />
                  <DSRow label="Vapour Thermal Conductivity"
                    v1={f4(ST_in?.k_therm)} v2={f4(ST_out?.k_therm)} unit="W/m·°C" />
                  <DSRow label="Dynamic Viscosity μ"
                    v1={f4(ST_in?.mu ? ST_in.mu*1000 : undefined)}
                    v2={f4(ST_out?.mu ? ST_out.mu*1000 : undefined)} unit="cP" />
                  <DSRow label="Molecular Weight"
                    v1={f2(s1?.MW)} v2={f2(s1?.MW)} unit="g/mol" />
                  <DSRow label="Compressibility Z"
                    v1={f4(ST_in?.Z)} v2={f4(ST_out?.Z)} />
                  <DSRow label="Specific Gravity (Air=1)"
                    v1={f4(s1?.SG)} v2={f4(s1?.SG)} />
                  <DSRow label="HHV" v1={f2(s1?.heatingValues?.HHV_kJkg ? s1.heatingValues.HHV_kJkg/1000 : undefined)}
                    unit="MJ/kg" />
                  <DSRow label="Wobbe Index" v1={f2(s1?.heatingValues?.WobbeIdx)} unit="MJ/Nm³" />
                </DSSection>

                {/* SECTION 2: HEATER DESIGN */}
                <DSSection title="2 — Heater Design">
                  <DSRow label="Heater Design Code" v1="API 12K — Specification for Indirect Type Oilfield Heaters" />
                  <DSRow label="Process Coil Mechanical Code" v1="ASME Section VIII Division 1 / ASME B31.3" />
                  <DSRow label="Calculated Duty / Design Duty" bold
                    v1={s1 ? `${f(s1.Q_final,1)} / ${f(s1.Q_final,1)}` : '—'} unit="kW" />
                  <DSRow label="Heater Efficiency [HHV / LHV]"
                    v1={s2 ? `${f(s2.Q_net_kW/s2.Q_gross_kW*100,1)}` : '—'} unit="%" />
                  <DSRow label="Burner Excess Air Level"
                    v1={f0(s2 ? (s2 as any).excessAir_pct ?? 22.5 : undefined)} unit="%" />
                  <DSRow label="Fire Tube Heat Release"
                    v1={f2(s2?.Q_gross_kW)} unit="kW" />
                  <DSRow label="Bath Operating Temperature (clean)"
                    v1={f2((s2 as any)?.T_bath_C ?? (s3 as any)?.T_bath_C)} unit="°C" />
                  <DSRow label="Bath Fluid" v1="MEG-Water Mixture" />
                  <DSRow label="Calculated Pressure Drop"
                    v1={f4(s3?.dP_kPa ? s3.dP_kPa/100 : undefined)} unit="bar" />
                  <DSRow label="Inside Film Coefficient" v1={f(s3?.U_Wm2K ? s3.U_Wm2K*0.6 : undefined, 1)}
                    unit="W/m²·°C" />
                  <DSRow label="Outside Film Coefficient" v1={f(s3?.U_Wm2K ? s3.U_Wm2K*0.85 : undefined, 1)}
                    unit="W/m²·°C" />
                  <DSRow label="Overall Heat Transfer Coeff (fouled)" bold
                    v1={f(s3?.U_Wm2K, 1)} unit="W/m²·°C" />
                  <DSRow label="LMTD" v1={f2(s3?.LMTD)} unit="°C" />
                  <DSRow label="Process Coil Fluid Velocity"
                    v1={f2((s3 as any)?.v_inlet_ms)} v2={f2((s3 as any)?.v_outlet_ms)} unit="m/s" />
                  <DSRow label="Shell Design Pressure" v1="Atmospheric + Liquid Head" />
                  <DSRow label="Shell Design Temperature (max/min)" v1="100 / 0" unit="°C" />
                  <DSRow label="Process Coil Design Pressure"
                    v1={f2(s3?.t_press !== undefined ? (s1?.P_des ? s1.P_des/100-1.01325 : undefined) : undefined)}
                    unit="barg" />
                  <DSRow label="Process Coil Design Temperature"
                    v1={s3 ? `${(s1 as any)?.T_des_C ?? 100} / -29` : '—'} unit="°C" />
                  <DSRow label="Process Coil Configuration" v1="Serpentine Coil Multiple Flow Path" />
                  <DSRow label={`ASME 'U' Code Stamp [Process Coil]`} v1="YES" />
                </DSSection>

                {/* SECTION 3: CONSTRUCTION */}
                <DSSection title="3 — Construction">
                  <DSRow label="Radiography — pressure parts" v1="100" unit="%" />
                  <DSRow label="Post Weld Heat Treatment" v1="Per Code" />
                  <DSRow label="HEATER SHELL" sub="(Insulated 50mm thk)" />
                  <DSRow label="Outside Diameter" bold
                    v1={sketcher ? String(sketcher.shellOD_mm) : f0(s2?.OD_shell_mm)}
                    unit="mm" sub={sketcher ? "Geometric (Shell Sketcher)" : "Estimated (thermal basis)"} />
                  <DSRow label="Overall Shell Length" v1={f0(s2?.L_shell_mm)} unit="mm" />
                  <DSRow label="Shell Thickness" v1="10" unit="mm" />
                  <DSRow label="End Plate Thickness — coil / fire tubes" v1="16 / 16" unit="mm" />
                  <DSRow label="Corrosion Allowance" v1="0" unit="mm" />
                  <DSRow label="Material" v1={shellMatLabel} sub={`CA: ${shellCA} mm`} />
                  <DSRow label="PROCESS COIL" sub="" />
                  <DSRow label="Number of Flow Paths" v1={f0(s3?.n_pass)} />
                  <DSRow label="Number of Passes per Flow Path" v1={f0(s3?.n_rows)} />
                  <DSRow label="Straight Length per Pass" v1={f2(s3?.L_leg ? s3.L_leg*1000 : undefined)} unit="mm" />
                  <DSRow label="Nominal Pipe Size / Schedule"
                    v1={sketcher ? `${sketcher.coilNPS} / Sch ${s3?.sched?.nm ?? '80'}` : '—'} />
                  <DSRow label="Total Surface Area — calc / required / available"
                    v1={s3 ? `${f2(s3.Ac_design)} / ${f2(s3.Ac_actual)}` : '—'} unit="m²" />
                  <DSRow label="% Total Oversurface" v1={f2(s3?.area_margin_pct)} unit="%" />
                  <DSRow label="Corrosion Allowance — inside / outside" v1="0 / 0" unit="mm" />
                  <DSRow label="Material (Pipe / Fittings)"
                    v1={coilMat} />
                  <DSRow label="HEADERS / TERMINAL POINTS" sub="" />
                  <DSRow label="Inlet / Outlet Header Size"
                    v1={s3 ? `DN${Math.max(200, (s3.n_pass ?? 1) * 100)} / Sch 80` : 'DN400 / Sch 80'} />
                  <DSRow label="Flange Rating" v1="ASME Class 600 / RFWN" />
                  <DSRow label="Header Material" v1={headerMat} />
                  <DSRow label="FIRE TUBE & EXHAUST STACK" sub="" />
                  <DSRow label="Burner Type / Model" bold
                    v1={`Gas Fired – ${s2?.pipe ? 'Forced Draft' : 'Natural Draft'}`} />
                  <DSRow label="Fire Tube Style"
                    v1={s2?.nPass === 4 ? 'U-Tube – 4 Pass' : 'U-Tube – 2 Pass'} />
                  <DSRow label="No. of Fire Tubes"
                    v1={s2?.nBurners ? `${s2.nBurners} × ${Math.round(100/s2.nBurners)}% capacity` : '—'} />
                  <DSRow label="Fire Tube NB / Thickness"
                    v1={sketcher ? `${sketcher.fireOD_mm.toFixed(0)} / Sch 10` : '—'} unit="NB / mm" />
                  <DSRow label="Total Fire Tube Centreline Length"
                    v1={f2(s2?.L ? s2.L * s2.nPass * s2.nBurners : undefined)} unit="m" />
                  <DSRow label="Average Fire Tube Outside Heat Flux"
                    v1={f2(s2?.heatFlux_kWm2)} unit="kW/m²"
                    sub={`API 12K limit: 37.9 kW/m² — ${s2?.fluxOK ? '✔ PASS' : '✘ FAIL'}`} />
                  <DSRow label="Fire Tube Material" v1={fireMatLabel} />
                  <DSRow label="Exhaust Stack Material" v1="API 5L ERW Grade B / ASTM A234 WPB" />
                </DSSection>

                {/* SECTION 4: COMBUSTION (from Stage 2 blower if available) */}
                <DSSection title="4 — Combustion Data">
                  <DSRow label="Fuel Gas HHV"
                    v1={f2(s1?.heatingValues?.HHV_kJkg ? s1.heatingValues.HHV_kJkg/1000 : undefined)} unit="MJ/kg" />
                  <DSRow label="Fuel Gas LHV"
                    v1={f2(s1?.heatingValues?.LHV_kJkg ? s1.heatingValues.LHV_kJkg/1000 : undefined)} unit="MJ/kg" />
                  <DSRow label="Excess Air Level" v1="15 – 25" unit="%" />
                  <DSRow label="Stoichiometric AFR (mass)" v1="17.2" unit="kg air/kg fuel" />
                  <DSRow label="Fuel Flow Rate (HHV basis)"
                    v1={f2(s2?.m_fuel_kghr)} unit="kg/hr" />
                  <DSRow label="Fuel Volume Flow"
                    v1={f2(s2?.V_fuel_Nm3hr)} unit="Nm³/hr" />
                  <DSRow label="Stack Bottom Temperature"
                    v1={f0(s2?.T_stack_est)} unit="°C" />
                  <DSRow label="Stack Gas Velocity"
                    v1={f2(s2?.stackVelocity_ms)} unit="m/s" />
                </DSSection>

                {/* SECTION 5: GAS COMPOSITION */}
                <DSSection title="5 — Gas Composition (mol %)">
                  {s1 ? (() => {
                    const COMP_LABELS = ['CH₄','C₂H₆','C₃H₈','iC₄','nC₄','iC₅','nC₅','nC₆','nC₇',
                      'N₂','CO₂','H₂S','He','H₂'];
                    const comp = (s1 as any).composition ?? [];
                    return COMP_LABELS.map((label, i) => {
                      const molFrac = Array.isArray(comp) ? (comp[i] ?? 0) : 0;
                      if (molFrac < 0.0001) return null;
                      return (
                        <DSRow key={label} label={label}
                          v1={(molFrac * 100).toFixed(4)} unit="mol%" />
                      );
                    });
                  })() : <DSRow label="Run Stage 1 to populate gas composition" />}
                  <DSRow label="Molecular Weight" bold v1={f2(s1?.MW)} unit="g/mol" />
                </DSSection>

                {/* SECTION 6: NOZZLE SCHEDULE */}
                <DSSection title="6 — Nozzle Schedule">
                  <tr>
                    <td style={{ padding:'4px 10px', fontSize:10, fontWeight:700,
                      color:'var(--text-dim)', textTransform:'uppercase' }}>Service</td>
                    <td style={{ padding:'4px 10px', fontSize:10, fontWeight:700,
                      color:'var(--text-dim)', textTransform:'uppercase' }}>Size</td>
                    <td style={{ padding:'4px 10px', fontSize:10, fontWeight:700,
                      color:'var(--text-dim)', textTransform:'uppercase' }}>Type</td>
                    <td style={{ padding:'4px 10px', fontSize:10, fontWeight:700,
                      color:'var(--text-dim)', textTransform:'uppercase' }}>Rating</td>
                  </tr>
                  {[
                    { id:'N1',  svc:'Process Gas Inlet',                size:'DN400',  type:'ASME B16.5 RFWN', rating:'600#' },
                    { id:'N2',  svc:'Process Gas Outlet',               size:'DN400',  type:'ASME B16.5 RFWN', rating:'600#' },
                    { id:'N3',  svc:'Level Switch (expansion tank)',     size:'DN40',   type:'ASME B16.5 RFWN', rating:'150#' },
                    { id:'N4',  svc:'Fuel Gas Outlet',                  size:'DN25',   type:'ASME B16.5 RFWN', rating:'600#' },
                    { id:'N5',  svc:'Shell Drain',                      size:'DN50',   type:'Plugged',          rating:'BSP' },
                    { id:'N6',  svc:'Overflow (expansion tank)',         size:'DN50',   type:'Flange',           rating:'BSPF' },
                    { id:'N7',  svc:'Water Bath Fill Point',            size:'DN50',   type:'Plugged',          rating:'BSP' },
                    { id:'N8',  svc:'Level Gauge (×2)',                  size:'DN25',   type:'—',                rating:'BSP' },
                    { id:'N9',  svc:'Shell / Bath Thermowells (×3)',     size:'DN40',   type:'ASME B16.5',       rating:'150#' },
                    { id:'N10', svc:'FG Pre-heat Coil Inlet / Outlet',  size:'DN25',   type:'ASME B16.5 RFWN', rating:'600#' },
                    { id:'BNR', svc:'Burner Assembly',                   size:'—',      type:'See burner tab',   rating:'—' },
                    { id:'STK', svc:'Exhaust Stack',                     size:'DN250',  type:'API 5L ERW Gr B', rating:'—' },
                  ].map(n => (
                    <tr key={n.id} style={{ borderBottom:'1px solid rgba(180,190,200,0.1)' }}>
                      <td style={{ padding:'4px 10px', fontSize:11 }}>
                        <span style={{ fontFamily:'var(--mono)', fontWeight:700,
                          color:'var(--accent)', marginRight:8 }}>{n.id}</span>
                        {n.svc}
                      </td>
                      <td style={{ padding:'4px 10px', fontFamily:'var(--mono)', fontSize:11 }}>{n.size}</td>
                      <td style={{ padding:'4px 10px', fontSize:10, color:'var(--text-dim)' }}>{n.type}</td>
                      <td style={{ padding:'4px 10px', fontSize:10, color:'var(--text-dim)' }}>{n.rating}</td>
                    </tr>
                  ))}
                </DSSection>

                {/* SECTION 7: COMPLIANCE CHECKS */}
                <DSSection title="7 — Standards Compliance">
                  {[
                    { std:'API 12K',      desc:'Heat flux ≤ 37.9 kW/m²',   ok: s2?.fluxOK },
                    { std:'AS 3814',      desc:'Volumetric heat release',   ok: (s2 as any)?.volumetricHeatReleaseOK },
                    { std:'AS 1228',      desc:'Linear heat intensity',     ok: (s2 as any)?.linearHeatReleaseOK },
                    { std:'ASME B31.3',   desc:'Wall thickness adequate',   ok: s3?.area_adequate },
                    { std:'NACE MR0175',  desc:'Sour service assessment',   ok: s1 ? (parseFloat(Object.values(s1 as any).join('')) >= 0 ? true : undefined) : undefined },
                  ].map(row => (
                    <tr key={row.std} style={{ borderBottom:'1px solid rgba(180,190,200,0.1)' }}>
                      <td style={{ padding:'4px 10px', fontFamily:'var(--mono)', fontSize:11, fontWeight:700,
                        color:'var(--accent)' }}>{row.std}</td>
                      <td colSpan={2} style={{ padding:'4px 10px', fontSize:11 }}>{row.desc}</td>
                      <td style={{ padding:'4px 10px', fontWeight:700,
                        color: row.ok === true ? 'var(--green)' : row.ok === false ? 'var(--red)' : 'var(--text-dim)' }}>
                        {row.ok === true ? '✔ PASS' : row.ok === false ? '✘ FAIL' : '— n/a'}
                      </td>
                    </tr>
                  ))}
                </DSSection>

              </tbody>
            </table>
          </div>
        </div>

        {/* ── VESSEL SKETCHES ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          {/* Longitudinal */}
          <div className="panel" style={{ gridColumn:'1/-1' }}>
            <div className="panel-header">
              <div className="panel-title">Vessel Longitudinal View (Schematic)</div>
              <div style={{ fontSize:10, color:'var(--text-dim)', marginLeft:'auto' }}>
                Not to scale — for proposal reference only
              </div>
            </div>
            <div className="panel-body">
              <LongitudinalSketch s2={s2} s3={s3} sketcher={sketcher} />
            </div>
          </div>

          {/* Key parameters summary cards */}
          <div className="panel">
            <div className="panel-header"><div className="panel-title">Key Design Parameters</div></div>
            <div className="panel-body">
              <table style={{ width:'100%', fontSize:11, borderCollapse:'collapse' }}>
                <tbody>
                  {[
                    ['Shell OD (confirmed)', sketcher ? `${sketcher.shellOD_mm} mm` : f0(s2?.OD_shell_mm) + ' mm (est.)',
                      sketcher ? 'var(--green)' : 'var(--accent)'],
                    ['Shell Length', f0(s2?.L_shell_mm) + ' mm', 'var(--text)'],
                    ['Process Duty Q', f(s1?.Q_final, 1) + ' kW', 'var(--accent)'],
                    ['LMTD', f2(s3?.LMTD) + ' °C', 'var(--text)'],
                    ['U Overall', f(s3?.U_Wm2K, 0) + ' W/m²·K', 'var(--text)'],
                    ['Heat Transfer Area', f2(s3?.Ac_actual) + ' m²', 'var(--green)'],
                    ['Area Margin', f2(s3?.area_margin_pct) + ' %', s3?.area_adequate ? 'var(--green)' : 'var(--red)'],
                    ['Coil ΔP', f2(s3?.dP_kPa) + ' kPa', s3?.dP_acceptable ? 'var(--green)' : 'var(--red)'],
                    ['Bath Volume', f0(s2?.bath_volume_L) + ' L', 'var(--text)'],
                    ['Fuel Consumption', f2(s2?.m_fuel_kghr) + ' kg/hr', 'var(--text)'],
                  ].map(([k, v, col]) => (
                    <tr key={k as string} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'5px 8px', color:'var(--text-dim)', width:'55%' }}>{k}</td>
                      <td style={{ padding:'5px 8px', fontFamily:'var(--mono)', fontWeight:700,
                        color: col as string }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Compliance quick check */}
          <div className="panel">
            <div className="panel-header"><div className="panel-title">Design Status</div></div>
            <div className="panel-body">
              {[
                { label:'Heat flux API 12K', ok: s2?.fluxOK, val: f2(s2?.heatFlux_kWm2) + ' kW/m²' },
                { label:'AS 3814 vol. release', ok: (s2 as any)?.volumetricHeatReleaseOK, val: '' },
                { label:'AS 1228 linear intensity', ok: (s2 as any)?.linearHeatReleaseOK, val: '' },
                { label:'Coil area adequate', ok: s3?.area_adequate, val: f2(s3?.area_margin_pct) + '% margin' },
                { label:'Coil ΔP acceptable', ok: s3?.dP_acceptable, val: f2(s3?.dP_kPa) + ' kPa' },
                { label:'Draft adequate', ok: s2?.draftOK, val: f2(s2?.P_available_Pa) + ' Pa avail' },
                { label:'B31.3 wall thickness', ok: s3?.t_nom !== undefined, val: f2(s3?.t_nom) + ' mm' },
              ].map(row => (
                <div key={row.label} style={{ display:'flex', justifyContent:'space-between',
                  alignItems:'center', padding:'5px 0',
                  borderBottom:'1px solid rgba(180,190,200,0.1)' }}>
                  <span style={{ fontSize:11 }}>{row.label}</span>
                  <span style={{ display:'flex', gap:8, alignItems:'center' }}>
                    {row.val && <span style={{ fontSize:10, color:'var(--text-dim)',
                      fontFamily:'var(--mono)' }}>{row.val}</span>}
                    <span style={{ fontSize:11, fontWeight:700,
                      color: row.ok === true ? 'var(--green)' : row.ok === false ? 'var(--red)' : 'var(--text-dim)' }}>
                      {row.ok === true ? '✔' : row.ok === false ? '✘' : '—'}
                    </span>
                  </span>
                </div>
              ))}
              {(!s1 || !s2 || !s3) && (
                <div className="note-box" style={{ marginTop:10, fontSize:10 }}>
                  Complete all stages to populate the full compliance check.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="panel">
          <div className="panel-header"><div className="panel-title">Notes</div></div>
          <div className="panel-body" style={{ fontSize:11, lineHeight:1.8 }}>
            <ol style={{ margin:0, paddingLeft:20, color:'var(--text-dim)' }}>
              <li>The flow rate of process gas through the process coil includes fuel gas flow rate required for the burner.</li>
              <li>Last pass of fire tube shall be slightly sloped downward. Stack elbow to have drain line with isolating valve.</li>
              <li>Shell OD shown is {sketcher ? 'geometric basis from Shell Sketcher (governing)' : 'estimated thermal basis — run Shell Sketcher to confirm'}.</li>
              <li>All calculations per API 12K, ASME B31.3, AS 3814, AS 1228. Refer to individual stage reports for detail.</li>
              <li>Sketch shown is schematic only — not for construction. Refer to issued GA drawings.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
