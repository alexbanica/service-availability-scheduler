import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import yaml from 'js-yaml';

type WorkflowStep = {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
};

type WorkflowJob = {
  steps?: WorkflowStep[];
};

type ValidationWorkflow = {
  on?: {
    pull_request?: { branches?: string[]; types?: string[] };
    push?: { branches?: string[] };
    pull_request_target?: unknown;
  };
  permissions?: Record<string, unknown>;
  jobs?: Record<string, WorkflowJob>;
};

function readWorkflow(): { source: string; workflow: ValidationWorkflow } {
  const workflowPath = path.join(
    process.cwd(),
    '.github',
    'workflows',
    'ci.yml',
  );
  assert.ok(fs.existsSync(workflowPath), 'Expected .github/workflows/ci.yml');
  const source = fs.readFileSync(workflowPath, 'utf8');
  const workflow = yaml.load(source) as ValidationWorkflow;
  assert.ok(
    workflow && typeof workflow === 'object',
    'Expected valid workflow YAML',
  );
  return { source, workflow };
}

function validationSteps(workflow: ValidationWorkflow): WorkflowStep[] {
  const jobs = Object.values(workflow.jobs ?? {});
  return jobs.flatMap((job) => job.steps ?? []);
}

function stepUses(
  step: WorkflowStep,
  action: string,
): step is WorkflowStep & { uses: string } {
  return typeof step.uses === 'string' && step.uses.startsWith(action);
}

function runCommands(workflow: ValidationWorkflow): string[] {
  return validationSteps(workflow)
    .map((step) => step.run)
    .filter((run): run is string => typeof run === 'string');
}

test('validation workflow is limited to main pull requests and pushes', () => {
  const { workflow } = readWorkflow();
  const pullRequest = workflow.on?.pull_request;
  const push = workflow.on?.push;

  assert.deepEqual(pullRequest?.branches, ['main']);
  assert.deepEqual(pullRequest?.types, [
    'opened',
    'reopened',
    'ready_for_review',
    'synchronize',
  ]);
  assert.deepEqual(push?.branches, ['main']);
  assert.equal(workflow.on?.pull_request_target, undefined);
});

test('validation checkout avoids explicit head SHA pinning and uses merge context', () => {
  const { workflow, source } = readWorkflow();
  const steps = validationSteps(workflow);
  const checkout = steps.find((candidate) =>
    stepUses(candidate, 'actions/checkout@'),
  );
  assert.ok(checkout, 'Expected workflow checkout step');

  assert.equal(checkout.with?.ref, undefined);
  assert.ok(
    checkout.with === undefined || !('head-ref' in checkout.with),
    'Expected no explicit pull_request head override',
  );
  assert.doesNotMatch(
    source,
    /\{\{\s*github\.event\.pull_request\.head\.sha\s*\}\}/,
    'checkout should not pin PR head SHA',
  );
  assert.doesNotMatch(
    source,
    /\{\{\s*github\.event\.pull_request\.head\.ref\s*\}\}/,
    'checkout should not pin PR head ref',
  );
});

test('validation workflow has read-only permissions and no publication capability', () => {
  const { workflow, source } = readWorkflow();
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.doesNotMatch(
    source,
    /FORGEJO|REGISTRY_TOKEN|docker\/login|build-push/i,
  );
  assert.doesNotMatch(source, /docker\/build|docker build|docker push/i);
  assert.doesNotMatch(source, /secrets\./i);
});

test('validation workflow checks out without a persisted credential and installs Node 24 from lockfile', () => {
  const { workflow, source } = readWorkflow();
  const steps = validationSteps(workflow);
  const checkout = steps.find((step) => stepUses(step, 'actions/checkout@'));
  const setupNode = steps.find((step) => stepUses(step, 'actions/setup-node@'));

  assert.ok(checkout, 'Expected pinned actions/checkout step');
  assert.equal(
    checkout?.uses,
    'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
  );
  assert.match(
    source,
    /uses:\s*actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\s+#\s*v7\.0\.1/,
  );
  assert.equal(checkout?.with?.['persist-credentials'], false);
  assert.ok(setupNode, 'Expected pinned actions/setup-node step');
  assert.equal(
    setupNode?.uses,
    'actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38',
  );
  assert.match(
    source,
    /uses:\s*actions\/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38\s+#\s*v6/,
  );
  assert.equal(setupNode?.with?.['node-version'], 24);
  assert.equal(setupNode?.with?.cache, 'npm');
  assert.ok(
    runCommands(workflow).some((command) => /^npm ci\s*$/m.test(command)),
  );
});

test('validation workflow runs the exact lint and test entry points', () => {
  const commands = runCommands(readWorkflow().workflow).join('\n');
  assert.match(commands, /(^|\n)npm run lint\s*(\n|$)/);
  assert.match(commands, /(^|\n)npm test\s*(\n|$)/);
});

test('lint mutation check preserves install baseline and detects only lint changes', () => {
  const commands = runCommands(readWorkflow().workflow).join('\n');
  const lintIndex = commands.indexOf('npm run lint');
  assert.notEqual(lintIndex, -1, 'Expected lint command');
  const beforeLint = commands.slice(0, lintIndex);
  const afterLint = commands.slice(lintIndex);

  assert.match(
    beforeLint,
    /git\s+diff\s+--binary\s+--\s+\.\s*>\s*\S*baseline\S*/i,
    'Expected the full tracked-diff content to be captured before lint',
  );
  assert.doesNotMatch(
    beforeLint,
    /git\s+diff\s+--quiet/i,
    'A pre-lint quiet check cannot establish the baseline content',
  );
  assert.match(
    afterLint,
    /git\s+diff\s+--binary\s+--\s+\.\s*>\s*\S*after-lint\S*/i,
    'Expected the full tracked-diff content to be captured after lint',
  );
  assert.match(
    afterLint,
    /diff\s+-u\s+\S*baseline\S*\s+\S*after-lint\S*/i,
    'Expected an unconditional comparison of pre- and post-lint content',
  );
  assert.doesNotMatch(afterLint, /if\s+!\s*git\s+diff\s+--quiet/i);
  assert.match(
    afterLint,
    /lint|changed|mutation|worktree/i,
    'Expected lint mutation failure messaging',
  );
});
