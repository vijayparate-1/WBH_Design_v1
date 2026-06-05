// src/app/api/calculations/stage2/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { calcStage2, type Stage2Inputs } from '@/lib/calculations/heater-sizing';
import { checkHeatFlux, checkStackDraft } from '@/lib/validation/engineering-checks';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Accept both { inputs: Stage2Inputs } (legacy) and flat Stage2Inputs directly
    const inputs: Stage2Inputs = body.inputs ?? body;

    if (!inputs || inputs.Q_net_kW == null) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: Q_net_kW' },
        { status: 400 }
      );
    }

    const results = calcStage2(inputs);

    const validation = {
      heatFlux: checkHeatFlux(results.heatFlux_kWm2),
      stack:    checkStackDraft(
        results.P_available_Pa,
        results.P_required_Pa,
        results.stackVelocity_ms
      ),
    };

    return NextResponse.json({ success: true, results, validation });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 400 });
  }
}
