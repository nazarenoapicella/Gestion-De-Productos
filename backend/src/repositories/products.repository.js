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

function findAll(database) {
  return database
    .prepare(`SELECT ${productColumns} FROM products`)
    .all()
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

function deleteById(database, id) {
  const result = database
    .prepare("DELETE FROM products WHERE id = ?")
    .run(id);

  return result.changes > 0;
}

module.exports = { create, findById, findAll, update, deleteById };
