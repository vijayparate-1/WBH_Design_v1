'use client';
// src/components/modules/BOMTab.tsx

import { useState } from 'react';
import type { Stage2Results, Stage3Results } from '@/lib/calculations/heater-sizing';

interface Props {
  s2Results?: Stage2Results;
  s3Results?: Stage3Results;
}

interface BOMRow {
  tag: string;
  item: string;
  material: string;
  size: string;
  qty: string;
  unit: string;
  supplierAUS: string;
  supplierMYS: string;
  notes: string;
}

function generateBOM(s2?: Stage2Results, s3?: Stage3Results): BOMRow[] {
  if (!s2 && !s3) return [];

  const shellOD = s2?.OD_shell_mm ?? 1716;
  const shellL  = s2?.L_shell_mm ?? 7650;
  const ftOD    = s2?.pipe?.od ?? 406.4;
  const ftL     = (s2?.L ?? 4) * (s2?.nPass ?? 2) * (s2?.n_tubes ?? 2);
  const coilOD  = s3 ? s3.do_m * 1000 : 88.9;
  const coilL   = s3?.L_total ?? 40;
  const nPaths  = s3?.n_pass ?? 3;
  const nRows   = s3?.n_rows ?? 8;

  const pi = Math.PI;
  const A_shell = pi * shellOD / 1000 * shellL / 1000;
  const A_ends  = 2 * pi / 4 * (shellOD / 1000) ** 2;

  return [
    { tag:'01', item:'Shell plate', material:'AS 1548-7-430 or A516 Gr 70',
      size:`10 mm × ${shellOD} mm OD`, qty:(A_shell).toFixed(2), unit:'m²',
      supplierAUS:'BlueScope / InfraBuild', supplierMYS:'A516 local stock', notes:'Cylindrical shell body' },
    { tag:'02', item:'End plates (2 off)', material:'AS 1548-7-430 or A516 Gr 70',
      size:'10 mm thick', qty:A_ends.toFixed(2), unit:'m²',
      supplierAUS:'BlueScope', supplierMYS:'A516 local', notes:'Flat heads + dished inserts' },
    { tag:'03', item:'Firetube pipe', material:'ASTM A53 Gr B / AS 1579',
      size:`OD ${ftOD.toFixed(0)} mm`, qty:ftL.toFixed(1), unit:'m',
      supplierAUS:'Midalia / PipeLine Supplies', supplierMYS:'Kian Hup / indent', notes:`${s2?.n_tubes??2} tube(s) × ${(s2?.L??4).toFixed(1)} m` },
    { tag:'04', item:'Process coil pipe', material:s3?.mat_label ?? 'ASTM A106 Gr B',
      size:`NPS ${s3?.nps_k??'3"'} OD ${coilOD.toFixed(1)} WT ${s3?.wt_act?.toFixed(2)??'5.49'} mm`,
      qty:coilL.toFixed(1), unit:'m',
      supplierAUS:'Midalia Steel / Apex Steel', supplierMYS:'Kian Hup / A106 stock',
      notes:`${nPaths} paths × ${nRows} rows` },
    { tag:'05', item:'180° U-bend elbows', material:'ASTM A234 WPB',
      size:`NPS ${s3?.nps_k??'3"'} R=1.5D`, qty:String(nPaths * nRows / 2), unit:'Ea',
      supplierAUS:'Pipefittings Aus / Apex', supplierMYS:'Kian Hup / Cycle',
      notes:`${nPaths} paths × ${nRows/2} bends/path` },
    { tag:'06', item:'Inlet/outlet nozzles + flanges', material:'A106B pipe + ASTM A105 WNRF',
      size:`NPS per data sheet / Class ${s3?.flangeClass??'300'}`,
      qty:String(nPaths * 2), unit:'Sets',
      supplierAUS:'Midalia / Hansen Flanges', supplierMYS:'Local flange suppliers', notes:'Per flow path' },
    { tag:'07', item:'Saddle support plates', material:'AS/NZS 3678-350',
      size:'10 mm plate', qty:'2', unit:'Sets',
      supplierAUS:'BlueScope', supplierMYS:'Local plate', notes:'Welded saddle assemblies' },
    { tag:'08', item:'Expansion tank plate', material:'AS/NZS 3678-350',
      size:'6 mm plate', qty:'1', unit:'Set',
      supplierAUS:'BlueScope / InfraBuild', supplierMYS:'Mycron / Lion Steel', notes:'Rectangular expansion tank body' },
    { tag:'09', item:'Ceramic fibre blanket 75 mm', material:'96 kg/m³ Kaowool/Cerablanket',
      size:'75 mm × 300 mm wide rolls',
      qty:((A_shell + A_ends) * 1.15).toFixed(2), unit:'m²',
      supplierAUS:'Thermal Ceramics Australia', supplierMYS:'Thermal Ceramics Malaysia',
      notes:'+15% waste — shell + ends' },
    { tag:'10', item:'Cladding sheet', material:"Colorbond® Zincalume 0.75 BMT (AUS) / 304 SS 0.9 (MYS)",
      size:'Sheets per layout',
      qty:((A_shell + A_ends) * 1.10).toFixed(2), unit:'m²',
      supplierAUS:'BlueScope / Lysaght', supplierMYS:'Kian Hup SS sheet', notes:'+10% laps/waste' },
    { tag:'11', item:'Surface preparation + painting', material:'AS/NZS 3750 — 2-coat epoxy',
      size:'External surfaces',
      qty:(A_shell + A_ends).toFixed(2), unit:'m²',
      supplierAUS:'Wattyl / Dulux Protective Coatings', supplierMYS:'Nippon Paint / Jotun',
      notes:'Sa 2.5 blast + zinc primer + epoxy topcoat' },
  ];
}

export default function BOMTab({ s2Results, s3Results }: Props) {
  const [generated, setGenerated] = useState(false);
  const rows = generated ? generateBOM(s2Results, s3Results) : [];

  return (
    <div>
      <div className="section-title">Bill of Materials — Indicative Procurement List</div>

      {(!s2Results || !s3Results) && (
        <div className="alert alert-warn" style={{ marginBottom:12 }}>
          ⚠ Complete Stages 2 & 3 for accurate BOM quantities. Generating with estimated values.
        </div>
      )}

      <div style={{ marginBottom:16, display:'flex', gap:8 }}>
        <button className="btn btn-primary" onClick={() => setGenerated(true)}>
          ▶ Generate Bill of Materials
        </button>
        {generated && (
          <button className="btn btn-secondary" onClick={() => setGenerated(false)}>Reset</button>
        )}
      </div>

      {generated && rows.length > 0 && (
        <>
          {/* Summary cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:12 }}>
            {[
              { label:'Shell OD', value:`${s2Results?.OD_shell_mm ?? '—'} mm` },
              { label:'Shell Length', value:`${s2Results?.L_shell_mm ?? '—'} mm` },
              { label:'Coil Length', value:`${s3Results?.L_total?.toFixed(1) ?? '—'} m` },
              { label:'Total Items', value:`${rows.length}` },
            ].map(c => (
              <div key={c.label} className="result-card">
                <div className="result-label">{c.label}</div>
                <div className="result-value" style={{ fontSize:14 }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* BOM table */}
          <div style={{ overflowX:'auto' }}>
            <table className="res-table" style={{ fontSize:11, minWidth:900 }}>
              <thead>
                <tr>
                  <th>Tag</th><th>Item Description</th><th>Material Grade</th>
                  <th>Size / Spec</th><th>Qty</th><th>Unit</th>
                  <th style={{ color:'var(--blue)' }}>Supplier — AUS</th>
                  <th style={{ color:'var(--green)' }}>Supplier — MYS/ME</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.tag}>
                    <td style={{ fontFamily:'var(--mono)', color:'var(--accent)', fontWeight:700 }}>{r.tag}</td>
                    <td style={{ fontWeight:600 }}>{r.item}</td>
                    <td style={{ fontSize:10 }}>{r.material}</td>
                    <td style={{ fontFamily:'var(--mono)', fontSize:10 }}>{r.size}</td>
                    <td className="val">{r.qty}</td>
                    <td style={{ fontSize:10, color:'var(--text-dim)' }}>{r.unit}</td>
                    <td style={{ fontSize:10, color:'var(--blue)' }}>{r.supplierAUS}</td>
                    <td style={{ fontSize:10, color:'var(--green)' }}>{r.supplierMYS}</td>
                    <td style={{ fontSize:10, color:'var(--text-dim)' }}>{r.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="note-box" style={{ marginTop:12, fontSize:10 }}>
            <strong>BOM basis:</strong> Quantities derived from Stage 2 firetube geometry and Stage 3 coil geometry.
            All quantities are indicative for enquiry/procurement — confirm against final certified drawings.
            Add 10–15% for fabrication wastage on plates and pipe.
            Fasteners, instrumentation, nozzles for instruments, and piping connections not included — size separately per P&ID.
          </div>
        </>
      )}
    </div>
  );
}
