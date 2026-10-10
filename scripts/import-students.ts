/**
 * Imports the department roster from studentData.json (repo root) into the
 * `students` collection — the source of truth that registration validates
 * Student IDs against (completeProfile in src/lib/actions/register.ts).
 *
 *   npm run import:students
 *
 * Also migrates User uniqueness: drops the global studentId unique index and
 * creates the per-batch compound { studentId, batch } one — IDs legitimately
 * repeat across batches (1717062 is in both the 7th and the 8th).
 *
 * Re-runnable: the roster import is a full refresh (deleteMany + insertMany),
 * and syncIndexes() applies index changes idempotently. Any data problem
 * aborts BEFORE the first write.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDB } from '../src/lib/db';
import User from '../src/lib/models/User';
import Student from '../src/lib/models/Student';
import { batches } from '../src/data/batches';

interface RawRow {
  name?: unknown;
  studentId?: unknown;
  regNo?: unknown;
  batch?: unknown;
  session?: unknown;
  needsReview?: unknown;
  reviewNote?: unknown;
}

// Per-batch counts of the sheet this script was written against — a mismatch
// only logs (the sheet may have legitimately changed), never blocks.
const EXPECTED: Record<string, number> = {
  '1st': 45,
  '2nd': 47,
  '3rd': 48,
  '4th': 46,
  '5th': 39,
  '6th': 67,
  '7th': 51,
  '8th': 52,
  '9th': 62,
  '10th': 50,
};

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

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

async function main() {
  loadEnvLocal();

  const raw = JSON.parse(
    readFileSync(path.join(process.cwd(), 'studentData.json'), 'utf8')
  ) as RawRow[];

  // --- Validate + map every row before touching the database ---
  const problems: string[] = [];
  const dupes: string[] = [];
  const needsReview: string[] = [];
  const seen = new Map<string, number>(); // `${studentId}|${year}` -> row no
  const rows: { name: string; studentId: string; regNo: string; batch: string; session: string }[] = [];
  const perBatch = new Map<string, number>();

  raw.forEach((row, i) => {
    const at = `row ${i + 1}`;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const studentId = typeof row.studentId === 'string' ? row.studentId.trim() : '';
    const regNo = typeof row.regNo === 'string' ? row.regNo.trim() : '';
    if (!name) problems.push(`${at}: missing name`);
    if (!studentId) problems.push(`${at}: missing studentId`);
    if (!regNo) problems.push(`${at}: missing regNo`);
    if (
      typeof row.batch !== 'number' ||
      !Number.isInteger(row.batch) ||
      row.batch < 1 ||
      row.batch > 10
    ) {
      problems.push(`${at}: batch must be an integer 1-10 (got ${JSON.stringify(row.batch)})`);
      return;
    }
    const session = typeof row.session === 'string' ? row.session : '';
    const b = batches.find((x) => x.batchNo === ordinal(row.batch as number));
    if (!b) {
      problems.push(`${at}: no batch with batchNo '${ordinal(row.batch as number)}' in src/data/batches.ts`);
      return;
    }
    // Free sanity check on the number -> batch mapping itself.
    if (session.slice(0, 4) !== b.year) {
      problems.push(
        `${at}: session '${session}' does not start with ${b.year} (batch ${row.batch} -> ${b.batchNo})`
      );
    }
    const key = `${studentId}|${b.year}`;
    if (seen.has(key)) {
      dupes.push(
        `${at}: studentId ${studentId} already mapped to batch ${b.year} at row ${seen.get(key)}`
      );
    } else {
      seen.set(key, i + 1);
    }
    if (row.needsReview === true) {
      needsReview.push(
        `${at} (${studentId}): ${typeof row.reviewNote === 'string' ? row.reviewNote : 'flagged without a note'}`
      );
    }
    rows.push({ name, studentId, regNo, batch: b.year, session: b.session });
    perBatch.set(b.batchNo, (perBatch.get(b.batchNo) ?? 0) + 1);
  });

  if (problems.length || dupes.length) {
    for (const p of [...problems, ...dupes]) console.error(`  ${p}`);
    throw new Error(
      `Aborted: ${problems.length + dupes.length} data problem(s) — nothing was written.`
    );
  }

  await connectDB();

  // --- User index migration: global studentId unique -> per-batch compound ---
  // syncIndexes drops schema-absent indexes (the old studentId_1) and creates
  // the compound one; the listIndexes check below is the post-condition that
  // catches any silent failure (which would keep global uniqueness in force).
  console.log('User index diff:', JSON.stringify(await User.diffIndexes()));
  await User.syncIndexes();
  const userIndexes = await User.listIndexes();
  const staleGlobal = userIndexes.some((ix) => ix.name === 'studentId_1');
  const compound = userIndexes.find((ix) => ix.name === 'studentId_1_batch_1');
  if (staleGlobal || !compound?.unique) {
    throw new Error(
      `User index migration failed — studentId_1 still present: ${staleGlobal}, ` +
        `unique studentId_1_batch_1 present: ${!!compound?.unique}`
    );
  }
  console.log('User indexes now:', userIndexes.map((ix) => ix.name).join(', '));

  // --- Roster full refresh ---
  await Student.syncIndexes();
  await Student.deleteMany({});
  await Student.insertMany(rows);
  const total = await Student.countDocuments({});
  if (total !== rows.length) {
    throw new Error(`Inserted ${total} of ${rows.length} roster records — re-run to heal.`);
  }
  console.log(`\nImported ${total} roster records:`);
  for (const b of batches) {
    const got = perBatch.get(b.batchNo) ?? 0;
    console.log(`  ${b.batchNo} (${b.year}): ${got}`);
    if (got !== EXPECTED[b.batchNo]) {
      console.log(`    note: sheet had ${EXPECTED[b.batchNo]} when this script was written`);
    }
  }

  // --- Spot checks ---
  const crossA = await Student.exists({ studentId: '1717062', batch: '2017' });
  const crossB = await Student.exists({ studentId: '1717062', batch: '2018' });
  const founder = await Student.findOne({ studentId: '1417003' }).lean();
  console.log(`\nspot: 1717062 in 2017: ${!!crossA} | in 2018: ${!!crossB} (same ID, two batches)`);
  console.log(`spot: 1417003 -> ${founder ? `${founder.batch} (${founder.session})` : 'MISSING'}`);
  if (!crossA || !crossB) throw new Error('Spot check failed: 1717062 must exist in both 2017 and 2018');
  if (!founder || founder.batch !== '2014') throw new Error('Spot check failed: 1417003 must map to 2014');

  console.log(`\nneedsReview rows (imported normally, flagged in the sheet): ${needsReview.length}`);
  for (const n of needsReview) console.log(`  ${n}`);
}

main()
  .then(() => mongoose.disconnect())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
    return mongoose.disconnect();
  });
