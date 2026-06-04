-- drizzle/migrations/0001_initial.sql
-- WBH Design Module — Initial PostgreSQL Schema
-- Run on Neon: drizzle-kit push OR drizzle-kit migrate

CREATE TABLE IF NOT EXISTS "projects" (
  "id"          serial PRIMARY KEY,
  "job_no"      varchar(50)  NOT NULL,
  "tag_no"      varchar(50),
  "service"     text,
  "location"    text,
  "client"      text,
  "doc_no"      varchar(100),
  "revision"    varchar(10)  DEFAULT 'A',
  "status"      varchar(30)  DEFAULT 'draft',
  "prepared_by" varchar(50),
  "checked_by"  varchar(50),
  "notes"       text,
  "tags"        jsonb        DEFAULT '[]',
  "created_at"  timestamp    DEFAULT now() NOT NULL,
  "updated_at"  timestamp    DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "calculations" (
  "id"                    serial PRIMARY KEY,
  "project_id"            integer NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "revision"              varchar(10) DEFAULT 'A',
  "rev_note"              text,
  "is_active"             boolean DEFAULT true,
  "gas_composition"       jsonb,
  "process_conditions"    jsonb,
  "calc_basis"            integer DEFAULT 5,
  "firetube_config"       jsonb,
  "stack_config"          jsonb,
  "coil_config"           jsonb,
  "insulation_config"     jsonb,
  "exp_tank_config"       jsonb,
  "sour_gas_config"       jsonb,
  "results_s1"            jsonb,
  "results_s2"            jsonb,
  "results_s3"            jsonb,
  "results_bom"           jsonb,
  "results_ht"            jsonb,
  "results_ins"           jsonb,
  "validation_warnings"   jsonb DEFAULT '[]',
  "validation_errors"     jsonb DEFAULT '[]',
  "created_at"            timestamp DEFAULT now() NOT NULL,
  "updated_by"            varchar(50)
);

CREATE TABLE IF NOT EXISTS "library_projects" (
  "id"            serial PRIMARY KEY,
  "lib_id"        varchar(50) UNIQUE NOT NULL,
  "tag"           varchar(100),
  "name"          text NOT NULL,
  "location"      text,
  "doc_no"        varchar(100),
  "date"          varchar(30),
  "client"        text,
  "country"       varchar(50),
  "sector"        varchar(50),
  "description"   text,
  "kpis"          jsonb DEFAULT '[]',
  "tags"          jsonb DEFAULT '[]',
  "is_validated"  boolean DEFAULT false,
  "validation_ref" text,
  "params"        jsonb NOT NULL,
  "created_at"    timestamp DEFAULT now() NOT NULL,
  "updated_at"    timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "component_library" (
  "id"            serial PRIMARY KEY,
  "symbol"        varchar(20) UNIQUE NOT NULL,
  "name"          text NOT NULL,
  "formula"       varchar(30),
  "cas_no"        varchar(20),
  "mw"            real NOT NULL,
  "tc_k"          real,
  "pc_bar"        real,
  "omega"         real,
  "vc_cm3mol"     real,
  "dippr_a"       real,
  "dippr_b"       real,
  "dippr_c"       real,
  "dippr_d"       real,
  "dippr_e"       real,
  "bip_kij"       jsonb DEFAULT '{}',
  "sour_flag"     boolean DEFAULT false,
  "sort_order"    integer DEFAULT 99,
  "updated_at"    timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "validation_cases" (
  "id"            serial PRIMARY KEY,
  "case_ref"      varchar(30) NOT NULL,
  "description"   text,
  "region"        varchar(30),
  "flow_kg_hr"    real,
  "flow_nm3_hr"   real,
  "t_range"       varchar(30),
  "duty_curr"     real,
  "duty_ref"      real,
  "deviation_pct" real,
  "shell_dimm"    varchar(50),
  "cp_note"       varchar(80),
  "pass_status"   varchar(10),
  "notes"         text,
  "params"        jsonb,
  "updated_at"    timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id"            serial PRIMARY KEY,
  "entity_type"   varchar(50) NOT NULL,
  "entity_id"     integer NOT NULL,
  "action"        varchar(30) NOT NULL,
  "actor"         varchar(100),
  "diff"          jsonb,
  "created_at"    timestamp DEFAULT now() NOT NULL
);

-- Indices
CREATE INDEX IF NOT EXISTS "projects_job_no_idx"   ON "projects"("job_no");
CREATE INDEX IF NOT EXISTS "projects_status_idx"   ON "projects"("status");
CREATE INDEX IF NOT EXISTS "calc_project_idx"      ON "calculations"("project_id");
CREATE INDEX IF NOT EXISTS "calc_active_idx"       ON "calculations"("project_id","is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "library_lib_id_idx" ON "library_projects"("lib_id");
CREATE INDEX IF NOT EXISTS "library_sector_idx"    ON "library_projects"("sector");
