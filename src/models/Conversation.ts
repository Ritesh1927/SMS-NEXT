import mongoose, { Schema, type Document, type Model } from "mongoose";

export type ChatRole = "schooladmin" | "teacher" | "parent";

interface IParticipant {
  userId: mongoose.Types.ObjectId;
  role: ChatRole;
  name: string;
  unread: number;
}

export interface IConversation extends Document {
  school: mongoose.Types.ObjectId;
  participants: IParticipant[];
  childId: mongoose.Types.ObjectId | null;
  lastMessage: string;
  lastMessageAt: Date;
  lastSenderId: mongoose.Types.ObjectId | null;
}

const participantSchema = new Schema<IParticipant>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, enum: ["schooladmin", "teacher", "parent"], required: true },
    name: { type: String, required: true },
    unread: { type: Number, default: 0 },
  },
  { _id: false },
);

const conversationSchema = new Schema<IConversation>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    participants: [participantSchema],
    childId: { type: Schema.Types.ObjectId, ref: "Student", default: null },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
    lastSenderId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

conversationSchema.index({ school: 1, "participants.userId": 1 });
conversationSchema.index({ school: 1, lastMessageAt: -1 });
conversationSchema.index({ school: 1, childId: 1 });

export const Conversation: Model<IConversation> =
  mongoose.models.Conversation || mongoose.model<IConversation>("Conversation", conversationSchema);
