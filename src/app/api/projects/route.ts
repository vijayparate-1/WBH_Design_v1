// src/app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, projects, calculations } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  try {
    const rows = await db.select().from(projects).orderBy(desc(projects.updatedAt)).limit(50);
    return NextResponse.json({ success: true, projects: rows });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await db.insert(projects).values({
      jobNo:       body.jobNo ?? 'DRAFT',
      tagNo:       body.tagNo,
      service:     body.service,
      location:    body.location,
      client:      body.client,
      docNo:       body.docNo,
      revision:    body.revision ?? 'A',
      status:      'draft',
      preparedBy:  body.preparedBy,
      notes:       body.notes,
      updatedAt:   new Date(),
    }).returning();
    return NextResponse.json({ success: true, project: result[0] });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 400 });
  }
}
