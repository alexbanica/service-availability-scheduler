import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import yaml from 'js-yaml';

type Workflow = {
  on?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
  jobs?: Record<string, Job>;
};

type Job = {
  needs?: string | string[];
  permissions?: Record<string, unknown>;
  outputs?: Record<string, string>;
  'runs-on'?: string;
  strategy?: { matrix?: unknown };
  steps?: Step[];
};

type Step = {
  name?: string;
  id?: string;
  uses?: string;
  run?: string;
  if?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
  'continue-on-error'?: boolean;
};

function loadWorkflow(): Workflow {
  const workflowPath = path.join(
    process.cwd(),
    '.github',
    'workflows',
    'release.yml',
  );
  return yaml.load(fs.readFileSync(workflowPath, 'utf8')) as Workflow;
}

function step(job: Job, predicate: (candidate: Step) => boolean): Step {
  const match = (job.steps ?? []).find(predicate);
  assert.ok(match, 'Expected workflow step was not found');
  return match;
}

function uses(job: Job, action: string): Step {
  return step(
    job,
    (candidate) => candidate.uses?.startsWith(`${action}@`) === true,
  );
}

test('release workflow is tag-only and has read-only repository permissions', () => {
  const workflow = loadWorkflow();
  const triggers = workflow.on ?? {};

  assert.deepEqual(Object.keys(triggers), ['push']);
  assert.deepEqual((triggers.push as { tags?: string[] }).tags, ['*']);
  assert.equal(workflow.permissions?.contents, 'read');
  assert.equal('workflow_dispatch' in triggers, false);
  assert.equal('pull_request' in triggers, false);
  assert.equal('branches' in (triggers.push as object), false);
});

test('preparation validates the tag through metadata mode before publication secrets', () => {
  const workflow = loadWorkflow();
  const preparation = workflow.jobs?.['prepare-release'];
  assert.ok(preparation);
  assert.equal(preparation.needs, undefined);
  assert.equal(preparation.permissions?.contents, 'read');

  const checkout = uses(preparation, 'actions/checkout');
  assert.equal(
    checkout.uses,
    'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
  );
  assert.equal(checkout.with?.ref, '${{ github.sha }}');
  assert.equal(checkout.with?.['persist-credentials'], false);

  const metadata = step(
    preparation,
    (candidate) => candidate.run?.includes('docker/build.sh') === true,
  );
  assert.equal(metadata.env?.RELEASE_TAG, '${{ github.ref_name }}');
  assert.match(metadata.run ?? '', /--emit-github-matrix/);
  assert.match(metadata.run ?? '', /--release\s+"\$RELEASE_TAG"/);
  assert.doesNotMatch(metadata.run ?? '', /\$\{\{\s*github\.ref_name/);
  assert.match(
    metadata.run ?? '',
    /--registry\s+forgejo\.alexlab\.nl\/alexlab/,
  );
  assert.match(metadata.run ?? '', /--platform\s+linux\/arm64/);
  assert.match(metadata.run ?? '', /--no-latest/);
  assert.equal(
    (preparation.steps ?? []).some(
      (candidate) => candidate.uses?.includes('docker/') === true,
    ),
    false,
  );
  assert.equal(
    (preparation.steps ?? []).some((candidate) =>
      JSON.stringify(candidate).includes('FORGEJO_'),
    ),
    false,
  );
  assert.doesNotMatch(JSON.stringify(preparation), /secrets\./i);
  assert.match(
    preparation.outputs?.matrix ?? '',
    /steps\.[A-Za-z0-9_-]+\.outputs\.matrix/,
  );
});

test('publication consumes only preparation matrix on a native ARM64 runner', () => {
  const workflow = loadWorkflow();
  const publication = workflow.jobs?.publish;
  assert.ok(publication);
  assert.equal(publication.needs, 'prepare-release');
  assert.equal(publication['runs-on'], 'ubuntu-24.04-arm');
  assert.deepEqual(publication.permissions, { contents: 'read' });
  assert.equal(
    publication.strategy?.matrix,
    '${{ fromJSON(needs.prepare-release.outputs.matrix) }}',
  );

  const checkout = uses(publication, 'actions/checkout');
  assert.equal(
    checkout.uses,
    'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
  );
  assert.equal(checkout.with?.ref, '${{ github.sha }}');
  assert.equal(checkout.with?.['persist-credentials'], false);

  const build = step(
    publication,
    (candidate) => candidate.run?.includes('docker build') === true,
  );
  assert.equal(build.env?.APP_VERSION, '${{ matrix.app_version }}');
  assert.equal(build.env?.BUILD_CONTEXT, '${{ matrix.context }}');
  assert.equal(build.env?.DOCKERFILE, '${{ matrix.dockerfile }}');
  assert.equal(build.env?.IMAGE, '${{ matrix.image }}');
  assert.equal(build.env?.PLATFORM, '${{ matrix.platform }}');
  assert.match(build.run ?? '', /test "\$\(uname -m\)" = "aarch64"/);
  assert.match(build.run ?? '', /test "\$PLATFORM" = "linux\/arm64"/);
  assert.match(build.run ?? '', /docker build\s+\\/);
  assert.match(build.run ?? '', /--platform "\$PLATFORM"/);
  assert.match(build.run ?? '', /--file "\$DOCKERFILE"/);
  assert.match(build.run ?? '', /--build-arg "APP_VERSION=\$APP_VERSION"/);
  assert.match(build.run ?? '', /--tag "\$IMAGE"/);
  assert.match(build.run ?? '', /"\$BUILD_CONTEXT"/);
  assert.match(build.run ?? '', /docker push "\$IMAGE"/);
  assert.equal((build.run ?? '').match(/docker build\b/g)?.length, 1);
  assert.equal((build.run ?? '').match(/docker push\b/g)?.length, 1);
});

test('publication uses pinned Forgejo login without QEMU or Buildx actions', () => {
  const workflow = loadWorkflow();
  const publication = workflow.jobs?.publish;
  assert.ok(publication);
  const allSteps = publication.steps ?? [];
  const actionVersions = new Map(
    allSteps
      .filter((candidate) => candidate.uses)
      .map((candidate) => [
        candidate.uses?.split('@')[0],
        candidate.uses?.split('@')[1],
      ]),
  );
  assert.equal(actionVersions.has('docker/setup-qemu-action'), false);
  assert.equal(actionVersions.has('docker/setup-buildx-action'), false);
  assert.equal(actionVersions.has('docker/build-push-action'), false);
  assert.equal(
    actionVersions.get('docker/login-action'),
    'dbcb813823bdd20940b903addbd779551569679f',
  );

  const login = uses(publication, 'docker/login-action');
  assert.equal(login.with?.registry, 'forgejo.alexlab.nl');
  assert.equal(
    login.with?.username,
    '${{ secrets.FORGEJO_REGISTRY_USERNAME }}',
  );
  assert.equal(login.with?.password, '${{ secrets.FORGEJO_REGISTRY_TOKEN }}');
  const secretText = JSON.stringify(publication);
  assert.deepEqual(
    [...secretText.matchAll(/secrets\.([A-Z0-9_]+)/g)]
      .map((match) => match[1])
      .sort(),
    ['FORGEJO_REGISTRY_TOKEN', 'FORGEJO_REGISTRY_USERNAME'],
  );
});

test('publication reports pushed digest and always logs out securely', () => {
  const workflow = loadWorkflow();
  const publication = workflow.jobs?.publish;
  assert.ok(publication);
  const digest = step(
    publication,
    (candidate) => candidate.run?.includes('RepoDigests') === true,
  );
  assert.match(digest.run ?? '', /docker image inspect/);
  assert.match(digest.run ?? '', /GITHUB_STEP_SUMMARY/);
  const logout = step(
    publication,
    (candidate) => candidate.run?.includes('docker logout') === true,
  );
  assert.match(logout.if ?? '', /always\(\)/);
  assert.notEqual(logout['continue-on-error'], true);

  const serialized = JSON.stringify(workflow).toLowerCase();
  for (const forbidden of [
    'docker/build.sh --release',
    'docker buildx',
    'docker/build-push-action',
    'docker/setup-buildx-action',
    'docker/setup-qemu-action',
    'latest-node24-alpine',
    'insecure',
    'tlsverify=false',
    'type=gha',
  ]) {
    assert.equal(
      serialized.includes(forbidden),
      false,
      `Forbidden release behavior: ${forbidden}`,
    );
  }
});
