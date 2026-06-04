// src/lib/validation/engineering-checks.ts
// WBH Design Module — Shared Engineering Validation Library
// All checks return ValidationResult objects with severity, code and actionable messages
// Used by: API routes (server-side) + client-side form hooks

import { z } from 'zod';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  code: string;
  field?: string;
  message: string;
  severity: Severity;
  reference?: string;   // Standard reference e.g. "API 12K §4.3"
}

export type ValidationReport = {
  messages: ValidationResult[];
  errors: ValidationResult[];
  warnings: ValidationResult[];
  infos: ValidationResult[];
  isValid: boolean;      // no errors
};

function buildReport(messages: ValidationResult[]): ValidationReport {
  return {
    messages,
    errors:   messages.filter(m => m.severity === 'error'),
    warnings: messages.filter(m => m.severity === 'warning'),
    infos:    messages.filter(m => m.severity === 'info'),
    isValid:  !messages.some(m => m.severity === 'error'),
  };
}

// ─── ZOD SCHEMAS ─────────────────────────────────────────────────────────────

export const gasCompositionSchema = z.object({
  components: z.array(z.object({
    index: z.number().int().min(0).max(13),
    symbol: z.string(),
    molPct: z.number().min(0).max(100),
  })),
  presetId: z.string().optional(),
}).refine(
  data => {
    const total = data.components.reduce((s, c) => s + c.molPct, 0);
    return Math.abs(total - 100) < 0.01;
  },
  { message: 'Gas composition must sum to 100 mol%', path: ['components'] }
);

export const processConditionsSchema = z.object({
  T_in_C:         z.number().min(-60, 'Min inlet temp −60°C').max(200),
  T_out_C:        z.number().min(-60).max(200),
  P_in_kPa:       z.number().positive().max(200000, 'Max 200 000 kPa (200 barg)'),
  dP_kPa:         z.number().min(0).max(5000),
  massFlow:       z.number().positive().max(1e7),
  flowUnit:       z.enum(['kgh', 'nm3h']),
  T_design_C:     z.number().min(-60).max(400),
  P_design_kPa:   z.number().positive(),
  dutyOverride_kW: z.number().positive().optional(),
}).refine(
  data => data.T_out_C > data.T_in_C,
  { message: 'Outlet temperature must be greater than inlet temperature', path: ['T_out_C'] }
);

export const firetubeConfigSchema = z.object({
  Q_net_kW:          z.number().positive().max(50000),
  burnerConfig:      z.enum(['1x100', '2x50', '2x75', '2x100', '3x50']),
  draftType:         z.enum(['natural', 'forced', 'induced']),
  efficiency_pct:    z.number().min(50).max(95),
  burnerRatingFactor: z.number().min(1.0).max(1.5),
  nPass:             z.number().int().min(2).max(4),
  tubeLengthM:       z.number().min(1).max(15),
  pipeDN:            z.number().int().positive(),
  Tbath_C:           z.number().min(40).max(95),
});

export const coilConfigSchema = z.object({
  Q_net_kW:       z.number().positive().max(50000),
  T_in_C:         z.number().min(-60).max(200),
  T_out_C:        z.number().min(-60).max(200),
  T_bath_C:       z.number().min(40).max(95),
  nPaths:         z.number().int().min(1).max(12),
  nRows:          z.number().int().min(2).max(30).refine(v => v % 2 === 0, 'Rows must be even (U-bend returns)'),
  nps:            z.string(),
  material:       z.string(),
  P_maop_kPa:     z.number().positive(),
  P_design_kPa:   z.number().positive(),
  T_design_C:     z.number().positive(),
  corrAllow_mm:   z.number().min(0).max(10),
  safetyFactor:   z.number().min(1.0).max(1.5),
  uMethod:        z.string(),
  legLengthFixed: z.number().positive().optional(),
});

// ─── ENGINEERING CHECK FUNCTIONS ──────────────────────────────────────────────

/**
 * Validate gas composition (mole balance, H2S/CO2 sour limits, etc.)
 */
// checkGasComposition accepts EITHER mol fractions (sum≈1) OR mol% (sum≈100)
// Auto-detects by checking if sum is near 1 or near 100, then normalises internally
export function checkGasComposition(
  composition: number[],
  { P_kPa, T_C }: { P_kPa?: number; T_C?: number } = {}
): ValidationReport {
  const msgs: ValidationResult[] = [];
  const rawSum = composition.reduce((s, v) => s + v, 0);

  // Auto-detect: if sum is near 1.0 → mol fractions; if near 100 → mol%
  // Convert everything to mol fractions for internal use
  const isFractions = rawSum < 2.0;
  const moleFracs = isFractions ? composition : composition.map(v => v / 100);
  const total = moleFracs.reduce((s, v) => s + v, 0);

  if (Math.abs(total - 1.0) > 0.01) {
    msgs.push({
      code: 'COMP_SUM',
      field: 'composition',
      message: `Composition total is ${(total * 100).toFixed(2)} mol% — must be 100%. Normalise before calculating.`,
      severity: 'error',
    });
  } else if (Math.abs(total - 1.0) > 0.0001) {
    msgs.push({
      code: 'COMP_SUM_WARN',
      message: `Composition sums to ${(total * 100).toFixed(3)} mol% — slight imbalance; normalised internally.`,
      severity: 'warning',
    });
  }

  // All downstream checks use mol fractions (0-1)
  const h2s = moleFracs[11] ?? 0;
  const co2 = moleFracs[10] ?? 0;
  const h2sPa = h2s * (P_kPa ?? 0) * 1000;

  // NACE MR0175 / ISO 15156 sour threshold: H2S partial pressure > 0.3 kPa absolute
  if (h2s > 0 && P_kPa && h2sPa > 300) { // h2sPa = h2s_fraction * P_kPa * 1000 Pa = partial pressure Pa
    msgs.push({
      code: 'SOUR_THRESHOLD',
      field: 'h2s',
      message: `H₂S partial pressure ${(h2sPa / 1000).toFixed(3)} kPa exceeds 0.3 kPa NACE threshold — sour service assessment required.`,
      severity: 'warning',
      reference: 'NACE MR0175 / ISO 15156 §2.3',
    });
  }
  if (h2s > 0.05) { // >5 mol%
    msgs.push({
      code: 'HIGH_H2S',
      message: `High H₂S concentration (${(h2s*100).toFixed(1)}%) — verify material selection for all wetted parts.`,
      severity: 'warning',
      reference: 'AS 4041 / ASME B31.3 §323.4.2',
    });
  }
  if (co2 > 0.08) { // >8 mol%
    msgs.push({
      code: 'HIGH_CO2',
      message: `CO₂ concentration ${(co2*100).toFixed(1)}% is high — check for corrosion risk and PR-EOS accuracy near critical point.`,
      severity: 'info',
    });
  }

  // Methane check
  if ((moleFracs[0] ?? 0) < 0.50 && total > 0.90) {
    msgs.push({
      code: 'LOW_METHANE',
      message: `Methane ${((moleFracs[0] ?? 0) * 100).toFixed(1)}% — Rich gas / LPG-heavy stream. Verify composition. PR-EOS accuracy may reduce for heavy mixtures.`,
      severity: 'info',
    });
  }

  return buildReport(msgs);
}

/**
 * Check process conditions for physical plausibility
 */
export function checkProcessConditions(
  T_in_C: number,
  T_out_C: number,
  P_kPa: number,
  dP_kPa: number,
  T_design_C: number,
  P_design_kPa: number
): ValidationReport {
  const msgs: ValidationResult[] = [];

  if (T_out_C <= T_in_C) {
    msgs.push({ code:'T_DIRECTION', field:'T_out_C',
      message:'Outlet temperature must exceed inlet temperature for a heater.',
      severity:'error' });
  }
  if (T_design_C < T_out_C) {
    msgs.push({ code:'T_DESIGN_LOW', field:'T_design_C',
      message:`Design temperature (${T_design_C}°C) is below process outlet temperature (${T_out_C}°C).`,
      severity:'error', reference:'ASME VIII Div 1 UG-20' });
  }
  if (P_design_kPa < P_kPa) {
    msgs.push({ code:'P_DESIGN_LOW', field:'P_design_kPa',
      message:`Design pressure (${P_design_kPa} kPa) is below operating pressure (${P_kPa} kPa).`,
      severity:'error', reference:'AS 1228 §3.2' });
  }
  if (P_kPa > 150000) {
    msgs.push({ code:'HIGH_PRESSURE', field:'P_kPa',
      message:`Operating pressure ${(P_kPa/1000).toFixed(0)} MPa is very high — verify PR-EOS accuracy; consider M6 method.`,
      severity:'warning', reference:'API 12K §2.2' });
  }
  if (dP_kPa > P_kPa * 0.05) {
    msgs.push({ code:'HIGH_DP', field:'dP_kPa',
      message:`Pressure drop (${dP_kPa} kPa) exceeds 5% of inlet pressure — verify coil sizing.`,
      severity:'warning' });
  }
  if (T_out_C > 80) {
    msgs.push({ code:'HIGH_TOUT',
      message:`Outlet temperature ${T_out_C}°C is above typical WBH bath limit (~80°C). Verify bath temperature is sufficient.`,
      severity:'warning', reference:'API 12K §4.1' });
  }

  return buildReport(msgs);
}

/**
 * Check firetube heat flux against API 12K limits
 */
export function checkHeatFlux(
  heatFlux_kWm2: number,
  fluidType: 'water-glycol' | 'hot-oil' = 'water-glycol'
): ValidationReport {
  const msgs: ValidationResult[] = [];
  const limit = fluidType === 'water-glycol' ? 37.9 : 25;

  if (heatFlux_kWm2 > limit * 1.1) {
    msgs.push({
      code: 'HEAT_FLUX_EXCEED',
      message: `Heat flux ${heatFlux_kWm2.toFixed(1)} kW/m² exceeds API 12K limit ${limit} kW/m² for ${fluidType} bath. Increase firetube area.`,
      severity: 'error',
      reference: 'API 12K §4.3',
    });
  } else if (heatFlux_kWm2 > limit) {
    msgs.push({
      code: 'HEAT_FLUX_MARGINAL',
      message: `Heat flux ${heatFlux_kWm2.toFixed(1)} kW/m² marginally above API 12K limit ${limit} kW/m² — increase tube size or length.`,
      severity: 'warning',
      reference: 'API 12K §4.3',
    });
  } else if (heatFlux_kWm2 < 8) {
    msgs.push({
      code: 'HEAT_FLUX_LOW',
      message: `Heat flux ${heatFlux_kWm2.toFixed(1)} kW/m² is very low — firetube may be oversized. Check burner efficiency.`,
      severity: 'info',
    });
  }

  return buildReport(msgs);
}

/**
 * Check ASME B31.3 pipe wall thickness compliance
 */
export function checkB313WallThickness(
  t_selected_mm: number,
  t_required_mm: number,
  pipeSched: string,
  pipeOD: number
): ValidationReport {
  const msgs: ValidationResult[] = [];
  const margin = t_selected_mm - t_required_mm;

  if (margin < 0) {
    msgs.push({
      code: 'B313_WT_FAIL',
      message: `Schedule ${pipeSched} (WT ${t_selected_mm.toFixed(2)} mm) is INSUFFICIENT. Required ${t_required_mm.toFixed(2)} mm per B31.3. Use heavier schedule.`,
      severity: 'error',
      reference: 'ASME B31.3-2022 §304.1.2',
    });
  } else if (margin < 0.5) {
    msgs.push({
      code: 'B313_WT_MARGINAL',
      message: `Margin to B31.3 minimum is only ${margin.toFixed(2)} mm — consider next heavier schedule for fabrication tolerance.`,
      severity: 'warning',
      reference: 'ASME B31.3-2022 §304.1.2',
    });
  }

  return buildReport(msgs);
}

/**
 * Check hydrate risk
 */
export function checkHydrateRisk(
  T_outlet_C: number,
  T_hydrate_C: number
): ValidationReport {
  const msgs: ValidationResult[] = [];
  const margin = T_outlet_C - T_hydrate_C;

  if (margin < 0) {
    msgs.push({
      code: 'HYDRATE_FAIL',
      message: `Gas outlet temperature (${T_outlet_C.toFixed(1)}°C) is BELOW hydrate formation temperature (${T_hydrate_C.toFixed(1)}°C). Hydrate plugging risk — increase heater duty or outlet temperature.`,
      severity: 'error',
      reference: 'GPSA §20, ASTM D-3827',
    });
  } else if (margin < 5) {
    msgs.push({
      code: 'HYDRATE_MARGINAL',
      message: `Hydrate margin is only ${margin.toFixed(1)}°C above T_hydrate = ${T_hydrate_C.toFixed(1)}°C. GPSA recommends ≥ 5°C margin for transient surges.`,
      severity: 'warning',
      reference: 'GPSA §20-11',
    });
  }

  return buildReport(msgs);
}

/**
 * Check sour gas material requirements (NACE MR0175 / AS 4041)
 */
export function checkSourGasMaterials(
  h2sMolPct: number,
  P_kPa: number,
  T_C: number
): ValidationReport {
  const msgs: ValidationResult[] = [];
  const pH2S_kPa = (h2sMolPct / 100) * P_kPa;
  const pH2S_psi = pH2S_kPa * 0.1450;

  if (h2sMolPct <= 0) return buildReport([]);

  if (pH2S_kPa > 0.3) {
    msgs.push({
      code: 'SOUR_NACE',
      message: `H₂S partial pressure ${pH2S_kPa.toFixed(2)} kPa (${pH2S_psi.toFixed(2)} psi) exceeds NACE sour threshold. All wetted materials must meet NACE MR0175 / ISO 15156.`,
      severity: 'error',
      reference: 'NACE MR0175 / ISO 15156 §1',
    });
  }
  if (T_C > 150 && h2sMolPct > 0.5) {
    msgs.push({
      code: 'SOUR_HIGH_TEMP',
      message: `High-temperature sour service (${T_C}°C, H₂S ${h2sMolPct}%). Stress corrosion cracking (SCC) risk — verify material certification and PWHT requirements.`,
      severity: 'warning',
      reference: 'NACE MR0175 §4.2.2',
    });
  }
  if (pH2S_kPa > 100) {
    msgs.push({
      code: 'SOUR_SEVERE',
      message: `Severe sour service: H₂S partial pressure ${pH2S_kPa.toFixed(1)} kPa. HIC and SSC testing required per NACE TM0284 / TM0177.`,
      severity: 'warning',
      reference: 'NACE TM0284, TM0177',
    });
  }

  return buildReport(msgs);
}

/**
 * Check stack draft adequacy
 */
export function checkStackDraft(
  P_available_Pa: number,
  P_required_Pa: number,
  stackVelocity_ms: number
): ValidationReport {
  const msgs: ValidationResult[] = [];

  if (P_available_Pa < P_required_Pa) {
    msgs.push({
      code: 'DRAFT_INSUFFICIENT',
      message: `Available natural draft (${P_available_Pa.toFixed(1)} Pa) is less than required (${P_required_Pa.toFixed(1)} Pa). Increase stack height or diameter.`,
      severity: 'error',
      reference: 'API 12K §5.4, AS 3814 §6',
    });
  }
  if (stackVelocity_ms < 3) {
    msgs.push({
      code: 'STACK_VEL_LOW',
      message: `Stack velocity ${stackVelocity_ms.toFixed(1)} m/s is too low (min ~3 m/s) — reduce stack diameter or risk downdraft.`,
      severity: 'warning',
      reference: 'AS 3814 §6.4',
    });
  }
  if (stackVelocity_ms > 15) {
    msgs.push({
      code: 'STACK_VEL_HIGH',
      message: `Stack velocity ${stackVelocity_ms.toFixed(1)} m/s is high (max ~15 m/s) — increase stack diameter.`,
      severity: 'warning',
      reference: 'AS 3814 §6.4',
    });
  }

  return buildReport(msgs);
}

/**
 * Check heat loss against GPSA 3% guideline
 */
export function checkHeatLoss(Q_loss_kW: number, Q_design_kW: number): ValidationReport {
  const msgs: ValidationResult[] = [];
  const pct = (Q_loss_kW / Q_design_kW) * 100;

  if (pct > 5) {
    msgs.push({
      code: 'HEAT_LOSS_HIGH',
      message: `Heat loss ${Q_loss_kW.toFixed(1)} kW (${pct.toFixed(1)}%) exceeds 5% — significantly underinsulated.`,
      severity: 'error',
      reference: 'GPSA §3',
    });
  } else if (pct > 3) {
    msgs.push({
      code: 'HEAT_LOSS_WARN',
      message: `Heat loss ${Q_loss_kW.toFixed(1)} kW (${pct.toFixed(1)}%) exceeds GPSA §3 guideline of 3%. Increase insulation thickness.`,
      severity: 'warning',
      reference: 'GPSA §3',
    });
  }

  return buildReport(msgs);
}

// ─── AGGREGATE FULL-DESIGN VALIDATION ────────────────────────────────────────

export interface FullDesignCheckInputs {
  composition: number[];
  T_in_C: number;
  T_out_C: number;
  P_kPa: number;
  dP_kPa: number;
  T_design_C: number;
  P_design_kPa: number;
  heatFlux_kWm2?: number;
  t_selected_mm?: number;
  t_required_mm?: number;
  pipeSched?: string;
  pipeOD?: number;
  T_hydrate_C?: number;
  h2sMolPct?: number;
  P_available_Pa?: number;
  P_required_Pa?: number;
  stackVelocity_ms?: number;
  Q_loss_kW?: number;
  Q_design_kW?: number;
}

export function runFullDesignCheck(inputs: FullDesignCheckInputs): ValidationReport {
  const allMessages: ValidationResult[] = [];

  allMessages.push(...checkGasComposition(inputs.composition, { P_kPa: inputs.P_kPa }).messages);
  allMessages.push(...checkProcessConditions(
    inputs.T_in_C, inputs.T_out_C, inputs.P_kPa, inputs.dP_kPa,
    inputs.T_design_C, inputs.P_design_kPa
  ).messages);

  if (inputs.heatFlux_kWm2 !== undefined)
    allMessages.push(...checkHeatFlux(inputs.heatFlux_kWm2).messages);

  if (inputs.t_selected_mm && inputs.t_required_mm && inputs.pipeSched && inputs.pipeOD)
    allMessages.push(...checkB313WallThickness(inputs.t_selected_mm, inputs.t_required_mm, inputs.pipeSched, inputs.pipeOD).messages);

  if (inputs.T_hydrate_C !== undefined)
    allMessages.push(...checkHydrateRisk(inputs.T_out_C, inputs.T_hydrate_C).messages);

  if (inputs.h2sMolPct)
    allMessages.push(...checkSourGasMaterials(inputs.h2sMolPct, inputs.P_kPa, inputs.T_out_C).messages);

  if (inputs.P_available_Pa !== undefined && inputs.P_required_Pa !== undefined && inputs.stackVelocity_ms !== undefined)
    allMessages.push(...checkStackDraft(inputs.P_available_Pa, inputs.P_required_Pa, inputs.stackVelocity_ms).messages);

  if (inputs.Q_loss_kW !== undefined && inputs.Q_design_kW !== undefined)
    allMessages.push(...checkHeatLoss(inputs.Q_loss_kW, inputs.Q_design_kW).messages);

  return buildReport(allMessages);
}
