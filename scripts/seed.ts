/**
 * Creates the first admin record so an admin can bootstrap moderators.
 *
 *   npm run seed
 *
 * Reads MONGODB_URI / ADMIN_EMAIL from the environment or .env.local (tsx
 * does not load .env files itself). Idempotent — exits without changes if
 * the admin already exists.
 *
 * Credentials live in Clerk, not here: create the matching Clerk user with
 * the same email in the Clerk dashboard (and verify it) — it links to this
 * record automatically on first sign-in via the verified-email lazy link in
 * src/lib/auth.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDB } from '../src/lib/db';
import User from '../src/lib/models/User';

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
    // .env.local is optional — real env vars and defaults still apply
  }
}

async function main() {
  loadEnvLocal();

  const email = (process.env.ADMIN_EMAIL ?? 'admin@dm-alumni.local').toLowerCase();

  await connectDB();

  // Housekeeping for the Auth.js → Clerk migration: strip now-unused
  // password hashes and make sure the sparse unique clerkId index exists.
  // Raw collection on purpose — passwordHash is no longer a schema path, so
  // a model-level $unset would be filtered out by strict mode and no-op.
  await User.collection.updateMany({}, { $unset: { passwordHash: '' } });
  await User.syncIndexes();

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Admin ${email} already exists — nothing to do.`);
    return;
  }

  await User.create({
    name: 'Site Admin',
    email,
    // The schema requires alumni-shaped fields; placeholders keep the admin
    // record valid without pointing at a real person.
    phone: '+880000000000',
    studentId: 'ADMIN-0001',
    batch: '2018',
    role: 'admin',
    verificationStatus: 'verified',
    // No clerkId — set automatically when the admin first signs in with a
    // verified Clerk account using this same email.
  });

  console.log(
    `Created admin ${email} — now create the matching Clerk user (same email, verified) in the Clerk dashboard; it will link automatically on first sign-in.`
  );
}

main()
  .then(() => mongoose.disconnect())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
    return mongoose.disconnect();
  });
