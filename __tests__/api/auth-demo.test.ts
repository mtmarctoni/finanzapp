/** @jest-environment node */
import { GET } from '@/app/api/auth/demo/route';
import { getPublicDemo } from '@/lib/auth-credentials';

const account = {
  id: 'f7a8b9c0-1e2f-3d45-6a7b-1234567890cd',
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User',
};
const preview = {
  NODE_ENV: 'production' as const,
  VERCEL_ENV: 'preview',
  DEV_CREDENTIALS: JSON.stringify([account]),
  ALLOWED_USERS: ' Test User , other',
};

describe('public demo eligibility', () => {
  it('offers only the designated public values in eligible Preview', () => {
    expect(getPublicDemo(preview)).toEqual({
      email: account.email,
      password: account.password,
    });
  });

  it.each([
    { VERCEL_ENV: 'production' },
    { VERCEL_ENV: 'development', NODE_ENV: 'development' },
    { VERCEL_ENV: undefined, NODE_ENV: 'development' },
    { DEV_CREDENTIALS: undefined },
    { DEV_CREDENTIALS: '[]' },
    { DEV_CREDENTIALS: '{}' },
    { ALLOWED_USERS: undefined },
    { ALLOWED_USERS: '' },
    { ALLOWED_USERS: 'test user' },
  ])('hides ineligible configuration %j', (overrides) => {
    expect(getPublicDemo({ ...preview, ...overrides })).toBeNull();
  });

  it.each(['id', 'email', 'password', 'name'])(
    'rejects mismatched %s',
    (field) => {
      expect(
        getPublicDemo({
          ...preview,
          DEV_CREDENTIALS: JSON.stringify([
            { ...account, [field]: 'different' },
          ]),
        }),
      ).toBeNull();
    },
  );

  it('checks the actual configured name with exact allowlist case', () => {
    expect(
      getPublicDemo({
        ...preview,
        DEV_CREDENTIALS: JSON.stringify([{ ...account, name: 'Public Demo' }]),
        ALLOWED_USERS: 'Public Demo',
      }),
    ).not.toBeNull();
  });

  it('does not advertise a shadowed account rejected by authorization', () => {
    expect(
      getPublicDemo({
        ...preview,
        DEV_CREDENTIALS: JSON.stringify([{ ...account, id: 'wrong' }, account]),
      }),
    ).toBeNull();
  });

  it('fails closed on malformed JSON without logging its contents', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      getPublicDemo({ ...preview, DEV_CREDENTIALS: 'private-secret' }),
    ).toBeNull();
    expect(log).toHaveBeenCalledWith('[Auth] Failed to parse DEV_CREDENTIALS');
    log.mockRestore();
  });

  it('serializes no collection, private account, id, name, or allowlist and disables caching', async () => {
    const original = process.env;
    process.env = {
      ...original,
      ...preview,
      DEV_CREDENTIALS: JSON.stringify([
        account,
        {
          id: 'private-id',
          email: 'private@example.com',
          password: 'private-password',
          name: 'Private User',
        },
      ]),
    };
    try {
      const response = GET();
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(await response.json()).toEqual({
        demo: { email: account.email, password: account.password },
      });
      process.env.VERCEL_ENV = 'production';
      expect(await GET().json()).toEqual({ demo: null });
    } finally {
      process.env = original;
    }
  });
});
