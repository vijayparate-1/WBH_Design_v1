// src/app/api/calculations/stage3/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { calcStage3 } from '@/lib/calculations/heater-sizing';
import { checkB313WallThickness } from '@/lib/validation/engineering-checks';

export async function POST(req: NextRequest) {
  try {
    const inputs = await req.json();
    const results = calcStage3(inputs);

    const validation = {
      wallThickness: checkB313WallThickness(
        results.wt_act, results.t_nom,
        results.sched.nm, results.pipe.od
      ),
    };

    return NextResponse.json({ success: true, results, validation });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 400 });
  }
}
