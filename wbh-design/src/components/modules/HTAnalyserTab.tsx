'use client';
// src/components/modules/HTAnalyserTab.tsx
// HT Analyser — Nodal Thermal Profile + Coil Performance Chart

import { useState } from 'react';
import { ResultCard } from '@/components/ui/ResultCard';
import type { Stage1Results } from '@/lib/calculations/thermodynamics';
import type { Stage2Results, Stage3Results } from '@/lib/calculations/heater-sizing';

interface Props {
  s1Results?: Stage1Results;
  s2Results?: Stage2Results;
  s3Results?: Stage3Results;
}

interface NodalNode { x: number; T_g_in: number; Tb: number; T_wall: number; dQ: number; }

export default function HTAnalyserTab({ s1Results, s2Results, s3Results }: Props) {
  const [nodes, setNodes] = useState<NodalNode[] | null>(
    s3Results?.nodalProfile ?? null
  );

  // If Stage 3 has nodal data, use it; otherwise show prompt
  const profile = s3Results?.nodalProfile ?? nodes;

  // Inline SVG thermal profile chart
  function ThermalProfileChart({ data }: { data: NodalNode[] }) {
    if (data.length < 2) return null;
    const W = 560, H = 200, pL = 52, pB = 36, pT = 16, pR = 12;
    const cW = W - pL - pR, cH = H - pB - pT;
    const xs = data.map(d => d.x);
    const maxX = Math.max(...xs);
    const allT = data.flatMap(d => [d.T_g_in, d.Tb, d.T_wall]);
    const minT = Math.min(...allT) - 2, maxT = Math.max(...allT) + 2;

    const toX = (x: number) => pL + (x / maxX) * cW;
    const toY = (T: number) => pT + cH - (T - minT) / (maxT - minT) * cH;

    const linePath = (key: keyof NodalNode, col: string, dash?: string) => {
      const d = data.map((n, i) => `${i === 0 ? 'M' : 'L'}${toX(n.x).toFixed(1)},${toY(n[key] as number).toFixed(1)}`).join(' ');
      return <path d={d} fill="none" stroke={col} strokeWidth={1.8}
        strokeDasharray={dash} opacity={0.9} />;
    };

    const yTicks = 4;
    return (
      <div>
        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1,
          color:'var(--text-dim)', marginBottom:4 }}>Thermal Profile Along Coil</div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%' }}>
          {/* Grid */}
          {Array.from({ length: yTicks + 1 }, (_, i) => {
            const T = minT + (maxT - minT) * i / yTicks;
            const y = toY(T);
            return (
              <g key={i}>
                <line x1={pL} y1={y} x2={pL + cW} y2={y}
                  stroke="rgba(180,190,200,0.3)" strokeWidth={0.5} />
                <text x={pL - 4} y={y + 4} textAnchor="end" fontSize={9}
                  fill="var(--text-dim)" fontFamily="monospace">{T.toFixed(1)}</text>
              </g>
            );
          })}
          {/* X axis ticks */}
          {data.filter((_, i) => i % 2 === 0).map(n => (
            <g key={n.x}>
              <line x1={toX(n.x)} y1={pT + cH} x2={toX(n.x)} y2={pT + cH + 4}
                stroke="var(--border)" strokeWidth={0.5} />
              <text x={toX(n.x)} y={H - 4} textAnchor="middle" fontSize={9}
                fill="var(--text-dim)" fontFamily="monospace">{n.x.toFixed(1)}m</text>
            </g>
          ))}
          {/* Lines */}
          {linePath('T_g_in', '#c04000')}
          {linePath('Tb', '#1a6ab8', '4,2')}
          {linePath('T_wall', '#0e7a3e', '2,2')}
          {/* Axis labels */}
          <text x={pL - 2} y={pT - 2} fontSize={9} fill="var(--text-dim)" fontFamily="sans-serif">°C</text>
          <text x={pL + cW} y={H - 2} fontSize={9} fill="var(--text-dim)" fontFamily="sans-serif" textAnchor="end">L [m]</text>
          {/* Legend */}
          {[
            { col:'#c04000', dash:undefined, label:'Gas temp T_g' },
            { col:'#1a6ab8', dash:'4,2',     label:'Bath temp T_b' },
            { col:'#0e7a3e', dash:'2,2',     label:'Wall temp T_w' },
          ].map((l, i) => (
            <g key={l.label} transform={`translate(${pL + 8 + i * 130}, ${pT + 8})`}>
              <line x1={0} y1={6} x2={20} y2={6} stroke={l.col} strokeWidth={2}
                strokeDasharray={l.dash} />
              <text x={24} y={10} fontSize={9} fill="var(--text-dim)" fontFamily="sans-serif">{l.label}</text>
            </g>
          ))}
        </svg>
      </div>
    );
  }

  // dQ profile bar chart
  function HeatDutyChart({ data }: { data: NodalNode[] }) {
    if (data.length < 2) return null;
    const W = 560, H = 140, pL = 52, pB = 36, pT = 16, pR = 12;
    const cW = W - pL - pR, cH = H - pB - pT;
    const vals = data.map(d => d.dQ);
    const maxV = Math.max(...vals) * 1.1;
    const bW = Math.floor(cW / data.length) - 2;

    return (
      <div style={{ marginTop:8 }}>
        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1,
          color:'var(--text-dim)', marginBottom:4 }}>Heat Duty per Node [kW]</div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%' }}>
          {[0, 0.5, 1].map(t => {
            const v = maxV * t;
            const y = pT + cH * (1 - t);
            return (
              <g key={t}>
                <line x1={pL} y1={y} x2={pL + cW} y2={y}
                  stroke="rgba(180,190,200,0.3)" strokeWidth={0.5} />
                <text x={pL - 4} y={y + 4} textAnchor="end" fontSize={9}
                  fill="var(--text-dim)" fontFamily="monospace">{v.toFixed(2)}</text>
              </g>
            );
          })}
          {data.map((n, i) => {
            const bH = (n.dQ / maxV) * cH;
            const x = pL + i * (cW / data.length) + 1;
            const y = pT + cH - bH;
            const pct = n.dQ / Math.max(vals[0], 0.001);
            const col = pct > 0.8 ? '#0e7a3e' : pct > 0.4 ? '#1a6ab8' : '#c04000';
            return (
              <g key={i}>
                <rect x={x} y={y} width={bW} height={bH} fill={col} opacity={0.75} rx={1} />
                <text x={x + bW/2} y={H - 6} textAnchor="middle" fontSize={8}
                  fill="var(--text-dim)" fontFamily="monospace">{i + 1}</text>
              </g>
            );
          })}
          <text x={pL + cW} y={pT - 2} textAnchor="end" fontSize={9}
            fill="var(--text-dim)" fontFamily="sans-serif">kW</text>
        </svg>
      </div>
    );
  }

  return (
    <div>
      <div className="section-title">HT Analyser — Nodal Thermal Profile</div>

      {!profile ? (
        <div className="alert alert-info">
          ℹ Complete Stage 3 Process Coil calculation to generate the 10-node thermal profile.
          The nodal profile maps gas temperature, bath temperature, and wall temperature
          along the coil length with step-by-step duty calculations.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:16 }}>
          <div>
            {/* Charts */}
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Coil Thermal Profile</div></div>
              <div className="panel-body">
                <ThermalProfileChart data={profile} />
                <HeatDutyChart data={profile} />
              </div>
            </div>

            {/* Summary stats */}
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Node Summary Table</div></div>
              <div className="panel-body" style={{ overflowX:'auto' }}>
                <table className="res-table" style={{ fontSize:11 }}>
                  <thead>
                    <tr>
                      <th>Node</th>
                      <th>Position</th>
                      <th style={{ color:'#c04000' }}>T_gas</th>
                      <th style={{ color:'#1a6ab8' }}>T_bath</th>
                      <th style={{ color:'#0e7a3e' }}>T_wall</th>
                      <th>ΔT drive</th>
                      <th>dQ</th>
                      <th>Cumul. Q</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.map((n, i) => {
                      const cumQ = profile.slice(0, i + 1).reduce((s, x) => s + x.dQ, 0);
                      const dT_drive = n.Tb - n.T_g_in;
                      return (
                        <tr key={i}>
                          <td style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{i + 1}</td>
                          <td style={{ fontFamily:'var(--mono)' }}>{n.x.toFixed(2)} m</td>
                          <td className="val">{n.T_g_in.toFixed(1)}°C</td>
                          <td style={{ color:'#1a6ab8', fontFamily:'var(--mono)', fontWeight:600 }}>{n.Tb.toFixed(1)}°C</td>
                          <td style={{ color:'#0e7a3e', fontFamily:'var(--mono)', fontWeight:600 }}>{n.T_wall.toFixed(1)}°C</td>
                          <td style={{ fontFamily:'var(--mono)', color: dT_drive < 5 ? 'var(--red)' : 'var(--text-dim)' }}>
                            {dT_drive.toFixed(1)}°C</td>
                          <td style={{ fontFamily:'var(--mono)', color:'var(--accent)', fontWeight:600 }}>{n.dQ.toFixed(3)} kW</td>
                          <td style={{ fontFamily:'var(--mono)' }}>{cumQ.toFixed(2)} kW</td>
                        </tr>
                      );
                    })}
                    <tr style={{ borderTop:'2px solid var(--accent)' }}>
                      <td colSpan={6} style={{ textAlign:'right', fontWeight:700, color:'var(--text-dim)' }}>Total Q</td>
                      <td style={{ fontFamily:'var(--mono)', color:'var(--accent)', fontWeight:700 }}>
                        {profile.reduce((s, n) => s + n.dQ, 0).toFixed(2)} kW
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div style={{ width:220 }}>
            <div className="panel">
              <div className="panel-header"><div className="panel-title">Performance</div></div>
              <div className="panel-body">
                <ResultCard label="Total Nodal Q" value={profile.reduce((s, n) => s + n.dQ, 0)} unit="kW" decimals={2} variant="highlight" />
                <div style={{ marginTop:8 }}>
                  <ResultCard label="Inlet Gas T" value={profile[0]?.T_g_in} unit="°C" decimals={1} />
                </div>
                <div style={{ marginTop:8 }}>
                  <ResultCard label="Outlet Gas T" value={profile[profile.length-1]?.T_g_in} unit="°C" decimals={1} />
                </div>
                <div style={{ marginTop:8 }}>
                  <ResultCard label="Max Wall T" value={Math.max(...profile.map(n => n.T_wall))} unit="°C" decimals={1} />
                </div>
                <div style={{ marginTop:8 }}>
                  <ResultCard label="Min ΔT drive" value={Math.min(...profile.map(n => n.Tb - n.T_g_in))} unit="°C" decimals={1}
                    variant={Math.min(...profile.map(n => n.Tb - n.T_g_in)) < 3 ? 'red' : 'default'} />
                </div>
              </div>
            </div>

            {s3Results && (
              <div className="panel" style={{ marginTop:8 }}>
                <div className="panel-header"><div className="panel-title">Stage 3 Summary</div></div>
                <div className="panel-body" style={{ fontSize:11 }}>
                  <div style={{ display:'grid', gap:6 }}>
                    <ResultCard label="LMTD" value={s3Results.LMTD} unit="°C" decimals={1} />
                    <ResultCard label="Area actual" value={s3Results.Ac_actual} unit="m²" decimals={2} />
                    <ResultCard label="Area margin" value={s3Results.area_margin_pct} unit="%" decimals={1}
                      variant={s3Results.area_adequate ? 'green' : 'red'} />
                    <ResultCard label="Coil ΔP" value={s3Results.dP_kPa} unit="kPa" decimals={1}
                      variant={s3Results.dP_acceptable ? 'default' : 'red'} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="note-box" style={{ marginTop:12 }}>
        <strong>Nodal method:</strong> 10 equal-area steps along coil. Each node calculates local ΔT drive
        (bath−gas), heat transferred dQ = U·dA·ΔT, and updates gas temperature.
        The method validates that ΔT drive remains positive throughout — if it approaches zero near
        outlet, the coil area or bath temperature is insufficient. Wall temperature = gas T + 45%·ΔT_drive
        (inner convection approximation). Reference: GPSA §9; C-FER nodal approach.
      </div>
    </div>
  );
}
