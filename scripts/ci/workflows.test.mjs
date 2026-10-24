import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { parse } from 'yaml';

function workflow(name) {
  return parse(
    readFileSync(
      new URL(`../../.github/workflows/${name}.yml`, import.meta.url),
      'utf8',
    ),
  );
}

const ci = workflow('ci');

test('quality shares one install while retaining all validation and build commands', () => {
  assert.deepEqual(Object.keys(ci.jobs).sort(), ['e2e-tests', 'quality']);
  const steps = ci.jobs.quality.steps;
  const commands = steps.map((step) => step.run).filter(Boolean);
  assert.equal(
    commands.filter((command) => command === 'pnpm install --frozen-lockfile')
      .length,
    1,
  );
  for (const command of [
    'pnpm format:check',
    'pnpm lint',
    'pnpm tsc --noEmit',
    'pnpm depcruise',
    'pnpm knip',
    'pnpm audit --audit-level=high',
    'pnpm test',
    'pnpm test:ci',
    'pnpm build',
  ]) {
    assert.ok(commands.includes(command), `Missing check: ${command}`);
  }
  assert.ok(steps.every((step) => !step['continue-on-error']));
  assert.equal(
    steps.find((step) => step.uses?.startsWith('trufflesecurity/trufflehog@'))
      ?.with.extra_args,
    '--only-verified',
  );
});

test('human PR commitlint keeps the full commit range without running on bots or pushes', () => {
  assert.ok(ci.jobs.quality, 'Checks must share the quality job');
  const steps = ci.jobs.quality.steps;
  const checkout = steps.find((step) =>
    step.uses?.startsWith('actions/checkout@'),
  );
  assert.equal(checkout.with['fetch-depth'], 0);
  const commitlint = steps.find((step) =>
    step.run?.includes('pnpm exec commitlint'),
  );
  assert.equal(
    commitlint.if,
    "github.event_name == 'pull_request' && github.actor != 'dependabot[bot]'",
  );
  assert.ok(commitlint.run.includes('--from "$BASE_SHA"'));
  assert.ok(commitlint.run.includes('--to "$HEAD_SHA"'));
  assert.equal(
    commitlint.env.BASE_SHA,
    '${{ github.event.pull_request.base.sha }}',
  );
  assert.equal(
    commitlint.env.HEAD_SHA,
    '${{ github.event.pull_request.head.sha }}',
  );
});

test('required E2E check evaluates failed prerequisites instead of being silently skipped', () => {
  const e2e = ci.jobs['e2e-tests'];
  assert.equal(e2e.needs, 'quality');
  assert.equal(e2e.if, '${{ !cancelled() }}');
  const guard = e2e.steps[0];
  assert.equal(
    typeof guard.run,
    'string',
    'Prerequisites must be checked before checkout',
  );
  assert.equal(guard.env.QUALITY_RESULT, '${{ needs.quality.result }}');
  for (const result of ['success', 'failure', 'skipped', 'cancelled', '']) {
    const execution = spawnSync('bash', ['-e', '-c', guard.run], {
      encoding: 'utf8',
      env: { ...process.env, QUALITY_RESULT: result },
    });
    assert.equal(execution.status, result === 'success' ? 0 : 1, result);
  }
});

test('missing database configuration fails before setup without disclosing credentials', () => {
  const e2e = ci.jobs['e2e-tests'];
  const guard = e2e.steps[1];
  assert.equal(
    typeof guard.run,
    'string',
    'Database must be checked before checkout',
  );
  for (const [pooled, direct, expected] of [
    ['', '', 1],
    ['secret-pooled-url', '', 1],
    ['', 'secret-direct-url', 1],
    ['secret-pooled-url', 'secret-direct-url', 0],
  ]) {
    const execution = spawnSync('bash', ['-e', '-c', guard.run], {
      encoding: 'utf8',
      env: {
        ...process.env,
        POSTGRES_URL: pooled,
        POSTGRES_URL_NON_POOLING: direct,
      },
    });
    assert.equal(execution.status, expected);
    assert.ok(!`${execution.stdout}${execution.stderr}`.includes('secret-'));
  }
});

test('E2E retains all browsers, database serialization, and existing test execution', () => {
  const e2e = ci.jobs['e2e-tests'];
  assert.deepEqual(e2e.concurrency, {
    group: 'e2e-db',
    'cancel-in-progress': false,
  });
  const commands = e2e.steps.map((step) => step.run).filter(Boolean);
  assert.ok(
    commands.includes(
      'pnpm exec playwright install --with-deps chromium firefox webkit',
    ),
  );
  assert.ok(commands.includes('pnpm test:e2e'));
  assert.ok(commands.includes('pnpm tsx scripts/reset-test-user-data.ts'));
  assert.ok(
    commands.includes('psql "$POSTGRES_URL_NON_POOLING" -f db/init.sql'),
  );
  assert.ok(!commands.some((command) => command.includes('apt-get')));
  assert.deepEqual(ci.on, {
    push: { branches: ['main'] },
    pull_request: { branches: ['main'] },
  });
});

test('CodeQL cancels superseded scans and analyzes without application installation', () => {
  const codeql = workflow('codeql');
  assert.deepEqual(codeql.concurrency, {
    group: '${{ github.workflow }}-${{ github.ref }}',
    'cancel-in-progress': true,
  });
  const analyze = codeql.jobs.analyze;
  assert.equal(analyze['timeout-minutes'], 10);
  assert.equal(analyze.name, 'Analyze');
  assert.deepEqual(analyze.strategy.matrix.include, [
    { language: 'javascript-typescript', 'build-mode': 'none' },
  ]);
  assert.deepEqual(
    analyze.steps.map((step) => step.uses),
    [
      'actions/checkout@v5',
      'github/codeql-action/init@v4',
      'github/codeql-action/analyze@v4',
    ],
  );
  assert.equal(
    analyze.steps[1].with.queries,
    'security-extended,security-and-quality',
  );
  assert.equal(
    analyze.steps[2].with.category,
    '/language:${{ matrix.language }}',
  );
  assert.deepEqual(codeql.on, {
    push: { branches: ['main'] },
    pull_request: { branches: ['main'] },
    schedule: [{ cron: '0 6 * * 1' }],
  });
});
