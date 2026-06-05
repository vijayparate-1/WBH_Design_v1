// =============================================================================
// wbhEngine.ts
// WBH Design & Sizing Engine — Forced Draft Blower & Burner Integration
// API 12K · AS 3814 · ISA Standard Atmosphere Compliance
// TJ0750 · TJ1000 · TJ1500 Medium Velocity Burners
//
// Single consolidated engine. Import calcForcedDraftBlower() for blower sizing.
// All other helpers are exported individually for use in forms / UI components.
//
// Fixes applied vs previous versions:
//   ✓ Rankine offset corrected to 459.67 (exact, not 460)
//   ✓ kW→Btu/h factor corrected to 3412.142
//   ✓ Altitude input unified to metres (AS 3814 / SI primary)
//   ✓ Preheat temp input unified to Celsius (AS 3814 / SI primary)
//   ✓ Efficiency input as percent 0–100 (UX-consistent with uploaded spec)
//   ✓ kW capacity input path (Q_gross_kW) added natively
//   ✓ Low-fire check added (warns when Q < min proportional input)
//   ✓ BHP formula verified: uses scfh ÷ 60 = CFM, consistent with 6356 constant
//   ✓ Compounding of safety margins in BHP confirmed intentional (conservative motor sizing)
// =============================================================================

import {
  AMBIENT_REFERENCE,
  BLOWER_CONSTANTS,
  BURNER_SPECS,
  CONTROL_CONSTANTS,
  FUEL_PROPERTIES,
  NOX_CONSTANTS,
  type BlowerSizingInput,
  type BlowerSizingResult,
  type BurnerModel,
  type FlameDetector,
  type FuelType,
  type IgnitionWave,
  type NOxCorrectionParams,
  type ValidationResult,
  type VolumetricFlowInput,
  type VolumetricFlowResult,
} from "@/data/wbhData";

// =============================================================================
// SECTION 1 — UNIT CONVERSION HELPERS
// =============================================================================

/** °C → °F */
export const celsiusToFahrenheit = (c: number): number => c * 1.8 + 32;

/** °F → °C */
export const fahrenheitToCelsius = (f: number): number => (f - 32) / 1.8;

/** °C → Kelvin (exact) */
export const toKelvin = (c: number): number => c + AMBIENT_REFERENCE.kelvinOffset;

/** °F → Rankine (exact) */
export const toRankine = (f: number): number => f + AMBIENT_REFERENCE.rankineOffset;

/** °C → Rankine (exact — used in preheat correction) */
export const celsiusToRankine = (c: number): number =>
  toRankine(celsiusToFahrenheit(c));

/** metres → feet */
export const metresToFeet = (m: number): number => m * 3.28084;

/** kW → Btu/h */
export const kWToBtuH = (kw: number): number => kw * AMBIENT_REFERENCE.kWToBtuH;

/** Btu/h → kW */
export const btuHToKW = (btu: number): number => btu / AMBIENT_REFERENCE.kWToBtuH;

/** "w.c. → mbar */
export const inWCToMbar = (inWC: number): number => inWC * 2.4908;

/** mbar → "w.c. */
export const mbarToInWC = (mbar: number): number => mbar / 2.4908;

/** scfh → Nm³/h */
export const scfhToNm3h = (scfh: number): number => scfh * 0.02832;

/** BHP → kW */
export const bhpToKW = (bhp: number): number => bhp * 0.7457;

// =============================================================================
// SECTION 2 — COMBUSTION FLOW FORMULAS (standalone helpers)
// =============================================================================

/**
 * Formula A — Volumetric Gas & Air Flow Rates
 *
 *   V_Gas          = Q / q
 *   V_Air_Stoich   = α × V_Gas
 *   V_Air_Total    = (1 + EA) × V_Air_Stoich
 *
 * All results in scfh. EA input as fraction (0.15 = 15%).
 */
export function calcVolumetricFlow(input: VolumetricFlowInput): VolumetricFlowResult {
  const { capacityBtuPerHour, fuel, excessAirFraction = AMBIENT_REFERENCE.excessAirHighFire } = input;
  const fp              = FUEL_PROPERTIES[fuel];
  const gasFlowScfh     = capacityBtuPerHour / fp.hhv.btuPerCuFt;
  const airStoichScfh   = fp.stoichAirRatio * gasFlowScfh;
  const airTotalScfh    = (1 + excessAirFraction) * airStoichScfh;
  return { gasFlowScfh, airFlowStoichScfh: airStoichScfh, airFlowTotalScfh: airTotalScfh, excessAirFraction, fuelUsed: fuel };
}

/**
 * Formula B — Preheat Air Pressure Correction
 * Accepts temperatures in °C; converts internally to Rankine for exact physics.
 *
 *   P_Burner_Preheat = P_Burner_Ambient × (T_Preheat_R / T_Ambient_R)
 *
 * @returns Corrected Tap A pressure ("w.c.)
 */
export function calcPreheatPressure(
  ambientPressure_inWC: number,
  preheatTemp_C:        number,
  ambientTemp_C:        number = AMBIENT_REFERENCE.tempC
): number {
  const T_amb_R = celsiusToRankine(ambientTemp_C);
  const T_pre_R = celsiusToRankine(preheatTemp_C);
  return ambientPressure_inWC * (T_pre_R / T_amb_R);
}

/**
 * Formula C — NOx MV Correction
 *
 *   NOx_MV = NOx_Curve × 1.20
 *
 * Baseline: HV curve at 1,700°F furnace, 15% EA, dry 3% O₂ reference.
 */
export function calcNOxMV({ noxCurveValue }: NOxCorrectionParams): number {
  return noxCurveValue * NOX_CONSTANTS.mvCorrectionFactor;
}

// =============================================================================
// SECTION 3 — ALTITUDE DENSITY CORRECTION
// =============================================================================

/**
 * ISA standard atmosphere density ratio.
 *
 *   δ = (1 − 6.875×10⁻⁶ × altitude_ft) ^ 5.2559
 *
 * @param altitude_m  Site altitude in metres above sea level
 * @returns δ (dimensionless) — 1.0 at MSL, < 1.0 at elevation
 */
export function calcAltitudeFactor(altitude_m: number): number {
  if (altitude_m <= 0) return 1.0;
  const altFt = metresToFeet(altitude_m);
  return Math.pow(1 - 6.875e-6 * altFt, 5.2559);
}

// =============================================================================
// SECTION 4 — MOTOR SIZING
// =============================================================================

/**
 * BHP estimator using fluid horsepower principles.
 *
 *   BHP = (V_scfh × P_inWC) / (6356 × η × 60)
 *
 * The ÷60 converts scfh → scfm (CFM), matching the 6356 fan law constant.
 * Using safety-margined flow and pressure is intentionally conservative
 * to ensure the motor frame is adequate at catalogue conditions.
 *
 * @param airFlow_scfh  Safety-margined blower flow (scfh)
 * @param pressure_inWC Safety-margined blower discharge pressure ("w.c.)
 * @param efficiency    Fan total efficiency as fraction (0–1)
 */
export function calcBHP(
  airFlow_scfh:  number,
  pressure_inWC: number,
  efficiency:    number
): number {
  return (airFlow_scfh * pressure_inWC) / (BLOWER_CONSTANTS.bhpConstant * efficiency * 60);
}

/**
 * Selects the smallest standard motor frame (kW) that satisfies:
 *   frame >= BHP × 0.7457 kW/BHP × 1.15 service factor
 */
export function recommendMotorFrame(bhp: number): number {
  const requiredKW = bhpToKW(bhp) * BLOWER_CONSTANTS.motorServiceFactor;
  for (const frame of BLOWER_CONSTANTS.standardMotorFrames_kW) {
    if (frame >= requiredKW) return frame;
  }
  return BLOWER_CONSTANTS.standardMotorFrames_kW[BLOWER_CONSTANTS.standardMotorFrames_kW.length - 1];
}

// =============================================================================
// SECTION 5 — BURNER SELECTION & TURNDOWN HELPERS
// =============================================================================

/** Smallest model whose max input ≥ required capacity (Btu/h). Returns null if none fits. */
export function selectBurnerModel(requiredBtuH: number): BurnerModel | null {
  for (const m of ["TJ0750", "TJ1000", "TJ1500"] as BurnerModel[]) {
    if (BURNER_SPECS[m].maxInput.btuPerHour >= requiredBtuH) return m;
  }
  return null;
}

/** All models capable of meeting the required capacity. */
export function getCompatibleModels(requiredBtuH: number): BurnerModel[] {
  return (["TJ0750", "TJ1000", "TJ1500"] as BurnerModel[]).filter(
    (m) => BURNER_SPECS[m].maxInput.btuPerHour >= requiredBtuH
  );
}

/**
 * Checks whether a required firing range fits within a model's turndown limits.
 * Returns the mode (proportional / fixed_air) and achievable minimum.
 */
export function checkTurndownFeasibility(
  model:             BurnerModel,
  minRequired_BtuH:  number,
  maxRequired_BtuH:  number
): { feasible: boolean; mode: "proportional" | "fixed_air" | "none"; achievableMin_BtuH: number } {
  const s = BURNER_SPECS[model];
  if (maxRequired_BtuH > s.maxInput.btuPerHour)
    return { feasible: false, mode: "none", achievableMin_BtuH: s.minProportionalInput.btuPerHour };
  if (minRequired_BtuH >= s.minProportionalInput.btuPerHour)
    return { feasible: true, mode: "proportional", achievableMin_BtuH: s.minProportionalInput.btuPerHour };
  if (minRequired_BtuH >= s.minFixedAirInput.btuPerHour)
    return { feasible: true, mode: "fixed_air", achievableMin_BtuH: s.minFixedAirInput.btuPerHour };
  return { feasible: false, mode: "none", achievableMin_BtuH: s.minFixedAirInput.btuPerHour };
}

/** Expected flame length range for combustion chamber clearance checks. */
export function getFlameLengthRange(
  model: BurnerModel, fuel: FuelType
): { minMm: number; maxMm: number; minIn: number; maxIn: number } {
  const c = BURNER_SPECS[model].combustion;
  const r = fuel === "natural_gas" ? c.flameLengthNaturalGas : c.flameLengthPropaneButane;
  return { minMm: r.mmMin, maxMm: r.mmMax, minIn: r.inMin, maxIn: r.inMax };
}

// =============================================================================
// SECTION 6 — CONTROL SYSTEM VALIDATION
// =============================================================================

/** Validates flame detector selection. Flame rod is BLOCKED on all TJ0150+ models. */
export function validateFlameDetector(detector: FlameDetector): ValidationResult {
  if (detector === CONTROL_CONSTANTS.blockedFlameDetector) {
    return {
      valid: false,
      errors: ["Flame rod monitoring is not permitted on TJ0750, TJ1000, or TJ1500. UV Scanner required."],
      warnings: [],
    };
  }
  return { valid: true, errors: [], warnings: [] };
}

/** Validates ignition transformer — only 6,000 VAC full-wave permitted. */
export function validateIgnitionTransformer(params: {
  voltageVAC: number;
  waveType:   IgnitionWave;
}): ValidationResult {
  const errors: string[] = [];
  if (params.voltageVAC !== CONTROL_CONSTANTS.requiredIgnitionVoltageVAC)
    errors.push(`Ignition transformer must be ${CONTROL_CONSTANTS.requiredIgnitionVoltageVAC} VAC. ${CONTROL_CONSTANTS.blockedIgnitionVoltageVAC} VAC is blocked.`);
  if (params.waveType !== CONTROL_CONSTANTS.requiredWaveType)
    errors.push("Full-wave ignition transformer required. Half-wave architecture is blocked.");
  return { valid: errors.length === 0, errors, warnings: [] };
}

/** Combined single-call control system validation. */
export function validateControlSystem(params: {
  flameDetector:      FlameDetector;
  ignitionVoltageVAC: number;
  ignitionWaveType:   IgnitionWave;
}): ValidationResult {
  const d = validateFlameDetector(params.flameDetector);
  const t = validateIgnitionTransformer({ voltageVAC: params.ignitionVoltageVAC, waveType: params.ignitionWaveType });
  return { valid: d.valid && t.valid, errors: [...d.errors, ...t.errors], warnings: [...d.warnings, ...t.warnings] };
}

// =============================================================================
// SECTION 7 — MAIN BLOWER SIZING ENGINE
// =============================================================================

/**
 * calcForcedDraftBlower
 *
 * Full four-step combustion blower sizing for TJ-series MV burners.
 * Incorporates altitude density correction, preheat air pressure correction,
 * BHP estimation, and motor frame recommendation.
 *
 * Steps:
 *   1. V_Gas           = Q / q
 *   2. V_Air_Stoich    = α × V_Gas
 *      V_Air_Design    = V_Air_Stoich × (1 + EA/100)
 *   3. V_Air_Blower    = V_Air_Design × 1.10          (safety margin)
 *      V_Catalogue     = V_Blower / δ                 (altitude correction)
 *   4. P_Blower        = (P_Burner + ΔP_Piping + ΔP_Valves ± P_Chamber) × 1.10
 *      BHP             = (V_Blower × P_Blower) / (6356 × η × 60)
 *
 * All errors are returned in result.errors — this function never throws.
 */
export function calcForcedDraftBlower(input: BlowerSizingInput): BlowerSizingResult {
  const errors:   string[] = [];
  const warnings: string[] = [];
  const alerts:   string[] = [];

  // ── Apply defaults ──────────────────────────────────────────────────────────
  const {
    burnerModel,
    fuel,
    excessAir_pct       = 15,
    pipingPressureLoss_inWC,
    valvePressureLoss_inWC,
    chamberStaticPressure_inWC,
    altitude_m          = 0,
    preheatAirTemp_C    = null,
    ambientAirTemp_C    = AMBIENT_REFERENCE.tempC,
    controlMethod,
    efficiency_pct      = BLOWER_CONSTANTS.defaultEfficiency_pct,
  } = input;

  const spec      = BURNER_SPECS[burnerModel];
  const fuelProps = FUEL_PROPERTIES[fuel];

  // ── Resolve gross load ──────────────────────────────────────────────────────
  let grossLoad_BtuH: number;
  if (input.Q_gross_kW != null && input.Q_gross_kW > 0) {
    grossLoad_BtuH = kWToBtuH(input.Q_gross_kW);
  } else if (input.Q_gross_BtuH != null && input.Q_gross_BtuH > 0) {
    grossLoad_BtuH = input.Q_gross_BtuH;
  } else {
    grossLoad_BtuH = spec.maxInput.btuPerHour;
    warnings.push(`No design load supplied — sizing defaulted to ${burnerModel} maximum: ${spec.maxInput.btuPerHour.toLocaleString()} Btu/h (${spec.maxInput.kW.toLocaleString()} kW).`);
  }
  const grossLoad_kW = btuHToKW(grossLoad_BtuH);

  // ── Hard validation ─────────────────────────────────────────────────────────
  if (grossLoad_BtuH <= 0)
    errors.push("Design load must be greater than zero.");

  if (grossLoad_BtuH > spec.maxInput.btuPerHour)
    errors.push(`Design load ${grossLoad_BtuH.toLocaleString()} Btu/h exceeds ${burnerModel} maximum of ${spec.maxInput.btuPerHour.toLocaleString()} Btu/h. High flame rollover hazard.`);

  if (excessAir_pct < 0 || excessAir_pct > 100)
    errors.push("Excess air must be between 0% and 100%.");

  if (efficiency_pct < BLOWER_CONSTANTS.efficiencyMin_pct || efficiency_pct > BLOWER_CONSTANTS.efficiencyMax_pct)
    warnings.push(`Blower efficiency ${efficiency_pct}% is outside the typical centrifugal package range (${BLOWER_CONSTANTS.efficiencyMin_pct}–${BLOWER_CONSTANTS.efficiencyMax_pct}%). Verify against manufacturer fan curve.`);

  if (preheatAirTemp_C !== null && preheatAirTemp_C <= ambientAirTemp_C)
    errors.push(`Preheat air temperature (${preheatAirTemp_C}°C) must be greater than ambient temperature (${ambientAirTemp_C}°C).`);

  // ── Low-fire turndown check ─────────────────────────────────────────────────
  if (grossLoad_BtuH < spec.minProportionalInput.btuPerHour) {
    const td = checkTurndownFeasibility(burnerModel, grossLoad_BtuH, grossLoad_BtuH);
    if (!td.feasible) {
      errors.push(`Design load ${grossLoad_BtuH.toLocaleString()} Btu/h is below ${burnerModel} minimum fixed-air input of ${spec.minFixedAirInput.btuPerHour.toLocaleString()} Btu/h. Burner cannot operate at this firing rate.`);
    } else {
      warnings.push(`Design load is below ${burnerModel} proportional minimum (${spec.minProportionalInput.btuPerHour.toLocaleString()} Btu/h). Fixed-air control mode required below this point.`);
    }
  }

  // ── Early return on hard errors ─────────────────────────────────────────────
  if (errors.length > 0) {
    return {
      burnerModel, fuelUsed: fuel, grossLoad_kW, grossLoad_BtuH,
      gasFlow_scfh: 0, airFlowStoich_scfh: 0, airFlowDesign_scfh: 0,
      airFlowBlower_scfh: 0, airFlowCatalogue_scfh: 0, altitudeCorrectionFactor: 1,
      pBurner_inWC: 0, pPiping_inWC: 0, pValves_inWC: 0, pChamber_inWC: 0,
      pTotalRaw_inWC: 0, pBlower_inWC: 0, estimatedBHP: 0, recommendedMotor_kW: 0,
      errors, warnings, alerts,
    };
  }

  const eta = efficiency_pct / 100;

  // ── Step 1: Gas volumetric flow ─────────────────────────────────────────────
  // V_Gas = Q / q
  const gasFlow_scfh = grossLoad_BtuH / fuelProps.hhv.btuPerCuFt;

  // ── Step 2: Combustion air flow ─────────────────────────────────────────────
  // V_Air_Stoich = α × V_Gas
  // V_Air_Design = V_Air_Stoich × (1 + EA%)
  const airFlowStoich_scfh = fuelProps.stoichAirRatio * gasFlow_scfh;
  const airFlowDesign_scfh = airFlowStoich_scfh * (1 + excessAir_pct / 100);

  // ── Step 3: Safety margin + altitude correction ─────────────────────────────
  // V_Blower    = V_Design × 1.10
  // V_Catalogue = V_Blower / δ
  const airFlowBlower_scfh    = airFlowDesign_scfh * BLOWER_CONSTANTS.flowSafetyFactor;
  const delta                  = calcAltitudeFactor(altitude_m);
  const airFlowCatalogue_scfh  = airFlowBlower_scfh / delta;

  if (altitude_m > 0) {
    warnings.push(`Site altitude ${altitude_m.toLocaleString()} m (${metresToFeet(altitude_m).toFixed(0)} ft) — density factor δ = ${delta.toFixed(4)}. Catalogue flow adjusted to ${Math.ceil(airFlowCatalogue_scfh).toLocaleString()} scfh.`);
  }
  if (altitude_m >= BLOWER_CONSTANTS.motorDeratingAltitude_m) {
    alerts.push(`High-elevation site (${altitude_m.toLocaleString()} m). Motor convective cooling is reduced at altitude — consider motor derating per AS 1359 or upsizing one frame.`);
  }

  // ── Tap A preheat correction ────────────────────────────────────────────────
  // P_Burner_Preheat = P_Burner_Ambient × (T_Preheat_R / T_Ambient_R)
  const pBurnerAmbient = spec.combustion.airPressureTapA.inWC;
  let   pBurner_inWC   = pBurnerAmbient;

  if (preheatAirTemp_C !== null && preheatAirTemp_C > ambientAirTemp_C) {
    pBurner_inWC = calcPreheatPressure(pBurnerAmbient, preheatAirTemp_C, ambientAirTemp_C);
    warnings.push(`Preheat mode active at ${preheatAirTemp_C}°C. Tap A pressure corrected from ${pBurnerAmbient} to ${pBurner_inWC.toFixed(3)} "w.c. using absolute Rankine temperature ratio.`);
  }

  // ── Step 4: Total blower discharge pressure ─────────────────────────────────
  // P_Total_Raw = P_Burner + ΔP_Piping + ΔP_Valves ± P_Chamber
  // P_Blower    = P_Total_Raw × 1.10
  const pTotalRaw_inWC = pBurner_inWC + pipingPressureLoss_inWC + valvePressureLoss_inWC + chamberStaticPressure_inWC;
  const pBlower_inWC   = pTotalRaw_inWC * BLOWER_CONSTANTS.pressureSafetyFactor;

  if (chamberStaticPressure_inWC < 0)
    warnings.push(`Negative draft chamber (${chamberStaticPressure_inWC} "w.c.) reduces blower duty. Confirm suction is maintained across full firing range before commissioning.`);
  if (chamberStaticPressure_inWC > 0)
    warnings.push(`Pressurised chamber (+${chamberStaticPressure_inWC} "w.c.) adds to blower duty. Verify blower shaft seal integrity at maximum operating pressure.`);
  if (pTotalRaw_inWC <= 0)
    warnings.push("Calculated total raw pressure is zero or negative — check chamber static pressure input. Blower cannot operate under these conditions.");

  // ── BHP and motor frame ─────────────────────────────────────────────────────
  // BHP = (V_Blower_scfh × P_Blower_inWC) / (6356 × η × 60)
  const estimatedBHP       = calcBHP(airFlowBlower_scfh, pBlower_inWC, eta);
  const recommendedMotor_kW = recommendMotorFrame(estimatedBHP);

  // ── Control method alert ────────────────────────────────────────────────────
  if (controlMethod === "fixed_air_modulating_gas" && grossLoad_BtuH > BLOWER_CONSTANTS.fixedAirAlertThreshold_BtuH)
    alerts.push("Fixed-air damper control on inputs exceeding 5,000,000 Btu/h will cause excessive blower power consumption at low-fire cycles. On-Ratio Proportional Modulating Air & Gas is strongly recommended.");

  return {
    burnerModel,
    fuelUsed:              fuel,
    grossLoad_kW,
    grossLoad_BtuH,
    gasFlow_scfh,
    airFlowStoich_scfh,
    airFlowDesign_scfh,
    airFlowBlower_scfh,
    airFlowCatalogue_scfh,
    altitudeCorrectionFactor: delta,
    pBurner_inWC,
    pPiping_inWC:          pipingPressureLoss_inWC,
    pValves_inWC:          valvePressureLoss_inWC,
    pChamber_inWC:         chamberStaticPressure_inWC,
    pTotalRaw_inWC,
    pBlower_inWC,
    estimatedBHP,
    recommendedMotor_kW,
    errors,
    warnings,
    alerts,
  };
}
