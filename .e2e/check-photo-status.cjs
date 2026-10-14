// Read-only: HTTP status of the stored photo URL for recently created users
// (URLs not printed — just the status) — proves dangling-asset breakage.
const fs = require('fs');
const mongoose = require('mongoose');

const env = fs.readFileSync('.env.local', 'utf8');
const uri = env.match(/^MONGODB_URI=(.+)$/m)[1].trim();

(async () => {
  await mongoose.connect(uri);
  const col = mongoose.connection.collection('users');
  const docs = await col
    .find(
      { createdAt: { $gte: new Date('2026-10-12') }, photo: { $ne: null } },
      { projection: { createdAt: 1, updatedAt: 1, photo: 1 } }
    )
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();
  for (const d of docs) {
    let status = 'err';
    try {
      const res = await fetch(d.photo, { method: 'HEAD' });
      status = String(res.status);
    } catch (e) {
      status = 'fetch-failed';
    }
    console.log(
      'created:', d.createdAt.toISOString(),
      '| updated:', d.updatedAt.toISOString(),
      '| photo HTTP:', status
    );
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
