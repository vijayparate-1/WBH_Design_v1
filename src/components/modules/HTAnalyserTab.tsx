'use client';
// src/components/modules/HTAnalyserTab.tsx
// HT Analyser — Full port from WBH_Design_v28 HTML
// Sub-tabs: ① Overview  ② Firetube HT  ③ Process Coil HT
//           ④ Temperature Profiles  ⑤ Sensitivity  ⑥ Accuracy  ⑦ Comparison

import React, { useState, useEffect, useCallback } from 'react';
import { ResultCard, ResultGrid } from '@/components/ui/ResultCard';
import type { Stage1Results } from '@/lib/calculations/thermodynamics';
import type { Stage2Results, Stage3Results } from '@/lib/calculations/heater-sizing';

interface Props {
  s1Results?: Stage1Results;
  s2Results?: Stage2Results;
  s3Results?: Stage3Results;
}

// ═══════════════════════════════════════════════════════════════════════
// PHYSICS LIBRARY (ported from v28 HTML htCalc* functions)
// ═══════════════════════════════════════════════════════════════════════

// Flue gas properties (simplified combustion gas mix: CO2+H2O+N2+O2)
function propsFlueGas(T_C: number) {
  const T = Math.max(T_C, 50);
  const Cp = 1050 + 0.12 * T;              // J/(kg·K)
  const k  = 0.0245 + 7.2e-5 * T;         // W/(m·K)
  const mu = 1.46e-5 + 4.0e-8 * T;        // Pa·s
  const rho = 1.25 * 273.15 / (273.15 + T); // kg/m³
  return { Cp, k, mu, rho, Pr: mu * Cp / k };
}

// Natural gas properties — uses Stage 1 PR-EOS if synced, else Hall-Yarborough + polynomial
function propsNaturalGas(T_C: number, P_barg: number, synced?: { Cp: number; k: number; mu: number; rho: number; Z: number }) {
  if (synced) {
    return { ...synced, Pr: synced.mu * synced.Cp / synced.k, source: 'PR-EOS (Stage 1)' };
  }
  const T = Math.max(T_C, 5);
  const P_abs = (P_barg + 1.01325) * 1e5;
  const M = 16.04, R = 8314.0;
  const Cp = 2200 + 1.1 * T + 0.002 * T * T;
  const k  = 0.0302 + 8.5e-5 * T;
  const mu = 1.05e-5 + 3.0e-8 * T;
  // Hall-Yarborough Z-factor for lean NG
  const T_K = 273.15 + T, P_bar = P_abs / 1e5;
  const Tpc = 190.5, Ppc = 45.8;
  const Tpr = T_K / Tpc, Ppr = P_bar / Ppc;
  let Z = 1.0;
  if (Ppr >= 0.1) {
    const t = 1 / Tpr;
    const A = t * (-0.06125) * Math.exp(-1.2 * (1 - t) ** 2);
    let y = 0.001;
    for (let i = 0; i < 100; i++) {
      const y3 = y * y * y, y4 = y3 * y;
      const F  = A * Ppr + (y + y*y + y3 - y4) / (1 - y) ** 3
               - (14.76*t - 9.76*t*t + 4.58*t**3) * y*y
               + (90.7*t - 242.2*t*t + 42.4*t**3) * y ** (2.18 + 2.82*t);
      const dF = (1 + 4*y + 4*y*y - 4*y3 + y4) / (1 - y) ** 4
               - (29.52*t - 19.52*t*t + 9.16*t**3) * y
               + (90.7*t - 242.2*t*t + 42.4*t**3) * (2.18 + 2.82*t) * y ** (1.18 + 2.82*t);
      const dy = F / Math.max(dF, 1e-9);
      y = Math.max(1e-6, y - dy);
      if (Math.abs(dy) < 1e-7) break;
    }
    Z = Math.max(0.5, Math.min(1.5, -A * Ppr / y));
  }
  const rho = P_abs * M / (R * T_K * 1000 * Z);
  return { Cp, k, mu, rho, Z, Pr: mu * Cp / k, source: 'Polynomial + Hall-Yarborough' };
}

// Bath fluid (water/MEG mix — simplified water)
function propsWater(T_C: number) {
  const T = Math.max(Math.min(T_C, 95), 20);
  const Cp   = 4210 - 1.4*T + 0.006*T*T;
  const k    = 0.571 + 0.00175*T - 6e-6*T*T;
  const mu   = 1e-3 * Math.exp(-0.02 * (T - 20));
  const rho  = 1000 - 0.003*T*T;
  const beta = 2.1e-4 + 5e-6*T;
  return { Cp, k, mu, rho, beta, Pr: mu*Cp/k, Z: 1.0 };
}

// Gnielinski (1976) — valid Re > 3000
function gnielinski(Re: number, Pr: number, k: number, D_i: number, L: number): number {
  Re = Math.max(Re, 3001);
  const lnRe = Math.log(Re);
  const f = (0.790 * lnRe - 1.64) ** -2;
  let Nu = (f/8) * (Re-1000) * Pr / (1 + 12.7 * Math.sqrt(f/8) * (Pr ** (2/3) - 1));
  Nu *= (1 + (D_i / Math.max(L, D_i)) ** (2/3));
  return Math.max(Nu * k / D_i, 1.0);
}

// Dittus-Boelter
function dittusBoelter(Re: number, Pr: number, k: number, D_i: number, heating = true): number {
  const n = heating ? 0.4 : 0.3;
  const Nu = 0.023 * Math.max(Re,100) ** 0.8 * Math.max(Pr,0.1) ** n;
  return Math.max(Nu * k / D_i, 1.0);
}

// Churchill-Chu natural convection (horizontal cylinder)
function churchillChu(D_o: number, T_surf: number, T_bath: number,
  fluid: { mu: number; rho: number; k: number; Cp: number; beta: number; Pr?: number }): number {
  const dT = Math.abs(T_surf - T_bath);
  if (dT < 0.05) return 600;
  const nu = fluid.mu / fluid.rho, alp = fluid.k / (fluid.rho * fluid.Cp);
  const Ra = Math.max(9.81 * fluid.beta * dT * D_o**3 / (nu * alp), 1e3);
  const Pr_f = fluid.Pr ?? (fluid.mu * fluid.Cp / fluid.k);
  const denom = (1 + (0.559/Pr_f) ** (9/16)) ** (16/9);
  const Nu = (0.60 + 0.387 * (Ra/denom) ** (1/6)) ** 2;
  return Math.max(Nu * fluid.k / D_o, 50);
}

// Iterative bath h_o
function iterateHBath(Q_W: number, A_o: number, D_o: number, T_bath: number,
  fluid: any, T_surf_guess: number, hot_side = true): { h: number; T_surf: number } {
  let T_surf = T_surf_guess, h = 500;
  for (let i = 0; i < 10; i++) {
    h = churchillChu(D_o, T_surf, T_bath, fluid);
    const q = Q_W / Math.max(A_o, 0.001);
    T_surf = hot_side ? T_bath + q / Math.max(h, 1) : T_bath - q / Math.max(h, 1);
  }
  return { h, T_surf };
}

// Dean number / factor (PRCI serpentine correlation)
function deanFactor(d_i: number, r_bend: number, Re: number): number {
  const D_c = 2 * r_bend;
  if (D_c <= 0 || D_c < d_i) return 1;
  const ratio = d_i / D_c;
  const f_prci = 1 + 3.6 * (1 - ratio) * ratio ** 0.8;
  return Re > 10000 ? Math.min(f_prci, 1.35) : Math.min(f_prci, 2.5);
}

// Overall U — cylindrical wall (OD basis)
function calcU(h_i: number, h_o: number, k_wall: number, D_i: number, D_o: number,
  Rf_i = 0, Rf_o = 0) {
  const ro = D_o/2, ri = D_i/2;
  const R_inner = (D_o/D_i) * (1/h_i + Rf_i);
  const R_wall  = ro * Math.log(ro/ri) / k_wall;
  const R_outer = 1/h_o + Rf_o;
  const R_total = R_inner + R_wall + R_outer;
  const U_o = 1 / R_total;
  return { U_o, R_inner, R_wall, R_outer, R_total,
    pct_i: R_inner/R_total*100, pct_w: R_wall/R_total*100, pct_o: R_outer/R_total*100 };
}

// LMTD (bath = hot side, gas = cold side, counter-current)
function calcLMTD(T_bath: number, T_gas_in: number, T_gas_out: number): number {
  const dT1 = Math.max(T_bath - T_gas_in,  0.01);
  const dT2 = Math.max(T_bath - T_gas_out, 0.01);
  if (Math.abs(dT1 - dT2) < 0.01) return dT1;
  return (dT1 - dT2) / Math.log(dT1 / dT2);
}

// Swamee-Jain friction factor
function swameeJain(Re: number, epsD: number): number {
  if (Re < 2300) return 64 / Math.max(Re, 1);
  return 0.25 / (Math.log10(epsD/3.7 + 5.74/Re**0.9)) ** 2;
}

// Pressure drop (straight + U-bends, Swamee-Jain)
function calcDP(mdot_total: number, rho: number, mu: number, D_i: number,
  L_straight: number, N_ubends: number, r_ubend: number, N_parallel = 1,
  roughness = 4.6e-5) {
  const mdot_per = mdot_total / Math.max(N_parallel, 1);
  const A_cs = Math.PI/4 * D_i**2;
  const v    = mdot_per / (rho * A_cs);
  const Re   = Math.max(rho * v * D_i / mu, 100);
  const epsD = roughness / D_i;
  const f    = swameeJain(Re, epsD);
  const dyn  = 0.5 * rho * v**2;
  const dP_straight = f * (L_straight / D_i) * dyn;
  const dP_bends    = N_ubends * 0.35 * dyn;
  const dP_total    = dP_straight + dP_bends;
  const regime = Re < 2300 ? 'Laminar' : Re < 4000 ? 'Transitional' : 'Turbulent';
  return { mdot_per, velocity: v, Re, f, regime,
    dP_straight, dP_bends, dP_total, dP_kPa: dP_total/1000, dP_mbar: dP_total/100 };
}

// Skin temperatures
function skinTemps(Q_W: number, A_o: number, D_i: number, D_o: number,
  h_i: number, h_o: number, k_wall: number) {
  const ro = D_o/2, ri = D_i/2;
  const q = Q_W / Math.max(A_o, 0.001);
  return { q,
    dT_o: q / Math.max(h_o, 1),
    dT_w: q * ro * Math.log(ro/ri) / k_wall,
    dT_i: q * (D_o/D_i) / Math.max(h_i, 1) };
}

// B31.3 wall thickness check
function b313Check(P_barg: number, D_o_mm: number, T_C: number, mat: string, t_sel: number,
  E = 1.0, Y = 0.4, mill = 0.125) {
  const S_MAP: Record<string,number> = {
    'A106B':137.9, 'A333G6':137.9, '316L':115.1, 'A312TP316L':115.1 };
  const S = S_MAP[mat.toUpperCase().replace(/[\s-]/g,'')] ?? 137.9;
  const P_MPa = P_barg * 0.1;
  const tmin  = (P_MPa * D_o_mm) / (2 * (S * E + P_MPa * Y));
  const treq  = tmin / (1 - mill);
  const margin = +(t_sel - treq).toFixed(3);
  return { S, tmin: +tmin.toFixed(3), treq: +treq.toFixed(3), tsel: t_sel, margin, pass: margin >= 0 };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN CALCULATION ENGINE — mirrors htCalculate() from v28
// ═══════════════════════════════════════════════════════════════════════
interface HTInputs {
  ves_ID: number; ves_L: number; T_bath: number;
  ft_nps?: string; ft_OD: number; ft_wall: number; ft_rbend: number; k_ft: number;
  ft_config: number;  // number of U-tubes (1 = 2-pass, 2 = 4-pass)
  Q_burner: number; eta_burner: number;
  T_fg_in: number; T_fg_out: number; foul_fg: number;
  pc_OD: number; pc_wall: number; pc_rbend: number; k_pc: number;
  N_paths: number; N_rows: number;
  ng_mdot: number; T_ng_in: number; T_ng_out: number; P_ng_op: number;
  foul_ng: number; foul_wb: number;
  b313_mat: string; P_design: number; T_design: number;
  f_rad: number;
  syncedNG?: { Cp: number; k: number; mu: number; rho: number; Z: number };
}

function runHT(inp: HTInputs) {
  const L_ves = inp.ves_L / 1000;
  const N_ft_passes = inp.ft_config * 2;
  const ft_OD_m = inp.ft_OD/1000, ft_ID = inp.ft_OD - 2*inp.ft_wall, ft_ID_m = ft_ID/1000;
  const ft_rb_m = inp.ft_rbend/1000;
  const pc_ID = inp.pc_OD - 2*inp.pc_wall, pc_ID_m = pc_ID/1000;
  const pc_OD_m = inp.pc_OD/1000, pc_rb_m = inp.pc_rbend/1000;

  // Geometry
  const A_ft_straight = N_ft_passes * Math.PI * ft_OD_m * L_ves;
  const A_ft_ubend    = inp.ft_config * Math.PI**2 * ft_OD_m * ft_rb_m;
  const A_ft_total    = A_ft_straight + A_ft_ubend;
  const A_ft_cs       = Math.PI/4 * ft_ID_m**2;
  const L_ft_straight = N_ft_passes * L_ves;
  const A_pc_straight = inp.N_paths * inp.N_rows * Math.PI * pc_OD_m * L_ves;
  const N_pc_ubends   = inp.N_paths * (inp.N_rows - 1);
  const A_pc_ubend    = N_pc_ubends * Math.PI**2 * pc_OD_m * pc_rb_m;
  const A_pc_total    = A_pc_straight + A_pc_ubend;
  const A_pc_cs       = Math.PI/4 * pc_ID_m**2;
  const L_pc_per_path = inp.N_rows * L_ves;

  // Flue gas side
  const Q_bath_W  = inp.Q_burner * 1000 * inp.eta_burner / 100;
  const Q_conv_W  = Q_bath_W * (1 - inp.f_rad / 100);
  const T_fg_mean = (inp.T_fg_in + inp.T_fg_out) / 2;
  const fp_fg     = propsFlueGas(T_fg_mean);
  const dT_fg     = Math.max(inp.T_fg_in - inp.T_fg_out, 1);
  const mdot_fg   = Q_conv_W / (fp_fg.Cp * dT_fg);
  const v_fg      = mdot_fg / (fp_fg.rho * A_ft_cs);
  const Re_fg     = fp_fg.rho * v_fg * ft_ID_m / fp_fg.mu;
  const h_fi      = Re_fg > 3000
    ? gnielinski(Re_fg, fp_fg.Pr, fp_fg.k, ft_ID_m, L_ft_straight)
    : dittusBoelter(Re_fg, fp_fg.Pr, fp_fg.k, ft_ID_m, false);
  const fp_wb     = propsWater(inp.T_bath);
  const { h: h_fo, T_surf: T_ft_outer } = iterateHBath(Q_bath_W, A_ft_total, ft_OD_m, inp.T_bath, fp_wb, inp.T_bath+15, true);
  const U_ft  = calcU(h_fi, h_fo, inp.k_ft, ft_ID_m, ft_OD_m, inp.foul_fg, inp.foul_wb);
  const sk_ft = skinTemps(Q_bath_W, A_ft_total, ft_ID_m, ft_OD_m, h_fi, h_fo, inp.k_ft);
  const T_ft_outer_skin = inp.T_bath + sk_ft.dT_o;
  const T_ft_inner_skin = T_ft_outer_skin + sk_ft.dT_w;
  const T_ft_film       = T_ft_inner_skin + sk_ft.dT_i;
  const dp_fg = calcDP(mdot_fg, fp_fg.rho, fp_fg.mu, ft_ID_m, L_ft_straight, inp.ft_config, ft_rb_m, 1);

  // Process gas side
  const T_ng_mean = (inp.T_ng_in + inp.T_ng_out) / 2;
  const fp_ng     = propsNaturalGas(T_ng_mean, inp.P_ng_op, inp.syncedNG);
  const Q_gas_W   = inp.ng_mdot * fp_ng.Cp * (inp.T_ng_out - inp.T_ng_in);
  const v_ng      = inp.ng_mdot / (inp.N_paths * fp_ng.rho * A_pc_cs);
  const Re_ng     = fp_ng.rho * v_ng * pc_ID_m / fp_ng.mu;
  const h_gi_str  = Re_ng > 3000
    ? gnielinski(Re_ng, fp_ng.Pr, fp_ng.k, pc_ID_m, L_pc_per_path)
    : dittusBoelter(Re_ng, fp_ng.Pr, fp_ng.k, pc_ID_m, true);
  const dean  = deanFactor(pc_ID_m, pc_rb_m, Re_ng);
  const De_ng = Re_ng * Math.sqrt(pc_ID_m / Math.max(2*pc_rb_m, pc_ID_m));
  const h_gi  = h_gi_str * dean;
  const { h: h_wo } = iterateHBath(Q_gas_W, A_pc_total, pc_OD_m, inp.T_bath, fp_wb, inp.T_bath-10, false);
  const U_pc  = calcU(h_gi, h_wo, inp.k_pc, pc_ID_m, pc_OD_m, inp.foul_ng, inp.foul_wb);
  const lmtd  = calcLMTD(inp.T_bath, inp.T_ng_in, inp.T_ng_out);
  const A_req = Q_gas_W / (U_pc.U_o * Math.max(lmtd, 0.1));
  const oversurf = (A_pc_total - A_req) / Math.max(A_req, 0.001) * 100;
  const A_bend_term = inp.N_paths * (inp.N_rows-1) * Math.PI**2 * pc_OD_m * pc_rb_m;
  const L_req = (A_req - A_bend_term) / Math.max(inp.N_paths * inp.N_rows * Math.PI * pc_OD_m, 0.001);
  const sk_pc = skinTemps(Q_gas_W, A_pc_total, pc_ID_m, pc_OD_m, h_gi, h_wo, inp.k_pc);
  const T_pc_outer_skin = inp.T_bath - sk_pc.dT_o;
  const dp_ng = calcDP(inp.ng_mdot, fp_ng.rho, fp_ng.mu, pc_ID_m, L_pc_per_path, inp.N_rows-1, pc_rb_m, inp.N_paths);
  const b313  = b313Check(inp.P_design, inp.pc_OD, inp.T_design, inp.b313_mat, inp.pc_wall);

  // Approach temps
  const ap_fg = inp.T_fg_out - inp.T_bath;
  const ap_ng = inp.T_bath - inp.T_ng_out;

  return {
    ...inp, L_ves, N_ft_passes, ft_ID, ft_ID_m, ft_OD_m, ft_rb_m, pc_ID, pc_ID_m, pc_OD_m, pc_rb_m,
    Q_bath_W, Q_conv_W, T_fg_mean, fp_fg, mdot_fg, v_fg, Re_fg,
    h_fi, h_fo, U_ft, sk_ft, T_ft_outer_skin, T_ft_inner_skin, T_ft_film,
    A_ft_straight, A_ft_ubend, A_ft_total, A_ft_cs, L_ft_straight, dp_fg,
    fp_ng, Q_gas_W, v_ng, Re_ng, h_gi_str, h_gi, dean, De_ng, h_wo, U_pc, lmtd,
    A_pc_straight, A_pc_ubend, A_pc_total, A_pc_cs, L_pc_per_path, N_pc_ubends,
    A_req, oversurf, L_req, sk_pc, T_pc_outer_skin, dp_ng, b313,
    ap_fg, ap_ng, fp_wb,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SVG CHARTS — Resistance bar, Temperature profile
// ═══════════════════════════════════════════════════════════════════════
function ResistanceBar({ pct_i, pct_w, pct_o, label_i, label_o }:
  { pct_i: number; pct_w: number; pct_o: number; label_i: string; label_o: string }) {
  const W = 400, H = 36;
  const wi = pct_i / 100 * W, ww = pct_w / 100 * W, wo = pct_o / 100 * W;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%' }}>
      <rect x={0}      y={8} width={wi} height={16} fill="#1a6ab8" rx={2}/>
      <rect x={wi}     y={8} width={ww} height={16} fill="#7a3a00" rx={0}/>
      <rect x={wi+ww}  y={8} width={wo} height={16} fill="#0e7a3e" rx={2}/>
      <text x={wi/2}    y={20} textAnchor="middle" fontSize={9} fill="white" fontFamily="monospace">
        {pct_i.toFixed(0)}% {label_i}
      </text>
      <text x={wi+ww/2} y={20} textAnchor="middle" fontSize={9} fill="white" fontFamily="monospace">
        {pct_w.toFixed(0)}% wall
      </text>
      <text x={wi+ww+wo/2} y={20} textAnchor="middle" fontSize={9} fill="white" fontFamily="monospace">
        {pct_o.toFixed(0)}% {label_o}
      </text>
    </svg>
  );
}

function TProfileSVG({ title, nodes, label_hot, label_cold, color_hot, color_cold }:
  { title: string; nodes: Array<{x:number; T_hot:number; T_cold:number; T_wall:number}>;
    label_hot: string; label_cold: string; color_hot: string; color_cold: string }) {
  if (nodes.length < 2) return null;
  const W = 520, H = 200, pL = 50, pB = 32, pT = 18, pR = 12;
  const cW = W - pL - pR, cH = H - pB - pT;
  const xs = nodes.map(n => n.x), allT = nodes.flatMap(n => [n.T_hot, n.T_cold, n.T_wall]);
  const maxX = Math.max(...xs), minX = Math.min(...xs);
  const maxT = Math.max(...allT) + 3, minT = Math.min(...allT) - 3;
  const sx = (x: number) => pL + ((x - minX) / Math.max(maxX - minX, 0.01)) * cW;
  const sy = (T: number) => pT + (1 - (T - minT) / (maxT - minT)) * cH;
  const path = (key: 'T_hot'|'T_cold'|'T_wall', col: string, dash?: string) => {
    const d = nodes.map((n,i) => `${i===0?'M':'L'}${sx(n.x).toFixed(1)},${sy(n[key]).toFixed(1)}`).join(' ');
    return <path d={d} fill="none" stroke={col} strokeWidth={2} strokeDasharray={dash} opacity={0.9}/>;
  };
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1,
        color:'var(--text-dim)', marginBottom:4 }}>{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%' }}>
        {[0,0.25,0.5,0.75,1].map(t => {
          const T = minT + (maxT - minT) * t;
          const y = sy(T);
          return <g key={t}>
            <line x1={pL} y1={y} x2={pL+cW} y2={y} stroke="rgba(180,190,200,0.2)" strokeWidth={0.5}/>
            <text x={pL-4} y={y+4} textAnchor="end" fontSize={9}
              fill="var(--text-dim)" fontFamily="monospace">{T.toFixed(0)}°</text>
          </g>;
        })}
        {path('T_hot',  color_hot)}
        {path('T_cold', color_cold, '4 2')}
        {path('T_wall', '#7a3a00', '2 2')}
        <text x={pL+4} y={pT+10} fontSize={8} fill={color_hot} fontFamily="monospace">{label_hot}</text>
        <text x={pL+4} y={pT+22} fontSize={8} fill={color_cold} fontFamily="monospace">{label_cold}</text>
        <text x={pL+4} y={pT+34} fontSize={8} fill="#7a3a00" fontFamily="monospace">Wall T</text>
        <text x={pL+cW} y={H-4} textAnchor="end" fontSize={9}
          fill="var(--text-dim)" fontFamily="monospace">Position [m]</text>
      </svg>
    </div>
  );
}

// Sensitivity chart: area and oversurface vs N_rows
function SensitivitySVG({ ht, maxRows }: { ht: any; maxRows: number }) {
  const rows = Array.from({ length: maxRows - 1 }, (_, i) => i + 2);
  const data = rows.map(nr => {
    const A = ht.N_paths * nr * Math.PI * ht.pc_OD_m * ht.L_ves
            + ht.N_paths * (nr-1) * Math.PI**2 * ht.pc_OD_m * ht.pc_rb_m;
    const os = (A - ht.A_req) / Math.max(ht.A_req, 0.001) * 100;
    return { nr, A, os };
  });
  const W = 400, H = 160, pL = 52, pB = 30, pT = 14, pR = 12;
  const cW = W - pL - pR, cH = H - pB - pT;
  const maxA = Math.max(...data.map(d => d.A));
  const minOS = Math.min(...data.map(d => d.os)), maxOS = Math.max(...data.map(d => d.os));
  const bW = Math.floor(cW / data.length) - 3;
  const sx = (i: number) => pL + i * (cW / data.length) + bW / 2;
  const syOS = (v: number) => pT + (1 - (v - minOS) / Math.max(maxOS - minOS, 0.01)) * cH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%' }}>
      {[0,0.5,1].map(t => {
        const v = minOS + (maxOS - minOS) * t;
        const y = syOS(v);
        return <g key={t}>
          <line x1={pL} y1={y} x2={pL+cW} y2={y} stroke="rgba(180,190,200,0.3)" strokeWidth={0.5}/>
          <text x={pL-4} y={y+4} textAnchor="end" fontSize={9}
            fill="var(--text-dim)" fontFamily="monospace">{v.toFixed(0)}%</text>
        </g>;
      })}
      {/* Zero line */}
      {minOS < 0 && maxOS > 0 && (
        <line x1={pL} y1={syOS(0)} x2={pL+cW} y2={syOS(0)}
          stroke="var(--red)" strokeWidth={0.8} strokeDasharray="3 2"/>
      )}
      {data.map((d, i) => {
        const bH = Math.abs(syOS(d.os) - syOS(0));
        const y  = d.os >= 0 ? syOS(d.os) : syOS(0);
        const isCurrent = d.nr === ht.N_rows;
        return (
          <g key={d.nr}>
            <rect x={sx(i) - bW/2} y={y} width={bW} height={bH}
              fill={d.os >= 0 ? 'rgba(14,122,62,0.5)' : 'rgba(176,16,16,0.5)'} rx={1}/>
            {isCurrent && <rect x={sx(i) - bW/2 - 1} y={y - 1} width={bW+2} height={bH+2}
              fill="none" stroke="var(--accent)" strokeWidth={1.5} rx={2}/>}
            <text x={sx(i)} y={H-4} textAnchor="middle" fontSize={8}
              fill={isCurrent ? 'var(--accent)' : 'var(--text-dim)'}
              fontFamily="monospace">{d.nr}</text>
          </g>
        );
      })}
      <text x={pL-2} y={pT-2} fontSize={9} fill="var(--text-dim)">Oversurface [%]</text>
      <text x={pL + cW/2} y={H-14} textAnchor="middle" fontSize={9}
        fill="var(--text-dim)" fontFamily="monospace">N_rows per path</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function HTAnalyserTab({ s1Results, s2Results, s3Results }: Props) {
  const [subTab, setSubTab] = useState<
    'overview'|'firetube'|'coil'|'profiles'|'sizing'|'accuracy'|'comparison'
  >('overview');
  const [sensMax, setSensMax] = useState(20);

  // Form state — pre-populated from stages, user can override
  const [form, setForm] = useState({
    ves_ID:    s2Results?.OD_shell_mm ? (s2Results.OD_shell_mm - 20) : 2000,
    ves_L:     s2Results?.L_shell_mm ?? 7500,
    T_bath:    (s2Results as any)?.T_bath_C ?? 65,
    ft_nps: 'DN400_SCH10',
    ft_config: s2Results?.nBurners ?? 1,  // U-tubes
    ft_OD:     s2Results?.pipe?.od ?? 406.4,
    ft_wall:   s2Results?.pipe ? s2Results.pipe.od - (s2Results.OD ?? 0.4)*1000 : 6.35,
    ft_rbend:  s2Results?.pipe?.od ? s2Results.pipe.od * 1.5 : 610,
    k_ft:      50.0,    // W/(m·K) — CS
    Q_burner:  s2Results?.Q_burner_rated_kW ?? 800,
    eta_burner:80,
    T_fg_in:   900,
    T_fg_out:  s2Results?.T_stack_est ?? 450,
    foul_fg:   0.0002,
    pc_OD:     s3Results?.do_m ? s3Results.do_m*1000 : 88.9,
    pc_wall:   s3Results?.wt_act ?? 7.62,
    pc_rbend:  s3Results?.r_bend_m ? s3Results.r_bend_m*1000 : 133,
    k_pc:      50.0,
    N_paths:   s3Results?.n_pass ?? 3,
    N_rows:    s3Results?.n_rows ?? 8,
    ng_mdot:   s1Results?.mdot_kgs ?? 1.389,
    T_ng_in:   s1Results?.T_in_C ?? 5,
    T_ng_out:  s1Results?.T_out_C ?? 40,
    P_ng_op:   s1Results ? (s1Results.P_kPa/100 - 1.01325) : 70,
    foul_ng:   0.00017,
    foul_wb:   0.000088,
    b313_mat:  s3Results?.mat_label ?? 'A106B',
    P_design:  s1Results?.P_des ? (s1Results.P_des/100 - 1.01325) : 77,
    T_design:  (s1Results as any)?.T_des_C ?? 100,
    f_rad:     30,   // % radiation fraction
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: parseFloat(e.target.value) || 0 }));
  const setS = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // Sync from stages
  const syncFromStages = useCallback(() => {
    setForm(f => ({
      ...f,
      ves_ID:    s2Results?.OD_shell_mm ? s2Results.OD_shell_mm - 20 : f.ves_ID,
      ves_L:     s2Results?.L_shell_mm ?? f.ves_L,
      T_bath:    (s2Results as any)?.T_bath_C ?? f.T_bath,
      Q_burner:  s2Results?.Q_burner_rated_kW ?? f.Q_burner,
      T_fg_out:  s2Results?.T_stack_est ?? f.T_fg_out,
      ft_OD:     s2Results?.pipe?.od ?? f.ft_OD,
      pc_OD:     s3Results?.do_m ? s3Results.do_m*1000 : f.pc_OD,
      pc_wall:   s3Results?.wt_act ?? f.pc_wall,
      pc_rbend:  s3Results?.r_bend_m ? s3Results.r_bend_m*1000 : f.pc_rbend,
      N_paths:   s3Results?.n_pass ?? f.N_paths,
      N_rows:    s3Results?.n_rows ?? f.N_rows,
      ng_mdot:   s1Results?.mdot_kgs ?? f.ng_mdot,
      T_ng_in:   s1Results?.T_in_C ?? f.T_ng_in,
      T_ng_out:  s1Results?.T_out_C ?? f.T_ng_out,
      P_ng_op:   s1Results ? (s1Results.P_kPa/100 - 1.01325) : f.P_ng_op,
      P_design:  s1Results?.P_des ? (s1Results.P_des/100 - 1.01325) : f.P_design,
    }));
  }, [s1Results, s2Results, s3Results]);

  // Build synced NG props from Stage 1 PR-EOS results
  const syncedNG = s1Results ? (() => {
    const ST_in = (s1Results.ST_in as any);
    if (!ST_in?.Cp5_kgK) return undefined;
    return { Cp: ST_in.Cp5_kgK * 1000, k: ST_in.k_therm ?? 0.035,
      mu: ST_in.mu ?? 1.1e-5, rho: ST_in.rho ?? 55, Z: ST_in.Z ?? 0.85 };
  })() : undefined;

  // Run calculation
  const ht = React.useMemo(() => {
    const ft_wall_calc = form.ft_OD > 200 ? 6.35 : 3.76;
    return runHT({ ...form, ft_wall: ft_wall_calc, syncedNG });
  }, [form, syncedNG]);

  const f1 = (v: number) => isFinite(v) ? v.toFixed(1) : '—';
  const f2 = (v: number) => isFinite(v) ? v.toFixed(2) : '—';
  const f3 = (v: number) => isFinite(v) ? v.toFixed(3) : '—';
  const f0 = (v: number) => isFinite(v) ? Math.round(v).toLocaleString() : '—';

  // 10-node temperature profiles
  const ftProfile = React.useMemo(() => {
    const nodes = [];
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * ht.L_ves * ht.N_ft_passes;
      const T_hot  = ht.T_fg_in  - (ht.T_fg_in  - ht.T_fg_out) * (i / 10);
      const T_cold = ht.T_bath;
      const T_wall = ht.T_bath + sk_interp(i/10, ht.sk_ft);
      nodes.push({ x, T_hot, T_cold, T_wall });
    }
    return nodes;
  }, [ht]);

  const pcProfile = React.useMemo(() => {
    const nodes = [];
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * ht.L_pc_per_path * ht.N_paths;
      const T_cold = ht.T_ng_in + (ht.T_ng_out - ht.T_ng_in) * (i / 10);
      const T_hot  = ht.T_bath;
      const T_wall = ht.T_bath - sk_interp(i/10, ht.sk_pc);
      nodes.push({ x, T_hot, T_cold, T_wall });
    }
    return nodes;
  }, [ht]);

  function sk_interp(t: number, sk: any) {
    return (sk.dT_o * (1 - t) + sk.dT_w * 0.5 + sk.dT_i * t) * 0.6;
  }

  const TABS_HT = [
    { id:'overview',   label:'① Overview' },
    { id:'firetube',   label:'② Firetube HT' },
    { id:'coil',       label:'③ Process Coil HT' },
    { id:'profiles',   label:'④ T Profiles' },
    { id:'sizing',     label:'⑤ ΔP & Sensitivity' },
    { id:'accuracy',   label:'⑥ Accuracy' },
    { id:'comparison', label:'⑦ Stages Comparison' },
  ] as const;

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{ display:'flex', background:'var(--panel)', borderBottom:'1px solid var(--border)',
        margin:'-20px -24px 16px', overflowX:'auto' }}>
        {TABS_HT.map(t => (
          <button key={t.id} className={`tab-btn${subTab === t.id ? ' active' : ''}`}
            style={{ fontSize:11 }} onClick={() => setSubTab(t.id as typeof subTab)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Sync bar */}
      <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center',
        padding:'8px 12px', background:'var(--panel)', borderRadius:6,
        border:'1px solid var(--border)' }}>
        <button className="btn btn-secondary btn-sm" onClick={syncFromStages}>
          ⚡ Sync from Stages 1–3
        </button>
        <span style={{ fontSize:11, color:'var(--text-dim)' }}>
          {syncedNG
            ? `✔ Using PR-EOS gas properties from Stage 1 (Z=${(s1Results?.ST_in as any)?.Z?.toFixed(4) ?? '—'})`
            : '⚠ Stage 1 not run — using Hall-Yarborough fallback for Z-factor'}
        </span>
        <span style={{ fontSize:10, color:'var(--text-dim)', marginLeft:'auto', fontFamily:'var(--mono)' }}>
          HT Analyser runs independently of Stage 2 & 3 — sync to load current values
        </span>
      </div>

      {/* ── ① OVERVIEW ── */}
      {subTab === 'overview' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            {/* Pinch checks */}
            {ht.T_ng_out >= ht.T_bath ? (
              <div className="alert alert-fail" style={{ marginBottom:12 }}>
                ✘ Gas outlet ({f0(ht.T_ng_out)}°C) ≥ bath ({f0(ht.T_bath)}°C) — thermodynamically impossible.
              </div>
            ) : ht.ap_ng < 5 ? (
              <div className="alert alert-warn" style={{ marginBottom:12 }}>
                ⚠ Gas outlet only {f1(ht.ap_ng)}°C below bath — LMTD too small.
              </div>
            ) : (
              <div className="alert alert-ok" style={{ marginBottom:12 }}>
                ✔ Pinch OK — Flue exit approach {f0(ht.ap_fg)}°C | Gas outlet {f1(ht.ap_ng)}°C below bath.
                <span style={{ marginLeft:8, fontSize:10, color:'var(--text-dim)' }}>
                  [{ht.fp_ng.source}]
                </span>
              </div>
            )}
            {ht.ap_fg < 30 && (
              <div className="alert alert-warn" style={{ marginBottom:12 }}>
                ⚠ Flue exit {f0(ht.T_fg_out)}°C only {f0(ht.ap_fg)}°C above bath — condensation/acid dew point risk. Recommend ≥30°C.
              </div>
            )}

            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Thermal Balance</div></div>
              <div className="panel-body">
                <ResultGrid cols={3}>
                  <ResultCard label="Burner Duty" value={ht.Q_burner} unit="kW" decimals={0} />
                  <ResultCard label="Heat to Bath" value={ht.Q_bath_W/1000} unit="kW" decimals={1} variant="highlight" />
                  <ResultCard label="Gas Duty Q" value={ht.Q_gas_W/1000} unit="kW" decimals={1} variant="highlight" />
                </ResultGrid>
                <div style={{ marginTop:8 }}>
                  <ResultGrid cols={3}>
                    <ResultCard label="U Firetube" value={ht.U_ft.U_o} unit="W/m²·K" decimals={0} />
                    <ResultCard label="U Process Coil" value={ht.U_pc.U_o} unit="W/m²·K" decimals={0} variant="highlight" />
                    <ResultCard label="LMTD" value={ht.lmtd} unit="°C" decimals={1} variant="green" />
                  </ResultGrid>
                </div>
                <div style={{ marginTop:8 }}>
                  <ResultGrid cols={3}>
                    <ResultCard label="FT Area" value={ht.A_ft_total} unit="m²" decimals={3} />
                    <ResultCard label="Coil Area (installed)" value={ht.A_pc_total} unit="m²" decimals={3} />
                    <ResultCard label="Over-surface" value={ht.oversurf} unit="%" decimals={1}
                      variant={ht.oversurf >= 0 ? 'green' : 'red'} />
                  </ResultGrid>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title">Design Inputs Quick-Ref</div></div>
              <div className="panel-body">
                <table className="res-table" style={{ fontSize:11 }}>
                  <tbody>
                    {[
                      ['Vessel ID × L', `${f0(ht.ves_ID)} × ${f0(ht.ves_L)} mm`],
                      ['Bath T', `${f1(ht.T_bath)} °C`],
                      ['Gas T in/out', `${f1(ht.T_ng_in)} / ${f1(ht.T_ng_out)} °C`],
                      ['Gas P op', `${f1(ht.P_ng_op)} barg`],
                      ['Gas ṁ', `${f3(ht.ng_mdot)} kg/s`],
                      ['Burner duty', `${f0(ht.Q_burner)} kW`],
                      ['Efficiency η', `${ht.eta_burner}%`],
                      ['Firetube', `${f0(ht.ft_OD)} mm OD × ${ht.N_ft_passes} passes`],
                      ['Process Coil', `${f0(ht.pc_OD)} mm OD × ${ht.N_paths}×${ht.N_rows}`],
                      ['Design P / T', `${f1(ht.P_design)} barg / ${f1(ht.T_design)}°C`],
                      ['B31.3 Status', ht.b313.pass ? `PASS (margin ${ht.b313.margin} mm)` : 'FAIL'],
                    ].map(([l, v]) => (
                      <tr key={l as string}><td>{l}</td>
                        <td className="val">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="note-box" style={{ marginTop:8, fontSize:10 }}>
                  <strong>Heat balance:</strong> Q_bath ({f1(ht.Q_bath_W/1000)} kW) − Q_gas ({f1(ht.Q_gas_W/1000)} kW)
                  = {f1((ht.Q_bath_W - ht.Q_gas_W)/1000)} kW available for shell losses.<br/>
                  ΔP_coil = {f2(ht.dp_ng.dP_kPa)} kPa · ΔP_firetube = {f1(ht.dp_fg.dP_total)} Pa.
                </div>
              </div>
            </div>
          </div>

          {/* Right: Key HT inputs */}
          <div>
            <div className="panel">
              <div className="panel-header"><div className="panel-title">HT Analyser Inputs (Override)</div></div>
              <div className="panel-body">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { k:'ves_ID',    l:'Vessel ID',        u:'mm' },
                    { k:'ves_L',     l:'Vessel Length',    u:'mm' },
                    { k:'T_bath',    l:'Bath T',           u:'°C' },
                    { k:'Q_burner',  l:'Burner Duty',      u:'kW' },
                    { k:'eta_burner',l:'Efficiency',       u:'%' },
                    { k:'T_fg_in',   l:'Flue T inlet',     u:'°C' },
                    { k:'T_fg_out',  l:'Flue T outlet',    u:'°C' },
                    { k:'T_ng_in',   l:'Gas T inlet',      u:'°C' },
                    { k:'T_ng_out',  l:'Gas T outlet',     u:'°C' },
                    { k:'P_ng_op',   l:'Gas P operating',  u:'barg' },
                    { k:'ng_mdot',   l:'Gas ṁ',            u:'kg/s' },
                    { k:'f_rad',     l:'Radiation fraction',u:'%' },
                  ].map(fi => (
                    <div key={fi.k}>
                      <label className="field-label">{fi.l}</label>
                      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                        <input type="number" value={(form as any)[fi.k]}
                          onChange={set(fi.k)} style={{ fontSize:11 }} />
                        <span style={{ fontFamily:'var(--mono)', fontSize:10,
                          color:'var(--text-dim)', whiteSpace:'nowrap' }}>{fi.u}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="note-box" style={{ marginTop:8, fontSize:10 }}>
                  Radiation fraction: ~30% of Q is radiant heat transfer inside firetube (not modelled by
                  Gnielinski/Churchill-Chu convection). Corrected by scaling Q_conv = Q×(1-f_rad).
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ② FIRETUBE HT ── */}
      {subTab === 'firetube' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Firetube Film Coefficients</div></div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="U_o Overall" value={ht.U_ft.U_o} unit="W/m²·K" decimals={1} variant="highlight" />
                  <ResultCard label="Heat Flux q″" value={ht.sk_ft.q/1000} unit="kW/m²" decimals={2} />
                  <ResultCard label="h_fi (flue gas)" value={ht.h_fi} unit="W/m²·K" decimals={0} />
                  <ResultCard label="h_fo (bath)" value={ht.h_fo} unit="W/m²·K" decimals={0} />
                </ResultGrid>
                <div style={{ marginTop:10 }}>
                  <ResistanceBar pct_i={ht.U_ft.pct_i} pct_w={ht.U_ft.pct_w} pct_o={ht.U_ft.pct_o}
                    label_i="flue gas" label_o="bath" />
                </div>
                <div className="note-box" style={{ marginTop:8, fontSize:10 }}>
                  <strong>Dominant resistance:</strong>{' '}
                  {ht.U_ft.pct_i > ht.U_ft.pct_o
                    ? `Flue gas film (${ht.U_ft.pct_i.toFixed(0)}%) — increase velocity (smaller ID or more passes).`
                    : `Bath convection (${ht.U_ft.pct_o.toFixed(0)}%) — vigorous bath circulation helps.`}
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title">Resistance Breakdown</div></div>
              <div className="panel-body">
                <table className="res-table" style={{ fontSize:11 }}>
                  <thead><tr><th>Resistance Term</th><th>Value [m²·K/W]</th><th>% of Total</th></tr></thead>
                  <tbody>
                    <tr><td>R_inner = (D_o/D_i)·(1/h_i + Rf_i)</td>
                      <td className="val">{(ht.U_ft.R_inner).toFixed(5)}</td>
                      <td className="val">{ht.U_ft.pct_i.toFixed(0)}%</td></tr>
                    <tr><td>R_wall = r_o·ln(r_o/r_i)/k</td>
                      <td className="val">{(ht.U_ft.R_wall).toFixed(5)}</td>
                      <td className="val">{ht.U_ft.pct_w.toFixed(0)}%</td></tr>
                    <tr><td>R_outer = 1/h_o + Rf_o</td>
                      <td className="val">{(ht.U_ft.R_outer).toFixed(5)}</td>
                      <td className="val">{ht.U_ft.pct_o.toFixed(0)}%</td></tr>
                    <tr style={{ borderTop:'2px solid var(--accent)' }}>
                      <td><strong>U_o = 1/R_total</strong></td>
                      <td className="val">{f1(ht.U_ft.U_o)}</td><td>W/m²·K</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Firetube Geometry & Flow</div></div>
              <div className="panel-body">
                <table className="res-table" style={{ fontSize:11 }}>
                  <tbody>
                    {[
                      ['Config', `${ht.ft_config} U-tube(s) · ${ht.N_ft_passes} passes`],
                      ['OD / Wall / ID', `${f1(ht.ft_OD)} / ${f2(ht.ft_wall)} / ${f1(ht.ft_ID)} mm`],
                      ['Straight passes × L', `${ht.N_ft_passes} × ${f2(ht.L_ves)} m = ${f2(ht.L_ft_straight)} m`],
                      ['Straight area', `${f3(ht.A_ft_straight)} m²`],
                      ['U-bend area', `${(ht.A_ft_ubend).toFixed(4)} m²`],
                      ['Total HT area', `${f3(ht.A_ft_total)} m²`],
                      ['Flue ṁ (convective Q)', `${f3(ht.mdot_fg)} kg/s = ${f1(ht.mdot_fg*3600)} kg/hr`],
                      ['Flue density (mean T)', `${f3(ht.fp_fg.rho)} kg/m³`],
                      ['Flue velocity', `${f3(ht.v_fg)} m/s`],
                      ['Reynolds number', `${f0(ht.Re_fg)} — ${ht.dp_fg.regime}`],
                      ['Correlation', ht.Re_fg > 3000 ? 'Gnielinski (1976)' : 'Dittus-Boelter'],
                      ['h_fi (inside)', `${f1(ht.h_fi)} W/m²·K`],
                      ['h_fo (bath Churchill-Chu)', `${f1(ht.h_fo)} W/m²·K`],
                    ].map(([l,v]) => (
                      <tr key={l as string}><td>{l}</td><td className="val">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title">Tube Skin Temperatures</div></div>
              <div className="panel-body">
                <table className="res-table" style={{ fontSize:11 }}>
                  <thead><tr><th>Location</th><th>Temperature</th><th>ΔT</th></tr></thead>
                  <tbody>
                    <tr><td>Water bath</td><td className="val2">{f1(ht.T_bath)} °C</td><td>—</td></tr>
                    <tr><td>Outer tube skin</td>
                      <td className="val">{f1(ht.T_ft_outer_skin)} °C</td>
                      <td>+{f1(ht.sk_ft.dT_o)} °C</td></tr>
                    <tr><td>Inner tube skin</td>
                      <td className="val">{f1(ht.T_ft_inner_skin)} °C</td>
                      <td>+{f2(ht.sk_ft.dT_w)} °C</td></tr>
                    <tr><td>Flue gas film temp</td>
                      <td className="val">{f1(ht.T_ft_film)} °C</td>
                      <td>+{f1(ht.sk_ft.dT_i)} °C</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ③ PROCESS COIL HT ── */}
      {subTab === 'coil' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Coil Film Coefficients</div></div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="U_o Overall" value={ht.U_pc.U_o} unit="W/m²·K" decimals={1} variant="highlight" />
                  <ResultCard label="LMTD" value={ht.lmtd} unit="°C" decimals={1} variant="green" />
                  <ResultCard label="h_gi (gas, Dean corr.)" value={ht.h_gi} unit="W/m²·K" decimals={0} />
                  <ResultCard label="h_gi straight (no Dean)" value={ht.h_gi_str} unit="W/m²·K" decimals={0} />
                  <ResultCard label="Dean Factor" value={ht.dean} decimals={3} variant="highlight" />
                  <ResultCard label="Dean Number De" value={ht.De_ng} decimals={0} />
                  <ResultCard label="h_wo (bath)" value={ht.h_wo} unit="W/m²·K" decimals={0} />
                  <ResultCard label="Re (gas)" value={ht.Re_ng} decimals={0} />
                </ResultGrid>
                <div style={{ marginTop:10 }}>
                  <ResistanceBar pct_i={ht.U_pc.pct_i} pct_w={ht.U_pc.pct_w} pct_o={ht.U_pc.pct_o}
                    label_i="gas film" label_o="bath" />
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title">Sizing Check</div></div>
              <div className="panel-body">
                <table className="res-table" style={{ fontSize:11 }}>
                  <tbody>
                    {[
                      ['Gas duty Q = ṁ·Cp·ΔT', `${f2(ht.Q_gas_W/1000)} kW`],
                      ['LMTD', `${f1(ht.lmtd)} °C`],
                      ['Required area A = Q/(U·LMTD)', `${f3(ht.A_req)} m²`],
                      ['Installed area', `${f3(ht.A_pc_total)} m²`],
                      ['Over-surface margin', `${ht.oversurf >= 0 ? '+' : ''}${f1(ht.oversurf)}% ${ht.oversurf >= 0 ? '✔' : '✘'}`],
                      ['Required vessel L', `${f2(ht.L_req)} m`],
                      ['Installed vessel L', `${f2(ht.L_ves)} m`],
                    ].map(([l, v]) => (
                      <tr key={l as string}><td>{l}</td><td className="val">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className={`alert ${ht.oversurf < 0 ? 'alert-fail' : ht.oversurf < 10 ? 'alert-warn' : 'alert-ok'}`}
                  style={{ marginTop:8 }}>
                  {ht.oversurf < 0
                    ? `✘ Coil UNDERSURFACED by ${Math.abs(ht.oversurf).toFixed(1)}% — add rows or paths.`
                    : ht.oversurf < 10
                    ? `⚠ Only ${ht.oversurf.toFixed(1)}% margin — consider one more row.`
                    : `✔ ${ht.oversurf.toFixed(1)}% design margin — adequate.`}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Coil Geometry & Flow</div></div>
              <div className="panel-body">
                <table className="res-table" style={{ fontSize:11 }}>
                  <tbody>
                    {[
                      ['OD / Wall / ID', `${f1(ht.pc_OD)} / ${f2(ht.pc_wall)} / ${f1(ht.pc_ID)} mm`],
                      ['Paths × Rows', `${ht.N_paths} × ${ht.N_rows} = ${ht.N_paths * ht.N_rows} tubes`],
                      ['U-bends total', `${ht.N_pc_ubends}`],
                      ['Straight tube area', `${f3(ht.A_pc_straight)} m²`],
                      ['U-bend area', `${(ht.A_pc_ubend).toFixed(4)} m²`],
                      ['Total area (installed)', `${f3(ht.A_pc_total)} m²`],
                      ['Gas ṁ per path', `${f3(ht.dp_ng.mdot_per)} kg/s`],
                      ['Density (Z-corrected)', `${f3(ht.fp_ng.rho)} kg/m³ (Z=${f3(ht.fp_ng.Z)})`],
                      ['Velocity per tube', `${f3(ht.v_ng)} m/s`],
                      ['Reynolds number', `${f0(ht.Re_ng)} — ${ht.dp_ng.regime}`],
                      ['Z-factor source', ht.fp_ng.source ?? 'Hall-Yarborough'],
                    ].map(([l,v]) => (
                      <tr key={l as string}><td>{l}</td><td className="val">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title">ASME B31.3 Check</div></div>
              <div className="panel-body">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                  <div>
                    <label className="field-label">Material</label>
                    <select value={form.b313_mat} onChange={setS('b313_mat')}>
                      <option value="A106B">ASTM A106 Gr B</option>
                      <option value="A333G6">ASTM A333 Gr 6</option>
                      <option value="316L">ASTM A312 TP316L</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Design P [barg]</label>
                    <input type="number" value={form.P_design} onChange={set('P_design')} />
                  </div>
                </div>
                <table className="res-table" style={{ fontSize:11 }}>
                  <tbody>
                    {[
                      ['Allowable stress S', `${ht.b313.S} MPa`],
                      ['t_min (pressure)', `${ht.b313.tmin} mm`],
                      ['t_req (with 12.5% mill tol)', `${ht.b313.treq} mm`],
                      ['Wall selected', `${ht.b313.tsel} mm`],
                      ['Margin', `${ht.b313.margin} mm`],
                    ].map(([l,v]) => (
                      <tr key={l as string}><td>{l}</td><td className="val">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className={`alert ${ht.b313.pass ? 'alert-ok' : 'alert-fail'}`} style={{ marginTop:8 }}>
                  {ht.b313.pass ? `✔ ASME B31.3 PASS — margin ${ht.b313.margin} mm` : '✘ ASME B31.3 FAIL — increase wall thickness'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ④ TEMPERATURE PROFILES ── */}
      {subTab === 'profiles' && (
        <div>
          <div className="panel" style={{ marginBottom:12 }}>
            <div className="panel-header"><div className="panel-title">Firetube — Flue Gas Temperature Profile</div></div>
            <div className="panel-body">
              <TProfileSVG title="Firetube: Flue Gas T vs Position (10 nodes)"
                nodes={ftProfile} label_hot="Flue gas T" label_cold="Bath T (const.)"
                color_hot="#c04000" color_cold="#1a6ab8" />
              <table className="res-table" style={{ fontSize:11 }}>
                <thead><tr><th>Node</th><th>Position [m]</th><th>Flue T [°C]</th>
                  <th>Wall T [°C]</th><th>Bath T [°C]</th></tr></thead>
                <tbody>
                  {ftProfile.filter((_,i) => i%2===0 || i===ftProfile.length-1).map((n,i) => (
                    <tr key={i}>
                      <td>{i*2+1}</td>
                      <td style={{ fontFamily:'var(--mono)' }}>{n.x.toFixed(2)}</td>
                      <td className="val">{n.T_hot.toFixed(1)}</td>
                      <td style={{ fontFamily:'var(--mono)', color:'#7a3a00' }}>{n.T_wall.toFixed(1)}</td>
                      <td className="val2">{n.T_cold.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Process Coil — Gas Temperature Profile</div></div>
            <div className="panel-body">
              <TProfileSVG title="Process Coil: Gas T vs Position (10 nodes)"
                nodes={pcProfile} label_hot="Bath T (const.)" label_cold="Gas T"
                color_hot="#1a6ab8" color_cold="#1e8a40" />
              <table className="res-table" style={{ fontSize:11 }}>
                <thead><tr><th>Node</th><th>Position [m]</th><th>Gas T [°C]</th>
                  <th>Wall T [°C]</th><th>Bath T [°C]</th></tr></thead>
                <tbody>
                  {pcProfile.filter((_,i) => i%2===0 || i===pcProfile.length-1).map((n,i) => (
                    <tr key={i}>
                      <td>{i*2+1}</td>
                      <td style={{ fontFamily:'var(--mono)' }}>{n.x.toFixed(2)}</td>
                      <td className="val">{n.T_cold.toFixed(1)}</td>
                      <td style={{ fontFamily:'var(--mono)', color:'#7a3a00' }}>{n.T_wall.toFixed(1)}</td>
                      <td className="val2">{n.T_hot.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── ⑤ ΔP & SENSITIVITY ── */}
      {subTab === 'sizing' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Flue Gas ΔP (Firetube)</div></div>
              <div className="panel-body">
                <table className="res-table" style={{ fontSize:11 }}>
                  <tbody>
                    {[
                      ['Velocity', `${f3(ht.dp_fg.velocity)} m/s`],
                      ['Reynolds', `${f0(ht.dp_fg.Re)} — ${ht.dp_fg.regime}`],
                      ['Friction factor f', ht.dp_fg.f.toFixed(4)],
                      ['ΔP straight', `${f1(ht.dp_fg.dP_straight)} Pa`],
                      ['ΔP bends', `${f1(ht.dp_fg.dP_bends)} Pa`],
                      ['ΔP total', `${f1(ht.dp_fg.dP_total)} Pa (${f2(ht.dp_fg.dP_mbar)} mbar)`],
                    ].map(([l,v]) => (
                      <tr key={l as string}><td>{l}</td><td className="val">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title">Process Gas ΔP (Coil)</div></div>
              <div className="panel-body">
                <table className="res-table" style={{ fontSize:11 }}>
                  <tbody>
                    {[
                      ['ṁ per path', `${f3(ht.dp_ng.mdot_per)} kg/s`],
                      ['Velocity/tube', `${f3(ht.dp_ng.velocity)} m/s`],
                      ['Reynolds', `${f0(ht.dp_ng.Re)} — ${ht.dp_ng.regime}`],
                      ['ΔP straight', `${f2(ht.dp_ng.dP_straight/1000)} kPa`],
                      ['ΔP bends', `${f2(ht.dp_ng.dP_bends/1000)} kPa`],
                      ['ΔP total', `${f2(ht.dp_ng.dP_kPa)} kPa (${f1(ht.dp_ng.dP_mbar)} mbar)`],
                    ].map(([l,v]) => (
                      <tr key={l as string}><td>{l}</td><td className="val">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">N_rows Sensitivity — Over-surface vs Rows</div>
              </div>
              <div className="panel-body">
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
                  <label className="field-label" style={{ margin:0 }}>Max rows to show:</label>
                  <input type="number" value={sensMax} min={4} max={30}
                    onChange={e => setSensMax(parseInt(e.target.value)||20)}
                    style={{ width:60 }} />
                </div>
                <SensitivitySVG ht={ht} maxRows={sensMax} />
                <div className="note-box" style={{ marginTop:8, fontSize:10 }}>
                  Orange outline = current design ({ht.N_rows} rows). Green bars = adequate oversurface.
                  Red bars = undersurfaced. Zero line (red dashed) = required area exactly met.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ⑥ ACCURACY ── */}
      {subTab === 'accuracy' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Method Validation Indicators</div></div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="Re (gas)" value={ht.Re_ng} decimals={0}
                    variant={ht.Re_ng > 3000 ? 'green' : 'red'} />
                  <ResultCard label="Dean Factor" value={ht.dean} decimals={3} variant="highlight" />
                  <ResultCard label="Z-Factor" value={ht.fp_ng.Z} decimals={4} />
                  <ResultCard label="U_coil" value={ht.U_pc.U_o} unit="W/m²·K" decimals={0} />
                </ResultGrid>
                <table className="res-table" style={{ marginTop:10, fontSize:11 }}>
                  <thead><tr><th>Parameter</th><th>This Calc</th><th>GPSA Typical Range</th><th>Status</th></tr></thead>
                  <tbody>
                    <tr>
                      <td>U_coil [W/m²·K]</td>
                      <td className="val">{f1(ht.U_pc.U_o)}</td>
                      <td>170 – 340</td>
                      <td style={{ color: ht.U_pc.U_o >= 170 && ht.U_pc.U_o <= 500 ? 'var(--green)' : 'var(--accent)' }}>
                        {ht.U_pc.U_o >= 170 && ht.U_pc.U_o <= 500 ? '✔ Reasonable' : '⚠ Outside range'}
                      </td>
                    </tr>
                    <tr>
                      <td>Re gas (turbulent?)</td>
                      <td className="val">{f0(ht.Re_ng)}</td>
                      <td>&gt; 10,000 ideal</td>
                      <td style={{ color: ht.Re_ng > 4000 ? 'var(--green)' : 'var(--accent)' }}>
                        {ht.Re_ng > 10000 ? '✔ Fully turbulent'
                          : ht.Re_ng > 4000 ? '✔ Turbulent' : '⚠ Transitional / Laminar'}
                      </td>
                    </tr>
                    <tr>
                      <td>Dean enhancement</td>
                      <td className="val">{f3(ht.dean)}×</td>
                      <td>1.05 – 1.35 typical</td>
                      <td style={{ color: ht.dean > 1 ? 'var(--green)' : 'var(--text-dim)' }}>
                        {ht.dean > 1 ? '✔ Applied' : '— No enhancement'}
                      </td>
                    </tr>
                    <tr>
                      <td>Z-factor deviation</td>
                      <td className="val">{((1 - ht.fp_ng.Z)*100).toFixed(1)}% from ideal</td>
                      <td>|Z-1| &lt; 10% = moderate</td>
                      <td style={{ color: Math.abs(1-ht.fp_ng.Z) < 0.1 ? 'var(--green)' : 'var(--accent)' }}>
                        {Math.abs(1-ht.fp_ng.Z) < 0.1 ? '✔ Moderate' : '⚠ High — use PR-EOS (Stage 1)'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title">Method Reference</div></div>
              <div className="panel-body" style={{ fontSize:11, lineHeight:1.8 }}>
                <div><strong>h_i (gas inside coil):</strong> Gnielinski (1976) for Re&gt;3000,
                  Dittus-Boelter for Re&lt;3000. Dean correction per PRCI cold-climate method.</div>
                <div><strong>h_o (bath outside):</strong> Churchill-Chu (1975) natural convection,
                  iterated for surface temperature. Includes bath fluid properties at T_bath.</div>
                <div><strong>Z-factor:</strong> Hall-Yarborough (1974) EOS for lean NG fallback.
                  Overridden by Stage 1 PR-EOS when synced — always prefer synced values.</div>
                <div><strong>ΔP:</strong> Swamee-Jain friction (1976), ε=4.6×10⁻⁵ m commercial steel.
                  Bend resistance K=0.35 per U-bend.</div>
                <div><strong>Radiation:</strong> {ht.f_rad}% of Q_burner is radiant — not modelled
                  by convective correlations. Compensated by scaling Q_conv = Q×(1−f_rad/100).</div>
              </div>
            </div>
          </div>

          <div>
            <div className="panel">
              <div className="panel-header"><div className="panel-title">Z-Factor at Current Conditions</div></div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="Z (current)" value={ht.fp_ng.Z} decimals={4} variant="highlight" />
                  <ResultCard label="Density ρ" value={ht.fp_ng.rho} unit="kg/m³" decimals={3} />
                  <ResultCard label="P operating" value={ht.P_ng_op} unit="barg" decimals={1} />
                  <ResultCard label="T mean" value={(ht.T_ng_in+ht.T_ng_out)/2} unit="°C" decimals={1} />
                </ResultGrid>
                <div className="note-box" style={{ marginTop:8, fontSize:10 }}>
                  <strong>Source:</strong> {ht.fp_ng.source}<br/>
                  For P &gt; 50 barg, strongly recommend syncing from Stage 1 (PR-EOS M6 or Lee-Kesler M7)
                  for accurate ρ and Cp. Hall-Yarborough is reliable to ±3% at P &lt; 100 barg for lean NG.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ⑦ COMPARISON ── */}
      {subTab === 'comparison' && (
        <div>
          {(!s1Results && !s2Results && !s3Results) ? (
            <div className="alert alert-info">ℹ Run Stages 1–3 then click ⚡ Sync to compare.</div>
          ) : (
            <div className="panel">
              <div className="panel-header"><div className="panel-title">Stages 1–3 vs HT Analyser — Parameter Comparison</div></div>
              <div className="panel-body" style={{ overflowX:'auto' }}>
                <table className="res-table" style={{ fontSize:11 }}>
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Parameter</th>
                      <th style={{ color:'var(--accent)' }}>Stages 1–3</th>
                      <th style={{ color:'var(--blue)' }}>HT Analyser</th>
                      <th>Unit</th>
                      <th>Match?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      // Stage 1
                      { src:'S1', param:'Gas T_in',    sv: s1Results?.T_in_C,   htv: form.T_ng_in,  unit:'°C',   tol:0.5 },
                      { src:'S1', param:'Gas T_out',   sv: s1Results?.T_out_C,  htv: form.T_ng_out, unit:'°C',   tol:0.5 },
                      { src:'S1', param:'Gas P_op',    sv: s1Results ? (s1Results.P_kPa/100-1.01325) : undefined,
                        htv: form.P_ng_op, unit:'barg', tol:3 },
                      { src:'S1', param:'Mass flow',   sv: s1Results ? s1Results.mdot_kgs*3600 : undefined,
                        htv: form.ng_mdot*3600, unit:'kg/hr', tol:2 },
                      // Stage 2
                      { src:'S2', param:'Bath T',      sv: (s2Results as any)?.T_bath_C, htv: form.T_bath,   unit:'°C', tol:1 },
                      { src:'S2', param:'Vessel L',    sv: s2Results?.L_shell_mm, htv: form.ves_L,  unit:'mm', tol:2 },
                      { src:'S2', param:'Burner duty', sv: s2Results?.Q_burner_rated_kW, htv: form.Q_burner, unit:'kW', tol:2 },
                      // Stage 3
                      { src:'S3', param:'Coil N_paths',sv: s3Results?.n_pass, htv: form.N_paths, unit:'',   tol:0.1 },
                      { src:'S3', param:'Coil N_rows', sv: s3Results?.n_rows, htv: form.N_rows,  unit:'',   tol:0.1 },
                      { src:'S3', param:'U_coil (S3)', sv: s3Results?.U_Wm2K, htv: ht.U_pc.U_o, unit:'W/m²·K', tol:15 },
                      { src:'S3', param:'LMTD',        sv: s3Results?.LMTD,   htv: ht.lmtd,    unit:'°C', tol:5 },
                    ].map(row => {
                      const sv = row.sv, htv = row.htv;
                      const pct = (sv !== undefined && htv !== undefined && sv !== 0)
                        ? Math.abs(sv - htv) / Math.abs(sv) * 100 : NaN;
                      const status = isNaN(pct) ? '—'
                        : pct < row.tol ? '✔ Match'
                        : pct < 10 ? `⚠ ${pct.toFixed(1)}%`
                        : `✘ ${pct.toFixed(1)}%`;
                      const statusCol = isNaN(pct) ? 'var(--text-dim)'
                        : pct < row.tol ? 'var(--green)'
                        : pct < 10 ? 'var(--accent)' : 'var(--red)';
                      return (
                        <tr key={row.param}>
                          <td style={{ fontSize:10, color:'var(--text-dim)' }}>{row.src}</td>
                          <td>{row.param}</td>
                          <td className="val">{sv !== undefined ? sv.toFixed(sv > 100 ? 0 : 2) : '—'}</td>
                          <td className="val2">{htv !== undefined ? htv.toFixed(htv > 100 ? 0 : 2) : '—'}</td>
                          <td style={{ fontSize:10, color:'var(--text-dim)' }}>{row.unit}</td>
                          <td style={{ fontWeight:700, color:statusCol }}>{status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="note-box" style={{ marginTop:8, fontSize:10 }}>
                  <strong>Tolerance:</strong> T ±0.5°C · P ±3% · Flow ±2% · U ±15% (method difference expected) · Geometry exact.<br/>
                  U_coil difference between Stage 3 (NATCO/GPSA empirical) and HT Analyser (Gnielinski + Churchill-Chu)
                  is expected — both are valid engineering approaches with different accuracy assumptions.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
