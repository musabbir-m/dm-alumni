import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

export const ROLES = ['alumni', 'moderator', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const DOC_TYPES = ['certificate', 'card'] as const;
export type DocType = (typeof DOC_TYPES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: true, trim: true },
    studentId: { type: String, required: true, unique: true, trim: true },
    /** Graduation year as a string, e.g. '2018' — key into src/data/batches.ts */
    batch: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, default: 'alumni' },
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'pending' },
    /** Batch year this moderator covers (role === 'moderator' only) */
    moderatorBatch: { type: String, default: null },
    /** Public URL path of the profile photo, e.g. /uploads/photos/<uuid>.jpg */
    photo: { type: String, default: null },
    docType: { type: String, enum: [...DOC_TYPES, null], default: null },
    /** Public URL path of the verification document */
    doc: { type: String, default: null },
  },
  { timestamps: true }
);

// Never leak the hash or internals through JSON (profile pages, API responses)
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const clean = ret as Record<string, unknown>;
    delete clean.passwordHash;
    delete clean.__v;
    return ret;
  },
});

export type UserDocument = InferSchemaType<typeof userSchema>;

const User =
  (mongoose.models.User as Model<UserDocument> | undefined) ??
  mongoose.model<UserDocument>('User', userSchema);

export default User;
