'use client';
// src/components/modules/ShellSketcherTab.tsx
// WBH Cross-Section Sketcher — ASME B16.9 Triangular Pitch Bundle
// Ported from wbh-shell-sketcher (vijayparate-1/wbh-shell-sketcher)
// Integrated with Stage 2 (firetube) + Stage 3 (coil) results for auto-population

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Stage2Results, Stage3Results } from '@/lib/calculations/heater-sizing';

// ─── ASME B16.9 180° Return Bend — SR/LR Center-to-Center ───────────────────
const PIPE_DATA: Record<number, { od:number; sr_ctoc:number; sr_btof:number; lr_ctoc:number; lr_btof:number }> = {
  10:  {od:33.4,  sr_ctoc:51,  sr_btof:41,  lr_ctoc:76,  lr_btof:56},
  13:  {od:42.2,  sr_ctoc:64,  sr_btof:52,  lr_ctoc:95,  lr_btof:70},
  15:  {od:48.3,  sr_ctoc:76,  sr_btof:62,  lr_ctoc:114, lr_btof:83},
  20:  {od:60.3,  sr_ctoc:102, sr_btof:81,  lr_ctoc:152, lr_btof:106},
  25:  {od:73.0,  sr_ctoc:127, sr_btof:100, lr_ctoc:190, lr_btof:132},
  30:  {od:88.9,  sr_ctoc:152, sr_btof:121, lr_ctoc:229, lr_btof:159},
  35:  {od:101.6, sr_ctoc:178, sr_btof:140, lr_ctoc:267, lr_btof:184},
  40:  {od:114.3, sr_ctoc:203, sr_btof:159, lr_ctoc:305, lr_btof:210},
  50:  {od:141.3, sr_ctoc:254, sr_btof:197, lr_ctoc:381, lr_btof:262},
  60:  {od:168.3, sr_ctoc:305, sr_btof:237, lr_ctoc:457, lr_btof:313},
  80:  {od:219.1, sr_ctoc:406, sr_btof:313, lr_ctoc:610, lr_btof:414},
  100: {od:273.1, sr_ctoc:508, sr_btof:391, lr_ctoc:762, lr_btof:518},
  120: {od:323.9, sr_ctoc:610, sr_btof:467, lr_ctoc:914, lr_btof:619},
};

const NPS_LABELS: Record<number, string> = {
  10:'1"', 13:'1¼"', 15:'1½"', 20:'2"', 25:'2½"',
  30:'3"', 35:'3½"', 40:'4"', 50:'5"', 60:'6"',
  80:'8"', 100:'10"', 120:'12"',
};

const WALL_THK: Record<number, Record<string, number>> = {
  10: {'Sch40':3.38,'Sch80':4.55,'XXS':6.35},
  13: {'Sch40':3.56,'Sch80':4.85,'XXS':7.14},
  15: {'Sch40':3.68,'Sch80':5.08,'Sch160':7.14,'XXS':7.62},
  20: {'Sch40':3.91,'Sch80':5.54,'Sch160':8.74,'XXS':11.07},
  25: {'Sch40':5.16,'Sch80':7.01,'Sch160':9.53,'XXS':14.02},
  30: {'Sch40':5.49,'Sch80':7.62,'Sch160':11.13,'XXS':15.24},
  35: {'Sch40':5.74,'Sch80':8.08,'XXS':16.15},
  40: {'Sch40':6.02,'Sch80':8.56,'Sch160':13.49,'XXS':17.12},
  50: {'Sch40':6.55,'Sch80':9.53,'Sch160':15.88,'XXS':19.05},
  60: {'Sch40':7.11,'Sch80':10.97,'Sch160':18.26,'XXS':21.95},
  80: {'Sch40':8.18,'Sch80':12.70,'Sch160':20.62,'XXS':22.23},
  100:{'Sch40':9.27,'Sch80':15.09,'Sch160':25.40,'XXS':25.40},
  120:{'Sch40':9.53,'Sch80':17.48,'Sch160':25.40,'XXS':25.40},
};

const FIRETUBE_OD: Record<number, Record<string, number>> = {
  150:{'Sch10':168.3,'Sch20':168.3}, 200:{'Sch10':219.1,'Sch20':219.1},
  250:{'Sch10':273.1,'Sch20':273.1}, 300:{'Sch10':323.9,'Sch20':323.9},
  350:{'Sch10':355.6,'Sch20':355.6}, 400:{'Sch10':406.4,'Sch20':406.4},
  450:{'Sch10':457.2,'Sch20':457.2}, 500:{'Sch10':508.0,'Sch20':508.0},
  600:{'Sch10':609.6,'Sch20':609.6},
};
const FIRETUBE_WALL: Record<number, Record<string, number>> = {
  150:{'Sch10':3.96,'Sch20':6.35}, 200:{'Sch10':4.19,'Sch20':6.35},
  250:{'Sch10':4.57,'Sch20':7.80}, 300:{'Sch10':5.16,'Sch20':8.38},
  350:{'Sch10':7.92,'Sch20':9.53}, 400:{'Sch10':7.92,'Sch20':9.53},
  450:{'Sch10':7.92,'Sch20':11.13}, 500:{'Sch10':9.53,'Sch20':12.70},
  600:{'Sch10':9.53,'Sch20':14.27},
};

const COIL_COLORS = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63','#00bcd4','#8bc34a'];

export interface SketcherResults {
  shellOD_mm: number;        // confirmed geometric shell OD (governs all downstream)
  shellID_mm: number;        // ID required
  vijayOD_mm: number;        // Vijay formula result
  coilNPS: string;           // NPS label
  coilOD_mm: number;
  coilWall_mm: number;
  nPipes: number;            // total coil pipes in cross-section
  fireOD_mm: number;
  firePasses: number;
  nBurners: number;
  pitch_mm: number;
  bendType: string;
}

interface Props {
  s2Results?: Stage2Results;
  s3Results?: Stage3Results;
  onComplete?: (r: SketcherResults) => void;
}

interface BurnerSystem {
  p1: {x:number; y:number};
  p2Angle: number; p3Angle: number; p4Angle: number;
}

// NPS key from OD (mm) — finds closest match
function npsFromOD(od_mm: number): number {
  let best = 30, bestDiff = Infinity;
  Object.entries(PIPE_DATA).forEach(([k, v]) => {
    const diff = Math.abs(v.od - od_mm);
    if (diff < bestDiff) { bestDiff = diff; best = parseInt(k); }
  });
  return best;
}

// Schedule key from wall thickness
function schedFromWT(npsKey: number, wt_mm: number): string {
  const scheds = WALL_THK[npsKey] ?? {};
  let bestSch = 'Sch80', bestDiff = Infinity;
  Object.entries(scheds).forEach(([s, w]) => {
    const d = Math.abs(w - wt_mm);
    if (d < bestDiff) { bestDiff = d; bestSch = s; }
  });
  return bestSch;
}

// Firetube DN from OD (mm)
function fireNbFromOD(od_mm: number): number {
  const dns = [150,200,250,300,350,400,450,500,600];
  let best = 200, bestDiff = Infinity;
  dns.forEach(dn => {
    const v = FIRETUBE_OD[dn]?.['Sch10'] ?? 0;
    const d = Math.abs(v - od_mm);
    if (d < bestDiff) { bestDiff = d; best = dn; }
  });
  return best;
}

export default function ShellSketcherTab({ s2Results, s3Results, onComplete }: Props) {
  // ── Auto-populate from Stage 2 & 3 ─────────────────────────────────────
  // Coil: from Stage 3 (pipe OD, wall thickness, nPaths=pipes/row, nRows)
  const initCoilNb = s3Results ? npsFromOD(s3Results.do_m * 1000) : 30;
  const initCoilSch = s3Results ? schedFromWT(initCoilNb, s3Results.wt_act) : 'Sch80';
  const initPasses = s3Results?.n_pass ?? 3;     // paths = pipes per row
  const initRows = s3Results?.n_rows ?? 4;       // rows in bundle

  // Firetube: from Stage 2 (pipe OD, nBurners, nPass)
  const initFireNb = s2Results ? fireNbFromOD(s2Results.OD * 1000) : 200;
  const initBurnerQty = s2Results?.nBurners ?? 2;
  const initFirePasses = s2Results?.nPass ?? 2;

  const [synced, setSynced] = useState(false);
  const [coilNb, setCoilNb] = useState(initCoilNb);
  const [coilSch, setCoilSch] = useState(initCoilSch);
  const [bendType, setBendType] = useState('SR');
  const [coilPasses, setCoilPasses] = useState(initPasses);
  const [coilRows, setCoilRows] = useState(initRows);
  const [layoutMode, setLayoutMode] = useState('Standard');
  const [zigzagAngle, setZigzagAngle] = useState(30);

  const [fireNb, setFireNb] = useState(initFireNb);
  const [fireSch, setFireSch] = useState('Sch10');
  const [burnerQty, setBurnerQty] = useState(initBurnerQty);
  const [firePasses, setFirePasses] = useState(initFirePasses);
  const [gapSide, setGapSide] = useState(75);
  const [clearA, setClearA] = useState(100);
  const [clearC, setClearC] = useState(120);
  const [clearD, setClearD] = useState(150);

  const [coilCenter, setCoilCenter] = useState({x:0, y:-90});

  // Notify parent whenever the confirmed shell OD changes
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const [burners, setBurners] = useState<BurnerSystem[]>([
    {p1:{x:-120,y:120}, p2Angle:150, p3Angle:60, p4Angle:-30},
    {p1:{x:120,y:120},  p2Angle:30,  p3Angle:120, p4Angle:210},
  ]);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{type:string; bIdx:number} | null>(null);
  const SVG_W = 800, SVG_H = 800;
  const cx = SVG_W/2, cy = SVG_H/2;

  // Sync button
  // Emit results whenever geometry changes (after render — values computed inline below)
  // We call this from the render computation area using a ref trick
  const lastOD = React.useRef(0);

  const syncFromDesign = () => {
    if (s3Results) {
      const nb = npsFromOD(s3Results.do_m * 1000);
      setCoilNb(nb);
      setCoilSch(schedFromWT(nb, s3Results.wt_act));
      setCoilPasses(s3Results.n_pass);
      setCoilRows(s3Results.n_rows);
    }
    if (s2Results) {
      setFireNb(fireNbFromOD(s2Results.OD * 1000));
      setBurnerQty(s2Results.nBurners);
      setFirePasses(s2Results.nPass);
    }
    setSynced(true);
  };

  // ── Pipe data lookups ────────────────────────────────────────────────────
  const pipeRow = PIPE_DATA[coilNb] ?? PIPE_DATA[30];
  const odCoil = pipeRow.od;
  const wallCoil = WALL_THK[coilNb]?.[coilSch] ?? 6.0;
  const idCoil = odCoil - 2 * wallCoil;
  const pitch = bendType === 'SR' ? pipeRow.sr_ctoc : pipeRow.lr_ctoc;
  const pv = Math.sin(Math.PI/3) * pitch;
  const shellClearance = coilNb <= 30 ? 125 : 175;

  // Vijay formula: shell radius from geometry
  const rowsArr = Array.from({length:coilRows}, (_, i) => i+1);
  const shellRadii = rowsArr.map(r => {
    const c = (coilPasses-1)*pitch + odCoil + 50;
    const h = pv*(r-1) + odCoil/2 + shellClearance;
    return (c*c + 4*h*h)/(8*h);
  });
  const calcShellRadius = Math.max(...shellRadii);
  const calcShellOD = Math.ceil((calcShellRadius*2 + 50)/50)*50;

  const odFire = FIRETUBE_OD[fireNb]?.[fireSch] ?? 219.1;
  const wallFire = FIRETUBE_WALL[fireNb]?.[fireSch] ?? 4.5;
  const cFire = PIPE_DATA[fireNb]?.sr_ctoc ?? fireNb*2;

  // ── Coil layout ──────────────────────────────────────────────────────────
  const getCoilPoints = () => {
    const pts: {x:number; y:number; r:number}[] = [];
    for (let r=0; r<coilRows; r++) {
      const shifted = r%2!==0;
      for (let c=0; c<coilPasses; c++) {
        let x: number, y: number;
        if (layoutMode === 'Zigzag') {
          const rad = zigzagAngle*Math.PI/180;
          const off = shifted ? pitch/2 : 0;
          x = c*pitch - (coilPasses-1)*pitch/2 + off;
          y = r*Math.sin(rad)*pitch - (coilRows-1)*Math.sin(rad)*pitch/2;
        } else {
          const off = shifted ? pitch/2 : 0;
          x = c*pitch - (coilPasses-1)*pitch/2 + off;
          y = (r-(coilRows-1)/2)*pv;
        }
        if (layoutMode === 'Split') x += (x>=0 ? pitch*0.6 : -pitch*0.6);
        if (layoutMode === 'Pyramid') {
          const nx = x/((coilPasses*pitch)/2), ny = y/((coilRows*pv)/2);
          if (nx*nx+ny*ny>1.0) continue;
        }
        pts.push({x:x+coilCenter.x, y:y+coilCenter.y, r:odCoil/2});
      }
    }
    return pts;
  };

  // ── Firetube layout ──────────────────────────────────────────────────────
  const getFirePoints = () => {
    const pts: {x:number; y:number; r:number; bIdx:number; pIdx:number}[] = [];
    const nB = Math.min(burnerQty, burners.length);
    for (let i=0; i<nB; i++) {
      const b = burners[i];
      pts.push({x:b.p1.x, y:b.p1.y, r:odFire/2, bIdx:i, pIdx:1});
      const r2 = b.p2Angle*Math.PI/180;
      const p2x = b.p1.x+cFire*Math.cos(r2), p2y = b.p1.y+cFire*Math.sin(r2);
      if (firePasses>=2) pts.push({x:p2x, y:p2y, r:odFire/2, bIdx:i, pIdx:2});
      const r3 = b.p3Angle*Math.PI/180;
      const p3x = p2x+cFire*Math.cos(r3), p3y = p2y+cFire*Math.sin(r3);
      if (firePasses>=4) pts.push({x:p3x, y:p3y, r:odFire/2, bIdx:i, pIdx:3});
      const r4 = b.p4Angle*Math.PI/180;
      const p4x = p3x+cFire*Math.cos(r4), p4y = p3y+cFire*Math.sin(r4);
      if (firePasses>=4) pts.push({x:p4x, y:p4y, r:odFire/2, bIdx:i, pIdx:4});
    }
    return pts;
  };

  const coilPoints = getCoilPoints();
  // Emit confirmed shell OD to parent — only when it changes
  React.useEffect(() => {
    if (onComplete && suggestedOD !== lastOD.current) {
      lastOD.current = suggestedOD;
      onComplete({
        shellOD_mm:  suggestedOD,
        shellID_mm:  Math.round(idRequired),
        vijayOD_mm:  calcShellOD,
        coilNPS:     NPS_LABELS[coilNb] ?? String(coilNb),
        coilOD_mm:   odCoil,
        coilWall_mm: wallCoil,
        nPipes:      coilPoints.length,
        fireOD_mm:   odFire,
        firePasses,
        nBurners:    burnerQty,
        pitch_mm:    pitch,
        bendType,
      });
    }
  }); // intentionally no dep array — runs on every render when suggestedOD changes
  const firePoints = getFirePoints();
  const allPts = [...coilPoints, ...firePoints.map(p=>({x:p.x,y:p.y,r:p.r}))];
  let maxExtent = 0;
  allPts.forEach(p => { const d=Math.sqrt(p.x*p.x+p.y*p.y)+p.r; if(d>maxExtent) maxExtent=d; });
  const idRequired = maxExtent*2 + 20;
  const suggestedOD = Math.ceil((idRequired+2*gapSide)/50)*50;
  const viewR = Math.max(suggestedOD, calcShellOD, 600)*1.15;
  const scale = SVG_W/viewR;
  const mm = (v:number) => v*scale;

  // ── Drag handling ────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent, type:string, bIdx:number) => {
    e.preventDefault(); dragRef.current = {type, bIdx};
  };
  const onMouseMove = useCallback((e:MouseEvent) => {
    if (!dragRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = (e.clientX-rect.left-cx)/scale, my = (e.clientY-rect.top-cy)/scale;
    const {type, bIdx} = dragRef.current;
    if (type==='coil') { setCoilCenter({x:mx, y:my}); }
    else if (type==='p1') { setBurners(prev=>prev.map((b,i)=>i===bIdx?{...b,p1:{x:mx,y:my}}:b)); }
    else if (type==='p2') { setBurners(prev=>prev.map((b,i)=>i===bIdx?{...b,p2Angle:Math.atan2(my-b.p1.y,mx-b.p1.x)*180/Math.PI}:b)); }
    else if (type==='p3') {
      const b = burners[bIdx];
      const p2x=b.p1.x+cFire*Math.cos(b.p2Angle*Math.PI/180), p2y=b.p1.y+cFire*Math.sin(b.p2Angle*Math.PI/180);
      setBurners(prev=>prev.map((b2,i)=>i===bIdx?{...b2,p3Angle:Math.atan2(my-p2y,mx-p2x)*180/Math.PI}:b2));
    }
  }, [burners, scale, cx, cy, cFire]);

  useEffect(() => {
    const up = () => { dragRef.current=null; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove',onMouseMove); window.removeEventListener('mouseup',up); };
  }, [onMouseMove]);

  // ── Live clearances ──────────────────────────────────────────────────────
  const shellR = idRequired/2;
  const coilYs = coilPoints.map(p=>p.y);
  const fireYs = firePoints.map(p=>p.y);
  const hiCoilY = coilYs.length ? Math.min(...coilYs)-odCoil/2 : 0;
  const loCoilY = coilYs.length ? Math.max(...coilYs)+odCoil/2 : 0;
  const hiFireY = fireYs.length ? Math.min(...fireYs)-odFire/2 : 0;
  const loFireY = fireYs.length ? Math.max(...fireYs)+odFire/2 : 0;
  const liveA = Math.max(0, shellR - loFireY);
  const liveC = Math.max(0, hiFireY - loCoilY);
  const liveD = Math.max(0, shellR + hiCoilY);
  const liveB = burnerQty===2 ? Math.abs(burners[0].p1.x - burners[1].p1.x) - odFire : 0;

  const clrOK = (v:number, min:number) => v >= min;

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div>
          <div className="section-title" style={{ margin:0, borderBottom:'none' }}>
            Shell Cross-Section Sketcher — ASME B16.9 Triangular Pitch Bundle
          </div>
          <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:2 }}>
            SR/LR 180° Return Bend · Vijay Shell Formula · Live Clearance Check
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:28, fontFamily:'var(--mono)', fontWeight:900,
            color: 'var(--green)' }}>{suggestedOD} mm</div>
          <div style={{ fontSize:10, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:1 }}>
            Shell OD (rounded ×50)
          </div>
          <div style={{ fontSize:10, color:'var(--text-dim)' }}>
            ID required: {idRequired.toFixed(0)} mm · Vijay formula: {calcShellOD} mm
          </div>
        </div>
      </div>

      {/* Sync banner */}
      {(s2Results || s3Results) && (
        <div className={`alert ${synced ? 'alert-ok' : 'alert-info'}`} style={{ marginBottom:12 }}>
          {synced
            ? `✔ Sketcher synced from Stage 2 (firetube DN${fireNb}, ${burnerQty}×${firePasses}-pass) and Stage 3 (NPS ${NPS_LABELS[coilNb]} ${coilSch}, ${coilPasses}×${coilRows} rows)`
            : `ℹ Stage 2 & 3 results available. Click "Sync from Design" to auto-populate firetube and coil geometry.`}
          {!synced && (
            <button className="btn btn-secondary btn-sm" style={{ marginLeft:12 }} onClick={syncFromDesign}>
              ← Sync from Design
            </button>
          )}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:16, alignItems:'start' }}>
        {/* ── CONTROLS ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

          {/* Process Coil */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title" style={{ color:'var(--accent)' }}>Process Coil Bundle</div>
            </div>
            <div className="panel-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div>
                  <label className="field-label">NPS (Pipe Size)</label>
                  <select value={coilNb} onChange={e => setCoilNb(Number(e.target.value))}>
                    {Object.keys(PIPE_DATA).map(n => (
                      <option key={n} value={n}>{NPS_LABELS[Number(n)] ?? n} — OD {PIPE_DATA[Number(n)].od} mm</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Schedule</label>
                  <select value={coilSch} onChange={e => setCoilSch(e.target.value)}>
                    {Object.keys(WALL_THK[coilNb] ?? {}).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Bend Type</label>
                  <select value={bendType} onChange={e => setBendType(e.target.value)}>
                    <option value="SR">SR 180° Short Radius</option>
                    <option value="LR">LR 180° Long Radius</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Layout Mode</label>
                  <select value={layoutMode} onChange={e => setLayoutMode(e.target.value)}>
                    <option value="Standard">60° Triangular Staggered</option>
                    <option value="Zigzag">Zigzag 30° Compact</option>
                    <option value="Split">Split Central Lane</option>
                    <option value="Pyramid">Pyramid Boundary</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Pipes / Row</label>
                  <input type="number" min="1" max="20" value={coilPasses}
                    onChange={e => setCoilPasses(Number(e.target.value))} />
                </div>
                <div>
                  <label className="field-label">Rows in Bundle</label>
                  <input type="number" min="1" max="12" value={coilRows}
                    onChange={e => setCoilRows(Number(e.target.value))} />
                </div>
              </div>
              {/* Geometry summary */}
              <div style={{ marginTop:8, background:'var(--panel2)', borderRadius:4, padding:'8px 10px',
                fontSize:11, fontFamily:'var(--mono)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                <span style={{ color:'var(--text-dim)' }}>OD:</span><span style={{ color:'var(--accent)' }}>{odCoil} mm</span>
                <span style={{ color:'var(--text-dim)' }}>Wall ({coilSch}):</span><span style={{ color:'var(--accent)' }}>{wallCoil.toFixed(2)} mm</span>
                <span style={{ color:'var(--text-dim)' }}>ID:</span><span style={{ color:'var(--green)' }}>{idCoil.toFixed(1)} mm</span>
                <span style={{ color:'var(--text-dim)' }}>{bendType} Pitch C-C:</span><span style={{ color:'var(--blue)' }}>{pitch} mm</span>
                <span style={{ color:'var(--text-dim)' }}>Row spacing:</span><span style={{ color:'var(--blue)' }}>{pv.toFixed(1)} mm</span>
                <span style={{ color:'var(--text-dim)' }}>Vijay Shell OD:</span><span style={{ color:'var(--green)', fontWeight:700 }}>{calcShellOD} mm</span>
              </div>
            </div>
          </div>

          {/* Firetube */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title" style={{ color:'var(--blue)' }}>Firetube Assemblies</div>
            </div>
            <div className="panel-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div>
                  <label className="field-label">Bore Size (DN)</label>
                  <select value={fireNb} onChange={e => setFireNb(Number(e.target.value))}>
                    {Object.keys(FIRETUBE_OD).map(n => <option key={n} value={n}>{n} NB</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Schedule</label>
                  <select value={fireSch} onChange={e => setFireSch(e.target.value)}>
                    {Object.keys(FIRETUBE_OD[fireNb] ?? {}).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">No. of Burners</label>
                  <select value={burnerQty} onChange={e => setBurnerQty(Number(e.target.value))}>
                    <option value={1}>1 Burner</option>
                    <option value={2}>2 Burners</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Firetube Passes</label>
                  <select value={firePasses} onChange={e => setFirePasses(Number(e.target.value))}>
                    <option value={1}>1-Pass</option>
                    <option value={2}>2-Pass (U-tube)</option>
                    <option value={4}>4-Pass Chained</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop:8, background:'var(--panel2)', borderRadius:4, padding:'8px 10px',
                fontSize:11, fontFamily:'var(--mono)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                <span style={{ color:'var(--text-dim)' }}>Fire OD:</span><span style={{ color:'var(--blue)' }}>{odFire} mm</span>
                <span style={{ color:'var(--text-dim)' }}>Wall ({fireSch}):</span><span style={{ color:'var(--blue)' }}>{wallFire.toFixed(2)} mm</span>
                <span style={{ color:'var(--text-dim)' }}>Fire ID:</span><span style={{ color:'#5ab8e8' }}>{(odFire-2*wallFire).toFixed(1)} mm</span>
                <span style={{ color:'var(--text-dim)' }}>Pass spacing:</span><span style={{ color:'#5ab8e8' }}>{cFire.toFixed(0)} mm</span>
              </div>
            </div>
          </div>

          {/* Clearances */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title" style={{ color:'#8a5ab0' }}>Shell Clearances</div>
            </div>
            <div className="panel-body">
              <div style={{ marginBottom:8 }}>
                <label className="field-label">Side Gap (each side of bundle)</label>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type="number" min="25" max="200" step="5" value={gapSide}
                    onChange={e => setGapSide(Number(e.target.value))} style={{ width:70 }} />
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>mm</span>
                </div>
              </div>
              {[
                {id:'A', label:'[A] Bottom Shell', val:liveA, min:75, set:setClearA},
                {id:'C', label:'[C] Mid Bundle Lane', val:liveC, min:75, set:setClearC},
                {id:'D', label:'[D] Top Headroom', val:liveD, min:100, set:setClearD},
              ].map(cl => (
                <div key={cl.id} style={{ marginBottom:6 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                    <span style={{ color:'var(--text-dim)' }}>{cl.label}</span>
                    <span style={{ fontFamily:'var(--mono)', fontWeight:700,
                      color: clrOK(cl.val, cl.min) ? 'var(--green)' : 'var(--red)' }}>
                      {cl.val.toFixed(0)} mm {!clrOK(cl.val, cl.min) ? '⚠' : '✔'}
                    </span>
                  </div>
                </div>
              ))}
              {burnerQty===2 && (
                <div style={{ fontSize:11 }}>
                  <span style={{ color:'var(--text-dim)' }}>[B] Inter-Burner: </span>
                  <span style={{ fontFamily:'var(--mono)', fontWeight:700,
                    color: liveB>=50 ? 'var(--green)' : 'var(--red)' }}>
                    {liveB.toFixed(0)} mm {liveB<50 ? '⚠' : '✔'}
                  </span>
                </div>
              )}
              <div style={{ marginTop:8, fontSize:10, color:'var(--text-dim)', background:'var(--panel2)',
                borderRadius:4, padding:'6px 8px' }}>
                Vijay formula clearance: {shellClearance} mm (≤3": 125, &gt;3": 175 mm)
              </div>
            </div>
          </div>

          {/* ASME B16.9 table */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title" style={{ fontSize:10 }}>ASME B16.9 — NPS {NPS_LABELS[coilNb]} Return Bend</div>
            </div>
            <div className="panel-body">
              <table className="res-table" style={{ fontSize:10 }}>
                <thead><tr><th>Param</th><th>SR (mm)</th><th>LR (mm)</th></tr></thead>
                <tbody>
                  <tr style={{ background: bendType==='SR' ? 'rgba(176,96,0,0.08)' : undefined }}>
                    <td>Center-Center</td>
                    <td className="val">{pipeRow.sr_ctoc}</td>
                    <td className="val2">{pipeRow.lr_ctoc}</td>
                  </tr>
                  <tr style={{ background: bendType==='SR' ? 'rgba(176,96,0,0.08)' : undefined }}>
                    <td>Back-to-Face</td>
                    <td className="val">{pipeRow.sr_btof}</td>
                    <td className="val2">{pipeRow.lr_btof}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── SVG CANVAS ── */}
        <div>
          <div style={{ background:'#f5f0e8', border:'2px solid #c9b99a', borderRadius:8, overflow:'hidden' }}>
            <svg ref={svgRef} width={SVG_W} height={SVG_H}
              style={{ width:'100%', height:'auto', display:'block', userSelect:'none' }}>
              <defs>
                <marker id="sk-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0 1.5 L9 5 L0 8.5 Z" fill="#c0392b"/>
                </marker>
                <filter id="sk-textbg" x="-8%" y="-40%" width="116%" height="180%">
                  <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="ex"/>
                  <feFlood floodColor="#f5f0e8" result="wh"/>
                  <feComposite in="wh" in2="ex" operator="in" result="halo"/>
                  <feMerge><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>

              {/* Centrelines */}
              <line x1={cx} y1={0} x2={cx} y2={SVG_H} stroke="#c0b090" strokeWidth={0.6} strokeDasharray="5 5"/>
              <line x1={0} y1={cy} x2={SVG_W} y2={cy} stroke="#c0b090" strokeWidth={0.6} strokeDasharray="5 5"/>

              <g transform={`translate(${cx},${cy})`}>
                {/* Shell OD */}
                <circle cx={0} cy={0} r={mm(suggestedOD/2)} fill="none" stroke="#2d7a55" strokeWidth={3}/>
                <text x={0} y={-mm(suggestedOD/2)-10} textAnchor="middle" fill="#1a5c3a"
                  fontSize="12" fontWeight="900" fontFamily="Courier New, monospace"
                  filter="url(#sk-textbg)">Ø {suggestedOD} mm SHELL OD</text>

                {/* ID required */}
                <circle cx={0} cy={0} r={mm(idRequired/2)} fill="none" stroke="#c0392b"
                  strokeWidth={1.5} strokeDasharray="5 3"/>
                <text x={mm(idRequired/2)+8} y={4} fill="#c0392b" fontSize="11" fontWeight="800"
                  fontFamily="Courier New, monospace" dominantBaseline="middle"
                  filter="url(#sk-textbg)">ID: {idRequired.toFixed(0)} mm</text>

                {/* Coil bundle */}
                {coilPoints.map((pt, i) => (
                  <g key={`c${i}`}>
                    <circle cx={mm(pt.x)} cy={mm(pt.y)} r={mm(pt.r)}
                      fill={COIL_COLORS[i%COIL_COLORS.length]} stroke="#1a1a1a"
                      strokeWidth={1.0} opacity={0.85}/>
                    <circle cx={mm(pt.x)} cy={mm(pt.y)} r={Math.max(1, mm(pt.r-wallCoil))}
                      fill="#f5f0e8" stroke="#1a1a1a" strokeWidth={0.7} opacity={0.9}/>
                  </g>
                ))}
                {/* Coil drag handle */}
                <circle cx={mm(coilCenter.x)} cy={mm(coilCenter.y)} r={10}
                  fill="#b45309" stroke="#78350f" strokeWidth={1.5}
                  style={{ cursor:'grab' }}
                  onMouseDown={e => onMouseDown(e, 'coil', 0)}/>
                <text x={mm(coilCenter.x)} y={mm(coilCenter.y)+3} textAnchor="middle"
                  fill="#fff" fontSize="8" fontWeight="bold" style={{ pointerEvents:'none' }}>✥</text>

                {/* Firetube passes */}
                {firePoints.map((pt, i) => {
                  const prev = pt.pIdx>1 ? firePoints.find(f=>f.bIdx===pt.bIdx&&f.pIdx===pt.pIdx-1) : null;
                  return (
                    <g key={`f${i}`}>
                      {prev && <line x1={mm(prev.x)} y1={mm(prev.y)} x2={mm(pt.x)} y2={mm(pt.y)}
                        stroke="#2255aa" strokeWidth={1.2} strokeDasharray="3 2" opacity={0.5}/>}
                      <circle cx={mm(pt.x)} cy={mm(pt.y)} r={mm(pt.r)}
                        fill={pt.pIdx===1 ? '#4a90c4' : '#7ab3d8'} stroke="#1a3a6a" strokeWidth={1.5}
                        style={{ cursor:'pointer' }}
                        onMouseDown={e => onMouseDown(e, `p${pt.pIdx}`, pt.bIdx)}/>
                      <circle cx={mm(pt.x)} cy={mm(pt.y)} r={Math.max(1, mm(pt.r-wallFire))}
                        fill="#dce8f5" stroke="#1a3a6a" strokeWidth={0.8} style={{ pointerEvents:'none' }}/>
                      <text x={mm(pt.x)} y={mm(pt.y)+3} textAnchor="middle" fill="#0d2a52"
                        fontSize="8" fontWeight="bold" fontFamily="Courier New" style={{ pointerEvents:'none' }}>
                        P{pt.pIdx}
                      </text>
                    </g>
                  );
                })}

                {/* Dimension lines */}
                <g stroke="#c0392b" strokeWidth={1.8}>
                  {/* A - bottom */}
                  <line x1={0} y1={mm(shellR)} x2={0} y2={mm(loFireY)}
                    markerStart="url(#sk-arrow)" markerEnd="url(#sk-arrow)"/>
                  <line x1={-6} y1={mm(shellR)} x2={6} y2={mm(shellR)} strokeWidth={1.2}/>
                  <line x1={-6} y1={mm(loFireY)} x2={6} y2={mm(loFireY)} strokeWidth={1.2}/>
                  <text x={14} y={mm(shellR-liveA/2)} fill="#c0392b" fontSize="11" fontWeight="900"
                    fontFamily="Courier New" dominantBaseline="middle" filter="url(#sk-textbg)">
                    [A] {liveA.toFixed(0)} mm
                  </text>
                  {/* C - mid bundle */}
                  {liveC > 0 && <>
                    <line x1={0} y1={mm(hiFireY)} x2={0} y2={mm(loCoilY)}
                      markerStart="url(#sk-arrow)" markerEnd="url(#sk-arrow)"/>
                    <line x1={-6} y1={mm(hiFireY)} x2={6} y2={mm(hiFireY)} strokeWidth={1.2}/>
                    <line x1={-6} y1={mm(loCoilY)} x2={6} y2={mm(loCoilY)} strokeWidth={1.2}/>
                    <text x={14} y={mm(loCoilY+liveC/2)} fill="#c0392b" fontSize="11" fontWeight="900"
                      fontFamily="Courier New" dominantBaseline="middle" filter="url(#sk-textbg)">
                      [C] {liveC.toFixed(0)} mm
                    </text>
                  </>}
                  {/* D - top */}
                  <line x1={0} y1={mm(hiCoilY)} x2={0} y2={mm(-shellR)}
                    markerStart="url(#sk-arrow)" markerEnd="url(#sk-arrow)"/>
                  <line x1={-6} y1={mm(hiCoilY)} x2={6} y2={mm(hiCoilY)} strokeWidth={1.2}/>
                  <line x1={-6} y1={mm(-shellR)} x2={6} y2={mm(-shellR)} strokeWidth={1.2}/>
                  <text x={14} y={mm(hiCoilY-liveD/2)} fill="#c0392b" fontSize="11" fontWeight="900"
                    fontFamily="Courier New" dominantBaseline="middle" filter="url(#sk-textbg)">
                    [D] {liveD.toFixed(0)} mm
                  </text>
                  {/* B - inter-burner */}
                  {burnerQty===2 && liveB>0 && <>
                    <line x1={mm(burners[0].p1.x+odFire/2)} y1={mm(burners[0].p1.y)}
                      x2={mm(burners[1].p1.x-odFire/2)} y2={mm(burners[1].p1.y)}
                      markerStart="url(#sk-arrow)" markerEnd="url(#sk-arrow)"/>
                    <text x={0} y={mm(burners[0].p1.y)-14} textAnchor="middle" fill="#c0392b"
                      fontSize="11" fontWeight="900" fontFamily="Courier New" filter="url(#sk-textbg)">
                      [B] {liveB.toFixed(0)} mm
                    </text>
                  </>}
                </g>

                {/* Pitch reference */}
                {coilPoints.length >= 2 && (() => {
                  const p0=coilPoints[0], p1=coilPoints[1];
                  const mx=(p0.x+p1.x)/2, my=(p0.y+p1.y)/2-odCoil/2-10;
                  return (
                    <g opacity={0.7}>
                      <line x1={mm(p0.x)} y1={mm(my+odCoil/2+10)} x2={mm(p1.x)} y2={mm(my+odCoil/2+10)}
                        stroke="#8e44ad" strokeWidth={1} markerStart="url(#sk-arrow)" markerEnd="url(#sk-arrow)"/>
                      <text x={mm(mx)} y={mm(my+odCoil/2+2)} textAnchor="middle" fill="#8e44ad"
                        fontSize="9" fontFamily="Courier New" fontWeight="700" filter="url(#sk-textbg)">
                        P={pitch}mm ({bendType})
                      </text>
                    </g>
                  );
                })()}
              </g>
            </svg>
          </div>

          {/* Dimensions summary */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginTop:12 }}>
            {/* Shell */}
            <div className="panel">
              <div className="panel-header" style={{ padding:'6px 10px' }}>
                <div className="panel-title" style={{ color:'var(--green)' }}>Shell</div>
              </div>
              <div className="panel-body" style={{ padding:'8px 10px' }}>
                <table style={{ width:'100%', fontSize:11, fontFamily:'var(--mono)' }}>
                  <tbody>
                    <tr><td style={{ color:'var(--text-dim)' }}>Shell OD</td>
                      <td style={{ color:'var(--green)', fontWeight:900, textAlign:'right' }}>{suggestedOD} mm</td></tr>
                    <tr><td style={{ color:'var(--text-dim)' }}>ID required</td>
                      <td style={{ color:'var(--green)', textAlign:'right' }}>{idRequired.toFixed(0)} mm</td></tr>
                    <tr><td style={{ color:'var(--text-dim)' }}>Vijay calc OD</td>
                      <td style={{ color:'var(--accent)', textAlign:'right' }}>{calcShellOD} mm</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            {/* Coil */}
            <div className="panel">
              <div className="panel-header" style={{ padding:'6px 10px' }}>
                <div className="panel-title" style={{ color:'var(--accent)' }}>Coil — NPS {NPS_LABELS[coilNb]}</div>
              </div>
              <div className="panel-body" style={{ padding:'8px 10px' }}>
                <table style={{ width:'100%', fontSize:11, fontFamily:'var(--mono)' }}>
                  <tbody>
                    <tr><td style={{ color:'var(--text-dim)' }}>OD</td><td style={{ color:'var(--accent)', textAlign:'right' }}>{odCoil} mm</td></tr>
                    <tr><td style={{ color:'var(--text-dim)' }}>Wall</td><td style={{ textAlign:'right' }}>{wallCoil.toFixed(2)} mm</td></tr>
                    <tr><td style={{ color:'var(--text-dim)' }}>ID</td><td style={{ color:'var(--blue)', textAlign:'right' }}>{idCoil.toFixed(1)} mm</td></tr>
                    <tr><td style={{ color:'var(--text-dim)' }}>Pitch</td><td style={{ color:'var(--blue)', textAlign:'right' }}>{pitch} mm</td></tr>
                    <tr><td style={{ color:'var(--text-dim)' }}>Pipes</td><td style={{ textAlign:'right' }}>{coilPoints.length}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            {/* Firetube */}
            <div className="panel">
              <div className="panel-header" style={{ padding:'6px 10px' }}>
                <div className="panel-title" style={{ color:'var(--blue)' }}>Firetube DN{fireNb}</div>
              </div>
              <div className="panel-body" style={{ padding:'8px 10px' }}>
                <table style={{ width:'100%', fontSize:11, fontFamily:'var(--mono)' }}>
                  <tbody>
                    <tr><td style={{ color:'var(--text-dim)' }}>OD</td><td style={{ color:'var(--blue)', textAlign:'right' }}>{odFire} mm</td></tr>
                    <tr><td style={{ color:'var(--text-dim)' }}>Wall</td><td style={{ textAlign:'right' }}>{wallFire.toFixed(2)} mm</td></tr>
                    <tr><td style={{ color:'var(--text-dim)' }}>ID</td><td style={{ color:'#5ab8e8', textAlign:'right' }}>{(odFire-2*wallFire).toFixed(1)} mm</td></tr>
                    <tr><td style={{ color:'var(--text-dim)' }}>Spacing</td><td style={{ textAlign:'right' }}>{cFire} mm</td></tr>
                    <tr><td style={{ color:'var(--text-dim)' }}>Config</td><td style={{ textAlign:'right' }}>{burnerQty}×{firePasses}P</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            {/* Live clearances */}
            <div className="panel">
              <div className="panel-header" style={{ padding:'6px 10px' }}>
                <div className="panel-title" style={{ color:'#8a5ab0' }}>Clearances</div>
              </div>
              <div className="panel-body" style={{ padding:'8px 10px' }}>
                <table style={{ width:'100%', fontSize:11, fontFamily:'var(--mono)' }}>
                  <tbody>
                    {[
                      {id:'A', v:liveA, min:75},
                      ...(burnerQty===2 ? [{id:'B', v:liveB, min:50}] : []),
                      {id:'C', v:liveC, min:75},
                      {id:'D', v:liveD, min:100},
                    ].map(cl => (
                      <tr key={cl.id}>
                        <td><span style={{ display:'inline-block', width:18, height:18, borderRadius:3,
                          background:'rgba(192,57,43,0.15)', textAlign:'center', lineHeight:'18px',
                          fontSize:10, fontWeight:900, color:'#c0392b' }}>{cl.id}</span></td>
                        <td style={{ color:'var(--text-dim)', paddingLeft:4, fontSize:10 }}>
                          {cl.id==='A'?'Bottom':cl.id==='B'?'Inter-burner':cl.id==='C'?'Mid lane':'Headroom'}
                        </td>
                        <td style={{ fontWeight:700, textAlign:'right',
                          color: cl.v>=cl.min ? 'var(--green)' : 'var(--red)' }}>
                          {cl.v.toFixed(0)} mm
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop:6, fontSize:9, color:'var(--text-dim)', borderTop:'1px solid var(--border)', paddingTop:4 }}>
                  Red = below minimum clearance
                </div>
              </div>
            </div>
          </div>

          <div className="note-box" style={{ marginTop:8, fontSize:10 }}>
            <strong>Drag to reposition:</strong> Orange ✥ handle = move coil bundle · Blue P1 circles = move firetube burner positions.
            Shell OD auto-updates from geometry.
            <strong> Vijay formula:</strong> R = (c² + 4h²)/(8h) where c = bundle width, h = coil-to-shell clearance.
            Source: ASME B16.9 SR/LR pitch tables.
          </div>
        </div>
      </div>
    </div>
  );
}
