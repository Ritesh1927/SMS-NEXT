import mongoose, { Schema, type Document, type Model } from "mongoose";

export type FeeStatus = "paid" | "pending" | "partial" | "overdue";
export type PaymentMode = "cash" | "online" | "cheque" | "dd";

export interface IFeePayment extends Document {
  school: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  feeStructure: mongoose.Types.ObjectId | null;
  title: string;
  month: string | null;
  amount: number;
  paidAmount: number;
  dueDate: Date | null;
  paidDate: Date | null;
  status: FeeStatus;
  paymentMode: PaymentMode;
  receiptNo: string | null;
  remarks: string;
  collectedBy: mongoose.Types.ObjectId | null;
}

const feePaymentSchema = new Schema<IFeePayment>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    feeStructure: { type: Schema.Types.ObjectId, ref: "FeeStructure", default: null },
    title: { type: String, required: true },
    month: { type: String, default: null },
    amount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    dueDate: { type: Date, default: null },
    paidDate: { type: Date, default: null },
    status: { type: String, enum: ["paid", "pending", "partial", "overdue"], default: "pending" },
    paymentMode: { type: String, enum: ["cash", "online", "cheque", "dd"], default: "cash" },
    receiptNo: { type: String, unique: true, sparse: true },
    remarks: { type: String, default: "" },
    collectedBy: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
  },
  { timestamps: true },
);

// Mongoose 9 dropped the next()-callback style for document middleware.
feePaymentSchema.pre<IFeePayment>("save", async function () {
  if (!this.receiptNo && this.status === "paid") {
    const count = await mongoose.model("FeePayment").countDocuments();
    this.receiptNo = "RCP-" + Date.now() + "-" + String(count + 1).padStart(4, "0");
  }
});

export const FeePayment: Model<IFeePayment> =
  mongoose.models.FeePayment || mongoose.model<IFeePayment>("FeePayment", feePaymentSchema);
