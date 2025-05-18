import GithubProvider, { GithubProfile } from "next-auth/providers/github";
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

export const authOptions: AuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt" as SessionStrategy,
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/unauthorized",
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user: User }) {
      if (user) {
        // set token.id with the id of our databas, not the github user
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
        session.user.id = token.id;
      }
      return session;
    },
    async signIn({user, account, profile}: {user: User, account: Account | null, profile?: Profile | undefined}){
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