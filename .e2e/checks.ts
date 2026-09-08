/* Post-e2e data checks: Mongo records (clerkId, no passwordHash, pending
 * status, Cloudinary URLs) + Cloudinary asset presence. Run: npx tsx .e2e/checks.ts */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDB } from '../src/lib/db';
import User from '../src/lib/models/User';
import { v2 as cloudinary } from 'cloudinary';

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

async function main() {
  loadEnvLocal();
  // Configure the SDK directly (src/lib/cloudinary.ts doesn't re-export it)
  const match = (process.env.CLOUDINARY_URL ?? '').match(
    /^cloudinary:\/\/([^:@]+):([^@]+)@([^@/?]+)\s*$/
  );
  if (!match) throw new Error('CLOUDINARY_URL missing/malformed in .env.local');
  cloudinary.config({ api_key: match[1], api_secret: match[2], cloud_name: match[3], secure: true });

  await connectDB();

  const users = await User.find({}).lean();
  console.log(`users: ${users.length}`);
  for (const u of users) {
    console.log(
      JSON.stringify({
        email: u.email,
        name: u.name,
        clerkId: u.clerkId ?? '(not linked)',
        role: u.role,
        verification: u.verificationStatus,
        batch: u.batch,
        studentId: u.studentId,
        photoOnCloudinary: String(u.photo ?? '').includes('res.cloudinary.com'),
        docOnCloudinary: String(u.doc ?? '').includes('res.cloudinary.com'),
        legacyPasswordHashPresent: 'passwordHash' in u,
      })
    );
  }

  for (const folder of ['dm-alumni/photos', 'dm-alumni/docs']) {
    try {
      const res = await cloudinary.api.resources({ type: 'upload', prefix: folder, max_results: 5 });
      console.log(
        `${folder}: ${res.total_count ?? '??'} total; latest:`,
        (res.resources ?? []).slice(0, 3).map((r) => ({ id: r.public_id, created: r.created_at }))
      );
    } catch (err) {
      console.log(`${folder}: listing failed —`, JSON.stringify(err).slice(0, 300));
    }
  }

  const idx = await User.collection.indexes();
  console.log(
    'indexes:',
    idx.map((i) => JSON.stringify(i.key) + (i.unique ? ` (unique${i.sparse ? ', sparse' : ''})` : '')).join(' | ')
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
  return mongoose.disconnect();
});
