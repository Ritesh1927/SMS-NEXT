import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IResult extends Document {
  school: mongoose.Types.ObjectId;
  exam: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  marksObtained: number;
  totalMarks: number;
  grade: string;
  percentage: number;
  isPassed: boolean;
  remarks: string;
  enteredBy: mongoose.Types.ObjectId | null;
  isPublished: boolean;
  publishedAt: Date | null;
}

const resultSchema = new Schema<IResult>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    marksObtained: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    grade: { type: String, default: "" },
    percentage: { type: Number, default: 0 },
    isPassed: { type: Boolean, default: false },
    remarks: { type: String, default: "" },
    enteredBy: { type: Schema.Types.ObjectId, default: null },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

resultSchema.index({ exam: 1, student: 1 }, { unique: true });

// Mongoose 9 dropped the next()-callback style for document middleware.
resultSchema.pre<IResult>("save", function () {
  this.percentage = Math.round((this.marksObtained / this.totalMarks) * 100);
  this.isPassed = this.marksObtained >= this.totalMarks * 0.33;
  const p = this.percentage;
  if (p >= 90) this.grade = "A+";
  else if (p >= 80) this.grade = "A";
  else if (p >= 70) this.grade = "B+";
  else if (p >= 60) this.grade = "B";
  else if (p >= 50) this.grade = "C";
  else if (p >= 33) this.grade = "D";
  else this.grade = "F";
});

export const Result: Model<IResult> = mongoose.models.Result || mongoose.model<IResult>("Result", resultSchema);
