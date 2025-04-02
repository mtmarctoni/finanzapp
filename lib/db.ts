import { db } from '@vercel/postgres';

export async function handler() {
    const client = await db.connect();

}