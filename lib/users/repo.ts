import { v4 as uuidv4 } from "uuid";
import { withClient } from "@/lib/db";

export interface UserRecord {
  id: string;
  name: string | null;
  email: string | null;
}

/**
 * Insert a new user. Returns the generated id.
 *
 * Caller responsibility: ensure the email/name pair is allowlisted (the
 * NextAuth signIn callback handles this for the OAuth flow).
 */
export async function insertUser(formData: {
  name: string;
  email: string;
}): Promise<string> {
  const id = uuidv4();
  await withClient(async (client) => {
    await client.sql`
      INSERT INTO users (id, name, email)
      VALUES (${id}, ${formData.name}, ${formData.email})
    `;
  });
  return id;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  return withClient(async (client) => {
    const result = await client.sql`
      SELECT id, name, email
        FROM users
       WHERE email = ${email}
       LIMIT 1
    `;
    return (result.rows[0] as UserRecord | undefined) ?? null;
  });
}
