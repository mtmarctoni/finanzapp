import GithubProvider, { GithubProfile } from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import NextAuth, {
  DefaultSession,
  SessionStrategy,
  AuthOptions,
  User,
  Account,
  Profile,
} from "next-auth";
import { JWT } from "next-auth/jwt";
import { createUser, getUserByEmail } from "@/lib/actions";

// Extend the default session type to include id
interface Session extends DefaultSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

// Development credentials for local testing
const devCredentials = [
  { id: '1', email: 'dev@example.com', password: 'password123', name: 'Dev User' },
  { id: 'f7a8b9c0-1e2f-3d45-6a7b-1234567890cd', email: 'test@example.com', password: 'password123', name: 'test' },
];

export const authOptions: AuthOptions = {
  providers: [
    // Enable GitHub provider only in production
    ...(process.env.NODE_ENV === 'production' ? [
      GithubProvider({
        clientId: process.env.GITHUB_ID!,
        clientSecret: process.env.GITHUB_SECRET!,
        authorization: {
          params: {
            redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/github`
          }
        }
      })
    ] : []),

    // Development credentials provider
    ...(process.env.NODE_ENV !== 'production' ? [
      CredentialsProvider({
        name: 'Credentials',
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" }
        },
        async authorize(credentials) {
          if (!credentials) return null;

          // In development, check against our hardcoded users
          const user = devCredentials.find(
            u => u.email === credentials.email && u.password === credentials.password
          );

          if (user) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
            };
          }

          return null;
        }
      })
    ] : []),
  ],
  session: {
    strategy: "jwt" as SessionStrategy,
  },
  debug: process.env.NODE_ENV !== 'production',
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/unauthorized",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // For development credentials, use the user data directly
      if (account?.provider === 'credentials' && user) {
        token.id = user.id;
        return token;
      }

      // For other providers (like GitHub), check the database
      if (user) {
        const existingUser = await getUserByEmail(user.email ?? "");
        if (!existingUser) {
          throw new Error('User not found');
        }
        token.id = existingUser.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    async signIn({ user, account, profile }: { user: User, account: Account | null, profile?: Profile | undefined }) {
      // Skip GitHub checks for development credentials
      if (account?.provider === 'credentials') {
        // allow only alloedUsers
        if (!process.env.ALLOWED_USERS?.split(",").includes(user.name ?? "")) {
          console.error(`User ${user.email} is not allowed to sign in.`);
          return false;
        }
        // Allow the user to sign in
        console.log(`User ${user.email} signed in successfully.`);

        // Get or create user using our actions
        const existingUser = await getUserByEmail(user?.email ?? "")

        if (!existingUser) {
          // If user doesn't exist, create them
          await createUser({
            name: user?.name ?? "",
            email: user?.email ?? ""
          })
        };


        return true;
      }

      const githubProfile = profile as GithubProfile | undefined;
      // only me access
      const allowedUsers = process.env.ALLOWED_USERS?.split(",") ?? [];

      if (!allowedUsers.includes(githubProfile?.login ?? "")) {
        return false;
      }

      // Get or create user using our actions
      const existingUser = await getUserByEmail(githubProfile?.email ?? "")

      if (!existingUser) {
        // If user doesn't exist, create them
        await createUser({
          name: githubProfile?.name ?? "",
          email: githubProfile?.email ?? ""
        })
      }

      return true;
    }
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };