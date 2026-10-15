#!/usr/bin/env node
import { loadConfig } from './config.js';
import { connect } from './db/client.js';
import { Repo } from './db/repo.js';
import { errorMessage, log } from './lib/log.js';
import { STEPS, runPipeline, type Step } from './run.js';

const HELP = `Unslog pipeline

Usage:
  npm run pipeline -- run                       Run every step (what the daily schedule does)
  npm run pipeline -- run --steps collect,match Run only some steps
  npm run pipeline -- help

Steps, in order: ${STEPS.join(', ')}
Other commands: npm run gmail:auth, npm run gmail:sample, npm run db:migrate`;

async function main(argv: string[]): Promise<number> {
  const [command = 'help', ...rest] = argv;
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP);
    return 0;
  }
  if (command !== 'run') {
    console.error(`Unknown command "${command}"\n\n${HELP}`);
    return 2;
  }

  let steps: Step[] | undefined;
  const i = rest.indexOf('--steps');
  if (i !== -1) {
    const requested = (rest[i + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const unknown = requested.filter((s) => !STEPS.includes(s as Step));
    if (unknown.length || requested.length === 0) {
      console.error(`Unknown or missing steps: ${unknown.join(', ') || '(none given)'}. Valid: ${STEPS.join(', ')}`);
      return 2;
    }
    steps = requested as Step[];
  }

  const config = loadConfig();
  const db = connect(config.DATABASE_URL);
  try {
    const started = Date.now();
    const summary = await runPipeline(config, new Repo(db), { steps });
    log.info('run finished', { seconds: Math.round((Date.now() - started) / 1000) });
    console.log(JSON.stringify(summary, null, 2));
    // Fail the scheduled job only if every collector that ran failed, so you get an email from GitHub.
    const ran = summary.collectors.filter((c) => c.status !== 'skipped');
    return ran.length > 0 && ran.every((c) => c.status === 'failed') ? 1 : 0;
  } finally {
    await db.close();
  }
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    log.error('pipeline crashed', { error: errorMessage(err) });
    process.exit(1);
  });
