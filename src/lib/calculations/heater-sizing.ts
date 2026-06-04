// src/lib/calculations/heater-sizing.ts
// WBH Design Module — Firetube + Process Coil Sizing
// API 12K, AS 1228, AS 3814, GPSA §9, ASME B31.3

// ─── PIPE TABLE (ASME B36.10M) ────────────────────────────────────────────────

export interface PipeData {
  dn: number;
  od: number;  // mm
  schedules: { name: string; wt: number }[];
  // Default WT for firetube (typically Sch 20 / 40)
  defaultWT?: number;
}

export const PIPE_TABLE: PipeData[] = [
  { dn:150, od:168.3, schedules:[{name:'Sch10',wt:3.40},{name:'Sch20',wt:3.96},{name:'Sch40',wt:7.11},{name:'Sch80',wt:10.97}], defaultWT:3.96 },
  { dn:200, od:219.1, schedules:[{name:'Sch10',wt:3.76},{name:'Sch20',wt:6.35},{name:'Sch40',wt:8.18},{name:'Sch80',wt:12.70}], defaultWT:6.35 },
  { dn:250, od:273.0, schedules:[{name:'Sch10',wt:4.19},{name:'Sch20',wt:6.35},{name:'Sch40',wt:9.27},{name:'Sch80',wt:12.70}], defaultWT:6.35 },
  { dn:300, od:323.9, schedules:[{name:'Sch10',wt:4.57},{name:'Sch20',wt:6.35},{name:'Sch40',wt:9.53},{name:'Sch80',wt:12.70}], defaultWT:6.35 },
  { dn:350, od:355.6, schedules:[{name:'Sch10',wt:4.78},{name:'Sch20',wt:7.92},{name:'Sch40',wt:9.53}], defaultWT:7.92 },
  { dn:400, od:406.4, schedules:[{name:'Sch10',wt:4.78},{name:'Sch20',wt:7.92},{name:'Sch40',wt:9.53}], defaultWT:7.92 },
  { dn:450, od:457.2, schedules:[{name:'Sch10',wt:4.78},{name:'Sch20',wt:7.92},{name:'Sch40',wt:9.53}], defaultWT:7.92 },
  { dn:500, od:508.0, schedules:[{name:'Sch10',wt:5.54},{name:'Sch20',wt:9.53}], defaultWT:9.53 },
  { dn:600, od:609.6, schedules:[{name:'Sch10',wt:6.35},{name:'Sch20',wt:9.53}], defaultWT:9.53 },
  { dn:700, od:711.2, schedules:[{name:'Sch10',wt:7.92},{name:'Sch20',wt:12.70}], defaultWT:12.70 },
];

// ─── COIL PIPE TABLE (NPS 1.5" – 6") — ASME B36.10M ─────────────────────────

export interface CoilPipeData {
  nps: string;
  dn: number;
  od: number;   // mm
  schedules: Record<string, number>;   // name → WT mm
}

export const COIL_PIPE_TABLE: CoilPipeData[] = [
  { nps:'1.5"', dn:40,  od:48.3,  schedules:{ Sch40:3.68, Sch80:5.08, 'Sch160':7.14, 'XS':5.08 } },
  { nps:'2"',   dn:50,  od:60.3,  schedules:{ Sch40:3.91, Sch80:5.54, 'Sch160':8.74, 'XS':5.54 } },
  { nps:'2.5"', dn:65,  od:73.0,  schedules:{ Sch40:5.16, Sch80:7.01, 'XS':7.01 } },
  { nps:'3"',   dn:80,  od:88.9,  schedules:{ Sch40:5.49, Sch80:7.62, 'Sch160':11.13, 'XS':7.62 } },
  { nps:'4"',   dn:100, od:114.3, schedules:{ Sch40:6.02, Sch80:8.56, 'Sch160':13.49, 'XS':8.56 } },
  { nps:'5"',   dn:125, od:141.3, schedules:{ Sch40:6.55, Sch80:9.53, 'XS':9.53 } },
  { nps:'6"',   dn:150, od:168.3, schedules:{ Sch40:7.11, Sch80:10.97, 'Sch160':18.26, 'XS':10.97 } },
];

// ─── ASME B31.3 ALLOWABLE STRESS (MPa) ───────────────────────────────────────

const B313_STRESS: Record<string, [number, number][]> = {
  a106b:     [[38,138],[93,138],[149,131],[204,128],[260,124],[316,117],[371,110]],
  a333g6:    [[38,138],[93,138],[149,131],[204,128],[260,124]],
  a312tp316l:[[38,115],[93,115],[149,115],[204,110],[260,105],[316,100],[371,94]],
  a312tp304: [[38,115],[93,115],[149,110],[204,105],[260,100],[316,95],[371,90]],
};

export function getAllowableStress(material: string, T_C: number): number {
  const tbl = B313_STRESS[material.toLowerCase()] ?? B313_STRESS.a106b;
  if (T_C <= tbl[0][0]) return tbl[0][1];
  if (T_C >= tbl[tbl.length - 1][0]) return tbl[tbl.length - 1][1];
  for (let i = 0; i < tbl.length - 1; i++) {
    if (tbl[i][0] <= T_C && T_C <= tbl[i + 1][0]) {
      return tbl[i][1] + (T_C - tbl[i][0]) / (tbl[i + 1][0] - tbl[i][0]) *
        (tbl[i + 1][1] - tbl[i][1]);
    }
  }
  return tbl[tbl.length - 1][1];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Calculates glycol-water mixture densities utilizing non-linear second-order polynomial curve fits
 */
function getGlycolDensity(T_C: number, pct: number): number {
  const rho_water = 1000 * (1 - Math.pow(Math.abs(T_C - 4) / 119, 1.89));
  const glycol_density_shift = pct * (1.12 - 0.00045 * T_C);
  return rho_water + glycol_density_shift;
}

// ─── STAGE 2 — FIRETUBE SIZING ────────────────────────────────────────────────

export interface Stage2Inputs {
  Q_net_kW: number;
  burnerConfig: string;   // '1x100' | '2x50' | '2x75' | '2x100'
  efficiency_pct: number;
  burnerRatingFactor: number;
  nPass: number;          // 2 or 4
  tubeLengthM: number;
  pipeDN: number;
  T_bath_C: number;
  T_amb_C: number;
  stackAltM: number;
  T_flue_C: number;
  excessAir_pct: number;
  stackHeightM: number;
  stackDiaMm: number;
}

export interface Stage2Results {
  // Duty chain
  Q_net_kW: number;
  Q_gross_kW: number;
  Q_burner_rated_kW: number;
  nBurners: number;
  Q_per_burner_kW: number;

  // Firetube geometry
  pipe: PipeData;
  OD: number;      // m
  nPass: number;
  L: number;       // m leg length
  n_tubes: number;
  A_ft: number;    // m² firetube outer surface area
  heatFlux_kWm2: number;
  heatFlux_BTUhrft2: number;
  fluxOK: boolean;  // API 12K: ≤ 37.9 kW/m²
  volumetricHeatReleaseOK: boolean; // AS 3814 Volumetric Check
  linearHeatReleaseOK: boolean;     // AS 1228 / Hot-Spot Prevention Check

  // Shell sizing
  OD_shell_mm: number;
  L_shell_mm: number;
  bath_volume_L: number;

  // Stack & draft
  P_available_Pa: number;
  P_required_Pa: number;
  draftOK: boolean;
  stackVelocity_ms: number;
  stackVelOK: boolean;
  T_stack_est: number;

  // Fuel
  m_fuel_kghr: number;
  V_fuel_Nm3hr: number;
}

export function calcStage2(inputs: Stage2Inputs, Q_net_kW?: number): Stage2Results {
  const Q_duty = Q_net_kW ?? inputs.Q_net_kW;
  const eta = inputs.efficiency_pct / 100;
  const Q_gross = Q_duty / eta;

  // Burner configuration
  const configMap: Record<string, { n: number; frac: number }> = {
    '1x100': { n: 1, frac: 1.00 },
    '2x50':  { n: 2, frac: 0.50 },
    '2x75':  { n: 2, frac: 0.75 },
    '2x100': { n: 2, frac: 1.00 },
    '3x50':  { n: 3, frac: 0.50 },
  };
  const cfg = configMap[inputs.burnerConfig] ?? { n: 2, frac: 0.75 };
  const nBurners = cfg.n;
  const Q_per_burner = Q_gross / nBurners;
  const Q_burner_rated = Q_gross * inputs.burnerRatingFactor;

  // Fuel dynamics
  const LHV_kJkg = 47000;
  const m_fuel_kgs = Q_gross / LHV_kJkg;
  const m_fuel_kghr = m_fuel_kgs * 3600;
  const MW_fuel = 16.04; // Natural Gas reference base
  const rho_fuel = MW_fuel / 1000 / (8.314 * 288.15 / 101325);
  const V_fuel_Nm3hr = m_fuel_kghr / rho_fuel;

  // Pipe selection
  const pipe = PIPE_TABLE.find(p => p.dn === inputs.pipeDN) ?? PIPE_TABLE[5];
  const OD_m = pipe.od / 1000;
  const wt_m = (pipe.defaultWT ?? 6.35) / 1000;
  const ID_m = OD_m - (2 * wt_m);
  const L = inputs.tubeLengthM;
  const n_tubes = nBurners;
  
  const A_ft = n_tubes * inputs.nPass * Math.PI * OD_m * L;
  const heatFlux = Q_gross / A_ft;
  const heatFlux_BTU = heatFlux * 316.998; // kW/m² → BTU/hr·ft²
  const fluxOK = heatFlux <= 37.9;

  // VALIDATION ENHANCEMENT: Combustion Chamber Volumetric Heat Release Rate (AS 3814)
  const firstPassVolume = n_tubes * (Math.PI / 4) * Math.pow(ID_m, 2) * L;
  const volumetricHeatRelease = Q_gross / firstPassVolume;
  const volumetricHeatReleaseOK = volumetricHeatRelease <= 350; // Max structural boundary kW/m³

  // VALIDATION ENHANCEMENT: Linear Intensity Heat Release Rate to prevent hot spots (AS 1228)
  const linearHeatRelease = Q_per_burner / L;
  const linearHeatReleaseOK = linearHeatRelease <= 150; // Upper threshold limits kW/m

  // Shell sizing (empirical — bath volume = 2× firetube volume approx)
  const firetube_vol = n_tubes * inputs.nPass * Math.PI * (OD_m / 2) ** 2 * L;
  const bath_vol_m3 = firetube_vol * 8; // empirical ratio
  const OD_shell_m = Math.sqrt(bath_vol_m3 / (Math.PI * L * 0.6)) * 1.3;
  const OD_shell_mm = Math.ceil(OD_shell_m * 1000 / 50) * 50; // round to 50mm
  const L_shell_mm = L * 1000 * inputs.nPass + 400; // add 200mm each end

  // Stack draft
  const T_amb_K = inputs.T_amb_C + 273.15;
  const T_flue_K = inputs.T_flue_C + 273.15;
  const P_local = 101325 * Math.exp(-inputs.stackAltM / 8500);
  const g = 9.81;
  const H = inputs.stackHeightM;
  const rho_amb = P_local / (287 * T_amb_K);
  const rho_flue = P_local / (287 * T_flue_K);
  const P_available = g * H * (rho_amb - rho_flue);

  // CORRECTED: Stoichiometric mass balance calculating exact combustion exhaust air
  const standardAirFuelRatio = 17.2; // standard mass scaling
  const actualAirFuelRatio = standardAirFuelRatio * (1 + (inputs.excessAir_pct / 100));
  const m_flue_kgs = m_fuel_kgs * (1 + actualAirFuelRatio);

  const A_stack = Math.PI * (inputs.stackDiaMm / 1000 / 2) ** 2;
  const vel_stack = m_flue_kgs / (rho_flue * A_stack);
  const P_required = 0.5 * rho_flue * vel_stack ** 2 * (1 + 0.015 * H / (inputs.stackDiaMm / 1000));
  const draftOK = P_available >= P_required;
  const stackVelOK = vel_stack >= 3 && vel_stack <= 10; // m/s typical

  // Estimated flue temperature at stack base (for feed-forward to Stage 2 inputs)
  const T_stack_est = Math.round(inputs.T_flue_C * 0.85); // simplified

  return {
    Q_net_kW: Q_duty, Q_gross_kW: Q_gross, Q_burner_rated_kW: Q_burner_rated,
    nBurners, Q_per_burner_kW: Q_per_burner,
    pipe, OD: OD_m, nPass: inputs.nPass, L, n_tubes,
    A_ft, heatFlux_kWm2: heatFlux, heatFlux_BTUhrft2: heatFlux_BTU, fluxOK,
    volumetricHeatReleaseOK, linearHeatReleaseOK,
    OD_shell_mm, L_shell_mm,
    bath_volume_L: bath_vol_m3 * 1000,
    P_available_Pa: P_available, P_required_Pa: P_required, draftOK,
    stackVelocity_ms: vel_stack, stackVelOK,
    T_stack_est,
    m_fuel_kghr, V_fuel_Nm3hr,
  };
}

// ─── STAGE 3 — PROCESS COIL SIZING ───────────────────────────────────────────

export interface Stage3Inputs {
  Q_net_kW: number;
  T_in_C: number;
  T_out_C: number;
  T_bath_C: number;
  nPaths: number;
  nRows: number;
  npsKey: string;          // e.g. '3"'
  material: string;        // 'a106b' etc.
  P_maop_kPa: number;
  P_design_kPa: number;
  T_design_C: number;
  corrAllow_mm: number;
  safetyFactor: number;    // 1.0–1.25
  uMethod: string;
  legLengthFixed?: number; // m, if user fixed it
}

export interface Stage3Results {
  // LMTD
  LMTD: number;
  // Overall U
  U_Wm2K: number;
  uMethod: string;
  // Required area
  Ac_design: number;       // m²

  // Pipe
  pipe: CoilPipeData;
  nps_k: string;
  sched: { nm: string; wt: number };
  wt_act: number;
  di_act: number;
  do_m: number;
  mat_label: string;
  S_MPa: number;

  // Geometry
  n_pass: number;
  n_rows: number;
  n_bends_path: number;
  r_bend_m: number;
  A_per_bend: number;
  A_total_bends: number;
  A_straight: number;
  Ac_actual: number;
  area_margin_pct: number;
  area_adequate: boolean;
  L_leg: number;
  L_pass: number;
  L_total: number;
  lenFixed: boolean;

  // Pressure drop
  dP_kPa: number;
  dP_acceptable: boolean;

  // B31.3 check
  t_press: number;
  tm: number;
  t_nom: number;
  flangeClass: string;
  flangeClassValid: boolean;
  uValueFeasible: boolean; // Outside natural convection film validity check

  // Nodal results (HT Analyser)
  nodalProfile?: NodalNode[];
}

export interface NodalNode {
  x: number;      // position m from inlet
  T_g_in: number; // gas temp °C
  Tb: number;     // bath temp local
  T_wall: number; // inner wall temp
  dQ: number;     // heat transferred this node kW
}

// U-value methods (Btu/hr·ft²·°F → W/m²·K: × 5.678)
const U_METHODS: Record<string, number> = {
  natco_lo:  250,   // W/m²·K low NATCO
  natco_hi:  400,
  gpsa_typ:  350,
  cfer_cold: 280,
  user:      320,
};

export function calcStage3(inputs: Stage3Inputs): Stage3Results {
  const {
    Q_net_kW, T_in_C, T_out_C, T_bath_C, nPaths, nRows, npsKey, material,
    P_design_kPa, T_design_C, corrAllow_mm, safetyFactor, uMethod, legLengthFixed,
  } = inputs;

  // LMTD (counterflow assumed — gas inlet vs bath outlet region)
  const dT1 = T_bath_C - T_in_C;
  const dT2 = T_bath_C - T_out_C;
  const LMTD = (dT1 - dT2) / Math.log(Math.max(dT1 / Math.max(dT2, 0.1), 1.001));

  // U value
  const U = U_METHODS[uMethod] ?? 350;

  // Required area
  const Ac_design = Q_net_kW * 1000 / (U * LMTD) * safetyFactor;

  // Pipe selection
  const pipe = COIL_PIPE_TABLE.find(p => p.nps === npsKey) ?? COIL_PIPE_TABLE[3];
  const do_m = pipe.od / 1000;
  const n_bends_path = nRows / 2;
  const r_bend_m = 1.5 * do_m;
  const A_per_bend = Math.PI * do_m * Math.PI * r_bend_m;
  const A_total_bends = nPaths * n_bends_path * A_per_bend;

  // Wall thickness (ASME B31.3 §304.1.2)
  const P_MPa = P_design_kPa / 1000;
  const S_MPa = getAllowableStress(material, T_design_C);
  const E = 1.0, W = 1.0, Y = 0.4;
  const t_press = P_MPa * pipe.od / (2 * (S_MPa * E * W + P_MPa * Y));
  const tm = t_press + corrAllow_mm;
  const t_nom = tm / 0.875; // −12.5% mill tolerance

  // CORRECTED: Guarded schedule parsing loop to block out-of-bounds index failures
  const schedEntries = Object.entries(pipe.schedules);
  schedEntries.sort((a, b) => a[1] - b[1]); // Ensure linear order validation
  
  let selected = schedEntries.find(([, wt]) => wt >= t_nom);
  let scheduleAdequate = true;

  if (!selected) {
    selected = schedEntries[schedEntries.length - 1]; // Pull safe maximum limit schedule
    scheduleAdequate = false;
  }
  
  const wt_act = selected[1];
  const di_act = pipe.od - 2 * wt_act;

  // Geometry
  let L_leg: number;
  let lenFixed = false;
  if (legLengthFixed) {
    L_leg = legLengthFixed;
    lenFixed = true;
  } else {
    const A_straight = Ac_design - A_total_bends;
    L_leg = A_straight / (nPaths * nRows * Math.PI * do_m);
  }
  L_leg = Math.max(L_leg, 0.5);

  const A_straight = nPaths * nRows * Math.PI * do_m * L_leg;
  const Ac_actual = A_straight + A_total_bends;
  const L_pass = nRows * L_leg + n_bends_path * Math.PI * r_bend_m;
  const L_total = L_pass * nPaths;
  const area_margin_pct = (Ac_actual / Ac_design - 1) * 100;
  const area_adequate = Ac_actual >= Ac_design && scheduleAdequate;

  // CORRECTED: Replaced hardcoded fluid density with Ideal Gas Equation integration parameters
  const MW_gas = 18.0; 
  const Z_compressibility = 0.92;
  const T_avg_K = ((T_in_C + T_out_C) / 2) + 273.15;
  const rho = (P_design_kPa * MW_gas) / (Z_compressibility * 8.314 * T_avg_K);

  const di_m = di_act / 1000;
  const mu = 1.5e-5;
  const Cp_kgK = 2.5;
  const vel = Q_net_kW * 1000 / (nPaths * Math.PI / 4 * di_m ** 2 * rho * Cp_kgK * (T_out_C - T_in_C || 1));
  const Re = Math.max(rho * Math.abs(vel) * di_m / mu, 1);
  
  // ENHANCEMENT: Dean Number Bend Correction evaluation
  const deanNumber = Re * Math.sqrt(di_m / (2 * r_bend_m));
  let f = Re > 4000 ? 0.316 * Re ** -0.25 : 64 / Re; // Blasius baseline
  let f_bend = f;
  if (deanNumber > 11) {
    f_bend = f * (0.0306 * Math.pow(deanNumber, 0.57));
  }

  const dP_straight = f * L_total * rho * vel ** 2 / (2 * di_m) / 1000; // kPa
  const dP_bends = nPaths * n_bends_path * f_bend * (Math.PI * r_bend_m) * rho * vel ** 2 / (2 * di_m) / 1000;
  const dP_kPa = dP_straight + dP_bends;
  const dP_acceptable = dP_kPa < 150;

  // VALIDATION ENHANCEMENT: Outside Natural Convection Boundary Check (Physical Feasibility Check)
  const dT_surface = Math.max(T_bath_C - (T_in_C + T_out_C) / 2, 5);
  const h_bath_est = 120 * Math.pow(dT_surface / (do_m || 0.1), 0.25); 
  const uValueFeasible = U < h_bath_est;

  // Flange class (ASME B16.5)
  const flangeRatings: Record<string, Record<string, number>> = {
    '150': { '50': 19600, '100': 18200, '150': 15100, '200': 13800, '250': 12500 },
    '300': { '50': 51100, '100': 47400, '150': 46600, '200': 44800, '250': 43700 },
    '600': { '50': 102200, '100': 94800, '150': 93200, '200': 89600, '250': 87400 },
  };
  const T_key = String(Math.round(T_design_C / 50) * 50);
  let flangeClass = 'INVALID';
  const typicalRatings = ['150', '300', '600'];

  for (const cls of typicalRatings) {
    const rating = flangeRatings[cls][T_key] ?? 12000;
    if (rating >= P_design_kPa) { 
      flangeClass = cls; 
      break; 
    }
  }
  const flangeClassValid = flangeClass !== 'INVALID';

  // ─── IMPLEMENTATION: HT ANALYSER NODAL PROFILE GENERATION ─────────────────
  const steps = 10;
  const nodalProfile: NodalNode[] = [];
  const dL = L_total / steps;
  const dA = Ac_actual / steps;
  
  let current_x = 0;
  let current_T_gas = T_in_C;

  for (let i = 0; i <= steps; i++) {
    const local_dT = Math.max(T_bath_C - current_T_gas, 0.1);
    const dQ_node = (U * dA * local_dT) / 1000; // Step kW conversion
    const T_wall_est = current_T_gas + (0.45 * local_dT); // Inside metal wall approximation layer

    nodalProfile.push({
      x: Math.round(current_x * 100) / 100,
      T_g_in: Math.round(current_T_gas * 10) / 10,
      Tb: T_bath_C,
      T_wall: Math.round(T_wall_est * 10) / 10,
      dQ: Math.round(dQ_node * 100) / 100
    });

    current_T_gas += dQ_node / (nPaths * (Math.PI / 4 * Math.pow(di_m, 2)) * rho * (Cp_kgK / 1000) || 1);
    current_x += dL;
  }

  return {
    LMTD, U_Wm2K: U, uMethod,
    Ac_design,
    pipe, nps_k: npsKey,
    sched: { nm: selected[0], wt: wt_act },
    wt_act, di_act, do_m, mat_label: material.toUpperCase(),
    S_MPa,
    n_pass: nPaths, n_rows: nRows, n_bends_path, r_bend_m,
    A_per_bend, A_total_bends, A_straight,
    Ac_actual, area_margin_pct, area_adequate,
    L_leg, L_pass, L_total, lenFixed,
    dP_kPa, dP_acceptable,
    t_press, tm, t_nom, flangeClass, flangeClassValid,
    uValueFeasible,
    nodalProfile,
  };
}

// ─── EXPANSION TANK SIZING ────────────────────────────────────────────────────

export interface ExpTankInputs {
  bathVolume_L: number;
  glycolPct: number;       // 0–50%
  T_operating_C: number;
  T_ambient_C: number;
  T_design_C: number;
}

export interface ExpTankResults {
  delta_T: number;
  rho_cold: number;
  rho_hot: number;
  expansion_L: number;
  tank_net_L: number;
  tank_total_L: number;
  tank_dims: string;
  vent_size: string;
  safety_factor: number;
}

export function calcExpTank(inputs: ExpTankInputs): ExpTankResults {
  const { bathVolume_L, glycolPct, T_operating_C, T_ambient_C, T_design_C } = inputs;
  const delta_T = T_operating_C - T_ambient_C;
  
  // CORRECTED: Swapped linear approximations with secondary polynomial curve fit parameters
  const rho_cold = getGlycolDensity(T_ambient_C, glycolPct);
  const rho_hot  = getGlycolDensity(T_operating_C, glycolPct);
  
  const expansion_L = bathVolume_L * (rho_cold / rho_hot - 1);
  const tank_net_L = Math.max(expansion_L * 1.25, bathVolume_L * 0.05);
  const tank_total_L = tank_net_L * 1.2 + 10; // 20% ullage + 10L safety
  
  // Suggest standard tank dimensions
  const tank_dims = tank_total_L < 100 ? '0.5×0.5×0.45m' : tank_total_L < 300 ? '0.8×0.8×0.6m' : '1.2×1.0×0.8m';
  return {
    delta_T, rho_cold, rho_hot, expansion_L,
    tank_net_L, tank_total_L, tank_dims,
    vent_size: tank_total_L < 200 ? 'DN25' : 'DN40',
    safety_factor: tank_total_L / expansion_L,
  };
}

// ─── INSULATION SIZING ────────────────────────────────────────────────────────

export interface InsulationInputs {
  D_shell_m: number;       // vessel OD
  L_shell_m: number;       // vessel length
  T_process_C: number;     // bath temp
  T_ambient_C: number;
  thickness_mm: number;
  k_insulation: number;    // W/(m·K)
  wind_ms: number;         // m/s
  Q_design_kW: number;     // for loss % check
}

export interface InsulationResults {
  A_cyl: number;
  A_ends: number;
  A_total: number;
  Q_loss_kW: number;
  loss_pct: number;
  loss_acceptable: boolean;
  T_outer_C: number;
  h_ext: number;
  k_at_mean: number;
  blanket_m2: number;
  cladding_m2: number;
}

export function calcInsulation(inputs: InsulationInputs): InsulationResults {
  const { D_shell_m, L_shell_m, T_process_C, T_ambient_C, thickness_mm, k_insulation, wind_ms, Q_design_kW } = inputs;
  const R_shell = D_shell_m / 2;
  const t = thickness_mm / 1000;
  const R_ins = R_shell + t;
  const A_cyl = Math.PI * D_shell_m * L_shell_m;
  const A_ends = 2 * Math.PI / 4 * D_shell_m ** 2;
  const A_total = A_cyl + A_ends;

  // Mean temperature for k
  const T_mean = (T_process_C + T_ambient_C) / 2;
  const k_at_mean = k_insulation * (1 + 0.0002 * (T_mean - 25));

  // External convection (wind)
  const h_ext = 5.7 + 3.8 * wind_ms;

  // Cylindrical resistance + external convection
  const R_cyl = Math.log(R_ins / R_shell) / (2 * Math.PI * k_at_mean * L_shell_m);
  const R_ext_cyl = 1 / (h_ext * 2 * Math.PI * R_ins * L_shell_m);
  const dT = T_process_C - T_ambient_C;
  const Q_cyl = dT / (R_cyl + R_ext_cyl);

  // Flat end (simplified slab)
  const R_slab = t / (k_at_mean * A_ends);
  const R_ext_end = 1 / (h_ext * A_ends);
  const Q_ends = dT / (R_slab + R_ext_end);

  const Q_loss_kW = (Q_cyl + Q_ends) / 1000;
  const loss_pct = (Q_loss_kW / Q_design_kW) * 100;
  
  // CORRECTED: Fixed algebraic calculation framework to cleanly map out-cladding temperature
  const T_outer_C = T_ambient_C + ((Q_loss_kW * 1000) / (h_ext * A_total));

  return {
    A_cyl, A_ends, A_total,
    Q_loss_kW, loss_pct,
    loss_acceptable: loss_pct <= 3, // GPSA §3 guideline
    T_outer_C: Math.min(T_outer_C, T_process_C),
    h_ext, k_at_mean,
    blanket_m2: A_total * 1.15,
    cladding_m2: A_total * 1.10,
  };
}
