class StockAdjustmentError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "StockAdjustmentError";
    this.code = code;
  }
}

function adjustStock(repository, id, input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    !["increase", "decrease"].includes(input.operation)
  ) {
    throw new StockAdjustmentError(
      "La operación de ajuste de stock no es válida.",
      "VALIDATION_ERROR",
    );
  }

  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw new StockAdjustmentError(
      "La cantidad debe ser un entero positivo.",
      "VALIDATION_ERROR",
    );
  }

  const result = repository.adjustStock(id, input.operation, input.quantity);

  if (result.status === "updated") {
    return result.product;
  }
  if (result.status === "not_found") {
    return { status: "not_found" };
  }
  if (result.status === "insufficient_stock") {
    throw new StockAdjustmentError(
      "La cantidad a disminuir supera el stock disponible.",
      "INSUFFICIENT_STOCK",
    );
  }
  if (result.status === "out_of_range") {
    throw new StockAdjustmentError(
      "El stock resultante excede el rango entero seguro admitido.",
      "VALIDATION_ERROR",
    );
  }

  throw new Error("El repositorio devolvió un resultado de ajuste inválido.");
}

module.exports = { adjustStock, StockAdjustmentError };
