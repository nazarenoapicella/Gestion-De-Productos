const productColumns = `
  id,
  name,
  description,
  category,
  price_cents,
  stock,
  created_at,
  updated_at
`;

const editableColumns = ["name", "description", "category", "price_cents"];

function toProduct(row) {
  return row ? { ...row } : null;
}

function create(database, product) {
  const now = new Date().toISOString();
  const result = database
    .prepare(
      `INSERT INTO products
        (name, description, category, price_cents, stock, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      product.name,
      product.description ?? null,
      product.category,
      product.price_cents,
      product.stock,
      now,
      now,
    );

  return findById(database, Number(result.lastInsertRowid));
}

function findById(database, id) {
  const row = database
    .prepare(`SELECT ${productColumns} FROM products WHERE id = ?`)
    .get(id);

  return toProduct(row);
}

function escapeLike(value) {
  return value.replace(/[!%_]/g, "!$&");
}

function findAll(database, filters = {}) {
  const conditions = [];
  const values = [];

  if (filters.search) {
    conditions.push("unicode_lower(name) LIKE unicode_lower(?) ESCAPE '!'");
    values.push(`%${escapeLike(filters.search.toLowerCase())}%`);
  }
  if (filters.category) {
    conditions.push("unicode_lower(category) = unicode_lower(?)");
    values.push(filters.category);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return database
    .prepare(
      `SELECT ${productColumns} FROM products
       ${where}
       ORDER BY name COLLATE NOCASE ASC, id ASC`,
    )
    .all(...values)
    .map(toProduct);
}

function update(database, id, fields) {
  const updates = editableColumns.filter((column) =>
    Object.hasOwn(fields, column),
  );

  if (updates.length === 0) {
    return findById(database, id);
  }

  const assignments = [...updates, "updated_at"]
    .map((column) => `${column} = ?`)
    .join(", ");
  const values = updates.map((column) => fields[column]);
  values.push(new Date().toISOString(), id);

  const result = database
    .prepare(`UPDATE products SET ${assignments} WHERE id = ?`)
    .run(...values);

  if (result.changes === 0) {
    return null;
  }

  return findById(database, id);
}

function adjustStock(database, id, operation, quantity) {
  const statement =
    operation === "increase"
      ? database.prepare(
          `UPDATE products
           SET stock = stock + ?, updated_at = ?
           WHERE id = ? AND stock <= ?
           RETURNING ${productColumns}`,
        )
      : database.prepare(
          `UPDATE products
           SET stock = stock - ?, updated_at = ?
           WHERE id = ? AND stock >= ?
           RETURNING ${productColumns}`,
        );
  const values =
    operation === "increase"
      ? [
          quantity,
          new Date().toISOString(),
          id,
          Number.MAX_SAFE_INTEGER - quantity,
        ]
      : [quantity, new Date().toISOString(), id, quantity];
  const product = statement.get(...values);

  if (product) {
    return { status: "updated", product: toProduct(product) };
  }

  const exists = database
    .prepare("SELECT 1 AS found FROM products WHERE id = ?")
    .get(id);

  if (!exists) {
    return { status: "not_found" };
  }
  return operation === "increase"
    ? { status: "out_of_range" }
    : { status: "insufficient_stock" };
}

function deleteById(database, id) {
  const result = database
    .prepare("DELETE FROM products WHERE id = ?")
    .run(id);

  return result.changes > 0;
}

module.exports = {
  create,
  findById,
  findAll,
  update,
  adjustStock,
  deleteById,
};
