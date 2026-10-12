import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
import { WALLET_TYPES } from '@/lib/wallet-fields';

/**
 * Payment receivers — who collects member payments (event dues, membership
 * fees, …) through a Bangladeshi mobile wallet (BKash / Rocket / Nagad).
 * Managed by admins from the staff dashboard; one wallet per registered
 * member (unique userId). The member's identity fields are stored as a
 * snapshot (name/studentId/batch/photo) and refreshed from their User record
 * on every wallet write, so display never needs a populate and stays correct
 * even if the profile is edited later.
 */

const paymentWalletSchema = new Schema(
  {
    /** The registered member who receives payments — one wallet per person */
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    /** Receiver identity snapshot (refreshed on every wallet write) */
    name: { type: String, required: true, trim: true },
    studentId: { type: String, required: true, trim: true },
    /** Session start year as a string, e.g. '2018' = DSM 8th Batch — key into src/data/batches.ts */
    batch: { type: String, required: true },
    /** Cloudinary URL of the receiver's profile photo ('' when none) */
    photo: { type: String, default: '' },
    walletType: { type: String, enum: WALLET_TYPES, required: true },
    /** Normalized BD mobile number (01XXXXXXXXX) of the wallet */
    walletNumber: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// The admin tab lists wallets grouped by batch
paymentWalletSchema.index({ batch: 1, name: 1 });

export type PaymentWalletDocument = InferSchemaType<typeof paymentWalletSchema>;

// Explicit collection name: mongoose would otherwise lowercase the model name
// to `paymentwallets` — this pins the requested camelCase `paymentWallets`.
const PaymentWallet =
  (mongoose.models.PaymentWallet as Model<PaymentWalletDocument> | undefined) ??
  mongoose.model<PaymentWalletDocument>('PaymentWallet', paymentWalletSchema, 'paymentWallets');

export default PaymentWallet;
