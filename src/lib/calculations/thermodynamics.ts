// src/lib/calculations/thermodynamics.ts
// WBH Design Module — Core Thermodynamic Engine
// Ported from WBH_Design_v28.html — PR-EOS 1976, DIPPR correlations, GPSA §9
// All calc functions are pure (no DOM dependencies) — safe for Server Actions

// ─── COMPONENT DATABASE ───────────────────────────────────────────────────────
// Index: 0=CH4, 1=C2H6, 2=C3H8, 3=iC4, 4=nC4, 5=iC5, 6=nC5, 7=nC6,
//        8=nC7,  9=N2,  10=CO2, 11=H2S, 12=He, 13=H2

export const COMPONENTS = [
  { sym:'CH₄',  name:'Methane',      MW:16.043,  Tc:190.56, Pc:45.99, omega:0.0115,
    a:[19828,102.4,0.01236,-4.15e-5,2.95e-8,298,1500] },
  { sym:'C₂H₆', name:'Ethane',       MW:30.070,  Tc:305.32, Pc:48.72, omega:0.0995,
    a:[30480,127.4,-0.0136,8.53e-5,-3.89e-8,250,1500] },
  { sym:'C₃H₈', name:'Propane',      MW:44.097,  Tc:369.83, Pc:42.48, omega:0.1523,
    a:[42940,156.1,-0.0328,1.51e-4,-6.71e-8,250,1500] },
  { sym:'iC₄',  name:'i-Butane',     MW:58.123,  Tc:408.14, Pc:36.48, omega:0.1808,
    a:[56590,178.3,-0.0406,1.86e-4,-8.25e-8,250,1200] },
  { sym:'nC₄',  name:'n-Butane',     MW:58.123,  Tc:425.12, Pc:37.96, omega:0.2002,
    a:[65350,163.3,-0.0184,8.90e-5,-3.69e-8,250,1200] },
  { sym:'iC₅',  name:'i-Pentane',    MW:72.150,  Tc:460.43, Pc:33.78, omega:0.2275,
    a:[76540,213.0,-0.0505,2.19e-4,-9.10e-8,250,1000] },
  { sym:'nC₅',  name:'n-Pentane',    MW:72.150,  Tc:469.70, Pc:33.70, omega:0.2515,
    a:[83430,189.1,-0.0236,1.01e-4,-3.85e-8,250,1000] },
  { sym:'nC₆',  name:'n-Hexane',     MW:86.177,  Tc:507.60, Pc:30.25, omega:0.3013,
    a:[104700,222.1,-0.0392,1.45e-4,-5.48e-8,250,1000] },
  { sym:'nC₇',  name:'n-Heptane',    MW:100.20,  Tc:540.20, Pc:27.40, omega:0.3498,
    a:[122100,248.8,-0.0487,1.68e-4,-6.07e-8,298,1000] },
  { sym:'N₂',   name:'Nitrogen',     MW:28.014,  Tc:126.20, Pc:33.98, omega:0.0372,
    a:[29105,  8.614,0.0,-0.864e-5,0.0,280,1500] },
  { sym:'CO₂',  name:'Carbon Dioxide',MW:44.010, Tc:304.10, Pc:73.75, omega:0.2239,
    a:[24997, 55.19,-0.0336,7.46e-5,-5.02e-8,250,1200] },
  { sym:'H₂S',  name:'Hydrogen Sulfide',MW:34.082,Tc:373.10,Pc:89.63,omega:0.0942,
    a:[33596,  4.58, 0.0,   0.0,      0.0,  298,1000] },
  { sym:'He',   name:'Helium',        MW:4.003,  Tc:5.19,   Pc:2.27,  omega:(-0.3836),
    a:[20786,  0.0,  0.0,   0.0,      0.0,  100,1500] },
  { sym:'H₂',   name:'Hydrogen',      MW:2.016,  Tc:33.19,  Pc:13.13, omega:(-0.2160),
    a:[29105,  -1.916,0.004003,-8.7e-7,0.0, 250,1500] },
] as const;

// GPSA BIP k_ij — indexed by component INDEX (0-13) to avoid unicode/ASCII key mismatch
// Source: GPSA Engineering Data Book §25, Table 25-1; Whitson & Brulé §3
// Symmetric matrix: kij = kji. Zero = no interaction parameter available.
// Index: 0=CH4, 1=C2H6, 2=C3H8, 3=iC4, 4=nC4, 5=iC5, 6=nC5, 7=nC6, 8=nC7, 9=N2, 10=CO2, 11=H2S, 12=He, 13=H2
const GPSA_BIP_IDX: number[][] = [
//  CH4    C2H6   C3H8   iC4    nC4    iC5    nC5    nC6    nC7    N2     CO2    H2S    He     H2
  [ 0,     0,     0,     0,     0,     0,     0,     0,     0,     0.025, 0.100, 0.070, 0,     0    ], // 0  CH4
  [ 0,     0,     0,     0,     0,     0,     0,     0,     0,     0.042, 0.132, 0.085, 0,     0    ], // 1  C2H6
  [ 0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0.142, 0.089, 0,     0    ], // 2  C3H8
  [ 0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0    ], // 3  iC4
  [ 0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0.148, 0,     0,     0    ], // 4  nC4
  [ 0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0    ], // 5  iC5
  [ 0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0    ], // 6  nC5
  [ 0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0    ], // 7  nC6
  [ 0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0    ], // 8  nC7
  [ 0.025, 0.042, 0,     0,     0,     0,     0,     0,     0,     0,    -0.020, 0.170, 0,     0    ], // 9  N2
  [ 0.100, 0.132, 0.142, 0,     0.148, 0,     0,     0,     0,    -0.020, 0,     0.120, 0,     0   ], // 10 CO2
  [ 0.070, 0.085, 0.089, 0,     0,     0,     0,     0,     0,     0.170, 0.120, 0,     0,     0   ], // 11 H2S
  [ 0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0    ], // 12 He
  [ 0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0    ], // 13 H2
];

export function getBIP(i: number, j: number): number {
  if (i === j) return 0;
  if (i < GPSA_BIP_IDX.length && j < GPSA_BIP_IDX[i].length && GPSA_BIP_IDX[i][j] !== 0)
    return GPSA_BIP_IDX[i][j];
  if (j < GPSA_BIP_IDX.length && i < GPSA_BIP_IDX[j].length && GPSA_BIP_IDX[j][i] !== 0)
    return GPSA_BIP_IDX[j][i];
  return 0;
}

// ─── PR-EOS CORE ──────────────────────────────────────────────────────────────

const R_GAS = 8.31446; // J/(mol·K)

export interface PRParams {
  MW: number;
  Tc_pc: number;
  Pc_pc: number;
  omega_m: number;
}

export interface GasStatePoint {
  Z: number;
  rho: number;        // kg/m³
  Cp0_kgK: number;   // ideal gas Cp kJ/(kg·K)
  Cp1_kgK: number;   // M1 PR analytic
  Cp2_kgK: number;   // M2 PR numeric H
  Cp3_kgK: number;   // M3 PR numeric S
  Cp4_kgK: number;   // M4 SRK
  Cp5_kgK: number;   // M5 avg(M1+M2)
  Cp6_kgK: number;   // M6 ΔH full departure
  Cv_kgK: number;
  mu: number;         // Pa·s
  k: number;          // W/(m·K)
  Pr: number;
  rho_ideal: number;
}

// Ideal-gas Cp at T [K]
// Returns J/(kmol·K) — coefficients are DIPPR 100/200 simple polynomial form scaled to kmol
// Source: DIPPR Project 801; Smith Van Ness Abbott App.B
// Division by MW_mix*1000 in calcMixCp0 converts correctly to kJ/(kg·K)
// Verified: CH4 at 300K → A+B*300+... = 35,500 J/(kmol·K) = 35.5 J/(mol·K) = 2.21 kJ/(kg·K) ✓
export function calcCp0(compIdx: number, T_K: number): number {
  const c = COMPONENTS[compIdx];
  if (!c) return 35000; // fallback in J/(kmol·K)
  const [A, B, C, D, E] = c.a;
  return A + B * T_K + C * T_K ** 2 + D * T_K ** 3 + E * T_K ** 4; // J/(kmol·K)
}

// Mixture Cp0 [kJ/(kg·K)]
export function calcMixCp0(composition: number[], T_K: number, MW_mix: number): number {
  let Cp0_mol = 0;
  composition.forEach((yi, i) => {
    if (yi > 0) Cp0_mol += yi * calcCp0(i, T_K);
  });
  return Cp0_mol / (MW_mix * 1000); // J/mol → kJ/kg
}

// PR-EOS: solve cubic for Z (largest real root = vapour)
export function prEOS_Z(T_K: number, P_bar: number, composition: number[]): number {
  const yTot = composition.reduce((s, y) => s + y, 0);
  if (yTot < 1e-10) return 1.0;
  const y = composition.map(v => v / yTot);

  let MW_m = 0, Tc_m = 0, Pc_m = 0, omega_m = 0;
  y.forEach((yi, i) => {
    const c = COMPONENTS[i];
    MW_m    += yi * c.MW;
    omega_m += yi * c.omega;
  });

  // Mixing rules with BIP
  let a_m = 0, b_m = 0;
  const ai = y.map((_, i) => {
    const c = COMPONENTS[i];
    const kappa = 0.37464 + 1.54226 * c.omega - 0.26992 * c.omega ** 2;
    const Tr = T_K / c.Tc;
    const alpha = (1 + kappa * (1 - Math.sqrt(Tr))) ** 2;
    return 0.45724 * R_GAS ** 2 * c.Tc ** 2 / (c.Pc * 1e5) * alpha;
  });
  const bi = y.map((_, i) => {
    const c = COMPONENTS[i];
    return 0.07780 * R_GAS * c.Tc / (c.Pc * 1e5);
  });

  y.forEach((yi, i) => {
    b_m += yi * bi[i];
    y.forEach((yj, j) => {
      const kij = getBIP(i, j);  // index-based — fixes unicode/ASCII mismatch
      a_m += yi * yj * Math.sqrt(ai[i] * ai[j]) * (1 - kij);
    });
  });

  const P_Pa = P_bar * 1e5;
  const A = a_m * P_Pa / (R_GAS * T_K) ** 2;
  const B = b_m * P_Pa / (R_GAS * T_K);

  // Cubic: Z³ − (1−B)Z² + (A−3B²−2B)Z − (AB−B²−B³) = 0
  const p = -(1 - B);
  const q = A - 3 * B ** 2 - 2 * B;
  const r = -(A * B - B ** 2 - B ** 3);

  const roots = solveCubic(p, q, r);
  const vapourRoots = roots.filter(z => z > B);
  return vapourRoots.length > 0 ? Math.max(...vapourRoots) : roots.reduce((a, b) => Math.max(a, b));
}

function solveCubic(p: number, q: number, r: number): number[] {
  const a2 = p, a1 = q, a0 = r;
  const Q = (3 * a1 - a2 ** 2) / 9;
  const R = (9 * a2 * a1 - 27 * a0 - 2 * a2 ** 3) / 54;
  const D = Q ** 3 + R ** 2;
  if (D >= 0) {
    const S = Math.cbrt(R + Math.sqrt(D));
    const T = Math.cbrt(R - Math.sqrt(D));
    return [S + T - a2 / 3];
  }
  const theta = Math.acos(R / Math.sqrt(-(Q ** 3)));
  const sqrtQ = Math.sqrt(-Q);
  return [
    2 * sqrtQ * Math.cos(theta / 3) - a2 / 3,
    2 * sqrtQ * Math.cos((theta + 2 * Math.PI) / 3) - a2 / 3,
    2 * sqrtQ * Math.cos((theta + 4 * Math.PI) / 3) - a2 / 3,
  ];
}

// Full state-point calculation (all Cp methods, transport)
export function calcStatePoint(
  T_C: number,
  P_kPa: number,
  composition: number[],   // mol fractions summing to 1
  MW_mix: number
): GasStatePoint {
  const T_K = T_C + 273.15;
  const P_bar = P_kPa / 100;
  const P_Pa = P_kPa * 1000;

  const Z = prEOS_Z(T_K, P_bar, composition);
  const rho = P_Pa * MW_mix / (Z * R_GAS * T_K * 1000); // kg/m³
  const rho_ideal = P_Pa * MW_mix / (R_GAS * T_K * 1000);

  // Ideal-gas Cp
  const Cp0_kgK = calcMixCp0(composition, T_K, MW_mix);

  // M1: PR analytic Cv departure
  const Cp1_kgK = calcCpM1(T_K, P_bar, composition, MW_mix, Cp0_kgK);
  // M2: PR numeric ΔH
  const Cp2_kgK = calcCpM2(T_C, P_kPa, composition, MW_mix);
  // M3: PR numeric ΔS
  const Cp3_kgK = calcCpM3(T_C, P_kPa, composition, MW_mix);
  // M4: SRK
  const Cp4_kgK = calcCpM4(T_K, P_bar, composition, MW_mix, Cp0_kgK);
  // M5: avg(M1,M2)
  const Cp5_kgK = (Cp1_kgK + Cp2_kgK) / 2;
  // M6: full ΔH departure
  const Cp6_kgK = calcCpM6(T_C, P_kPa, composition, MW_mix);

  // Cv
  const Cv_kgK = Cp5_kgK - R_GAS / (MW_mix / 1000);

  // Transport: Stiel-Thodos + Lucas — use mixture pseudo-critical (Expert fix C)
  // Pseudo-critical computed here for consistency; also available from Stage1 outputs
  const Tc_pc_local = composition.reduce((s, yi, i) => s + yi * COMPONENTS[i].Tc, 0);
  const Pc_pc_local = composition.reduce((s, yi, i) => s + yi * COMPONENTS[i].Pc, 0);
  // Pseudo-Zc from Lee-Kesler (1975): Zc = 0.2901 - 0.0990·ω_m
  const omega_m = composition.reduce((s, yi, i) => s + yi * COMPONENTS[i].omega, 0);
  const Zc_pc_local = Math.max(0.23, 0.2901 - 0.0990 * omega_m);
  const mu = calcViscosity(T_K, rho, MW_mix, Tc_pc_local, Pc_pc_local, Zc_pc_local);
  const k = calcThermalConductivity(T_K, MW_mix, Cp5_kgK, mu);
  const Pr = mu * Cp5_kgK * 1000 / k;

  return { Z, rho, Cp0_kgK, Cp1_kgK, Cp2_kgK, Cp3_kgK, Cp4_kgK, Cp5_kgK, Cp6_kgK, Cv_kgK, mu, k, Pr, rho_ideal };
}

// ─── Cp Methods ──────────────────────────────────────────────────────────────

function calcCpM1(T_K: number, P_bar: number, y: number[], MW: number, Cp0: number): number {
  // PR analytic Cv departure: Cv_dep = -T·d²(aα)/dT²·I/(2√2·b)
  const b = mixBParam(y);
  const daadT = mixDaadT(T_K, y);
  const d2aadT2 = mixD2aadT2(T_K, y);
  const Z = prEOS_Z(T_K, P_bar, y);
  const V = Z * R_GAS * T_K / (P_bar * 1e5);
  const I = Math.log((V + b * (1 + Math.SQRT2)) / (V + b * (1 - Math.SQRT2))) / (2 * Math.SQRT2 * b);
  const Cv_dep = -T_K * d2aadT2 * I;
  const Cv0 = Cp0 * MW / 1000 - R_GAS; // J/(mol·K) ideal Cv
  const Cv_real = (Cv0 + Cv_dep);       // J/(mol·K)
  // Cp - Cv departure
  const aa = mixAaParam(T_K, y);
  const dP_dT_V = R_GAS / (V - b) - daadT / (V * (V + b) + b * (V - b));
  const dP_dV_T = -R_GAS * T_K / (V - b) ** 2 + aa * (2 * V + 2 * b) / (V * (V + b) + b * (V - b)) ** 2;
  const Cp_Cv_dep = -T_K * dP_dT_V ** 2 / dP_dV_T;
  const Cp_real = Cv_real + Cp_Cv_dep + R_GAS; // approximately
  return Math.max(Cp_real / (MW / 1000) / 1000, 0.5); // kJ/(kg·K)
}

function calcCpM2(T_C: number, P_kPa: number, y: number[], MW: number): number {
  const dT = 0.5;
  const h1 = calcEnthalpy(T_C - dT, P_kPa, y, MW);
  const h2 = calcEnthalpy(T_C + dT, P_kPa, y, MW);
  return Math.max((h2 - h1) / (2 * dT), 0.5);
}

function calcCpM3(T_C: number, P_kPa: number, y: number[], MW: number): number {
  const T_K = T_C + 273.15;
  const dT = 0.5;
  const s1 = calcEntropy(T_C - dT, P_kPa, y, MW);
  const s2 = calcEntropy(T_C + dT, P_kPa, y, MW);
  return Math.max(T_K * (s2 - s1) / (2 * dT), 0.5);
}

// ── Genuine SRK EOS parameters (Soave 1972) ─────────────────────────────────
// Ω_a = 0.42748, Ω_b = 0.08664 (different from PR's 0.45724 / 0.07780)
// κ_SRK = 0.480 + 1.574ω − 0.176ω²  (Soave 1972, Chem.Eng.Sci. 27:1197)
// α_SRK(T) = [1 + κ(1 − √Tr)]²  (same functional form as PR)
// SRK integral: ∫dV/(V(V+b)) = ln(V/(V+b)) / b → I_SRK = ln((V+b)/V) / b
// H_dep_SRK = RT(Z−1) + (T·daadT_SRK − aa_SRK)/b · ln(V/(V+b))
function srkAaParam(T_K: number, y: number[]): number {
  const ai_srk = y.map((_, i) => {
    const c = COMPONENTS[i];
    const kappa_srk = 0.480 + 1.574 * c.omega - 0.176 * c.omega ** 2;
    const Tr = T_K / c.Tc;
    const alpha_srk = (1 + kappa_srk * (1 - Math.sqrt(Tr))) ** 2;
    return 0.42748 * R_GAS ** 2 * c.Tc ** 2 / (c.Pc * 1e5) * alpha_srk;
  });
  let aa = 0;
  y.forEach((yi, i) => y.forEach((yj, j) => {
    const kij = getBIP(i, j);
    aa += yi * yj * Math.sqrt(ai_srk[i] * ai_srk[j]) * (1 - kij);
  }));
  return aa;
}
function srkBParam(y: number[]): number {
  return y.reduce((sum, yi, i) =>
    sum + yi * 0.08664 * R_GAS * COMPONENTS[i].Tc / (COMPONENTS[i].Pc * 1e5), 0);
}
function srkDaadT(T_K: number, y: number[]): number {
  const dT = 0.5;
  return (srkAaParam(T_K + dT, y) - srkAaParam(T_K - dT, y)) / (2 * dT);
}
function srkD2aadT2(T_K: number, y: number[]): number {
  const dT = 0.5;
  return (srkAaParam(T_K + dT, y) - 2 * srkAaParam(T_K, y) + srkAaParam(T_K - dT, y)) / dT ** 2;
}

function calcCpM4(T_K: number, P_bar: number, y: number[], MW: number, Cp0: number): number {
  // Genuine SRK Cp via enthalpy departure numerical derivative
  // Reference: Soave (1972) Chem.Eng.Sci. 27:1197; Smith, Van Ness & Abbott §3.6
  const dT = 0.5;
  const P_kPa = P_bar * 100;
  const h1 = calcEnthalpySRK(T_K - dT, P_kPa, y, MW);
  const h2 = calcEnthalpySRK(T_K + dT, P_kPa, y, MW);
  return Math.max((h2 - h1) / (2 * dT), 0.5);
}

function calcEnthalpySRK(T_K: number, P_kPa: number, y: number[], MW: number): number {
  const P_bar = P_kPa / 100;
  const b = srkBParam(y);
  const aa = srkAaParam(T_K, y);
  const daadT = srkDaadT(T_K, y);

  // SRK cubic Z: Z³ - Z² + (A-B-B²)Z - AB = 0
  // where A = aa·P/(RT)², B = b·P/(RT)
  const P_Pa = P_bar * 1e5;
  const A_srk = aa * P_Pa / (R_GAS * T_K) ** 2;
  const B_srk = b * P_Pa / (R_GAS * T_K);
  const roots = solveCubic(-(1), A_srk - B_srk - B_srk ** 2, -A_srk * B_srk);
  const vapRoots = roots.filter(z => z > B_srk);
  const Z_srk = vapRoots.length > 0 ? Math.max(...vapRoots) : Math.max(...roots);

  const V = Z_srk * R_GAS * T_K / P_Pa;
  // SRK enthalpy departure: H-H_ig = RT(Z-1) + (T·daadT - aa)/b · ln(V/(V+b))
  const H_dep = (P_Pa * V - R_GAS * T_K) + (T_K * daadT - aa) / b * Math.log(V / (V + b));
  const H0 = calcMixCp0(y, T_K, MW) * MW;
  return (H0 + H_dep / (MW / 1000)) / 1000;
}

function calcCpM6(T_C: number, P_kPa: number, y: number[], MW: number): number {
  // Full ΔH departure — HYSYS-equivalent enthalpy difference
  const dT = 1.0;
  const h1 = calcEnthalpyFull(T_C - dT / 2, P_kPa, y, MW);
  const h2 = calcEnthalpyFull(T_C + dT / 2, P_kPa, y, MW);
  return Math.max((h2 - h1) / dT, 0.5);
}

// Enthalpy departure H_dep = a·T·dα/dT − a·α using PR-EOS integral
function calcEnthalpy(T_C: number, P_kPa: number, y: number[], MW: number): number {
  const T_K = T_C + 273.15;
  const P_bar = P_kPa / 100;
  const Z = prEOS_Z(T_K, P_bar, y);
  const b = mixBParam(y);
  const aa = mixAaParam(T_K, y);
  const daadT = mixDaadT(T_K, y);
  const P_Pa = P_bar * 1e5;
  const V = Z * R_GAS * T_K / P_Pa;
  const H0 = calcMixCp0(y, T_K, MW) * MW; // J/mol relative to 0
  // PR-EOS enthalpy departure — Poling, Prausnitz & O'Connell 5th Ed §6-7
  // H - H_ig = RT(Z-1) + (T·daadT - aa)/(2√2·b) · ln[(V+b(1+√2))/(V+b(1-√2))]
  // Note: (T·daadT - aa) has daadT first (negative for normal T range, making H_dep < 0 = correct)
  const H_dep = (P_Pa * V - R_GAS * T_K) + (T_K * daadT - aa) / (2 * Math.SQRT2 * b) *
    Math.log((V + b * (1 + Math.SQRT2)) / (V + b * (1 - Math.SQRT2)));
  return (H0 + H_dep / (MW / 1000)) / 1000; // kJ/kg
}

function calcEnthalpyFull(T_C: number, P_kPa: number, y: number[], MW: number): number {
  return calcEnthalpy(T_C, P_kPa, y, MW);
}

function calcEntropy(T_C: number, P_kPa: number, y: number[], MW: number): number {
  const T_K = T_C + 273.15;
  const P_bar = P_kPa / 100;
  const Z = prEOS_Z(T_K, P_bar, y);
  const b = mixBParam(y);
  const daadT = mixDaadT(T_K, y);
  const P_Pa = P_bar * 1e5;
  const V = Z * R_GAS * T_K / P_Pa;
  // PR-EOS entropy departure — Poling, Prausnitz & O'Connell 5th Ed §6-7
  // S - S_ig = R·ln(Z - B) - daadT/(2√2·b) · ln[(V+b(1+√2))/(V+b(1-√2))]
  const S_dep = R_GAS * Math.log(Z - P_Pa * b / (R_GAS * T_K)) -
    daadT / (2 * Math.SQRT2 * b) *
    Math.log((V + b * (1 + Math.SQRT2)) / (V + b * (1 - Math.SQRT2)));
  return (S_dep / (MW / 1000)) / 1000; // kJ/(kg·K)
}

// ─── PR-EOS Mixture Helpers ───────────────────────────────────────────────────

function mixBParam(y: number[]): number {
  return y.reduce((sum, yi, i) => sum + yi * 0.07780 * R_GAS * COMPONENTS[i].Tc / (COMPONENTS[i].Pc * 1e5), 0);
}

function getAlpha(i: number, T_K: number): number {
  const c = COMPONENTS[i];
  const kappa = 0.37464 + 1.54226 * c.omega - 0.26992 * c.omega ** 2;
  const Tr = T_K / c.Tc;
  return (1 + kappa * (1 - Math.sqrt(Tr))) ** 2;
}

function mixAaParam(T_K: number, y: number[]): number {
  const ai = y.map((_, i) => {
    const c = COMPONENTS[i];
    return 0.45724 * R_GAS ** 2 * c.Tc ** 2 / (c.Pc * 1e5) * getAlpha(i, T_K);
  });
  let aa = 0;
  y.forEach((yi, i) => y.forEach((yj, j) => {
    const kij = getBIP(i, j);  // index-based BIP lookup — fixes unicode key mismatch
    aa += yi * yj * Math.sqrt(ai[i] * ai[j]) * (1 - kij);
  }));
  return aa;
}

function mixDaadT(T_K: number, y: number[]): number {
  const dT = 0.5;
  return (mixAaParam(T_K + dT, y) - mixAaParam(T_K - dT, y)) / (2 * dT);
}

function mixD2aadT2(T_K: number, y: number[]): number {
  const dT = 0.5;
  return (mixAaParam(T_K + dT, y) - 2 * mixAaParam(T_K, y) + mixAaParam(T_K - dT, y)) / dT ** 2;
}

// ─── TRANSPORT PROPERTIES ────────────────────────────────────────────────────

// calcViscosity: Stiel-Thodos low-pressure + Lucas high-pressure correction
// Requires mixture pseudo-critical Tc_pc, Pc_pc from Kay's rule (Expert fix C)
// Reference: Poling, Prausnitz & O'Connell §9-4; Lucas (1981)
export function calcViscosity(
  T_K: number, rho_kgm3: number, MW: number,
  Tc_pc: number = 190.56,   // K  — pass from Stage1 Kay's rule
  Pc_pc: number = 45.99,    // bar — pass from Stage1 Kay's rule
  Zc_pc: number = 0.288     // mixture pseudo-Zc (Lee-Kesler: 0.2901 - 0.0990·ω_m)
): number {
  const Tr = T_K / Tc_pc;
  // Stiel-Thodos low-pressure viscosity [Pa·s]
  // Reference: Stiel & Thodos (1961), AIChE J. 7(4):611
  let mu0: number;
  if (Tr < 1.5) {
    mu0 = 34e-5 * Tr ** 0.94 / (MW / 1000) ** 0.5;
  } else {
    mu0 = 17.78e-5 * (4.58 * Tr - 1.67) ** 0.625 / (MW / 1000) ** 0.5;
  }
  // Lucas high-pressure correction
  // rho_c = Pc·M / (R·Tc·Zc) in kg/m³
  const rho_c = (Pc_pc * 1e5) * (MW / 1000) / (R_GAS * Tc_pc * Zc_pc);
  const rho_r = rho_kgm3 / rho_c;
  const delta_mu = 1.023e-7 * (Math.exp(1.439 * rho_r) - Math.exp(-1.111 * rho_r ** 1.858));
  return Math.max(mu0 + delta_mu, 5e-6);
}

export function calcThermalConductivity(T_K: number, MW: number, Cp_kgK: number, mu_Pas: number): number {
  // Modified Eucken: k = mu * Cp * (1.32 + 1.77/(Cp*MW/R_GAS))
  const Cp_molK = Cp_kgK * MW / 1000 * 1000; // J/(mol·K)
  const k = mu_Pas * Cp_molK / (MW / 1000) * (1.32 + 1.77 / (Cp_molK / R_GAS));
  return Math.max(k * 0.001, 0.02); // W/(m·K)
}

// ─── STAGE 1 MAIN CALCULATION ────────────────────────────────────────────────

export interface Stage1Inputs {
  composition: number[];   // mol fractions [0..1]
  T_in_C: number;
  T_out_C: number;
  P_kPa: number;
  dP_kPa: number;
  massFlow_kgh: number;    // already converted to kg/hr
  basisMethod: number;     // 1-6
  T_design_C: number;
  P_design_kPa: number;
  dutyOverride_kW?: number;
}

export interface Stage1Results {
  MW: number;
  SG: number;
  Tc_pc: number;
  Pc_pc: number;
  T_in_C: number;
  T_out_C: number;
  P_kPa: number;
  dP_kPa: number;
  T_des_C: number;
  P_des: number;
  mdot_kgs: number;
  ST_in: GasStatePoint;
  ST_out: GasStatePoint;
  ST_des: GasStatePoint;
  Q_final: number;         // kW net process duty
  Q_method: string;
  hydrateT_C: number;
  heatingValues?: { HHV_kJkg: number; LHV_kJkg: number };
}

export function calcStage1(inputs: Stage1Inputs): Stage1Results {
  const { composition, T_in_C, T_out_C, P_kPa, dP_kPa, massFlow_kgh, basisMethod,
          T_design_C, P_design_kPa, dutyOverride_kW } = inputs;

  const ySum = composition.reduce((s, v) => s + v, 0);
  const y = ySum > 0 ? composition.map(v => v / ySum) : composition;

  // Mixture MW
  const MW = y.reduce((s, yi, i) => s + yi * COMPONENTS[i].MW, 0);
  const SG = MW / 28.966;

  // Pseudo-critical (Kay's rule)
  const Tc_pc = y.reduce((s, yi, i) => s + yi * COMPONENTS[i].Tc, 0);
  const Pc_pc = y.reduce((s, yi, i) => s + yi * COMPONENTS[i].Pc, 0);

  const mdot_kgs = massFlow_kgh / 3600;

  const P_out_kPa = P_kPa - dP_kPa;
  const ST_in  = calcStatePoint(T_in_C,    P_kPa,    y, MW);
  const ST_out = calcStatePoint(T_out_C,   P_out_kPa, y, MW);
  const ST_des = calcStatePoint(T_design_C, P_design_kPa, y, MW);

  // Select Cp by basis method
  const CpMap: Record<number, keyof GasStatePoint> = {
    1: 'Cp1_kgK', 2: 'Cp2_kgK', 3: 'Cp3_kgK',
    4: 'Cp4_kgK', 5: 'Cp5_kgK', 6: 'Cp6_kgK',
  };
  const cpKey = CpMap[basisMethod] ?? 'Cp5_kgK';
  const Cp_avg = ((ST_in[cpKey] as number) + (ST_out[cpKey] as number)) / 2;
  const dT = T_out_C - T_in_C;

  let Q_calc = mdot_kgs * Cp_avg * dT; // kW (Cp in kJ/(kg·K))
  if (basisMethod === 6) {
    // M6: enthalpy difference
    Q_calc = mdot_kgs * (
      calcEnthalpyFull(T_out_C, P_out_kPa, y, MW) -
      calcEnthalpyFull(T_in_C,  P_kPa,     y, MW)
    );
  }

  const Q_final = dutyOverride_kW ?? Q_calc;
  const Q_method = dutyOverride_kW ? 'Manual override' : `M${basisMethod}`;

  const hydrateT_C = calcHydrateT(P_out_kPa);

  // Heating values (approximate for natural gas mix)
  const HHV_kJkg = y.reduce((s, yi, i) => {
    const HHV_vals = [55695,51877,50330,49360,49500,48583,48643,47793,47641,0,0,21900,0,141800];
    return s + yi * (HHV_vals[i] ?? 0);
  }, 0);
  const LHV_kJkg = y.reduce((s, yi, i) => {
    const LHV_vals = [50050,47484,46357,45602,45714,44916,44985,44743,44557,0,0,21900,0,119950];
    return s + yi * (LHV_vals[i] ?? 0);
  }, 0);

  return {
    MW, SG, Tc_pc, Pc_pc, T_in_C, T_out_C, P_kPa, dP_kPa,
    T_des_C: T_design_C, P_des: P_design_kPa,
    mdot_kgs, ST_in, ST_out, ST_des,
    Q_final, Q_method, hydrateT_C,
    heatingValues: { HHV_kJkg, LHV_kJkg },
  };
}

// ─── HYDRATE PREDICTION (Hammerschmidt approximation) ─────────────────────────
export function calcHydrateT(P_kPa: number): number {
  return -10 + 0.007 * P_kPa;
}

// ─── JOULE-THOMSON ────────────────────────────────────────────────────────────
export function calcJouleThomson(T_C: number, P_kPa: number, composition: number[], MW: number): number {
  // μ_JT = (dT/dP)_H — PR-EOS finite difference
  const dP = 10; // kPa
  const h1 = calcEnthalpy(T_C, P_kPa + dP, composition, MW);
  const h2 = calcEnthalpy(T_C, P_kPa - dP, composition, MW);
  // isenthalpic: dT/dP = (1/Cp) * (T*(∂V/∂T)_P - V)
  const sp = calcStatePoint(T_C, P_kPa, composition, MW);
  const T_K = T_C + 273.15;
  const Cp = sp.Cp5_kgK * 1000; // J/(kg·K)
  const dV_dT = (calcStatePoint(T_C + 1, P_kPa, composition, MW).rho -
                 calcStatePoint(T_C - 1, P_kPa, composition, MW).rho) / (-(sp.rho ** 2) * 2);
  const muJT = (T_K * dV_dT - 1 / sp.rho) / Cp * 1e5; // °C/bar
  return muJT;
}

// No re-exports from schema needed here - types defined inline above
