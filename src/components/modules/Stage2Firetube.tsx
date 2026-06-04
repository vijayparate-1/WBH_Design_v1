'use client';
// src/components/modules/Stage2Firetube.tsx
// Stage 2 — Firetube & Stack Sizing (API 12K / AS 3814)
// High-fidelity UI with draft buoyancy monitors and dynamic LHV overrides
// Updated to low-thermal-resistance Schedule 10 / Schedule 20 Combustion Tubes

import { useState } from 'react';
import ValidationPanel from '@/components/ui/ValidationPanel';
import { ResultCard, ResultGrid } from '@/components/ui/ResultCard';
import type { Stage1Results } from '@/lib/calculations/thermodynamics';

// ANSI/ASME B36.10M Standard Industrial Matrix for Combustion Tubes (Sch 10 / Sch 20)
// Wall thicknesses minimized to optimize overall heat transfer coefficient (U) while maintaining mechanical hoop stability
const INTERNAL_PIPE_TABLE = [
  { dn: 150, od: 168.3, thickness: 3.40, label: 'DN150 (6") Sch 10' },
  { dn: 200, od: 219.1, thickness: 4.78, label: 'DN200 (8") Sch 10' },
  { dn: 250, od: 273.1, thickness: 4.78, label: 'DN250 (10") Sch 10' },
  { dn: 300, od: 323.9, thickness: 4.78, label: 'DN300 (12") Sch 10' },
  { dn: 350, od: 355.6, thickness: 6.35, label: 'DN350 (14") Sch 20' },
  { dn: 400, od: 406.4, thickness: 6.35, label: 'DN400 (16") Sch 20' },
  { dn: 450, od: 457.0, thickness: 6.35, label: 'DN450 (18") Sch 20' },
  { dn: 500, od: 508.0, thickness: 6.35, label: 'DN500 (20") Sch 20' },
];

interface Props {
  s1Results?: Stage1Results;
  onComplete?: (results: any) => void;
}

interface S2Form {
  Q_net: string; burnerConfig: string; draftType: string;
  efficiency: string; burnerFactor: string;
  nPass: string; tubeLen: string; pipeDN: number;
  Tbath: string;
  stackAlt: string; stackTamb: string; stackTflue: string;
  excessAir: string; stackHeight: string; stackDia: string;
}

const DEFAULT_S2: S2Form = {
  Q_net: '400', burnerConfig: '2x75', draftType: 'natural',
  efficiency: '80', burnerFactor: '1.15',
  nPass: '2', tubeLen: '4.0', pipeDN: 400,
  Tbath: '62',
  stackAlt: '0', stackTamb: '15', stackTflue: '450',
  excessAir: '22.5', stackHeight: '4.0', stackDia: '355',
};

// SVG visual indicator comparing draft capabilities
function DraftBuoyancyMonitor({ available, required }: { available: number; required: number }) {
  if (!isFinite(available) || !isFinite(required) || available <= 0) return null;
  const maxVal = Math.max(available, required, 5.0) * 1.2;
  const W = 320, H = 60, pL = 10, pR = 10;
  const scale = (val: number) => pL + (val / maxVal) * (W - pL - pR);

  return (
    <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>
        Buoyancy Natural Draft Balance (Pa)
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
        {/* Required Draft Bar */}
        <rect x={pL} y={10} width={scale(required) - pL} height={12} fill="var(--red)" opacity={0.6} rx={2} />
        <text x={scale(required) + 4} y={20} fontSize={9} fill="var(--text-dim)" fontFamily="monospace">{required.toFixed(1)} Pa Req</text>
        
        {/* Available Draft Bar */}
        <rect x={pL} y={28} width={scale(available) - pL} height={12} fill={available >= required ? "var(--green)" : "var(--red)"} opacity={0.8} rx={2} />
        <text x={scale(available) + 4} y={38} fontSize={9} fill={available >= required ? "var(--green)" : "var(--red)"} fontFamily="monospace" fontWeight={700}>
          {available.toFixed(1)} Pa Avail
        </text>
      </svg>
    </div>
  );
}

export default function Stage2Firetube({ s1Results, onComplete }: Props) {
  const [form, setForm] = useState<S2Form>(DEFAULT_S2);
  const [results, setResults] = useState<any | null>(null);
  const [validation, setValidation] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof S2Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const syncFromS1 = () => {
    if (!s1Results) return;
    setForm(f => ({
      ...f,
      Q_net: s1Results.Q_final.toFixed(1),
    }));
  };

  const calculate = async () => {
    setLoading(true); setError('');
    try {
      const lhv_override = s1Results?.heatingValues?.LHV_kJkg ?? 47000;
      const mw_override = s1Results?.MW ?? 16.043;

      const selectedTube = INTERNAL_PIPE_TABLE.find(p => p.dn === form.pipeDN);

      const inputs = {
        Q_net_kW: parseFloat(form.Q_net),
        burnerConfig: form.burnerConfig,
        draftType: form.draftType,
        efficiency_pct: parseFloat(form.efficiency),
        burnerRatingFactor: parseFloat(form.burnerFactor),
        nPass: parseInt(form.nPass),
        tubeLengthM: parseFloat(form.tubeLen),
        pipeDN: form.pipeDN,
        tubeODMm: selectedTube?.od ?? 406.4,
        tubeWallMm: selectedTube?.thickness ?? 6.35,
        T_bath_C: parseFloat(form.Tbath),
        T_amb_C: parseFloat(form.stackTamb),
        stackAltM: parseFloat(form.stackAlt),
        T_flue_C: parseFloat(form.stackTflue),
        excessAir_pct: parseFloat(form.excessAir),
        stackHeightM: parseFloat(form.stackHeight),
        stackDiaMm: parseFloat(form.stackDia),
        lhvFuel_kJkg: lhv_override,
        mwFuel: mw_override
      };

      const res = await fetch('/api/calculations/stage2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs, Q_net_kW: parseFloat(form.Q_net) }),
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.results);
        setValidation(data.validation);
        onComplete?.(data.results);
      } else {
        setError(data.error ?? 'Calculation failed');
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const f1 = (v?: number) => v !== undefined && isFinite(v) ? v.toFixed(1) : '—';
  const f0 = (v?: number) => v !== undefined && isFinite(v) ? Math.round(v).toLocaleString() : '—';
  const f2 = (v?: number) => v !== undefined && isFinite(v) ? v.toFixed(2) : '—';

  const allValidation = validation
    ? Object.values(validation).flatMap((v: any) => v.messages || [])
    : [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* ── LEFT PANEL: CONFIGURATION INPUTS ── */}
      <div>
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="panel-header"><div className="panel-title">Heater Configuration — API 12K Parameters</div></div>
          <div className="panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="field-label">Net Process Duty (Q_net)</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="number" value={form.Q_net} onChange={set('Q_net')} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>kW</span>
                </div>
                {s1Results && (
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 4, fontSize: 10 }} onClick={syncFromS1}>
                    ← Pull Stage 1 Duty ({s1Results.Q_final.toFixed(1)} kW)
                  </button>
                )}
              </div>
              <div>
                <label className="field-label">Burner Configuration</label>
                <select value={form.burnerConfig} onChange={set('burnerConfig')}>
                  <option value="1x100">1×100% — Single Burner Assembly</option>
                  <option value="2x50">2×50% — Dual 50% Stream</option>
                  <option value="2x75">2×75% — Dual 75% Array (Standard WBH)</option>
                  <option value="2x100">2×100% — Dual 100% Redundancy</option>
                </select>
              </div>
              <div>
                <label className="field-label">Thermal Efficiency (η)</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="number" value={form.efficiency} step="1" min="50" max="95" onChange={set('efficiency')} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>%</span>
                </div>
              </div>
              <div>
                <label className="field-label">AS 3814 Rating Factor</label>
                <input type="number" value={form.burnerFactor} step="0.05" min="1.0" max="1.5" onChange={set('burnerFactor')} />
              </div>
              <div>
                <label className="field-label">Combustion Draft Layout</label>
                <select value={form.draftType} onChange={set('draftType')}>
                  <option value="natural">Natural Stack Buoyancy (Atmospheric)</option>
                  <option value="forced">Forced Draft (Mechanical Fan)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Target Water Bath Temp</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="number" value={form.Tbath} step="1" onChange={set('Tbath')} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>°C</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="panel-header"><div className="panel-title">Firetube Geometric Envelope</div></div>
          <div className="panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label className="field-label">Structural Tube Passes</label>
                <select value={form.nPass} onChange={set('nPass')}>
                  <option value="2">2-Pass (U-Tube Layout)</option>
                  <option value="4">4-Pass Design (High Duty / Compact)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Segment Linear Length (L)</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="number" value={form.tubeLen} step="0.25" min="1" max="12" onChange={set('tubeLen')} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>m</span>
                </div>
              </div>
            </div>

            <label className="field-label" style={{ marginBottom: 6 }}>Combustion Tube Specification (Light Wall Sch 10/20)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(105px,1fr))', gap: 6 }}>
              {INTERNAL_PIPE_TABLE.map(p => (
                <button
                  key={p.dn}
                  onClick={() => setForm(f => ({ ...f, pipeDN: p.dn }))}
                  style={{
                    background: form.pipeDN === p.dn ? 'rgba(176,96,0,0.12)' : 'var(--panel2)',
                    border: `1px solid ${form.pipeDN === p.dn ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 4, padding: '6px', cursor: 'pointer', textAlign: 'center',
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: 11 }}>DN{p.dn}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-dim)' }}>{p.od} mm OD</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--accent)' }}>t={p.thickness}mm</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><div className="panel-title">Stack Draft Sizing (AS 3814 / API 12K)</div></div>
          <div className="panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {[
                { label: 'Site Elevation Height', key: 'stackAlt', unit: 'm ASL' },
                { label: 'Atmospheric Temp', key: 'stackTamb', unit: '°C' },
                { label: 'Exhaust Flue Gas Temp', key: 'stackTflue', unit: '°C' },
                { label: 'Excess Air Ratio', key: 'excessAir', unit: '%' },
                { label: 'Stack Total Height', key: 'stackHeight', unit: 'm' },
                { label: 'Stack Internal Diameter', key: 'stackDia', unit: 'mm' },
              ].map(fi => (
                <div key={fi.key}>
                  <label className="field-label">{fi.label}</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="number" value={form[fi.key as keyof S2Form] as string} onChange={set(fi.key as keyof S2Form)} />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{fi.unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={calculate} disabled={loading}>
              {loading ? '⏳ Executing Sizing Engine…' : '▶ Calculate Sizing & Stack'}
            </button>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL: COMPUTED ENGINEERING RESULTS ── */}
      <div>
        {error && <div className="alert alert-fail" style={{ marginBottom: 12 }}>❌ {error}</div>}
        {allValidation.length > 0 && <ValidationPanel messages={allValidation} title="Regulatory Warnings Check" />}

        {results ? (
          <>
            <div className="panel" style={{ marginBottom: 12 }}>
              <div className="panel-header"><div className="panel-title">API 12K Thermal Duty Cascades</div></div>
              <div className="panel-body">
                <ResultGrid cols={3}>
                  <ResultCard label="Q Net Process" value={results.Q_net_kW} unit="kW" decimals={1} variant="highlight" />
                  <ResultCard label="Q Gross Input" value={results.Q_gross_kW} unit="kW" decimals={1} />
                  <ResultCard label="Q Rated Nameplate" value={results.Q_burner_rated_kW} unit="kW" decimals={1} />
                </ResultGrid>
                
                <div style={{ marginTop: 8 }}>
                  <ResultGrid cols={2}>
                    <ResultCard label="Active Burners Count" value={results.nBurners} />
                    <ResultCard label="Stream Load per Burner" value={results.Q_per_burner_kW} unit="kW" decimals={1} />
                  </ResultGrid>
                </div>
              </div>
            </div>

            <div className="panel" style={{ marginBottom: 12 }}>
              <div className="panel-header"><div className="panel-title">WBH Vessel & Area Boundaries</div></div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="Vessel Shell OD" value={results.OD_shell_mm} unit="mm" decimals={0} variant="highlight" />
                  <ResultCard label="Vessel Shell Length" value={results.L_shell_mm} unit="mm" decimals={0} />
                  <ResultCard label="Glycol-Bath Vol" value={results.bath_volume_L} unit="Litres" decimals={0} />
                  <ResultCard label="Total Firetube Area" value={results.A_ft} unit="m²" decimals={2} />
                </ResultGrid>
              </div>
            </div>

            <div className="panel" style={{ marginBottom: 12, borderColor: results.fluxOK ? '' : 'var(--red)' }}>
              <div className="panel-header">
                <div className="panel-title" style={{ color: results.fluxOK ? 'var(--green)' : 'var(--red)' }}>
                  Heat Flux Compliance — API 12K §4.3 Limits
                </div>
              </div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="Calculated Heat Flux" value={results.heatFlux_kWm2} unit="kW/m²" decimals={1} variant={results.fluxOK ? 'green' : 'red'} />
                  <ResultCard label="Heat Flux (Imperial)" value={results.heatFlux_BTUhrft2} unit="BTU/hr·ft²" decimals={0} variant={results.fluxOK ? 'green' : 'red'} />
                </ResultGrid>
                <div className={`alert ${results.fluxOK ? 'alert-ok' : 'alert-fail'}`} style={{ marginTop: 8 }}>
                  {results.fluxOK
                    ? `✔ Engineering Check Passed: Heat flux (${results.heatFlux_kWm2?.toFixed(1)} kW/m²) complies with the API 12K safety ceiling of 37.9 kW/m².`
                    : `✘ EXCEEDS REGULATORY CEILING: Heat flux (${results.heatFlux_kWm2?.toFixed(1)} kW/m²) violates API 12K constraints. Expand firetube DN size or leg length immediately to avoid local glycol degradation.`
                  }
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title">Buoyancy Draft Exhaust Dynamics</div></div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="Natural Draft Avail." value={results.P_available_Pa} unit="Pa" decimals={1} variant={results.draftOK ? 'green' : 'red'} />
                  <ResultCard label="System Flow Friction Pa" value={results.P_required_Pa} unit="Pa" decimals={1} />
                  <ResultCard label="Linear Stack Velocity" value={results.stackVelocity_ms} unit="m/s" decimals={1} />
                  <ResultCard label="Dynamic Fuel Demand" value={results.m_fuel_kghr} unit="kg/hr" decimals={1} variant="highlight" />
                </ResultGrid>
                
                <DraftBuoyancyMonitor available={results.P_available_Pa} required={results.P_required_Pa} />

                <div className={`alert ${results.draftOK ? 'alert-ok' : 'alert-fail'}`} style={{ marginTop: 8 }}>
                  {results.draftOK 
                    ? '✔ Hydrodynamic Stability Stable: Natural buoyancy head overrides system flow impedance resistances safely.' 
                    : '✘ STACK BOUYANCV IMPEDANCE FAILURE: Insufficient stack natural draft draft. Increase vertical stack height or scale chimney diameter to avoid exhaust flame rollout warnings.'
                  }
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="panel">
            <div className="panel-body" style={{ color: 'var(--text-dim)', padding: '32px 0', textAlign: 'center' }}>
              Configure processing input dimensions and click <strong>Calculate Sizing & Stack</strong>.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
