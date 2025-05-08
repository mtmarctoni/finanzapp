import { JWT } from "next-auth/jwt";
import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    name?: string;
    email?: string;
    image?: string;
  }
}