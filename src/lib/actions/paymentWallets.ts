'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import PaymentWallet from '@/lib/models/PaymentWallet';
import { createPaymentWallet, updatePaymentWallet } from '@/lib/payment-wallets';
import { batches } from '@/data/batches';
import type { WalletResult } from '@/lib/payment-wallets';

/**
 * Thin auth wrappers around the payment-wallet core
 * (src/lib/payment-wallets.ts) — same shape as src/lib/actions/admin.ts.
 * Wallets are admin-only: the picker query and both mutations re-assert the
 * actor's role, since actions are callable directly. revalidatePath('/admin')
 * re-renders the dashboard (wallet list included) in the same roundtrip.
 */

/** Person option for the add-wallet member picker. */
export type MemberOption = {
  id: string;
  name: string;
  studentId: string;
  email: string;
  photo: string;
  /** Already has a payment wallet — the picker shows them disabled */
  hasWallet: boolean;
};

export type MemberPickerResult =
  | { ok: true; members: MemberOption[] }
  | { ok: false; message: string };

/** Clerk session → Mongo actor id, or the error to surface instead. */
async function resolveAdminActor(): Promise<{ actorId: string } | { message: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { message: 'Your session has expired. Please sign in again.' };
  }
  await connectDB();
  const actor = await User.findOne({ clerkId: userId }).lean();
  if (!actor) return { message: 'Your account was not found.' };
  if (actor.role !== 'admin') {
    return { message: 'Only admins can manage payment wallets.' };
  }
  return { actorId: actor._id.toString() };
}

/** Registered members of one batch for the picker — sorted by name, each
 *  flagged with whether they already carry a wallet. Admin-only. */
export async function fetchBatchMembersAction(batch: string): Promise<MemberPickerResult> {
  if (!batches.some((b) => b.year === batch)) {
    return { ok: false, message: 'Unknown batch.' };
  }
  const resolved = await resolveAdminActor();
  if (!('actorId' in resolved)) return { ok: false, message: resolved.message };

  const [members, wallets] = await Promise.all([
    User.find({ batch }).sort({ name: 1 }).lean(),
    PaymentWallet.find({ batch }).select('userId').lean(),
  ]);
  const taken = new Set(wallets.map((w) => w.userId.toString()));
  return {
    ok: true,
    members: members.map((m) => ({
      id: m._id.toString(),
      name: m.name,
      studentId: m.studentId,
      email: m.email,
      photo: m.photo ?? '',
      hasWallet: taken.has(m._id.toString()),
    })),
  };
}

export async function addPaymentWalletAction(input: {
  userId: string;
  walletType: string;
  walletNumber: string;
}): Promise<WalletResult> {
  const resolved = await resolveAdminActor();
  if (!('actorId' in resolved)) return { status: 'error', message: resolved.message };

  const result = await createPaymentWallet(resolved.actorId, input);
  if (result.status === 'ok') revalidatePath('/admin');
  return result;
}

export async function updatePaymentWalletAction(input: {
  walletId: string;
  walletType: string;
  walletNumber: string;
}): Promise<WalletResult> {
  const resolved = await resolveAdminActor();
  if (!('actorId' in resolved)) return { status: 'error', message: resolved.message };

  const result = await updatePaymentWallet(resolved.actorId, input);
  if (result.status === 'ok') revalidatePath('/admin');
  return result;
}
