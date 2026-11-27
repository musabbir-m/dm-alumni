import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

/**
 * The poll book of an election — which members have voted. The member is
 * stored ONLY as an HMAC pseudonym (voting-crypto.ts computeVoterHash): the
 * one-way hash can't be reversed to a Member, and without VOTING_SECRET it
 * can't even be confirmed against a guessed member list. Ballot contents
 * live in a separate collection (Ballot) with no roll linkage, so the
 * database cannot show who voted for whom. The unique {electionId, voterHash}
 * index is the one-vote backstop — even a concurrent double-submit can't get
 * two entries through. `batch` is kept denormalized for live turnout stats.
 */

const voterRollSchema = new Schema(
  {
    electionId: { type: Schema.Types.ObjectId, ref: 'Election', required: true },
    /** HMAC(VOTING_SECRET, "voter:" + electionId + ":" + userId) — one-way pseudonym */
    voterHash: { type: String, required: true },
    /** Voter's batch year (session start) — the turnout-per-batch dimension */
    batch: { type: String, required: true },
  },
  { timestamps: true }
);

// The one-vote backstop — enforced by the database, not just by app logic
voterRollSchema.index({ electionId: 1, voterHash: 1 }, { unique: true });
// Turnout-per-batch aggregation
voterRollSchema.index({ electionId: 1, batch: 1 });

export type VoterRollDocument = InferSchemaType<typeof voterRollSchema>;

// Explicit collection name: mongoose would otherwise lowercase 'VoterRoll'
// to 'voterrolls' — this pins the requested camelCase 'voterRolls'.
const VoterRoll =
  (mongoose.models.VoterRoll as Model<VoterRollDocument> | undefined) ??
  mongoose.model<VoterRollDocument>('VoterRoll', voterRollSchema, 'voterRolls');

export default VoterRoll;
