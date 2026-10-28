function getSummary(database) {
  const row = database
    .prepare(
      `SELECT
         COUNT(*) AS productsCount,
         COALESCE(SUM(stock), 0) AS unitsInStock,
         COALESCE(SUM(CASE WHEN stock <= 5 THEN 1 ELSE 0 END), 0) AS lowStockCount
       FROM products`,
    )
    .get();

  return {
    productsCount: row.productsCount,
    unitsInStock: row.unitsInStock,
    lowStockCount: row.lowStockCount,
  };
}

module.exports = { getSummary };
