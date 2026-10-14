// Standards where sections represent streams (Science/Commerce/Arts), not
// just arbitrary divisions -- each section needs its own subject list rather
// than sharing one across the whole standard. Pure, no framework imports, so
// it's importable from both API routes and client components (same style as
// lib/holidays.ts).
const STREAM_STANDARDS = ["11", "12"];

export function isStreamStandard(name: string): boolean {
  return STREAM_STANDARDS.includes(String(name).trim());
}
