/* Exercises applyProfileUpdate's verified-account document lock directly —
 * the function is deliberately tsx-runnable. Run: npx tsx .e2e/profile-gate.ts
 * Scenarios (temp user, assets cleaned up after):
 *   1. verified + new document  -> field error, no upload, doc unchanged
 *   2. verified + new photo     -> success, doc unchanged, status stays verified
 *   3. rejected  + new document -> success, verificationStatus flips to pending
 *   4. rejected  + photo only   -> success, status stays rejected */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDB } from '../src/lib/db';
import User from '../src/lib/models/User';
import { applyProfileUpdate } from '../src/lib/profile';
import { cloudinaryAssetFromUrl, destroyCloudinaryAsset } from '../src/lib/cloudinary';

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

// 1x1 transparent PNG — valid for both IMAGE_TYPES and DOC_TYPES
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const pngFile = (name: string) => new File([PNG_BYTES], name, { type: 'image/png' });

let failures = 0;
function check(label: string, ok: boolean, extra?: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}${extra ? ` (${extra})` : ''}`);
  if (!ok) failures++;
}

function baseForm(): FormData {
  const fd = new FormData();
  fd.set('name', 'Gate Test');
  fd.set('phone', '+8801700000000');
  fd.set('batch', '2018');
  fd.set('docType', 'certificate');
  return fd;
}

async function main() {
  loadEnvLocal();
  await connectDB();

  const user = await User.create({
    name: 'Gate Test',
    email: 'gatetest+tmp@dm-alumni.local',
    phone: '+8801700000000',
    studentId: 'GATETEST-TMP-01',
    batch: '2018',
    clerkId: 'user_gatetest_tmp',
    role: 'alumni',
    verificationStatus: 'verified',
    docType: 'certificate',
  });
  const id = user._id.toString();
  const fresh = async () => {
    const u = await User.findById(id).lean();
    if (!u) throw new Error('temp user vanished');
    return u;
  };
  const created: string[] = [];

  try {
    // 1. Verified account tries to replace the document -> blocked before any upload
    const fd1 = baseForm();
    fd1.set('document', pngFile('doc.png'));
    const r1 = await applyProfileUpdate(id, fd1);
    check(
      '1. verified + new doc -> document field error',
      r1.status === 'error' && !!r1.errors.document
    );
    const after1 = await fresh();
    check('1. doc unchanged (no upload churn)', after1.doc == null);

    // 2. Verified account replaces the photo -> fine, doc + status untouched
    const fd2 = baseForm();
    fd2.set('photo', pngFile('photo.png'));
    const r2 = await applyProfileUpdate(id, fd2);
    check('2. verified + new photo -> success', r2.status === 'success');
    const after2 = await fresh();
    check(
      '2. photo stored on Cloudinary',
      String(after2.photo ?? '').includes('res.cloudinary.com')
    );
    check('2. doc still absent', after2.doc == null);
    check('2. status still verified', after2.verificationStatus === 'verified');
    if (after2.photo) created.push(after2.photo);

    // 3. Rejected account uploads a corrected document -> re-enters review
    await User.updateOne({ _id: id }, { verificationStatus: 'rejected' });
    const fd3 = baseForm();
    fd3.set('docType', 'card');
    fd3.set('document', pngFile('card.png'));
    const r3 = await applyProfileUpdate(id, fd3);
    check('3. rejected + new doc -> success', r3.status === 'success');
    const after3 = await fresh();
    check(
      '3. doc stored on Cloudinary',
      String(after3.doc ?? '').includes('res.cloudinary.com')
    );
    check('3. docType follows the new upload', after3.docType === 'card');
    check('3. verificationStatus reset to pending', after3.verificationStatus === 'pending');
    if (after3.doc) created.push(after3.doc);

    // 4. Photo-only edit never touches the status
    await User.updateOne({ _id: id }, { verificationStatus: 'rejected' });
    const fd4 = baseForm();
    fd4.set('photo', pngFile('photo2.png'));
    const r4 = await applyProfileUpdate(id, fd4);
    check('4. rejected + photo-only -> success', r4.status === 'success');
    const after4 = await fresh();
    check('4. status stays rejected', after4.verificationStatus === 'rejected');
    if (after4.photo) created.push(after4.photo);
  } finally {
    // Destroy everything this run uploaded, then remove the temp user
    for (const url of created) {
      const asset = cloudinaryAssetFromUrl(url);
      if (asset) await destroyCloudinaryAsset(asset).catch(() => {});
    }
    await User.deleteOne({ _id: id });
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
