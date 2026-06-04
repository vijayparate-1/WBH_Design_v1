// src/app/api/calculations/stage1/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { calcStage1 } from '@/lib/calculations/thermodynamics';
import { runFullDesignCheck } from '@/lib/validation/engineering-checks';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const results = calcStage1(body);

    const validation = runFullDesignCheck({
      composition: body.composition,
      T_in_C: body.T_in_C,
      T_out_C: body.T_out_C,
      P_kPa: body.P_kPa,
      dP_kPa: body.dP_kPa,
      T_design_C: body.T_design_C,
      P_design_kPa: body.P_design_kPa,
      T_hydrate_C: results.hydrateT_C,
      h2sMolPct: (body.composition[11] ?? 0) * 100,
    });

    return NextResponse.json({ success: true, results, validation });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 400 });
  }
}
