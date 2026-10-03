/**
 * semantic-release configuration.
 *
 * Runs in CI on every push to `main` (see .github/workflows/release.yml).
 * The version bump is derived entirely from commit messages, so the commit
 * convention documented in AGENTS.md is what actually drives the release tag.
 *
 * Only `feat`, `fix`, `perf` and breaking changes produce a release. Every
 * other type is explicitly silent, so `docs`, `test`, `chore`, `refactor` and
 * friends merge to production without cutting a tag. That is deliberate: the
 * tag stream is meant to be a log of meaningful changes, not of every merge.
 *
 * The preset is passed as an absolute path rather than `preset: '...'`. By
 * name, the plugins resolve it from their own folder first and pick up the v10
 * copy that commitlint pulls in, whose templates need conventional-changelog-
 * writer 9, while release-notes-generator still ships writer 8. Resolving from
 * here pins the direct devDependency (v9) instead.
 */
import { createRequire } from 'node:module';

const conventionalCommits = createRequire(import.meta.url).resolve(
  'conventional-changelog-conventionalcommits',
);

const config = {
  // v1.2.3
  tagFormat: 'v${version}',
  branches: ['main'],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        config: conventionalCommits,
        releaseRules: [
          // Types that describe housekeeping rather than user-visible change.
          // Everything not listed here falls through to the preset default:
          // feat -> minor, fix -> patch, perf -> patch, revert -> patch, and
          // any BREAKING CHANGE footer -> major.
          { type: 'docs', release: false },
          { type: 'test', release: false },
          { type: 'chore', release: false },
          { type: 'refactor', release: false },
          { type: 'style', release: false },
          { type: 'build', release: false },
          { type: 'ci', release: false },
        ],
      },
    ],
    // Same preset as the analyzer, so the notes group commits the same way
    // the bump was decided.
    [
      '@semantic-release/release-notes-generator',
      { config: conventionalCommits },
    ],
    // Nothing is committed back to main: the ruleset on main requires a pull
    // request, so a bot push would be rejected. The tag is the version and the
    // GitHub Release page is the changelog.
    // Creates the annotated git tag and the GitHub Release page.
    '@semantic-release/github',
  ],
};

export default config;
