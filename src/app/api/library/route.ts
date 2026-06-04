// src/app/api/library/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, libraryProjects } from '@/lib/db';
import { eq, like, or } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sector = searchParams.get('sector');
    const q = searchParams.get('q');

    let rows;
    if (q) {
      rows = await db.select().from(libraryProjects).where(
        or(
          like(libraryProjects.name, `%${q}%`),
          like(libraryProjects.location, `%${q}%`),
          like(libraryProjects.docNo, `%${q}%`),
        )
      ).limit(20);
    } else if (sector) {
      rows = await db.select().from(libraryProjects).where(
        eq(libraryProjects.sector, sector)
      ).limit(50);
    } else {
      rows = await db.select().from(libraryProjects).limit(50);
    }

    return NextResponse.json({ success: true, projects: rows });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await db.insert(libraryProjects).values({
      libId:       body.id ?? body.libId,
      tag:         body.tag,
      name:        body.name,
      location:    body.location,
      docNo:       body.docNo,
      date:        body.date,
      client:      body.client,
      sector:      body.sector ?? 'OilGas',
      description: body.desc ?? body.description,
      kpis:        body.kpis ?? [],
      isValidated: body.isValidated ?? false,
      validationRef: body.ref ?? body.validationRef,
      params:      body,
      updatedAt:   new Date(),
    }).returning();
    return NextResponse.json({ success: true, library: result[0] });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 400 });
  }
}
