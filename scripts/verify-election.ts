/**
 * Independent election-chain audit — recomputes every ballot chain straight
 * from the database (no server, no request context) and prints a verdict per
 * election, plus the fingerprint to compare against what was published.
 *
 *   npm run verify:election
 *
 * Run this any time — during voting, after close, or months after publishing
 * — to confirm no ballot was edited, deleted, or fabricated since casting.
 * If VOTING_SECRET differs from the one live at casting time, verification
 * fails by design (see voting-crypto.ts for the rotation warning).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDB } from '../src/lib/db';
import Election from '../src/lib/models/Election';
import { effectiveStatus, verifyChain } from '../src/lib/election';
import { hasVotingSecret } from '../src/lib/voting-crypto';

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
    // .env.local is optional — real env vars still apply
  }
}

async function main() {
  loadEnvLocal();

  if (!hasVotingSecret()) {
    console.error(
      'VOTING_SECRET is not set (or too short) — generate one and put it in .env.local first.'
    );
    process.exitCode = 1;
    return;
  }

  await connectDB();
  const elections = await Election.find().sort({ createdAt: -1 }).lean();
  if (elections.length === 0) {
    console.log('No elections in the database — nothing to verify.');
    await mongoose.disconnect();
    return;
  }

  let anyBroken = false;
  for (const election of elections) {
    const id = election._id.toString();
    const status = effectiveStatus(election);
    const chain = await verifyChain(id);

    console.log(`\nElection: ${election.title}`);
    console.log(`  status:            ${status} (stored: ${election.status})`);
    if (chain.ok) {
      console.log(`  chain:             VERIFIED — ${chain.ballotCount} ballot(s), ${chain.rollCount} voter(s)`);
      console.log(`  head hash:         ${chain.headHash}`);
    } else {
      anyBroken = true;
      console.log(`  chain:             FAILED — ${chain.reason}`);
      console.log(`  ballots inspected:  ${chain.ballotCount} (roll records: ${chain.rollCount})`);
    }
    if (election.publishedHeadHash) {
      const matches = chain.ok && election.publishedHeadHash === chain.headHash;
      console.log(`  published seal:    ${election.publishedHeadHash}`);
      console.log(
        `  matches now:       ${chain.ok ? (matches ? 'YES — nothing changed since publishing' : 'NO — the chain changed after publishing') : 'n/a (chain broken)'}`
      );
      if (chain.ok && !matches) anyBroken = true;
    }
  }

  await mongoose.disconnect();
  console.log(
    anyBroken
      ? '\nRESULT: PROBLEMS FOUND — the ledger does not verify against its seals.'
      : '\nRESULT: ALL CHAINS VERIFIED.'
  );
  process.exitCode = anyBroken ? 1 : 0;
}

main()
  .then(() => mongoose.disconnect())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
    return mongoose.disconnect();
  });
