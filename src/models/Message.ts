import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { ChatRole } from "@/models/Conversation";

export interface IMessage extends Document {
  conversation: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  senderRole: ChatRole;
  senderName: string;
  text: string;
  read: boolean;
  readAt: Date | null;
  school: mongoose.Types.ObjectId;
}

const messageSchema = new Schema<IMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    sender: { type: Schema.Types.ObjectId, required: true },
    senderRole: { type: String, enum: ["schooladmin", "teacher", "parent"], required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: 1 });
messageSchema.index({ school: 1 });

export const Message: Model<IMessage> = mongoose.models.Message || mongoose.model<IMessage>("Message", messageSchema);
