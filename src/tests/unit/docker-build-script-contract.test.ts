import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repositoryRoot = process.cwd();
const scriptPath = path.join(repositoryRoot, 'docker', 'build.sh');

type RunResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  dockerLog: string[];
};

function runBuild(
  args: string[],
  extraEnv: Record<string, string> = {},
): RunResult {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'build-script-contract-'),
  );
  const binDir = path.join(tempDir, 'bin');
  fs.mkdirSync(binDir);
  const dockerLogPath = path.join(tempDir, 'docker.log');
  const fakeDockerPath = path.join(binDir, 'docker');
  fs.writeFileSync(
    fakeDockerPath,
    '#!/bin/sh\nprintf \'%s\\n\' "$*" >> "$DOCKER_LOG"\n',
  );
  fs.chmodSync(fakeDockerPath, 0o755);

  const result = spawnSync('bash', [scriptPath, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
      DOCKER_LOG: dockerLogPath,
      ...extraEnv,
    },
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    dockerLog: fs.existsSync(dockerLogPath)
      ? fs
          .readFileSync(dockerLogPath, 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
      : [],
  };
}

test('local build uses docker/.env defaults, two tags, exact app version, and root context', () => {
  const result = runBuild(['--release', 'v1.2.3']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.dockerLog.length, 1);
  const command = result.dockerLog[0];
  assert.match(
    command,
    /-t registry\.pi\.home:5000\/service-availability-scheduler:v1\.2\.3-node24-alpine/,
  );
  assert.match(
    command,
    /-t registry\.pi\.home:5000\/service-availability-scheduler:latest-node24-alpine/,
  );
  assert.match(command, /--build-arg APP_VERSION=v1\.2\.3/);
  assert.match(command, /--load/);
  assert.match(command, / \.\s*$/);
  assert.doesNotMatch(command, /GITHUB_AUTH|\.github_auth|--secret/);
});

test('normal build accepts explicit registry, platform, no-latest, and push options', () => {
  const result = runBuild([
    '--release',
    'release-7',
    '--registry',
    'registry.example.test/team',
    '--platform',
    'linux/arm64',
    '--no-latest',
    '--push',
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.dockerLog.length, 1);
  const command = result.dockerLog[0];
  assert.match(command, /--platform linux\/arm64/);
  assert.match(
    command,
    /-t registry\.example\.test\/team\/service-availability-scheduler:release-7-node24-alpine/,
  );
  assert.doesNotMatch(command, /latest-node24-alpine/);
  assert.match(command, /--push/);
  assert.doesNotMatch(command, /--load/);
});

test('normal mode rejects absent or option-token values before invoking docker', () => {
  const missingValueCases = [
    ['--release'],
    ['--release', 'release-1', '--registry'],
    ['--release', 'release-1', '--platform'],
  ];
  for (const args of missingValueCases) {
    const result = runBuild(args);
    assert.notEqual(result.status, 0, args.join(' '));
    assert.deepEqual(result.dockerLog, [], args.join(' '));
  }

  const optionTokenValueCases = [
    ['--release', 'release-1', '--platform', '--push'],
    ['--release', '--debug'],
  ];
  for (const args of optionTokenValueCases) {
    const result = runBuild(args);
    assert.notEqual(result.status, 0, args.join(' '));
    assert.deepEqual(result.dockerLog, [], args.join(' '));
    assert.match(result.stderr, /requires a value/, args.join(' '));
  }
});

test('metadata mode emits one complete matrix line and never invokes docker', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'github-output-'));
  const outputPath = path.join(outputDir, 'output');
  fs.writeFileSync(outputPath, '');
  const result = runBuild(
    [
      '--emit-github-matrix',
      '--release',
      'v1.2.3',
      '--registry',
      'forgejo.alexlab.nl/alexlab',
      '--platform',
      'linux/arm64',
      '--no-latest',
    ],
    { GITHUB_OUTPUT: outputPath },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.dockerLog, []);
  const lines = fs.readFileSync(outputPath, 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^matrix=/);
  const matrix = JSON.parse(lines[0].slice('matrix='.length)) as {
    include: Array<Record<string, string>>;
  };
  assert.equal(matrix.include.length, 1);
  assert.deepEqual(matrix.include[0], {
    image_name: 'service-availability-scheduler',
    image:
      'forgejo.alexlab.nl/alexlab/service-availability-scheduler:v1.2.3-node24-alpine',
    context: repositoryRoot,
    dockerfile: 'docker/Dockerfile',
    platform: 'linux/arm64',
    app_version: 'v1.2.3',
    cache_scope: 'service-availability-scheduler-linux-arm64',
  });
});

test('metadata mode rejects unsafe or incomplete inputs before docker or output writes', () => {
  const cases = [
    ['uppercase tag', ['--release', 'Release-1']],
    ['overlong tag', ['--release', `a${'b'.repeat(120)}`]],
    ['newline tag', ['--release', 'release\nforged']],
    [
      'wrong registry',
      ['--release', 'release-1', '--registry', 'registry.example/team'],
    ],
    ['wrong platform', ['--release', 'release-1', '--platform', 'linux/amd64']],
    ['unknown option', ['--release', 'release-1', '--wat']],
  ] as const;

  for (const [label, args] of cases) {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'github-output-invalid-'),
    );
    const outputPath = path.join(outputDir, 'output');
    fs.writeFileSync(outputPath, 'sentinel\n');
    const result = runBuild(
      [
        '--emit-github-matrix',
        '--release',
        'release-1',
        '--registry',
        'forgejo.alexlab.nl/alexlab',
        '--platform',
        'linux/arm64',
        '--no-latest',
        ...args,
      ],
      { GITHUB_OUTPUT: outputPath },
    );
    assert.notEqual(result.status, 0, label);
    assert.deepEqual(result.dockerLog, [], label);
    assert.equal(fs.readFileSync(outputPath, 'utf8'), 'sentinel\n', label);
  }

  const missingOutput = runBuild([
    '--emit-github-matrix',
    '--release',
    'release-1',
    '--registry',
    'forgejo.alexlab.nl/alexlab',
    '--platform',
    'linux/arm64',
    '--no-latest',
  ]);
  assert.notEqual(missingOutput.status, 0);
  assert.deepEqual(missingOutput.dockerLog, []);
});

test('value-taking options reject missing values and option tokens without docker or metadata mutation', () => {
  const metadataBase = [
    '--emit-github-matrix',
    '--release',
    'release-1',
    '--registry',
    'forgejo.alexlab.nl/alexlab',
    '--platform',
    'linux/arm64',
    '--no-latest',
  ];

  for (const option of ['--release', '--registry', '--platform']) {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'github-output-missing-value-'),
    );
    const outputPath = path.join(outputDir, 'output');
    fs.writeFileSync(outputPath, 'sentinel\n');
    const result = runBuild([...metadataBase, option], {
      GITHUB_OUTPUT: outputPath,
    });
    assert.notEqual(result.status, 0, `${option} missing value`);
    assert.deepEqual(result.dockerLog, [], `${option} missing value`);
    assert.equal(
      fs.readFileSync(outputPath, 'utf8'),
      'sentinel\n',
      `${option} missing value`,
    );
  }

  for (const option of ['--release', '--registry', '--platform']) {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'github-output-option-value-'),
    );
    const outputPath = path.join(outputDir, 'output');
    fs.writeFileSync(outputPath, 'sentinel\n');
    const result = runBuild([...metadataBase, option, '--no-latest'], {
      GITHUB_OUTPUT: outputPath,
    });
    assert.notEqual(result.status, 0, `${option} option token value`);
    assert.deepEqual(result.dockerLog, [], `${option} option token value`);
    assert.equal(
      fs.readFileSync(outputPath, 'utf8'),
      'sentinel\n',
      `${option} option token value`,
    );
  }
});

test('metadata mode rejects directory or missing GITHUB_OUTPUT destinations before docker or writes', () => {
  const baseArgs = [
    '--emit-github-matrix',
    '--release',
    'release-1',
    '--registry',
    'forgejo.alexlab.nl/alexlab',
    '--platform',
    'linux/arm64',
    '--no-latest',
  ];
  const outputDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'github-output-destination-'),
  );

  for (const destination of [
    outputDir,
    path.join(outputDir, 'missing-output'),
  ]) {
    const result = runBuild(baseArgs, { GITHUB_OUTPUT: destination });
    assert.notEqual(result.status, 0, destination);
    assert.deepEqual(result.dockerLog, [], destination);
    assert.equal(
      fs.existsSync(destination) && fs.statSync(destination).isDirectory(),
      destination === outputDir,
    );
  }
});

test('unknown and incompatible options fail instead of being silently ignored', () => {
  for (const args of [
    ['--release', 'release-1', '--unknown'],
    ['--emit-github-matrix', '--release', 'release-1', '--push'],
    ['--emit-github-matrix', '--release', 'release-1'],
  ]) {
    const result = runBuild(args, {
      GITHUB_OUTPUT: path.join(os.tmpdir(), 'missing-github-output-contract'),
    });
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.dockerLog, []);
  }
});
