const { mkdirSync } = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const backendDirectory = path.resolve(__dirname, "..", "..");
const defaultDatabasePath = path.join(
  backendDirectory,
  "data",
  "stock-simple.sqlite",
);

const schema = `
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
      CHECK (length(trim(name)) BETWEEN 1 AND 100),
    description TEXT
      CHECK (description IS NULL OR length(description) <= 500),
    category TEXT NOT NULL
      CHECK (length(trim(category)) BETWEEN 1 AND 50),
    price_cents INTEGER NOT NULL
      CHECK (typeof(price_cents) = 'integer' AND price_cents >= 0),
    stock INTEGER NOT NULL
      CHECK (typeof(stock) = 'integer' AND stock >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'rejected')),
    total_cents INTEGER NOT NULL CHECK (typeof(total_cents) = 'integer' AND total_cents >= 0),
    created_at TEXT NOT NULL,
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS budget_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    -- product_id y product_name son una fotografía histórica; el producto puede
    -- cambiar de nombre/precio después, pero el presupuesto conserva sus valores.
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (typeof(quantity) = 'integer' AND quantity > 0),
    unit_price_cents INTEGER NOT NULL CHECK (typeof(unit_price_cents) = 'integer' AND unit_price_cents >= 0),
    line_total_cents INTEGER NOT NULL CHECK (typeof(line_total_cents) = 'integer' AND line_total_cents >= 0)
  );

  CREATE INDEX IF NOT EXISTS idx_budgets_status_created
    ON budgets(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_budget_items_budget
    ON budget_items(budget_id);
  CREATE INDEX IF NOT EXISTS idx_budget_items_product
    ON budget_items(product_id);
`;

function openDatabase(databasePath = process.env.DATABASE_PATH || defaultDatabasePath) {
  const isInMemory = databasePath === ":memory:";
  const resolvedPath = isInMemory
    ? ":memory:"
    : path.isAbsolute(databasePath)
      ? databasePath
      : path.resolve(backendDirectory, databasePath);

  if (!isInMemory) {
    mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const database = new DatabaseSync(resolvedPath);
  try {
    database.exec("PRAGMA busy_timeout = 5000");
    database.exec("PRAGMA foreign_keys = ON");
    database.function("unicode_lower", { deterministic: true }, (value) =>
      String(value ?? "").toLocaleLowerCase("es-ES"),
    );
    database.function("normalize_text", { deterministic: true }, (value) =>
      String(value ?? "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("es-ES"),
    );
    database.exec(schema);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

if (require.main === module) {
  const database = openDatabase();
  database.close();
}

module.exports = { openDatabase };
