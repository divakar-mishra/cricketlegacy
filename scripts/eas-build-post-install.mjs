import { spawnSync } from 'node:child_process';

if (process.env.EAS_BUILD_PROFILE !== 'production') {
  console.log('Skipping store-release checks for a non-production EAS build.');
  process.exit(0);
}

const result = spawnSync('npm', ['run', 'check:legal'], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(`Unable to run store-release checks: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
