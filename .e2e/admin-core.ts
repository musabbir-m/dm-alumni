/* Exercises the admin core (setUserRole / setUserVerification) directly —
 * the module is deliberately tsx-runnable. Run: npx tsx .e2e/admin-core.ts
 * Scenarios (temp users, no uploads, cleaned up after):
 *   1-2  promote: role + moderatorBatch = target's own batch; re-promote no-op
 *   3    demote: role back to alumni, moderatorBatch cleared
 *   4-6  verify / reject / re-approve / same-status no-op
 *   7-12 guards: non-admin actor, self-target, admin-target, unknown ids,
 *        invalid literals — every rejection leaves the data unchanged
 * 13-17 moderator scope: own-batch verify ok; other-batch / null-batch /
 *        admin-target / self refused; admin still decides any batch */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDB } from '../src/lib/db';
import User from '../src/lib/models/User';
import { setUserRole, setUserVerification } from '../src/lib/admin';

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, value] = match;
      if (process.env[key] === undefined) {
        process.env[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // optional
  }
}

let failures = 0;
function check(label: string, ok: boolean, extra?: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}${extra ? ` (${extra})` : ''}`);
  if (!ok) failures++;
}

async function main() {
  loadEnvLocal();
  await connectDB();

  const [adminA, adminB, alumni1, mod1, mod2, alumni2] = await User.create([
    { name: 'Admin A', email: 'admin-a+tmp@dm-alumni.local', phone: '+8801700000001', studentId: 'ADMINTMP-A-01', batch: '2015', role: 'admin', verificationStatus: 'verified' },
    { name: 'Admin B', email: 'admin-b+tmp@dm-alumni.local', phone: '+8801700000002', studentId: 'ADMINTMP-B-02', batch: '2016', role: 'admin', verificationStatus: 'verified' },
    { name: 'Alumni One', email: 'alumni-one+tmp@dm-alumni.local', phone: '+8801700000003', studentId: 'ADMINTMP-C-03', batch: '2019', role: 'alumni', verificationStatus: 'pending' },
    { name: 'Mod One', email: 'mod-one+tmp@dm-alumni.local', phone: '+8801700000004', studentId: 'ADMINTMP-D-04', batch: '2018', role: 'moderator', verificationStatus: 'verified', moderatorBatch: '2018' },
    { name: 'Mod Two', email: 'mod-two+tmp@dm-alumni.local', phone: '+8801700000005', studentId: 'ADMINTMP-E-05', batch: '2018', role: 'moderator', verificationStatus: 'verified', moderatorBatch: null },
    { name: 'Alumni Two', email: 'alumni-two+tmp@dm-alumni.local', phone: '+8801700000006', studentId: 'ADMINTMP-F-06', batch: '2018', role: 'alumni', verificationStatus: 'pending' },
  ]);
  const id = {
    adminA: adminA._id.toString(),
    adminB: adminB._id.toString(),
    alumni1: alumni1._id.toString(),
    mod1: mod1._id.toString(),
    mod2: mod2._id.toString(),
    alumni2: alumni2._id.toString(),
  };
  const fresh = async (userId: string) => {
    const u = await User.findById(userId).lean();
    if (!u) throw new Error('temp user vanished');
    return u;
  };

  try {
    // 1. Promote — moderatorBatch stamps the target's own batch
    let r = await setUserRole(id.adminA, id.alumni1, 'moderator');
    check('1. promote -> ok', r.status === 'ok');
    let u = await fresh(id.alumni1);
    check("1. role === 'moderator'", u.role === 'moderator');
    check("1. moderatorBatch = target's own batch", u.moderatorBatch === '2019');

    // 2. Re-promote is an idempotent no-op
    r = await setUserRole(id.adminA, id.alumni1, 'moderator');
    check('2. re-promote -> ok (no-op)', r.status === 'ok');

    // 3. Demote — batch coverage cleared
    r = await setUserRole(id.adminA, id.alumni1, 'alumni');
    check('3. demote -> ok', r.status === 'ok');
    u = await fresh(id.alumni1);
    check("3. role back to 'alumni'", u.role === 'alumni');
    check('3. moderatorBatch cleared', u.moderatorBatch == null);

    // 4. Verify
    r = await setUserVerification(id.adminA, id.alumni1, 'verified');
    check('4. verify -> ok', r.status === 'ok');
    u = await fresh(id.alumni1);
    check('4. status verified', u.verificationStatus === 'verified');

    // 5. Reject, then re-approve after rejection
    r = await setUserVerification(id.adminA, id.alumni1, 'rejected');
    check('5. reject -> ok', r.status === 'ok');
    r = await setUserVerification(id.adminA, id.alumni1, 'verified');
    check('5. re-approve after rejection -> ok', r.status === 'ok');
    u = await fresh(id.alumni1);
    check('5. verified again', u.verificationStatus === 'verified');

    // 6. Same-status write is a no-op success
    r = await setUserVerification(id.adminA, id.alumni1, 'verified');
    check('6. same-status -> ok (no-op)', r.status === 'ok');

    // 7. Non-admin actors are refused (alumni and moderator alike)
    r = await setUserRole(id.alumni1, id.mod1, 'alumni');
    check('7. alumni actor: role change -> error', r.status === 'error');
    r = await setUserRole(id.mod1, id.alumni1, 'moderator');
    check('7. moderator actor: role change -> error', r.status === 'error');
    check('7. mod1 still moderator', (await fresh(id.mod1)).role === 'moderator');
    check('7. alumni1 still alumni', (await fresh(id.alumni1)).role === 'alumni');

    // 8. Non-admin verification change refused, data unchanged
    r = await setUserVerification(id.mod1, id.alumni1, 'rejected');
    check('8. moderator actor: verification -> error', r.status === 'error');
    check('8. alumni1 still verified', (await fresh(id.alumni1)).verificationStatus === 'verified');

    // 9. Self-target refused
    r = await setUserRole(id.adminA, id.adminA, 'moderator');
    check('9. self role change -> error', r.status === 'error');
    r = await setUserVerification(id.adminA, id.adminA, 'rejected');
    check('9. self verification -> error', r.status === 'error');
    check('9. adminA untouched', (await fresh(id.adminA)).role === 'admin');

    // 10. Admin targets are off-limits for both mutations
    r = await setUserRole(id.adminA, id.adminB, 'moderator');
    check('10. admin target role -> error', r.status === 'error');
    r = await setUserVerification(id.adminA, id.adminB, 'rejected');
    check('10. admin target verification -> error', r.status === 'error');
    const adminBafter = await fresh(id.adminB);
    check('10. adminB untouched', adminBafter.role === 'admin' && adminBafter.verificationStatus === 'verified');

    // 11. Unknown ids
    const ghost = new mongoose.Types.ObjectId().toString();
    r = await setUserRole(id.adminA, ghost, 'moderator');
    check('11. unknown target -> error', r.status === 'error');
    r = await setUserRole(ghost, id.alumni1, 'moderator');
    check('11. unknown actor -> error', r.status === 'error');

    // 12. Invalid literals (runtime validation — types don't cross the wire)
    r = await setUserRole(id.adminA, id.alumni1, 'admin' as never);
    check("12. role 'admin' refused", r.status === 'error');
    r = await setUserRole(id.adminA, id.alumni1, 'banana' as never);
    check("12. role 'banana' refused", r.status === 'error');
    r = await setUserVerification(id.adminA, id.alumni1, 'pending' as never);
    check("12. status 'pending' refused", r.status === 'error');
    const finalAlumni = await fresh(id.alumni1);
    check('12. alumni1 unchanged by refusals', finalAlumni.role === 'alumni' && finalAlumni.verificationStatus === 'verified');

    // 13. Batch moderator verifies a member of their own batch
    r = await setUserVerification(id.mod1, id.alumni2, 'verified');
    check('13. batch moderator verifies own-batch member -> ok', r.status === 'ok');
    check('13. alumni2 verified', (await fresh(id.alumni2)).verificationStatus === 'verified');

    // 14. Batch moderator cannot verify outside their batch
    r = await setUserVerification(id.mod1, id.alumni1, 'rejected');
    check('14. moderator other-batch -> error', r.status === 'error');
    check('14. alumni1 unchanged', (await fresh(id.alumni1)).verificationStatus === 'verified');

    // 15. Moderator without a moderated batch can verify nobody
    r = await setUserVerification(id.mod2, id.alumni2, 'rejected');
    check('15. moderator without batch -> error', r.status === 'error');
    check('15. alumni2 still verified', (await fresh(id.alumni2)).verificationStatus === 'verified');

    // 16. Shared guards apply to moderators too — no admin targets, no self
    r = await setUserVerification(id.mod1, id.adminA, 'rejected');
    check('16. moderator targeting admin -> error', r.status === 'error');
    r = await setUserVerification(id.mod1, id.mod1, 'verified');
    check('16. moderator self-verification -> error', r.status === 'error');

    // 17. Admins still decide any batch
    r = await setUserVerification(id.adminA, id.alumni2, 'rejected');
    check('17. admin rejects a 2018 member -> ok', r.status === 'ok');
    check('17. alumni2 rejected', (await fresh(id.alumni2)).verificationStatus === 'rejected');
  } finally {
    await User.deleteMany({ _id: { $in: Object.values(id) } });
    await mongoose.disconnect();
  }

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
  if (failures) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
  return mongoose.disconnect();
});
