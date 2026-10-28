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
  )
`;

function openDatabase(databasePath = process.env.DATABASE_PATH || defaultDatabasePath) {
  const resolvedPath = path.isAbsolute(databasePath)
    ? databasePath
    : path.resolve(backendDirectory, databasePath);

  mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const database = new DatabaseSync(resolvedPath);
  try {
    database.exec("PRAGMA busy_timeout = 5000");
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
