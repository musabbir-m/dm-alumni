import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

/**
 * One anonymous ballot in an election's append-only ledger. Carries NO voter
 * identity — not even hashed — the poll book (VoterRoll) is the only record
 * of who voted, linked to nothing. Chain integrity: each ballot seals the
 * previous ballot's hash plus its own payload (see voting-crypto.ts), with a
 * contiguous per-election `seq`. Editing a ballot breaks its recomputed
 * hash, deleting one leaves a seq gap, fabricating one breaks the head —
 * all caught by verifyChain in src/lib/election.ts.
 */

const ballotSchema = new Schema(
  {
    electionId: { type: Schema.Types.ObjectId, ref: 'Election', required: true },
    /** Contiguous per election, starting at 1 — the chain order and gap detector */
    seq: { type: Number, required: true },
    /** Hash of the previous ballot ('GENESIS' for the first) — the chain link */
    prevHash: { type: String, required: true },
    /** HMAC over prevHash + canonical payload {electionId, seq, choice, receiptHash} */
    hash: { type: String, required: true },
    /** sha256 of the voter's receipt code (normalized) — inclusion check only */
    receiptHash: { type: String, required: true },
    /** The chosen candidate's public id (Election.candidates[].id) */
    choice: { type: String, required: true },
  },
  { timestamps: true }
);

// Chain order + the one-writer race backstop for concurrent casts
ballotSchema.index({ electionId: 1, seq: 1 }, { unique: true });
// Receipt lookups; also blocks any code path from inserting two ballots with
// the same receipt
ballotSchema.index({ electionId: 1, receiptHash: 1 }, { unique: true });

export type BallotDocument = InferSchemaType<typeof ballotSchema>;

const Ballot =
  (mongoose.models.Ballot as Model<BallotDocument> | undefined) ??
  mongoose.model<BallotDocument>('Ballot', ballotSchema, 'ballots');

export default Ballot;
