import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";

// Quick end-to-end check: does this deployment/dev-server actually have a
// working path to the database? Hit GET /api/health after setting MONGO_URI.
export async function GET() {
  try {
    const mongoose = await connectDB();
    return NextResponse.json({
      success: true,
      message: "Connected to MongoDB.",
      database: mongoose.connection.name,
      readyState: mongoose.connection.readyState, // 1 = connected
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Database connection failed." },
      { status: 500 },
    );
  }
}
