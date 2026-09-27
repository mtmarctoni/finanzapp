import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

const MIGRATION = 'db/migrations/20260926_add_receipt_ingestion.sql';
const INIT = 'db/init.sql';
const SCHEMA = 'db/schema.sql';

const SQL_FILES = [MIGRATION, INIT, SCHEMA];

describe('receipt ingestion schema', () => {
  it.each(SQL_FILES)('%s declares merchants and is safe to re-run', (file) => {
    const sql = read(file);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS merchants');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS merchants_user_normalized_name_idx',
    );
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS merchants_user_id_idx');
  });

  it.each(SQL_FILES)(
    '%s creates both receipt indexes on finance_entries',
    (file) => {
      const sql = read(file);
      expect(sql).toContain('ON finance_entries (user_id, content_hash)');
      expect(sql).toContain('ON finance_entries (user_id, origen, fecha DESC)');
    },
  );

  it.each(SQL_FILES)(
    '%s scopes the content-hash index to non-NULL hashes',
    (file) => {
      // Partial, so every manual entry (NULL hash) stays unaffected and two
      // users' identical screenshots both save.
      const sql = read(file);
      const start = sql.indexOf('finance_entries_user_content_hash_idx');
      expect(start).toBeGreaterThan(-1);
      expect(sql.slice(start, start + 200)).toContain(
        'WHERE content_hash IS NOT NULL',
      );
    },
  );

  it('declares merchants before finance_entries in schema.sql', () => {
    // schema.sql embeds the merchant_id REFERENCES clause inline, unlike
    // init.sql which adds the column after merchants exists, so an inline FK
    // pointing at a later table makes the script README tells users to run
    // fail outright.
    const sql = read(SCHEMA);
    const merchants = sql.indexOf('CREATE TABLE IF NOT EXISTS merchants');
    const financeEntries = sql.indexOf(
      'CREATE TABLE IF NOT EXISTS finance_entries',
    );

    expect(merchants).toBeGreaterThan(-1);
    expect(financeEntries).toBeGreaterThan(-1);
    expect(merchants).toBeLessThan(financeEntries);
  });

  it('keeps the migration and init.sql in agreement', () => {
    // The two are applied to different environments, so silent drift means dev
    // and CI disagree about the receipt-ingestion surface.
    const normalise = (sql: string) =>
      sql
        .replace(/--[^\n]*/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    expect(normalise(read(INIT))).toContain(normalise(read(MIGRATION)));
  });
});
