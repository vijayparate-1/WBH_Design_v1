// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WBH Design Module — Water Bath Heater Engineering',
  description: 'API 12K · GPSA §9 · AS 1228 · ASME B31.3 — Integrated Design & Heat Transfer Module',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
