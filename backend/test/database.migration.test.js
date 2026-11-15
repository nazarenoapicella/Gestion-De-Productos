const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { test } = require("node:test");
const { openDatabase } = require("../src/db");

function createDatabasePath() {
  return path.join(__dirname, `.legacy-budget-${process.pid}-${randomUUID()}.sqlite`);
}

function removeDatabaseFiles(databasePath) {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    const filePath = `${databasePath}${suffix}`;
    if (existsSync(filePath)) unlinkSync(filePath);
  }
}

test("migra el estado histórico de presupuestos y conserva sus líneas", () => {
  const databasePath = createDatabasePath();
  let legacyDatabase;
  let database;
  try {
    legacyDatabase = new DatabaseSync(databasePath);
    legacyDatabase.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'rejected')),
        total_cents INTEGER NOT NULL CHECK (typeof(total_cents) = 'integer' AND total_cents >= 0),
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );
      CREATE TABLE budget_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price_cents INTEGER NOT NULL,
        line_total_cents INTEGER NOT NULL
      );
      INSERT INTO budgets (id, status, total_cents, created_at, resolved_at)
      VALUES (1, 'pending', 2500, '2026-11-01T10:00:00.000Z', NULL),
             (2, 'paid', 3000, '2026-11-02T10:00:00.000Z', '2026-11-02T11:00:00.000Z'),
             (3, 'rejected', 4000, '2026-11-03T10:00:00.000Z', '2026-11-03T11:00:00.000Z');
      INSERT INTO budget_items (budget_id, product_id, product_name, quantity, unit_price_cents, line_total_cents)
      VALUES (1, 7, 'Producto histórico', 1, 2500, 2500);
    `);
    legacyDatabase.close();
    legacyDatabase = null;

    database = openDatabase(databasePath);
    const budgets = database.prepare("SELECT id, status FROM budgets ORDER BY id").all()
      .map((row) => ({ id: row.id, status: row.status }));
    assert.deepEqual(budgets, [
      { id: 1, status: "issued" },
      { id: 2, status: "paid" },
      { id: 3, status: "rejected" },
    ]);
    const migratedItems = database.prepare(
      "SELECT budget_id, product_id, product_name FROM budget_items",
    ).all().map((row) => ({
      budget_id: row.budget_id,
      product_id: row.product_id,
      product_name: row.product_name,
    }));
    assert.deepEqual(migratedItems, [
      { budget_id: 1, product_id: 7, product_name: "Producto histórico" },
    ]);
    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
    assert.throws(
      () => database.prepare(
        "INSERT INTO budgets (status, total_cents, created_at) VALUES ('pending', 0, '2026-11-15T00:00:00.000Z')",
      ).run(),
      /CHECK constraint failed/,
    );
    assert.doesNotThrow(() => database.prepare(
      "INSERT INTO budgets (status, total_cents, created_at) VALUES ('issued', 0, '2026-11-15T00:00:00.000Z')",
    ).run());
  } finally {
    if (database) database.close();
    if (legacyDatabase) legacyDatabase.close();
    removeDatabaseFiles(databasePath);
  }
});
