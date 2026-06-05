// =============================================================================
// wbhData.ts
// WBH Design & Sizing App — Master Data, Types & Constants
// API 12K · AS 3814 · ISA Standard Atmosphere Compliance
// TJ0750 · TJ1000 · TJ1500 Medium Velocity Burners
//
// This file is the single source of truth for all constants and interfaces.
// Import from here in all calculation modules.
// =============================================================================

// ─── Union Types ──────────────────────────────────────────────────────────────

export type BurnerModel      = "TJ0750" | "TJ1000" | "TJ1500";
export type FuelType         = "natural_gas" | "propane" | "butane";
export type FlameDetector    = "uv_scanner" | "flame_rod";
export type IgnitionWave     = "full_wave" | "half_wave";
export type ControlMethod    = "proportional_on_ratio" | "fixed_air_modulating_gas";
export type ChamberDraftMode = "positive" | "negative" | "balanced";

// ─── Burner Specification ─────────────────────────────────────────────────────

export interface BurnerSpec {
  model: BurnerModel;
  /** Maximum rated input */
  maxInput:             { btuPerHour: number; kW: number };
  /** Minimum input at 10:1 proportional turndown */
  minProportionalInput: { btuPerHour: number; kW: number };
  /** Minimum input at 50:1 fixed-air turndown */
  minFixedAirInput:     { btuPerHour: number; kW: number };
  turndown:             { proportional: 10; fixedAir: 50 };
  /** High-fire combustion reference data @ 15% EA, 1 atm, 70°F / 21°C */
  combustion: {
    /** Main gas supply pressure at Tap B — identical for NG, Propane & Butane */
    gasPressureTapB:          { inWC: number; mbar: number };
    /** Combustion air pressure at Tap A — used as P_Burner in blower sizing */
    airPressureTapA:          { inWC: number; mbar: number };
    /** MV flame exit velocity — constant across all three models */
    flameExitVelocity:        { ftPerSec: 280; mPerSec: 85 };
    flameLengthNaturalGas:    { inMin: number; inMax: number; mmMin: number; mmMax: number };
    flameLengthPropaneButane: { inMin: number; inMax: number; mmMin: number; mmMax: number };
  };
  dimensions: {
    gasConnectionSize: string;
    airConnectionSize: string;
    /** Total axial clearance */
    L1: { mm: number; in: number };
    /** Air inlet centreline offset */
    L2: { mm: number; in: number };
    /** Housing upper extension */
    H1: { mm: number; in: number };
    /** Housing lower extension — same for all models */
    H2: { mm: number; in: number };
    mass: { kg: number; lbs: number };
  };
  /** MV straight nozzle — inner exit throat diameter */
  nozzleDiameter: { mm: number; in: number };
}

// ─── Fuel Properties ──────────────────────────────────────────────────────────

export interface FuelProperties {
  type:           FuelType;
  label:          string;
  /** Gross Higher Heating Value (HHV) */
  hhv:            { btuPerCuFt: number };
  /** Stoichiometric air-to-gas ratio ft³_air / ft³_gas */
  stoichAirRatio: number;
}

// ─── Blower Sizing — Input ────────────────────────────────────────────────────

export interface BlowerSizingInput {
  burnerModel: BurnerModel;
  fuel:        FuelType;

  /**
   * Design thermal load — supply ONE of these; kW takes priority if both provided.
   * Falls back to burner maximum input if neither is supplied.
   */
  Q_gross_kW?:   number;
  Q_gross_BtuH?: number;

  /** Excess air at high fire (%) — default 15 */
  excessAir_pct?: number;

  /** System piping frictional pressure loss ("w.c.) */
  pipingPressureLoss_inWC:   number;
  /** Combined valve train pressure drop at full open ("w.c.) — SSVs, butterflies, control valve */
  valvePressureLoss_inWC:    number;
  /**
   * Furnace chamber static pressure ("w.c.)
   *   Positive  →  pressurised chamber (adds to blower duty)
   *   Negative  →  negative draft / suction (reduces blower duty)
   *   Zero      →  balanced / atmospheric
   */
  chamberStaticPressure_inWC: number;

  /** Site altitude in metres above sea level — default 0 (MSL) */
  altitude_m?: number;

  /**
   * Preheated combustion air temperature (°C).
   * Set to null or omit for ambient-temperature air.
   * Must be greater than ambientAirTemp_C when provided.
   */
  preheatAirTemp_C?: number | null;

  /** Ambient air inlet temperature (°C) — default 21°C (70°F) */
  ambientAirTemp_C?: number;

  controlMethod?: ControlMethod;

  /** Blower fan total efficiency as a percentage (%) — default 60, valid range 55–65 */
  efficiency_pct?: number;
}

// ─── Blower Sizing — Result ───────────────────────────────────────────────────

export interface BlowerSizingResult {
  // Input echo (resolved values after defaults applied)
  burnerModel:   BurnerModel;
  fuelUsed:      FuelType;
  grossLoad_kW:  number;
  grossLoad_BtuH: number;

  // ── Flow chain (all in scfh) ─────────────────────────────────────────────
  gasFlow_scfh:          number;
  airFlowStoich_scfh:    number;
  /** Air flow at design EA, before safety margin */
  airFlowDesign_scfh:    number;
  /** × 1.10 safety margin — use for blower duty point */
  airFlowBlower_scfh:    number;
  /** Altitude-corrected catalogue selection flow */
  airFlowCatalogue_scfh: number;
  /** Altitude correction factor δ */
  altitudeCorrectionFactor: number;

  // ── Pressure chain (all in "w.c.) ────────────────────────────────────────
  /** Tap A pressure, preheat-corrected when applicable */
  pBurner_inWC:   number;
  pPiping_inWC:   number;
  pValves_inWC:   number;
  /** Signed chamber pressure */
  pChamber_inWC:  number;
  /** Sum before safety margin */
  pTotalRaw_inWC: number;
  /** × 1.10 safety coefficient — use for blower catalogue selection */
  pBlower_inWC:   number;

  // ── Motor sizing ─────────────────────────────────────────────────────────
  estimatedBHP:        number;
  recommendedMotor_kW: number;

  // ── Validation ───────────────────────────────────────────────────────────
  /** Hard stop — calculation aborted; output flow/pressure values will be 0 */
  errors:   string[];
  /** Soft issue — calculation proceeded; review before finalising */
  warnings: string[];
  /** Operational optimisation notices */
  alerts:   string[];
}

// ─── Shared Interfaces (used by burner calc helpers) ─────────────────────────

export interface VolumetricFlowInput {
  capacityBtuPerHour: number;
  fuel:               FuelType;
  /** Fraction (0–1) — default 0.15 */
  excessAirFraction?: number;
}

export interface VolumetricFlowResult {
  gasFlowScfh:        number;
  airFlowStoichScfh:  number;
  airFlowTotalScfh:   number;
  excessAirFraction:  number;
  fuelUsed:           FuelType;
}

export interface ValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

export interface NOxCorrectionParams {
  /** Value read directly from the HV baseline NOx curve */
  noxCurveValue: number;
}

// ─── Fuel Data ────────────────────────────────────────────────────────────────

export const FUEL_PROPERTIES: Record<FuelType, FuelProperties> = {
  natural_gas: { type: "natural_gas", label: "Natural Gas", hhv: { btuPerCuFt: 1002  }, stoichAirRatio: 9.41  },
  propane:     { type: "propane",     label: "Propane",     hhv: { btuPerCuFt: 2572  }, stoichAirRatio: 23.82 },
  butane:      { type: "butane",      label: "Butane",      hhv: { btuPerCuFt: 3225  }, stoichAirRatio: 30.47 },
};

// ─── Burner Specifications ────────────────────────────────────────────────────

export const BURNER_SPECS: Record<BurnerModel, BurnerSpec> = {
  TJ0750: {
    model:                "TJ0750",
    maxInput:             { btuPerHour: 7_500_000,  kW: 1983 },
    minProportionalInput: { btuPerHour: 750_000,    kW: 198  },
    minFixedAirInput:     { btuPerHour: 150_000,    kW: 40   },
    turndown:             { proportional: 10, fixedAir: 50 },
    combustion: {
      gasPressureTapB:          { inWC: 6.7,  mbar: 16.7 },
      airPressureTapA:          { inWC: 10.2, mbar: 25.4 },
      flameExitVelocity:        { ftPerSec: 280, mPerSec: 85 },
      flameLengthNaturalGas:    { inMin: 125, inMax: 125, mmMin: 3175, mmMax: 3175 },
      flameLengthPropaneButane: { inMin: 125, inMax: 130, mmMin: 3175, mmMax: 3302 },
    },
    dimensions: {
      gasConnectionSize: '3" NPT / Rc',
      airConnectionSize: '8" Welded',
      L1: { mm: 424,   in: 16.7 }, L2: { mm: 220.5, in: 8.7  },
      H1: { mm: 285.3, in: 11.2 }, H2: { mm: 129.5, in: 5.1  },
      mass: { kg: 60, lbs: 133 },
    },
    nozzleDiameter: { mm: 224, in: 8.8 },
  },

  TJ1000: {
    model:                "TJ1000",
    maxInput:             { btuPerHour: 10_000_000, kW: 2666 },
    minProportionalInput: { btuPerHour: 1_000_000,  kW: 264  },
    minFixedAirInput:     { btuPerHour: 200_000,    kW: 53   },
    turndown:             { proportional: 10, fixedAir: 50 },
    combustion: {
      gasPressureTapB:          { inWC: 5.5, mbar: 13.7 },
      airPressureTapA:          { inWC: 7.8, mbar: 19.4 },
      flameExitVelocity:        { ftPerSec: 280, mPerSec: 85 },
      flameLengthNaturalGas:    { inMin: 149, inMax: 149, mmMin: 3785, mmMax: 3785 },
      flameLengthPropaneButane: { inMin: 149, inMax: 154, mmMin: 3785, mmMax: 3912 },
    },
    dimensions: {
      gasConnectionSize: '3" NPT / Rc',
      airConnectionSize: '8" Welded',
      L1: { mm: 424,   in: 16.7 }, L2: { mm: 220.5, in: 8.7  },
      H1: { mm: 285.3, in: 11.2 }, H2: { mm: 129.5, in: 5.1  },
      mass: { kg: 60, lbs: 133 },
    },
    nozzleDiameter: { mm: 253, in: 10.0 },
  },

  TJ1500: {
    model:                "TJ1500",
    maxInput:             { btuPerHour: 15_000_000, kW: 4000 },
    minProportionalInput: { btuPerHour: 1_500_000,  kW: 396  },
    minFixedAirInput:     { btuPerHour: 300_000,    kW: 79   },
    turndown:             { proportional: 10, fixedAir: 50 },
    combustion: {
      gasPressureTapB:          { inWC: 3.7, mbar: 9.2  },
      airPressureTapA:          { inWC: 8.4, mbar: 20.9 },
      flameExitVelocity:        { ftPerSec: 280, mPerSec: 85 },
      flameLengthNaturalGas:    { inMin: 144, inMax: 144, mmMin: 3660, mmMax: 3660 },
      flameLengthPropaneButane: { inMin: 185, inMax: 185, mmMin: 4700, mmMax: 4700 },
    },
    dimensions: {
      gasConnectionSize: '3" NPT / Rc',
      airConnectionSize: '10" ANSI Flange',
      L1: { mm: 500,   in: 19.7 }, L2: { mm: 315,   in: 12.4 },
      H1: { mm: 376.5, in: 14.8 }, H2: { mm: 129.5, in: 5.1  },
      mass: { kg: 95, lbs: 208 },
    },
    nozzleDiameter: { mm: 409, in: 16.1 },
  },
};

// ─── Blower Constants ─────────────────────────────────────────────────────────

export const BLOWER_CONSTANTS = {
  /** Volumetric flow safety margin — filter loading + commissioning tolerance */
  flowSafetyFactor:    1.10,
  /** Blower discharge pressure safety coefficient */
  pressureSafetyFactor: 1.10,
  /** Fan law BHP constant — used with flow in CFM (scfh ÷ 60) */
  bhpConstant:          6356,
  /** Default blower total efficiency for generic centrifugal packages */
  defaultEfficiency_pct: 60,
  efficiencyMin_pct:     55,
  efficiencyMax_pct:     65,
  /** Motor service factor applied before frame selection */
  motorServiceFactor:   1.15,
  /** Capacity threshold above which fixed-air control triggers on-ratio alert */
  fixedAirAlertThreshold_BtuH: 5_000_000,
  /** Standard motor frame sizes available for recommendation */
  standardMotorFrames_kW: [15, 22, 30, 37, 45] as const,
  /** Altitude above which motor derating alert is issued */
  motorDeratingAltitude_m: 1524,   // 5,000 ft
} as const;

// ─── Ambient Reference ────────────────────────────────────────────────────────

export const AMBIENT_REFERENCE = {
  tempF:             70,
  tempC:             21,
  /** Exact Rankine offset */
  rankineOffset:     459.67,
  kelvinOffset:      273.15,
  absoluteTempR:     529.67,   // 70°F + 459.67
  absoluteTempK:     294.15,   // 21°C + 273.15
  pressureAtm:       1,
  pressureHg_inHg:   29.92,
  pressureMbar:      1013,
  /** kW to Btu/h exact conversion factor */
  kWToBtuH:          3412.142,
  excessAirHighFire: 0.15,
} as const;

// ─── NOx Constants ────────────────────────────────────────────────────────────

export const NOX_CONSTANTS = {
  /** Multiply HV baseline curve reading by this to get MV target */
  mvCorrectionFactor:       1.20,
  baselineFurnaceTempF:     1700,
  baselineFurnaceTempC:     930,
  baselineExcessAirFraction: 0.15,
  referenceBasis:           "dry 3% O2",
} as const;

// ─── Control System Constants ─────────────────────────────────────────────────

export const CONTROL_CONSTANTS = {
  requiredIgnitionVoltageVAC: 6000,
  blockedIgnitionVoltageVAC:  10000,
  requiredWaveType:           "full_wave"  as IgnitionWave,
  blockedWaveType:            "half_wave"  as IgnitionWave,
  requiredFlameDetector:      "uv_scanner" as FlameDetector,
  blockedFlameDetector:       "flame_rod"  as FlameDetector,
} as const;
