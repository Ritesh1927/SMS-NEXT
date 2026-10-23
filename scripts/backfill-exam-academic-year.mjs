// Second migration for the Educational Year Switch feature: stamps every
// existing Exam/ScheduledExam doc with no academicYear with its school's
// current stored academic year (Admin.settings.academicYear -- run
// scripts/backfill-academic-year.mjs first so every school has one).
//
// This isn't required for correctness today -- every year-scoped query
// uses `$in: [year, ""]` so legacy docs stay visible in the current-year
// view regardless -- but it removes the ambiguity before the year-switch
// feature's flush step has to decide what "this year's" exams are.
//
// Safety: dry-run by default — nothing is written until you pass --confirm.
//
// Usage:
//   node scripts/backfill-exam-academic-year.mjs
//   node scripts/backfill-exam-academic-year.mjs --confirm
import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from "dns";

dotenv.config({ path: ".env.local" });

const CONFIRM = process.argv.includes("--confirm");

if (process.env.MONGO_URI?.startsWith("mongodb+srv://")) {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set. Add it to .env.local");

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log("Connected to", mongoose.connection.name);

  const admins = await db.collection("admins").find({}).toArray();

  let totalExams = 0;
  let totalTerms = 0;

  for (const admin of admins) {
    const ay = admin.settings?.academicYear;
    if (!ay) {
      console.log(`SKIP ${admin.schoolName}: no settings.academicYear yet (run backfill-academic-year.mjs first).`);
      continue;
    }

    const examFilter = { school: admin._id, $or: [{ academicYear: { $exists: false } }, { academicYear: "" }] };
    const termFilter = { school: admin._id, $or: [{ academicYear: { $exists: false } }, { academicYear: "" }] };

    const examCount = await db.collection("exams").countDocuments(examFilter);
    const termCount = await db.collection("scheduledexams").countDocuments(termFilter);
    console.log(`${admin.schoolName}: ${examCount} exam(s), ${termCount} exam term(s) -> ${ay}`);
    totalExams += examCount;
    totalTerms += termCount;

    if (!CONFIRM) continue;

    if (examCount > 0) await db.collection("exams").updateMany(examFilter, { $set: { academicYear: ay } });
    if (termCount > 0) await db.collection("scheduledexams").updateMany(termFilter, { $set: { academicYear: ay } });
  }

  console.log(`\nTotals: ${totalExams} exam(s), ${totalTerms} exam term(s).`);
  if (!CONFIRM) {
    console.log("DRY RUN — nothing written. Re-run with --confirm to apply.");
  } else {
    console.log("Applied.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
