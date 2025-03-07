import { createClient } from "@vercel/postgres"

// Create a database client using environment variables
export function getDbClient() {
  // Check if we're using Vercel Postgres environment variables
  if (process.env.POSTGRES_URL) {
    return createClient({
      connectionString: process.env.POSTGRES_URL,
    })
  }

  // Fallback to DATABASE_URL if available
  if (process.env.DATABASE_URL) {
    return createClient({
      connectionString: process.env.DATABASE_URL,
    })
  }

  // If individual parameters are provided, use them
  if (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE) {
    return createClient({
      host: process.env.PGHOST,
      port: Number.parseInt(process.env.PGPORT || "5432"),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      ssl: { rejectUnauthorized: false },
    })
  }

  // Default case - use createClient() which will look for environment variables automatically
  return createClient()
}

