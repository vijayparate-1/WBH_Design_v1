// src/lib/actions/calculations.ts
// WBH Design — Next.js Server Actions
// Runs on the server: calls calc engine, runs validation, persists to Neon DB

'use server';

import { db, calculations, projects } from '../db';
import { eq, and } from 'drizzle-orm';
import { calcStage1, type Stage1Inputs } from '../calculations/thermodynamics';
import { calcStage2, calcStage3, calcExpTank, calcInsulation } from '../calculations/heater-sizing';
import { runFullDesignCheck } from '../validation/engineering-checks';
import type { Stage2Inputs, Stage3Inputs, ExpTankInputs, InsulationInputs } from '../calculations/heater-sizing';
import { revalidatePath } from 'next/cache';

// ─── SAVE / LOAD PROJECT ──────────────────────────────────────────────────────

export async function saveProject(data: {
  jobNo: string;
  tagNo?: string;
  service?: string;
  location?: string;
  client?: string;
  docNo?: string;
  revision?: string;
  preparedBy?: string;
  notes?: string;
}) {
  const result = await db.insert(projects).values({
    ...data,
    status: 'draft',
    updatedAt: new Date(),
  }).returning();
  return { success: true, projectId: result[0].id };
}

export async function listProjects() {
  return db.query.projects.findMany({
    orderBy: (p, { desc }) => [desc(p.updatedAt)],
    limit: 50,
  });
}

// ─── STAGE 1: GAS PROPERTIES ─────────────────────────────────────────────────

export async function runStage1Action(
  inputs: Stage1Inputs,
  projectId?: number,
  revision?: string
) {
  try {
    const results = calcStage1(inputs);

    // Run validation
    const validation = runFullDesignCheck({
      composition: inputs.composition,
      T_in_C: inputs.T_in_C,
      T_out_C: inputs.T_out_C,
      P_kPa: inputs.P_kPa,
      dP_kPa: inputs.dP_kPa,
      T_design_C: inputs.T_design_C,
      P_design_kPa: inputs.P_design_kPa,
      T_hydrate_C: results.hydrateT_C,
      h2sMolPct: inputs.composition[11] * 100,
    });

    // Persist if project linked
    if (projectId) {
      await db.insert(calculations).values({
        projectId,
        revision: revision ?? 'A',
        isActive: true,
        gasComposition: {
          components: inputs.composition.map((molPct, index) => ({
            index, symbol: '', molPct: molPct * 100,
          })).filter(c => c.molPct > 0),
        },
        processConditions: {
          T_in_C: inputs.T_in_C,
          T_out_C: inputs.T_out_C,
          P_in_kPa: inputs.P_kPa,
          dP_kPa: inputs.dP_kPa,
          massFlow: inputs.massFlow_kgh,
          flowUnit: 'kgh',
          T_design_C: inputs.T_design_C,
          P_design_kPa: inputs.P_design_kPa,
          dutyOverride_kW: inputs.dutyOverride_kW,
        },
        calcBasis: inputs.basisMethod,
        resultsS1: results as unknown as Record<string, unknown> as never,
        validationWarnings: validation.warnings,
        validationErrors: validation.errors,
      });
      revalidatePath(`/projects/${projectId}`);
    }

    return { success: true, results, validation };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ─── STAGE 2: FIRETUBE SIZING ─────────────────────────────────────────────────

export async function runStage2Action(
  inputs: Stage2Inputs,
  Q_net_kW: number,
  projectId?: number
) {
  try {
    const results = calcStage2(inputs, Q_net_kW);
    const { checkHeatFlux, checkStackDraft } = await import('../validation/engineering-checks');

    const fluxCheck = checkHeatFlux(results.heatFlux_kWm2);
    const draftCheck = checkStackDraft(results.P_available_Pa, results.P_required_Pa, results.stackVelocity_ms);

    if (projectId) {
      // Update existing calc record
      await db.update(calculations)
        .set({
          firetubeConfig: inputs as unknown as Record<string, unknown> as never,
          resultsS2: results as unknown as Record<string, unknown> as never,
        })
        .where(and(eq(calculations.projectId, projectId), eq(calculations.isActive, true)));
      revalidatePath(`/projects/${projectId}`);
    }

    return {
      success: true, results,
      validation: {
        heatFlux: fluxCheck,
        draft: draftCheck,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ─── STAGE 3: PROCESS COIL ───────────────────────────────────────────────────

export async function runStage3Action(inputs: Stage3Inputs, projectId?: number) {
  try {
    const results = calcStage3(inputs);
    const { checkB313WallThickness } = await import('../validation/engineering-checks');

    const wtCheck = checkB313WallThickness(
      results.wt_act, results.t_nom,
      results.sched.nm, results.pipe.od
    );

    if (projectId) {
      await db.update(calculations)
        .set({
          coilConfig: inputs as unknown as Record<string, unknown> as never,
          resultsS3: results as unknown as Record<string, unknown> as never,
        })
        .where(and(eq(calculations.projectId, projectId), eq(calculations.isActive, true)));
      revalidatePath(`/projects/${projectId}`);
    }

    return { success: true, results, validation: { wallThickness: wtCheck } };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ─── LOAD CALCULATION ────────────────────────────────────────────────────────

export async function loadCalculation(projectId: number) {
  const calc = await db.query.calculations.findFirst({
    where: and(eq(calculations.projectId, projectId), eq(calculations.isActive, true)),
  });
  return calc ?? null;
}

// ─── FULL VALIDATION RUN ──────────────────────────────────────────────────────

export async function runFullValidation(projectId: number) {
  const calc = await loadCalculation(projectId);
  if (!calc) return { success: false, error: 'No active calculation found' };

  const s1 = calc.resultsS1 as Record<string, unknown> | null;
  const s2 = calc.resultsS2 as Record<string, unknown> | null;
  const s3 = calc.resultsS3 as Record<string, unknown> | null;

  const comp = (calc.processConditions as unknown as Record<string, unknown>) ?? {};
  const validation = runFullDesignCheck({
    composition: Array(14).fill(0), // reconstruct from stored data
    T_in_C:       (comp.T_in_C as number) ?? 10,
    T_out_C:      (comp.T_out_C as number) ?? 40,
    P_kPa:        (comp.P_in_kPa as number) ?? 7000,
    dP_kPa:       (comp.dP_kPa as number) ?? 50,
    T_design_C:   (comp.T_design_C as number) ?? 100,
    P_design_kPa: (comp.P_design_kPa as number) ?? 8500,
    heatFlux_kWm2: (s2?.heatFlux_kWm2 as number) ?? undefined,
    Q_loss_kW:    undefined,
    Q_design_kW:  (s1?.Q_final as number) ?? undefined,
  });

  return { success: true, validation, stages: { s1: !!s1, s2: !!s2, s3: !!s3 } };
}
