const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // The release tag is derived from the type, so the type must be spelled
    // exactly. This is the rule that actually protects the tag from being wrong.
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'perf',
        'refactor',
        'docs',
        'style',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    // ...and a scope is mandatory, because the scope is the subsystem name that
    // ends up in the release notes.
    'scope-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    // No trailing period, sentence-style body.
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
  },
};

export default config;
