import type { HydratedDocument } from 'mongoose';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import type { UserDocument } from '@/lib/models/User';
import PaymentWallet from '@/lib/models/PaymentWallet';
import type { PaymentWalletDocument } from '@/lib/models/PaymentWallet';
import { isWalletType, normalizeWalletNumber } from '@/lib/wallet-fields';
import type { WalletType } from '@/lib/wallet-fields';

/**
 * Payment-wallet core — who receives member payments, via which mobile
 * wallet. Admin-only throughout (moderators verify members; they don't handle
 * money). Lives outside the 'use server' boundary (like src/lib/admin.ts) so
 * tsx scripts can exercise the real guards; the wrappers in
 * src/lib/actions/paymentWallets.ts resolve the Clerk session to its Mongo
 * actor and delegate here.
 */

/** Result shape for wallet mutations — `field` routes the message next to the
 *  offending input instead of the form-level alert. */
export type WalletResult =
  | { status: 'ok' }
  | { status: 'error'; message: string; field?: 'walletNumber' };

export type WalletInput = { walletType: string; walletNumber: string };

/** JSON-serializable view sent to the client panels. */
export type WalletView = {
  id: string;
  userId: string;
  name: string;
  studentId: string;
  batch: string;
  photo: string;
  walletType: WalletType;
  walletNumber: string;
  createdAt: string;
  updatedAt: string;
  /** Wallet has been edited since it was added (updatedAt drifted past createdAt) */
  edited: boolean;
};

type UserDoc = HydratedDocument<UserDocument>;
type WalletDoc = HydratedDocument<PaymentWalletDocument>;

/** Loads the acting staff member and enforces the admin-only rule. */
async function loadAdmin(actorId: string): Promise<UserDoc | WalletResult> {
  await connectDB();
  const actor = await User.findById(actorId);
  if (!actor) return { status: 'error', message: 'Your account was not found.' };
  if (actor.role !== 'admin') {
    return { status: 'error', message: 'Only admins can manage payment wallets.' };
  }
  return actor;
}

/** Shared input validation: wallet type enum + BD mobile number normalization. */
function validateInput(
  input: WalletInput
): { walletType: WalletType; walletNumber: string } | WalletResult {
  if (!isWalletType(input.walletType)) {
    return { status: 'error', message: 'Choose a wallet type — BKash, Rocket, or Nagad.' };
  }
  const walletNumber = normalizeWalletNumber(input.walletNumber);
  if (!walletNumber) {
    return {
      status: 'error',
      message: 'Enter a valid Bangladeshi mobile number, e.g. 01XXXXXXXXX.',
      field: 'walletNumber',
    };
  }
  return { walletType: input.walletType, walletNumber };
}

/** Registers a member as a payment receiver. Snapshots their identity from
 *  the User record at write time; rejects members who already have a wallet
 *  (one per person — edit the existing record instead). */
export async function createPaymentWallet(
  actorId: string,
  { userId, walletType, walletNumber }: WalletInput & { userId: string }
): Promise<WalletResult> {
  const valid = validateInput({ walletType, walletNumber });
  if ('status' in valid) return valid;

  try {
    const actor = await loadAdmin(actorId);
    if ('status' in actor) return actor;

    const receiver = await User.findById(userId).lean();
    if (!receiver) return { status: 'error', message: 'That member no longer exists.' };

    // Friendly check up front; the unique userId index backs it under concurrency
    if (await PaymentWallet.exists({ userId: receiver._id })) {
      return {
        status: 'error',
        message: `${receiver.name} already has a payment wallet — edit it in the Payment Wallets tab instead.`,
      };
    }

    await PaymentWallet.create({
      userId: receiver._id,
      name: receiver.name,
      studentId: receiver.studentId,
      batch: receiver.batch,
      photo: receiver.photo ?? '',
      walletType: valid.walletType,
      walletNumber: valid.walletNumber,
    });
    return { status: 'ok' };
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      return { status: 'error', message: 'That member already has a payment wallet.' };
    }
    console.error('createPaymentWallet failed:', err);
    return {
      status: 'error',
      message: 'Something went wrong while adding the wallet. Please try again.',
    };
  }
}

/** Edits a wallet's type/number. The receiver stays locked (identity — pick a
 *  new wallet instead if payments should go to someone else), but their
 *  identity snapshot is refreshed from the current User record so the list
 *  never shows a stale name or photo. save() bumps updatedAt → "edited". */
export async function updatePaymentWallet(
  actorId: string,
  { walletId, walletType, walletNumber }: WalletInput & { walletId: string }
): Promise<WalletResult> {
  const valid = validateInput({ walletType, walletNumber });
  if ('status' in valid) return valid;

  try {
    const actor = await loadAdmin(actorId);
    if ('status' in actor) return actor;

    const wallet = (await PaymentWallet.findById(walletId)) as WalletDoc | null;
    if (!wallet) return { status: 'error', message: 'That payment wallet no longer exists.' };

    wallet.walletType = valid.walletType;
    wallet.walletNumber = valid.walletNumber;

    const receiver = await User.findById(wallet.userId).lean();
    if (receiver) {
      wallet.name = receiver.name;
      wallet.studentId = receiver.studentId;
      wallet.batch = receiver.batch;
      wallet.photo = receiver.photo ?? '';
    }

    await wallet.save();
    return { status: 'ok' };
  } catch (err) {
    console.error('updatePaymentWallet failed:', err);
    return {
      status: 'error',
      message: 'Something went wrong while updating the wallet. Please try again.',
    };
  }
}

/** All wallets, batch-then-name ordered — the Payment Wallets tab's data. */
export async function listPaymentWallets(): Promise<WalletView[]> {
  await connectDB();
  const wallets = await PaymentWallet.find().sort({ batch: 1, name: 1 }).lean();
  return wallets.map((w) => {
    const created = w.createdAt?.getTime() ?? 0;
    const updated = w.updatedAt?.getTime() ?? 0;
    return {
      id: w._id.toString(),
      userId: w.userId.toString(),
      name: w.name,
      studentId: w.studentId,
      batch: w.batch,
      photo: w.photo ?? '',
      walletType: w.walletType as WalletType,
      walletNumber: w.walletNumber,
      createdAt: (w.createdAt ?? new Date(0)).toISOString(),
      updatedAt: (w.updatedAt ?? new Date(0)).toISOString(),
      // Mongoose stamps both timestamps with the same instant on create, so
      // any drift means an edit happened — a quick back-to-back edit still
      // measures ~300ms apart, comfortably over this margin.
      edited: updated - created > 100,
    };
  });
}
