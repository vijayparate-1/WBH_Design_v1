// src/app/api/validate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runFullDesignCheck, type FullDesignCheckInputs } from '@/lib/validation/engineering-checks';

export async function POST(req: NextRequest) {
  try {
    const inputs: FullDesignCheckInputs = await req.json();
    const report = runFullDesignCheck(inputs);
    return NextResponse.json({ success: true, report });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 400 });
  }
}
