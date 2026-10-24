import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./retry-dependabot.sh', import.meta.url));
const pr = {
  number: 166,
  headRefName: 'dependabot/npm_and_yarn/development-example',
  headRefOid: 'current-sha',
  author: { login: 'app/dependabot' },
  state: 'OPEN',
};
const run = {
  databaseId: 123,
  headSha: 'current-sha',
  status: 'completed',
  conclusion: 'failure',
  attempt: 1,
  updatedAt: new Date(Date.now() - 7 * 60 * 60 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z'),
};

// Only the network boundary is replaced. The real shell script, jq filtering,
// pagination response shape, age checks and requested side effects all execute.
function execute(overrides = {}, manual = '') {
  const directory = mkdtempSync(join(tmpdir(), 'finanzapp-ci-retry-'));
  const scenario = {
    prs: [pr],
    runs: [[run], [run]],
    pages: [
      {
        jobs: [
          { id: 10, conclusion: 'success' },
          { id: 20, conclusion: 'failure' },
        ],
      },
    ],
    logs: { 10: 'success', 20: 'ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION' },
    comments: [],
    currentSha: pr.headRefOid,
    ...overrides,
  };
  writeFileSync(join(directory, 'scenario.json'), JSON.stringify(scenario));
  writeFileSync(
    join(directory, 'gh'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const path = process.env.FAKE_GH_DIRECTORY;
const s = JSON.parse(fs.readFileSync(path + '/scenario.json', 'utf8'));
const a = process.argv.slice(2);
const previous = fs.existsSync(path + '/calls.jsonl')
  ? fs.readFileSync(path + '/calls.jsonl', 'utf8').trim().split('\\n').map(JSON.parse) : [];
fs.appendFileSync(path + '/calls.jsonl', JSON.stringify(a) + '\\n');
const output = (v) => process.stdout.write(JSON.stringify(v));
if (s.fail && a.slice(0, s.fail.length).join(' ') === s.fail.join(' ')) process.exit(79);
if (a[0] === 'pr' && a[1] === 'list') output(s.prs);
else if (a[0] === 'pr' && a[1] === 'view') {
  const fields = a[a.indexOf('--json') + 1];
  if (fields === 'comments') output({ comments: s.comments });
  else if (fields === 'headRefOid') output({ headRefOid: s.currentSha });
  else output(s.prs[0]);
} else if (a[0] === 'run' && a[1] === 'list') {
  const index = previous.filter((c) => c[0] === 'run' && c[1] === 'list').length;
  output(s.runs[Math.min(index, s.runs.length - 1)]);
} else if (a[0] === 'api') {
  const endpoint = a.find((v) => v.startsWith('/repos/'));
  if (endpoint?.includes('/jobs?')) output(s.pages);
  else if (endpoint?.endsWith('/logs')) {
    const id = endpoint.split('/').at(-2);
    if (!(id in s.logs)) process.exit(80);
    process.stdout.write(s.logs[id]);
  } else process.exit(81);
} else if (!['pr edit', 'pr comment', 'label create', 'run rerun'].includes(a.slice(0, 2).join(' '))) {
  process.stderr.write('Unexpected gh call: ' + JSON.stringify(a));
  process.exit(82);
}
`,
  );
  chmodSync(join(directory, 'gh'), 0o755);
  try {
    const result = spawnSync('bash', [script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        GH_TOKEN: 'fake-token-never-sent',
        REPO: 'example/finance',
        MANUAL_PR: manual,
        FAKE_GH_DIRECTORY: directory,
      },
      timeout: 15000,
    });
    let calls = [];
    try {
      calls = readFileSync(join(directory, 'calls.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map(JSON.parse);
    } catch {
      // A rejected input can exit before the first API call.
    }
    return { ...result, calls };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function reruns(result) {
  return result.calls.filter(
    (call) => call[0] === 'run' && call[1] === 'rerun',
  );
}

function assertSuccess(result) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

test('no open Dependabot PRs exits without inspecting runs or creating labels', () => {
  const result = execute({ prs: [] });
  assertSuccess(result);
  assert.equal(result.calls.length, 1);
});

for (const [description, changedRun] of [
  ['successful latest run', { conclusion: 'success' }],
  ['running latest attempt', { status: 'in_progress', conclusion: null }],
  ['queued latest attempt', { status: 'queued', conclusion: null }],
  ['superseded commit', { headSha: 'old-sha' }],
  ['exhausted retry budget', { attempt: 5 }],
  [
    'recent failure',
    { updatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') },
  ],
]) {
  test(`${description} never downloads job logs or reruns old failures`, () => {
    const result = execute({ runs: [[{ ...run, ...changedRun }]] });
    assertSuccess(result);
    assert.equal(reruns(result).length, 0);
    assert.ok(!result.calls.some((call) => call[0] === 'api'));
  });
}

test('no CI run for the branch exits without retries', () => {
  const result = execute({ runs: [[]] });
  assertSuccess(result);
  assert.equal(reruns(result).length, 0);
});

test('only current failed CI jobs are inspected, including paginated jobs', () => {
  const result = execute({
    pages: [
      { jobs: [{ id: 10, conclusion: 'success' }] },
      { jobs: [{ id: 20, conclusion: 'failure' }] },
    ],
  });
  assertSuccess(result);
  const lists = result.calls.filter(
    (call) => call[0] === 'run' && call[1] === 'list',
  );
  assert.ok(lists.length >= 1);
  for (const call of lists) {
    assert.equal(call[call.indexOf('--workflow') + 1], 'ci.yml');
    assert.equal(call[call.indexOf('--limit') + 1], '1');
    assert.ok(!call.includes('--status'), 'Do not search historical failures');
  }
  const api = result.calls.filter((call) => call[0] === 'api');
  assert.ok(api[0].includes('--paginate'));
  assert.ok(api[0].includes('--slurp'));
  assert.deepEqual(
    api
      .filter((call) => call.some((arg) => arg.endsWith('/logs')))
      .map((call) => call.find((arg) => arg.startsWith('/repos/'))),
    ['/repos/example/finance/actions/jobs/20/logs'],
  );
  assert.deepEqual(reruns(result), [
    ['run', 'rerun', '123', '--failed', '--repo', 'example/finance'],
  ]);
});

test('non-age failures remove stale retry labels but do not retry', () => {
  const result = execute({ logs: { 20: 'Database credentials missing' } });
  assertSuccess(result);
  assert.equal(reruns(result).length, 0);
  assert.ok(
    result.calls.some(
      (call) => call.includes('--remove-label') && call.includes('retry-24h'),
    ),
  );
});

test('large age-violation logs still trigger only one failed-jobs retry', () => {
  const result = execute({
    logs: {
      20: `${'x'.repeat(200000)}\nERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION\n`,
    },
  });
  assertSuccess(result);
  assert.equal(reruns(result).length, 1);
});

test('existing bot explanation is not posted twice', () => {
  const result = execute({
    comments: [
      {
        author: { login: 'github-actions[bot]' },
        body: 'minimumReleaseAge violation',
      },
    ],
  });
  assertSuccess(result);
  assert.equal(reruns(result).length, 1);
  assert.ok(
    !result.calls.some((call) => call[0] === 'pr' && call[1] === 'comment'),
  );
});

test('newer CI attempt discovered during inspection is not overwritten by a retry', () => {
  const result = execute({
    runs: [
      [run],
      [{ ...run, attempt: 2, status: 'in_progress', conclusion: null }],
    ],
  });
  assertSuccess(result);
  assert.equal(reruns(result).length, 0);
});

test('PR head changed during inspection is not retried', () => {
  const result = execute({ currentSha: 'newer-sha' });
  assertSuccess(result);
  assert.equal(reruns(result).length, 0);
});

test('manual targets cannot retry a non-Dependabot PR', () => {
  const result = execute(
    { prs: [{ ...pr, author: { login: 'someone-dependabot-like' } }] },
    '166',
  );
  assertSuccess(result);
  assert.equal(reruns(result).length, 0);
  assert.ok(!result.calls.some((call) => call[0] === 'run'));
});

test('manual targets cannot retry a closed PR', () => {
  const result = execute({ prs: [{ ...pr, state: 'CLOSED' }] }, '166');
  assertSuccess(result);
  assert.equal(reruns(result).length, 0);
});

test('manual PR number is validated before calling GitHub', () => {
  const result = execute({}, '--unexpected-option');
  assert.equal(result.status, 1);
  assert.equal(result.calls.length, 0);
});

test('GitHub API errors fail visibly rather than looking like a successful no-op', () => {
  const result = execute({ fail: ['run', 'list'] });
  assert.equal(result.status, 79);
  assert.equal(reruns(result).length, 0);
});
