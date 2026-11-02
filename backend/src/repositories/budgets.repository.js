const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

function repositoryError(message, code, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function getBudget(database, id) {
  const budget = database.prepare(
    `SELECT id, status, total_cents, created_at, resolved_at
     FROM budgets WHERE id = ?`,
  ).get(id);
  if (!budget) return null;

  const items = database.prepare(
    `SELECT id, product_id, product_name, quantity, unit_price_cents, line_total_cents
     FROM budget_items WHERE budget_id = ? ORDER BY id ASC`,
  ).all(id);

  return { ...budget, items };
}

function createBudget(database, items) {
  database.exec("BEGIN IMMEDIATE");
  let transactionOpen = true;
  try {
    const now = new Date().toISOString();
    const budgetResult = database.prepare(
      `INSERT INTO budgets (status, total_cents, created_at, resolved_at)
       VALUES ('pending', 0, ?, NULL)`,
    ).run(now);
    const budgetId = Number(budgetResult.lastInsertRowid);
    const findProduct = database.prepare(
      "SELECT id, name, price_cents, stock FROM products WHERE id = ?",
    );
    const reserveProduct = database.prepare(
      `UPDATE products SET stock = stock - ?, updated_at = ?
       WHERE id = ? AND stock >= ?`,
    );
    const insertItem = database.prepare(
      `INSERT INTO budget_items
       (budget_id, product_id, product_name, quantity, unit_price_cents, line_total_cents)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    let totalCents = 0n;
    for (const item of items) {
      const product = findProduct.get(item.productId);
      if (!product) {
        throw repositoryError(
          `El producto con identificador ${item.productId} ya no existe. Actualizá el inventario e intentá nuevamente.`,
          "PRODUCT_NOT_FOUND",
          404,
        );
      }
      if (product.stock < item.quantity) {
        throw repositoryError(
          `Stock insuficiente para ${product.name}. Disponible: ${product.stock}; solicitado: ${item.quantity}.`,
          "INSUFFICIENT_STOCK",
          409,
        );
      }

      const lineTotal = BigInt(product.price_cents) * BigInt(item.quantity);
      totalCents += lineTotal;
      if (lineTotal > BigInt(MAX_SAFE_INTEGER) || totalCents > BigInt(MAX_SAFE_INTEGER)) {
        throw repositoryError(
          "El importe del presupuesto supera el máximo admitido. Reducí las cantidades o revisá los precios.",
          "AMOUNT_OUT_OF_RANGE",
          400,
        );
      }

      const reservation = reserveProduct.run(item.quantity, now, item.productId, item.quantity);
      if (reservation.changes !== 1) {
        throw repositoryError(
          `No se pudo reservar el stock de ${product.name}. Actualizá el inventario e intentá nuevamente.`,
          "INSUFFICIENT_STOCK",
          409,
        );
      }
      insertItem.run(
        budgetId,
        product.id,
        product.name,
        item.quantity,
        product.price_cents,
        Number(lineTotal),
      );
    }

    database.prepare("UPDATE budgets SET total_cents = ? WHERE id = ?")
      .run(Number(totalCents), budgetId);
    database.exec("COMMIT");
    transactionOpen = false;
    return getBudget(database, budgetId);
  } catch (error) {
    if (transactionOpen) database.exec("ROLLBACK");
    throw error;
  }
}

function listBudgets(database) {
  const ids = database.prepare("SELECT id FROM budgets ORDER BY id DESC").all();
  return ids.map(({ id }) => getBudget(database, id));
}

function resolveBudget(database, id, status) {
  database.exec("BEGIN IMMEDIATE");
  let transactionOpen = true;
  try {
    const budget = database.prepare(
      "SELECT id, status FROM budgets WHERE id = ?",
    ).get(id);
    if (!budget) {
      throw repositoryError("No se encontró el presupuesto solicitado.", "BUDGET_NOT_FOUND", 404);
    }
    if (budget.status !== "pending") {
      throw repositoryError(
        "Este presupuesto ya fue resuelto y no puede modificarse nuevamente.",
        "BUDGET_ALREADY_RESOLVED",
        409,
      );
    }

    if (status === "rejected") {
      const items = database.prepare(
        `SELECT product_id, product_name, quantity
         FROM budget_items WHERE budget_id = ? ORDER BY id ASC`,
      ).all(id);
      const restoreStock = database.prepare(
        `UPDATE products SET stock = stock + ?, updated_at = ?
         WHERE id = ? AND stock <= ?`,
      );
      const now = new Date().toISOString();
      for (const item of items) {
        const restored = restoreStock.run(
          item.quantity,
          now,
          item.product_id,
          MAX_SAFE_INTEGER - item.quantity,
        );
        if (restored.changes !== 1) {
          throw repositoryError(
            `No se pudo devolver el stock reservado de ${item.product_name}. La operación fue cancelada sin modificar el presupuesto.`,
            "STOCK_RESTORE_FAILED",
            409,
          );
        }
      }
    }

    database.prepare(
      `UPDATE budgets SET status = ?, resolved_at = ?
       WHERE id = ? AND status = 'pending'`,
    ).run(status, new Date().toISOString(), id);
    database.exec("COMMIT");
    transactionOpen = false;
    return getBudget(database, id);
  } catch (error) {
    if (transactionOpen) database.exec("ROLLBACK");
    throw error;
  }
}

module.exports = { createBudget, getBudget, listBudgets, resolveBudget };
