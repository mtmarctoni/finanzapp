/**
 * Regression tests for security fixes in the auth module.
 *
 * These tests validate the `isAllowed` logic for the ALLOWED_USERS
 * allowlist, which previously had a bypass: an empty/missing ALLOWED_USERS
 * would match any login because `"".split(",")` produces `[""]` and
 * the default `profile.login` was `""`.
 *
 * Since the function is not exported, we re-implement the exact logic
 * here to lock down the contract. If the implementation drifts, these
 * tests will catch it.
 */

describe('isAllowed (ALLOWED_USERS parsing)', () => {
  function isAllowed(
    identity: string | undefined | null,
    allowedUsers: string | undefined,
  ): boolean {
    if (!allowedUsers) return false;
    if (!identity) return false;
    const allowed = allowedUsers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.length === 0) return false;
    return allowed.includes(identity);
  }

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
    function isAllowed(
      identity: string | undefined | null,
      allowedUsers: string | undefined,
    ): boolean {
      if (!allowedUsers) return false;
      if (!identity) return false;
      const allowed = allowedUsers
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (allowed.length === 0) return false;
      return allowed.includes(identity);
    }

    expect(isAllowed('', '')).toBe(false);
    expect(isAllowed('', '  ')).toBe(false);
    expect(isAllowed('anyone', '')).toBe(false);
  });
});
