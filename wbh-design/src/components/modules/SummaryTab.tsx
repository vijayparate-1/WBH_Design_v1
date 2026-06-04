'use client';
// src/components/modules/SummaryTab.tsx

import { ResultCard, ResultGrid } from '@/components/ui/ResultCard';
import type { Stage1Results } from '@/lib/calculations/thermodynamics';
import type { Stage2Results, Stage3Results } from '@/lib/calculations/heater-sizing';

interface DesignState { s1?: Stage1Results; s2?: Stage2Results; s3?: Stage3Results; }

export default function SummaryTab({ design }: { design: DesignState }) {
  const { s1, s2, s3 } = design;
  const f = (v: number | undefined, d = 1) => v !== undefined && isFinite(v) ? v.toFixed(d) : '—';

  if (!s1 && !s2 && !s3) {
    return (
      <div className="panel">
        <div className="panel-body">
          <div className="alert alert-info">
            ℹ Complete Stages 1, 2 and 3 calculations to generate summary.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-title">Design Summary — Water Bath Heater</div>

      {s1 && (
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header"><div className="panel-title">Stage 1 — Gas Properties</div></div>
          <div className="panel-body">
            <ResultGrid cols={4}>
              <ResultCard label="Process Duty Q" value={s1.Q_final} unit="kW" decimals={1} variant="highlight" />
              <ResultCard label="MW mix" value={s1.MW} unit="g/mol" decimals={3} />
              <ResultCard label="Spec Gravity" value={s1.SG} decimals={4} />
              <ResultCard label="Hydrate T" value={s1.hydrateT_C} unit="°C" decimals={1}
                variant={s1.T_out_C && s1.hydrateT_C >= s1.T_out_C ? 'red' : 'green'} />
              <ResultCard label="Cp (M5 inlet)" value={s1.ST_in?.Cp5_kgK} unit="kJ/(kg·K)" decimals={4} />
              <ResultCard label="Z inlet" value={s1.ST_in?.Z} decimals={4} />
              <ResultCard label="ρ inlet" value={s1.ST_in?.rho} unit="kg/m³" decimals={3} />
              <ResultCard label="Calc Method" value={s1.Q_method} />
            </ResultGrid>
          </div>
        </div>
      )}

      {s2 && (
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header"><div className="panel-title">Stage 2 — Firetube & Shell</div></div>
          <div className="panel-body">
            <ResultGrid cols={4}>
              <ResultCard label="Shell OD" value={s2.OD_shell_mm} unit="mm" decimals={0} variant="highlight" />
              <ResultCard label="Shell Length" value={s2.L_shell_mm} unit="mm" decimals={0} />
              <ResultCard label="Firetube" value={`${s2.n_tubes}×DN${s2.pipe?.dn} ${s2.nPass}-pass`} />
              <ResultCard label="Heat Flux" value={s2.heatFlux_kWm2} unit="kW/m²" decimals={1}
                variant={s2.fluxOK ? 'green' : 'red'} />
              <ResultCard label="Q Gross" value={s2.Q_gross_kW} unit="kW" decimals={1} />
              <ResultCard label="Fuel Flow" value={s2.m_fuel_kghr} unit="kg/hr" decimals={1} />
              <ResultCard label="Draft" value={s2.draftOK ? 'PASS' : 'FAIL'}
                variant={s2.draftOK ? 'green' : 'red'} />
              <ResultCard label="Bath Volume" value={s2.bath_volume_L} unit="L" decimals={0} />
            </ResultGrid>
          </div>
        </div>
      )}

      {s3 && (
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header"><div className="panel-title">Stage 3 — Process Coil</div></div>
          <div className="panel-body">
            <ResultGrid cols={4}>
              <ResultCard label="Coil Length" value={s3.L_total} unit="m" decimals={1} variant="highlight" />
              <ResultCard label="Area Actual" value={s3.Ac_actual} unit="m²" decimals={2}
                variant={s3.area_adequate ? 'green' : 'red'} />
              <ResultCard label="LMTD" value={s3.LMTD} unit="°C" decimals={1} />
              <ResultCard label="ΔP Coil" value={s3.dP_kPa} unit="kPa" decimals={1}
                variant={s3.dP_acceptable ? 'default' : 'red'} />
              <ResultCard label="Pipe" value={`NPS ${s3.nps_k} Sch ${s3.sched?.nm}`} />
              <ResultCard label="Geometry" value={`${s3.n_pass}×${s3.n_rows} rows`} />
              <ResultCard label="Flange Class" value={`Class ${s3.flangeClass}`} />
              <ResultCard label="Area Margin" value={s3.area_margin_pct} unit="%" decimals={1}
                variant={s3.area_adequate ? 'green' : 'red'} />
            </ResultGrid>
          </div>
        </div>
      )}

      <div className="note-box">
        <strong>Summary generated from current session calculations.</strong> Save project to DB to persist this summary against the job number.
        All values are engineering estimates — confirm against certified drawings and detailed stress analysis.
      </div>
    </div>
  );
}
