/**
 * Regression tests for security fixes in the auth module.
 *
 * These tests validate the `isAllowed` logic for the ALLOWED_USERS
 * allowlist, which previously had a bypass: an empty/missing ALLOWED_USERS
 * would match any login because `"".split(",")` produces `[""]` and
 * the default `profile.login` was `""`.
 *
 * Exercise the shared implementation used by auth and demo eligibility.
 */

import { isAllowed as checkAllowed } from '@/lib/auth-credentials';

function isAllowed(
  identity: string | undefined | null,
  allowedUsers: string | undefined,
) {
  return checkAllowed(identity, allowedUsers ?? '');
}

describe('isAllowed (ALLOWED_USERS parsing)', () => {
  it('allows a user who is in the allowlist', () => {
    expect(isAllowed('alice', 'alice,bob')).toBe(true);
  });

  it('rejects a user who is NOT in the allowlist', () => {
    expect(isAllowed('eve', 'alice,bob')).toBe(false);
  });

  it('rejects when ALLOWED_USERS is undefined', () => {
    expect(isAllowed('alice', undefined)).toBe(false);
  });

  it('rejects when ALLOWED_USERS is empty string', () => {
    expect(isAllowed('alice', '')).toBe(false);
  });

  it('rejects when ALLOWED_USERS is just commas and spaces', () => {
    expect(isAllowed('alice', ' , , ')).toBe(false);
  });

  it('rejects when identity is undefined (null session)', () => {
    expect(isAllowed(undefined, 'alice')).toBe(false);
  });

  it('rejects when identity is null', () => {
    expect(isAllowed(null, 'alice')).toBe(false);
  });

  it('rejects when identity is empty string', () => {
    expect(isAllowed('', 'alice')).toBe(false);
  });

  it('handles allowlist with extra whitespace', () => {
    expect(isAllowed('alice', '  alice  ,  bob  ')).toBe(true);
  });

  it('is case-sensitive (matching the original behavior)', () => {
    expect(isAllowed('Alice', 'alice,bob')).toBe(false);
  });
});

describe('ALLOWED_USERS regression: empty string bypass', () => {
  it("does NOT allow login when ALLOWED_USERS splits into [''] and profile.login is ''", () => {
    expect(isAllowed('', '')).toBe(false);
    expect(isAllowed('', '  ')).toBe(false);
    expect(isAllowed('anyone', '')).toBe(false);
  });
});
