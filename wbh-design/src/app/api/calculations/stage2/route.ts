// src/app/api/calculations/stage2/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { calcStage2 } from '@/lib/calculations/heater-sizing';
import { checkHeatFlux, checkStackDraft } from '@/lib/validation/engineering-checks';

export async function POST(req: NextRequest) {
  try {
    const { inputs, Q_net_kW } = await req.json();
    const results = calcStage2(inputs, Q_net_kW);

    const validation = {
      heatFlux: checkHeatFlux(results.heatFlux_kWm2),
      draft: checkStackDraft(results.P_available_Pa, results.P_required_Pa, results.stackVelocity_ms),
    };

    return NextResponse.json({ success: true, results, validation });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 400 });
  }
}
