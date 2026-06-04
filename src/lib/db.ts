// src/lib/db.ts
// Neon PostgreSQL connection via @neondatabase/serverless + Drizzle ORM
// Works on Vercel Edge / Node runtime and can be pointed at company server later

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../../drizzle/schema';

// DATABASE_URL is required at runtime but not at build time
// During `next build` with no DB, API routes will throw at request time (expected)
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@placeholder/placeholder';

const sql = neon(DATABASE_URL);

export const db = drizzle(sql, { schema });

// Re-export schema types for convenience
export * from '../../drizzle/schema';
