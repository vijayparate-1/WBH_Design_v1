// drizzle/schema.ts
// WBH Design Module — PostgreSQL Schema (Neon / company server)
// Tables: projects, calculations, design_revisions, library_projects, validation_cases

import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  jsonb,
  timestamp,
  varchar,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ─── PROJECTS ─────────────────────────────────────────────────────────────────
// Top-level enquiry / job record
export const projects = pgTable('projects', {
  id:          serial('id').primaryKey(),
  jobNo:       varchar('job_no', { length: 50 }).notNull(),
  tagNo:       varchar('tag_no', { length: 50 }),
  service:     text('service'),
  location:    text('location'),
  client:      text('client'),
  docNo:       varchar('doc_no', { length: 100 }),
  revision:    varchar('revision', { length: 10 }).default('A'),
  status:      varchar('status', { length: 30 }).default('draft'), // draft | issued | approved | archived
  preparedBy:  varchar('prepared_by', { length: 50 }),
  checkedBy:   varchar('checked_by', { length: 50 }),
  notes:       text('notes'),
  tags:        jsonb('tags').$type<string[]>().default([]),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  jobNoIdx:    index('projects_job_no_idx').on(t.jobNo),
  statusIdx:   index('projects_status_idx').on(t.status),
}));

// ─── DESIGN CALCULATIONS ──────────────────────────────────────────────────────
// Full snapshot of all inputs + computed results at time of save
export const calculations = pgTable('calculations', {
  id:          serial('id').primaryKey(),
  projectId:   integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  revision:    varchar('revision', { length: 10 }).default('A'),
  revNote:     text('rev_note'),
  isActive:    boolean('is_active').default(true),   // latest active calc for project

  // ── Stage 1 — Gas Properties ──────────────────────────────────────────────
  gasComposition:  jsonb('gas_composition').$type<GasComposition>(),
  processConditions: jsonb('process_conditions').$type<ProcessConditions>(),
  calcBasis:       integer('calc_basis').default(5),  // M1–M6 + manual

  // ── Stage 2 — Firetube Sizing ─────────────────────────────────────────────
  firetubeConfig:  jsonb('firetube_config').$type<FiretubeConfig>(),
  stackConfig:     jsonb('stack_config').$type<StackConfig>(),

  // ── Stage 3 — Process Coil ────────────────────────────────────────────────
  coilConfig:      jsonb('coil_config').$type<CoilConfig>(),

  // ── Insulation ───────────────────────────────────────────────────────────
  insulationConfig: jsonb('insulation_config').$type<InsulationConfig>(),

  // ── Expansion Tank ───────────────────────────────────────────────────────
  expTankConfig:   jsonb('exp_tank_config').$type<ExpTankConfig>(),

  // ── Sour Gas ─────────────────────────────────────────────────────────────
  sourGasConfig:   jsonb('sour_gas_config').$type<SourGasConfig>(),

  // ── Results (all stages) ─────────────────────────────────────────────────
  resultsS1:   jsonb('results_s1'),     // Stage 1 computed output
  resultsS2:   jsonb('results_s2'),     // Stage 2 computed output
  resultsS3:   jsonb('results_s3'),     // Stage 3 computed output
  resultsBOM:  jsonb('results_bom'),    // Bill of Materials
  resultsHT:   jsonb('results_ht'),     // HT Analyser
  resultsIns:  jsonb('results_ins'),    // Insulation

  // ── Validation flags ─────────────────────────────────────────────────────
  validationWarnings: jsonb('validation_warnings').$type<ValidationMessage[]>().default([]),
  validationErrors:   jsonb('validation_errors').$type<ValidationMessage[]>().default([]),

  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedBy:   varchar('updated_by', { length: 50 }),
}, (t) => ({
  projectIdx:  index('calc_project_idx').on(t.projectId),
  activeIdx:   index('calc_active_idx').on(t.projectId, t.isActive),
}));

// ─── LIBRARY / REFERENCE PROJECTS ────────────────────────────────────────────
// Historical validated projects (go-by designs)
export const libraryProjects = pgTable('library_projects', {
  id:          serial('id').primaryKey(),
  libId:       varchar('lib_id', { length: 50 }).unique().notNull(),  // e.g. 'q13048_berwick'
  tag:         varchar('tag', { length: 100 }),
  name:        text('name').notNull(),
  location:    text('location'),
  docNo:       varchar('doc_no', { length: 100 }),
  date:        varchar('date', { length: 30 }),
  client:      text('client'),
  country:     varchar('country', { length: 50 }),
  sector:      varchar('sector', { length: 50 }),   // OilGas | Power | Mining
  description: text('description'),
  kpis:        jsonb('kpis').$type<string[]>().default([]),
  tags:        jsonb('tags').$type<string[]>().default([]),
  isValidated: boolean('is_validated').default(false),
  validationRef: text('validation_ref'),

  // Full parameter set (mirrors HTML HIST_PROJECTS shape)
  params:      jsonb('params').notNull(),

  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  libIdIdx:    uniqueIndex('library_lib_id_idx').on(t.libId),
  sectorIdx:   index('library_sector_idx').on(t.sector),
}));

// ─── COMPONENT LIBRARY ────────────────────────────────────────────────────────
// Pure-component thermodynamic data (Tc, Pc, omega, DIPPR Cp coefficients, etc.)
export const componentLibrary = pgTable('component_library', {
  id:          serial('id').primaryKey(),
  symbol:      varchar('symbol', { length: 20 }).unique().notNull(),  // CH4, C2H6, CO2 …
  name:        text('name').notNull(),
  formula:     varchar('formula', { length: 30 }),
  casNo:       varchar('cas_no', { length: 20 }),
  mw:          real('mw').notNull(),          // g/mol
  tc_K:        real('tc_k'),                  // critical temperature K
  pc_bar:      real('pc_bar'),               // critical pressure bar
  omega:       real('omega'),                // acentric factor
  vc_cm3mol:   real('vc_cm3mol'),            // critical volume
  // DIPPR Cp° polynomial: Cp = A + B*T + C*T² + D*T³ + E*T⁴  [J/(mol·K)]
  dippr_A:     real('dippr_a'),
  dippr_B:     real('dippr_b'),
  dippr_C:     real('dippr_c'),
  dippr_D:     real('dippr_d'),
  dippr_E:     real('dippr_e'),
  // Binary interaction params (kij) stored as JSON map
  bip_kij:     jsonb('bip_kij').$type<Record<string, number>>().default({}),
  sourFlag:    boolean('sour_flag').default(false),  // H2S, CO2 etc.
  sortOrder:   integer('sort_order').default(99),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
});

// ─── VALIDATION CASES ────────────────────────────────────────────────────────
// 30-case validation suite against HYSYS / certified datasheets
export const validationCases = pgTable('validation_cases', {
  id:          serial('id').primaryKey(),
  caseRef:     varchar('case_ref', { length: 30 }).notNull(),
  description: text('description'),
  region:      varchar('region', { length: 30 }),   // aus | sea | me | global
  flowKgHr:    real('flow_kg_hr'),
  flowNm3Hr:   real('flow_nm3_hr'),
  tRange:      varchar('t_range', { length: 30 }),   // "5→38°C"
  dutyCurr:    real('duty_curr'),     // calculated kW
  dutyRef:     real('duty_ref'),      // HYSYS / datasheet kW
  deviationPct: real('deviation_pct'),
  shellDimm:   varchar('shell_dimm', { length: 50 }),
  cpNote:      varchar('cp_note', { length: 80 }),
  passStatus:  varchar('pass_status', { length: 10 }), // PASS | WARN | FAIL
  notes:       text('notes'),
  params:      jsonb('params'),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
});

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────
export const auditLog = pgTable('audit_log', {
  id:          serial('id').primaryKey(),
  entityType:  varchar('entity_type', { length: 50 }).notNull(),  // project | calculation | library
  entityId:    integer('entity_id').notNull(),
  action:      varchar('action', { length: 30 }).notNull(),        // create | update | delete | export
  actor:       varchar('actor', { length: 100 }),
  diff:        jsonb('diff'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
});

// ─── TYPE DEFINITIONS ─────────────────────────────────────────────────────────

export interface GasComposition {
  components: Array<{
    index: number;
    symbol: string;
    molPct: number;
  }>;
  presetId?: string;
}

export interface ProcessConditions {
  T_in_C: number;
  T_out_C: number;
  P_in_kPa: number;
  dP_kPa: number;
  massFlow: number;
  flowUnit: 'kgh' | 'nm3h';
  T_design_C: number;
  P_design_kPa: number;
  dutyOverride_kW?: number;
}

export interface FiretubeConfig {
  Q_net_kW: number;
  burnerConfig: string;   // '1x100' | '2x50' | '2x75'
  draftType: string;      // 'natural' | 'forced' | 'induced'
  efficiency_pct: number;
  burnerRatingFactor: number;
  nPass: number;
  tubeLengthM: number;
  pipeDN: number;
  Tbath_C: number;
}

export interface StackConfig {
  altitudeM: number;
  T_amb_C: number;
  T_flue_C: number;
  excessAir_pct: number;
  stackHeightM: number;
  stackDiaMm: number;
}

export interface CoilConfig {
  Q_net_kW: number;
  T_in_C: number;
  T_out_C: number;
  T_bath_C: number;
  nPaths: number;
  nRows: number;
  nps: string;
  material: string;
  P_maop_kPa: number;
  P_design_kPa: number;
  T_design_C: number;
  corrAllow_mm: number;
  safetyFactor: number;
  uMethod: string;
  legLengthFixed?: number;
}

export interface InsulationConfig {
  thickness_mm: number;
  material: string;
  cladding: string;
  windSpeed_ms: number;
  T_amb_C: number;
  k_material: number;
}

export interface ExpTankConfig {
  bathVolumeL: number;
  glycolPct: number;
  T_operating_C: number;
  T_ambient_C: number;
}

export interface SourGasConfig {
  enabled: boolean;
  h2sMolPct: number;
  co2MolPct: number;
  P_kPa: number;
  T_C: number;
}

export interface ValidationMessage {
  code: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}
