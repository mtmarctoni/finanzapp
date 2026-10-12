import NextAuth, {
  type DefaultSession,
  type SessionStrategy,
  type AuthOptions,
  type User,
  type Account,
  type Profile,
} from 'next-auth';
import { type JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import GithubProvider, { type GithubProfile } from 'next-auth/providers/github';
type Provider = NonNullable<AuthOptions['providers']>[number];

import { createUser, getUserByEmail } from '@/lib/actions';
import {
  credentialsEnabled,
  isAllowed,
  loadDevCredentials,
  safeEqual,
} from '@/lib/auth-credentials';

// Extend the default session type to include id
interface Session extends DefaultSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

function getProviders(): Provider[] {
  const providers: Provider[] = [
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
      authorization: {
        params: {
          redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/github`,
        },
      },
    }),
  ];

  // The Credentials provider is intentionally disabled in production-mode
  // runs outside Vercel Preview. The previous implementation skipped the
  // password check entirely in production ("TODO: Add password hash check") and
  // therefore authenticated anyone whose email existed in the users
  // table. Adding a real password column is a larger change; until then
  // this provider is restricted behind an explicit env var. It is now
  // allowed when NODE_ENV !== 'production' or VERCEL_ENV === 'preview',
  // including production-mode Preview builds. Production-mode Production
  // deployments and local build/start without Preview remain disabled.
  // DEV_CREDENTIALS must still be set in all cases.
  if (credentialsEnabled()) {
    providers.push(
      CredentialsProvider({
        name: 'Credentials',
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          if (!credentials) return null;
          if (!credentials.email || !credentials.password) return null;
          const devUsers = loadDevCredentials();
          const user = devUsers.find(
            (u) =>
              safeEqual(u.email, credentials.email) &&
              safeEqual(u.password, credentials.password),
          );
          if (!user) return null;
          return { id: user.id, email: user.email, name: user.name };
        },
      }),
    );
  }

  return providers;
}

export const authOptions: AuthOptions = {
  providers: getProviders(),
  session: {
    strategy: 'jwt' as SessionStrategy,
  },
  // Avoid leaking auth internals in production logs.
  debug: process.env.NODE_ENV !== 'production',
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/unauthorized',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === 'credentials') {
        // user is always present for credentials provider
        token.id = user.id;
        return token;
      }

      // For OAuth providers, user may be undefined on token refresh
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!user) {
        return token;
      }

      const existingUser = await getUserByEmail(user.email ?? '');
      if (!existingUser) {
        throw new Error('User not found');
      }
      token.id = existingUser.id;
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      session.user.id = token.id as string;
      return session;
    },
    async signIn({
      user,
      account,
      profile,
    }: {
      user: User;
      account: Account | null;
      profile?: Profile | undefined;
    }) {
      if (account?.provider === 'credentials') {
        if (!isAllowed(user.name)) {
          console.error(`User ${user.email} is not allowed to sign in.`);
          return false;
        }
        const existingUser = await getUserByEmail(user.email ?? '');
        if (!existingUser) {
          await createUser({
            name: user.name ?? '',
            email: user.email ?? '',
          });
        }
        return true;
      }

      const githubProfile = profile as GithubProfile | undefined;
      if (!isAllowed(githubProfile?.login)) {
        return false;
      }

      const existingUser = await getUserByEmail(githubProfile?.email ?? '');
      if (!existingUser) {
        await createUser({
          name: githubProfile?.name ?? '',
          email: githubProfile?.email ?? '',
        });
      }
      return true;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
