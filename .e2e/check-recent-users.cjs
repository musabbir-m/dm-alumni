// Read-only: timestamps + photo-cloud of recently created users (no personal
// fields printed) — establishes whether profile edits followed registration.
const fs = require('fs');
const mongoose = require('mongoose');

const env = fs.readFileSync('.env.local', 'utf8');
const uri = env.match(/^MONGODB_URI=(.+)$/m)[1].trim();

(async () => {
  await mongoose.connect(uri);
  const col = mongoose.connection.collection('users');
  const docs = await col
    .find(
      { createdAt: { $gte: new Date('2026-10-12') } },
      { projection: { createdAt: 1, updatedAt: 1, photo: 1, doc: 1 } }
    )
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();
  for (const d of docs) {
    const cloud = (d.photo || '').match(/res\.cloudinary\.com\/([^/]+)/)?.[1] || 'none';
    console.log(
      'created:', d.createdAt.toISOString(),
      '| updated:', d.updatedAt.toISOString(),
      '| editGap(ms):', d.updatedAt - d.createdAt,
      '| photoCloud:', cloud,
      '| hasDoc:', Boolean(d.doc)
    );
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
