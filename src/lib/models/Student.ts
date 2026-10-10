import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

/**
 * The department roster — every genuine DM student across all batches,
 * imported from studentData.json (scripts/import-students.ts). Used only to
 * validate step 2 of registration: the (studentId, batch) pair a new member
 * submits must exist here (completeProfile in src/lib/actions/register.ts).
 */
const studentSchema = new Schema({
  name: { type: String, required: true, trim: true },
  studentId: { type: String, required: true, trim: true },
  regNo: { type: String, required: true, trim: true },
  /** Session start year as a string, e.g. '2018' — same domain as User.batch */
  batch: { type: String, required: true },
  /** Canonical session from src/data/batches.ts, e.g. '2011-12' (not '2011-2012') */
  session: { type: String, required: true, trim: true },
});

// IDs repeat across batches (1717062 is in both '2017' and '2018') — unique
// per batch, mirroring the compound index on User.
studentSchema.index({ studentId: 1, batch: 1 }, { unique: true });

export type StudentDocument = InferSchemaType<typeof studentSchema>;

const Student =
  (mongoose.models.Student as Model<StudentDocument> | undefined) ??
  mongoose.model<StudentDocument>('Student', studentSchema);

export default Student;
