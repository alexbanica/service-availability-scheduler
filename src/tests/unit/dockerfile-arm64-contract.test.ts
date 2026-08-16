import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const pinnedNodeImage =
  'node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd';

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function readDockerfile(): string {
  return readProjectFile(path.join('docker', 'Dockerfile'));
}

function readDockerignore(): string {
  return readProjectFile('.dockerignore');
}

test('Dockerfile uses the pinned Node 24 Alpine image for builder and runtime', () => {
  const dockerfile = readDockerfile();
  const fromImages = [
    ...dockerfile.matchAll(/^FROM\s+([^\s]+)(?:\s+AS\s+[\w-]+)?$/gim),
  ].map((match) => match[1]);

  assert.equal(fromImages.length, 3);
  assert.deepEqual(fromImages, [
    pinnedNodeImage,
    pinnedNodeImage,
    pinnedNodeImage,
  ]);
  assert.doesNotMatch(dockerfile, /^FROM\s+(?!node:24-alpine@)/m);
});

test('Dockerfile builds checked-out root sources without downloads or secrets', () => {
  const dockerfile = readDockerfile();

  assert.match(dockerfile, /COPY\s+package\.json\s+package-lock\.json\s+\.\//);
  assert.match(dockerfile, /COPY\s+\.\s+\.(?:\/)?/);
  assert.doesNotMatch(dockerfile, /\b(ADD|curl|wget|git\s+clone|unzip)\b/i);
  assert.doesNotMatch(
    dockerfile,
    /GITHUB_AUTH|GITHUB_REPO|RELEASE_TAG|run\/secrets/i,
  );
  assert.doesNotMatch(dockerfile, /--mount=type=secret/i);
});

test('Dockerfile installs locked development and production dependencies separately', () => {
  const dockerfile = readDockerfile();
  const builderStage = dockerfile.match(
    /FROM\s+[^\n]+\s+AS\s+builder(?<stage>[\s\S]*?)(?=^FROM\s|$(?![\s\S]))/im,
  )?.groups?.stage;
  const productionDependenciesStage = dockerfile.match(
    /FROM\s+[^\n]+\s+AS\s+production-dependencies(?<stage>[\s\S]*?)(?=^FROM\s|$(?![\s\S]))/im,
  )?.groups?.stage;

  assert.ok(builderStage, 'Missing builder stage');
  assert.ok(
    productionDependenciesStage,
    'Missing production-dependencies stage',
  );

  const builderNpmCi = builderStage.match(
    /^RUN\s+npm\s+ci(?:\s+[^\n]+)?$/im,
  )?.[0];
  const productionNpmCi = productionDependenciesStage.match(
    /^RUN\s+npm\s+ci(?:\s+[^\n]+)?$/im,
  )?.[0];

  assert.ok(
    builderNpmCi,
    'Builder must install the full locked dependency set',
  );
  assert.match(builderNpmCi, /--ignore-scripts/);
  assert.doesNotMatch(builderNpmCi, /--omit=dev/);
  assert.ok(
    productionNpmCi,
    'Production-dependencies stage must install dependencies',
  );
  assert.match(productionNpmCi, /--omit=dev/);
  assert.match(
    productionNpmCi,
    /--ignore-scripts/,
    'Production install must not run package lifecycle scripts',
  );
  assert.doesNotMatch(dockerfile, /RUN\s+npm\s+install(?:\s|$)/im);
});

test('Dockerfile directly compiles server and browser TypeScript and copies runtime inputs', () => {
  const dockerfile = readDockerfile();

  assert.match(dockerfile, /(?:npx\s+)?tsc\s+-p\s+tsconfig\.json/);
  assert.match(dockerfile, /(?:npx\s+)?tsc\s+-p\s+tsconfig\.client\.json/);
  assert.match(dockerfile, /COPY\s+--from=builder\s+\/app\/dist\s+\.\/dist/);
  assert.match(
    dockerfile,
    /COPY\s+--from=builder\s+\/app\/public\/js\s+\.\/public\/js/,
  );
  assert.match(
    dockerfile,
    /COPY\s+--from=builder\s+\/app\/config\s+\.\/config/,
  );
  assert.match(
    dockerfile,
    /COPY\s+--from=builder\s+\/app\/package\.json\s+\.\/package\.json/,
  );
  assert.match(
    dockerfile,
    /COPY\s+--from=builder\s+\/app\/package-lock\.json\s+\.\/package-lock\.json/,
  );
  assert.match(
    dockerfile,
    /COPY\s+--from=production-dependencies\s+\/app\/node_modules\s+\.\/node_modules/,
    'Runtime must receive production dependencies from their distinct stage',
  );
  assert.doesNotMatch(
    dockerfile,
    /COPY\s+--from=builder\s+\/app\/node_modules/,
  );
  assert.match(dockerfile, /ENV\s+APP_VERSION=\$\{APP_VERSION\}/);
});

test('Dockerfile ignore rules exclude repository metadata, generated files, secrets, and plans', () => {
  const dockerignore = readDockerignore();
  const requiredExclusions = [
    '.git',
    'node_modules',
    'dist',
    'public/js',
    'docker/.env',
    'docker/secrets',
    '.env',
    '.codex',
    'specs',
  ];

  for (const exclusion of requiredExclusions) {
    assert.match(
      dockerignore,
      new RegExp(`^${exclusion.replace(/[./]/g, '\\$&')}(?:/|$)`, 'm'),
      `Missing .dockerignore exclusion: ${exclusion}`,
    );
  }
});
