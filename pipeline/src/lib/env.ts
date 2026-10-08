import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Loads a .env file into process.env using Node's built-in loader (no dotenv dependency).
 * Looks in the current folder first, then the repo root. Variables already set in the
 * environment (e.g. GitHub Actions secrets) are never overwritten.
 */
let loaded = false;
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
  for (const file of [join(process.cwd(), '.env'), join(repoRoot, '.env')]) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return;
    }
  }
}
