/**
 * Creates the first admin account so an admin can bootstrap moderators.
 *
 *   npm run seed
 *
 * Reads MONGODB_URI / ADMIN_EMAIL / ADMIN_PASSWORD from the environment or
 * .env.local (tsx does not load .env files itself). Idempotent — exits
 * without changes if the admin already exists.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { hash } from 'bcryptjs';
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
  const password = process.env.ADMIN_PASSWORD ?? 'ChangeMe!2026';
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  }

  await connectDB();

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
    passwordHash: await hash(password, 12),
    role: 'admin',
    verificationStatus: 'verified',
  });

  console.log(`Created admin ${email} — change this password after first login.`);
}

main()
  .then(() => mongoose.disconnect())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
    return mongoose.disconnect();
  });
