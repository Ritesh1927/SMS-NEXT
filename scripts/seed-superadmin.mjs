// One-off dev script: creates (or resets) the SuperAdmin account directly,
// bypassing the OTP-based signup flow — same pattern SMS-BACKEND used for
// its own seedSuperAdmin(). Run with: node scripts/seed-superadmin.mjs
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dns from "dns";

// dotenv's default config() only reads ".env" — Next.js's convention (and
// this project's actual secrets file) is ".env.local".
dotenv.config({ path: ".env.local" });

const EMAIL = "riteshydv1927@gmail.com";
const PASSWORD = "sms-next-password";
const NAME = "Super Admin";

if (process.env.MONGO_URI?.startsWith("mongodb+srv://")) {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

const superAdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    phone: { type: String, default: "" },
    role: { type: String, default: "superadmin" },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    otp: { type: String, default: null },
    otpExpire: { type: Date, default: null },
  },
  { timestamps: true },
);
const SuperAdmin = mongoose.model("SuperAdmin", superAdminSchema);

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set. Add it to .env.local");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to", mongoose.connection.name);

  const existing = await SuperAdmin.findOne({ email: EMAIL });
  if (existing) {
    existing.password = await bcrypt.hash(PASSWORD, 12);
    existing.isActive = true;
    existing.isVerified = true;
    await existing.save();
    console.log(`Updated existing SuperAdmin: ${EMAIL}`);
  } else {
    await SuperAdmin.create({
      name: NAME,
      email: EMAIL,
      password: await bcrypt.hash(PASSWORD, 12),
      isActive: true,
      isVerified: true,
    });
    console.log(`Created SuperAdmin: ${EMAIL}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
