import GithubProvider from "next-auth/providers/github";
import NextAuth, { 
  DefaultSession, 
  SessionStrategy, 
  User,
  Account,
  Profile,
} from "next-auth";
import { JWT } from "next-auth/jwt";
import type { User as NextAuthUser } from "next-auth";
import { signIn } from "next-auth/react";

// Extend the default session type to include id
interface Session extends DefaultSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export const authOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt" as SessionStrategy,
  },
//   pages:{
//     signIn: "/auth/signin",
//     error: "/auth/error",
//   },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user: NextAuthUser }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.id;
      }
      return session;
    }
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };