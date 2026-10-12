/* Throwaway diagnostic: is the e2e moderator roster pair still free in the
 * real DB? Prints claimed users for the pair + candidate free pairs. */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection('users');
  const students = mongoose.connection.collection('students');

  const claimed = await users.find({ studentId: '1417003' }).toArray();
  console.log(
    'users with studentId 1417003:',
    claimed.map((u) => ({ email: u.email, batch: u.batch, role: u.role, clerkId: u.clerkId }))
  );

  const roster = await students.findOne({ studentId: '1417003', batch: '2014' });
  console.log('roster has 1417003/2014:', !!roster);

  // Any free roster pair per batch (cap 3 each) — candidates for MOD_PAIR
  for (const batch of ['2011', '2012', '2013', '2014', '2015', '2016', '2017', '2019', '2020']) {
    const rows = await students.find({ batch }).limit(60).toArray();
    const taken = new Set(
      (await users.find({ batch }, { studentId: 1 }).toArray()).map((u) => u.studentId)
    );
    const free = rows.filter((r) => !taken.has(r.studentId)).slice(0, 3);
    if (free.length)
      console.log(
        `batch ${batch} free pairs:`,
        free.map((r) => `${r.studentId}`)
      );
  }
  await mongoose.disconnect();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
