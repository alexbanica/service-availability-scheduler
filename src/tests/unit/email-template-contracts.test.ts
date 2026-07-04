import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

type TemplateExpectation = {
  fileName: string;
  subjectText: string;
  preheaderText: string;
  requiredPlaceholders: string[];
};

function readTemplate(fileName: string): string {
  const templatePath = path.join(process.cwd(), 'templates', fileName);
  return fs.readFileSync(templatePath, 'utf8');
}

function placeholderRegex(placeholder: string): RegExp {
  return new RegExp(
    `\\{\\{\\s*message\\.custom_data\\.${placeholder}\\s*\\}\\}`,
    'g',
  );
}

function assertTemplateContainsPlaceholders(
  template: string,
  placeholders: string[],
): void {
  for (const placeholder of placeholders) {
    const matches = template.match(placeholderRegex(placeholder));
    assert.ok(
      matches && matches.length > 0,
      `Expected placeholder {{${placeholder}}} in template`,
    );
  }
}

function assertTemplateHasSubjectPreheader(
  template: string,
  subjectText: string,
  preheaderText: string,
): void {
  const escapeRegExp = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  assert.ok(
    new RegExp(`^\\s*Subject:\\s*${escapeRegExp(subjectText)}`, 'm').test(
      template,
    ),
    `Expected template Subject line "${subjectText}"`,
  );
  assert.ok(
    new RegExp(`^\\s*Preheader:\\s*${escapeRegExp(preheaderText)}`, 'm').test(
      template,
    ),
    `Expected template Preheader line "${preheaderText}"`,
  );
}

function expectTemplateContract(expectation: TemplateExpectation): void {
  const template = readTemplate(expectation.fileName);

  assertTemplateHasSubjectPreheader(
    template,
    expectation.subjectText,
    expectation.preheaderText,
  );
  assertTemplateContainsPlaceholders(
    template,
    expectation.requiredPlaceholders,
  );

  const linkPlaceholder = expectation.requiredPlaceholders.find((value) =>
    value.endsWith('_url'),
  );
  if (linkPlaceholder) {
    assert.equal(
      template.includes('href') &&
        placeholderRegex(linkPlaceholder).test(template),
      true,
      `Expected ${expectation.fileName} to include an HTML link placeholder for ${linkPlaceholder}`,
    );
  }
}

test('password-reset email template contract', () => {
  expectTemplateContract({
    fileName: 'password-reset.html',
    subjectText: 'Reset your Service Availability Scheduler password',
    preheaderText: 'Use this link to choose a new password.',
    requiredPlaceholders: [
      'reset_url',
      'expires_in_minutes',
      'recipient_email',
    ],
  });
});

test('account-activation email template contract', () => {
  expectTemplateContract({
    fileName: 'account-activation.html',
    subjectText: 'Activate your Service Availability Scheduler account',
    preheaderText: 'Confirm your account to finish setup.',
    requiredPlaceholders: ['activation_url', 'nickname', 'recipient_email'],
  });
});

test('workspace-invitation email template contract', () => {
  expectTemplateContract({
    fileName: 'workspace-invitation.html',
    subjectText:
      'You have been invited to a Service Availability Scheduler workspace',
    preheaderText: 'Open the invitation to join the workspace.',
    requiredPlaceholders: [
      'invitation_url',
      'workspace_name',
      'expires_in_hours',
      'recipient_email',
    ],
  });
});
