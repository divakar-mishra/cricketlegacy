import { spawnSync } from 'node:child_process';

if (process.env.EAS_BUILD_PROFILE !== 'production' && process.env.EAS_BUILD_PROFILE !== 'ios-production') {
  console.log('Skipping store-release checks for a non-production EAS build.');
  process.exit(0);
}

const result = spawnSync('npm', ['run', 'check:legal'], {
  stdio: 'inherit',
  env: process.env,
});

if (result.status === 0 && process.env.EAS_BUILD_PLATFORM === 'ios') {
  const ios = spawnSync('node', ['scripts/checkIosRelease.cjs'], { stdio: 'inherit', env: process.env });
  if (ios.error || ios.status !== 0) process.exit(ios.status || 1);
}

if (result.error) {
  console.error(`Unable to run store-release checks: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
