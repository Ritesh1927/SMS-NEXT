// First-deploy migration for the Educational Year Switch feature: seeds
// Admin.settings.academicYear for every school where it's still empty, using
// the same "today's date + sessionStartMonth" calculation that the whole app
// used to live-recompute everywhere (now in src/lib/academicYear.ts). This
// is intentionally a one-time seed, not a live recompute — the whole point
// of this feature is that the stored year only moves when an admin
// explicitly runs the switch from here on, so no school's displayed year
// should change on deploy day.
//
// Safety: dry-run by default — nothing is written until you pass --confirm.
//
// Usage:
//   node scripts/backfill-academic-year.mjs
//   node scripts/backfill-academic-year.mjs --confirm
import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from "dns";

// dotenv's default config() only reads ".env" — Next.js uses ".env.local".
dotenv.config({ path: ".env.local" });

const CONFIRM = process.argv.includes("--confirm");

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function computeNaturalAcademicYear(sessionStartMonth, now = new Date()) {
  const startIdx = MONTHS_FULL.indexOf(sessionStartMonth);
  const idx = startIdx >= 0 ? startIdx : 3;
  const startYear = now.getMonth() >= idx ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

if (process.env.MONGO_URI?.startsWith("mongodb+srv://")) {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set. Add it to .env.local");

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log("Connected to", mongoose.connection.name);

  const admins = await db
    .collection("admins")
    .find({ $or: [{ "settings.academicYear": { $exists: false } }, { "settings.academicYear": "" }] })
    .toArray();

  console.log(`Found ${admins.length} school(s) with no stored academicYear.`);
  if (admins.length === 0) {
    await mongoose.disconnect();
    return;
  }

  for (const admin of admins) {
    const sessionStartMonth = admin.settings?.sessionStartMonth || "April";
    const ay = computeNaturalAcademicYear(sessionStartMonth);
    console.log(`  - ${admin.schoolName} <${admin.email}>  session starts ${sessionStartMonth}  ->  ${ay}`);
  }

  if (!CONFIRM) {
    console.log("\nDRY RUN — nothing written. Re-run with --confirm to apply.");
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  for (const admin of admins) {
    const sessionStartMonth = admin.settings?.sessionStartMonth || "April";
    const ay = computeNaturalAcademicYear(sessionStartMonth);
    const res = await db.collection("admins").updateOne(
      { _id: admin._id, $or: [{ "settings.academicYear": { $exists: false } }, { "settings.academicYear": "" }] },
      { $set: { "settings.academicYear": ay } },
    );
    if (res.modifiedCount > 0) updated += 1;
  }
  console.log(`\nUpdated ${updated} school(s).`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
