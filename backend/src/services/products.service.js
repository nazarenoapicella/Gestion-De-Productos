const editableFields = ["name", "description", "category", "price"];
const creationFields = [...editableFields, "stock"];

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.code = "VALIDATION_ERROR";
  }
}

function normalizeComparableText(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-ES");
}

function validateProductId(value) {
  const text = String(value ?? "");
  if (!/^[1-9]\d*$/.test(text)) {
    throw new ValidationError("El identificador del producto debe ser un entero positivo.");
  }

  const id = Number(text);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ValidationError("El identificador del producto está fuera del rango admitido.");
  }
  return id;
}

function assertProductInput(input, fields) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Los datos del producto no son válidos.");
  }

  const unexpectedField = Object.keys(input).find((field) => !fields.includes(field));
  if (unexpectedField) {
    throw new ValidationError(`El campo ${unexpectedField} no está permitido en esta operación.`);
  }

  for (const field of fields) {
    if (!Object.hasOwn(input, field)) {
      if (field === "description") continue;
      throw new ValidationError(`El campo ${field} es obligatorio.`);
    }
  }
}

function validateText(input, field, { required, maxLength }) {
  const value = input[field];
  if (value === undefined || value === null) {
    if (!required && value == null) return null;
    throw new ValidationError(`El campo ${field} debe ser texto.`);
  }
  if (typeof value !== "string") {
    throw new ValidationError(`El campo ${field} debe ser texto.`);
  }

  const normalized = value.trim();
  if (required && normalized.length === 0) {
    throw new ValidationError(`El campo ${field} es obligatorio.`);
  }
  if (normalized.length > maxLength) {
    throw new ValidationError(`El campo ${field} no puede superar ${maxLength} caracteres.`);
  }
  return field === "description" && normalized.length === 0 ? null : normalized;
}

function validateStock(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError("El stock debe ser un entero no negativo.");
  }
  return value;
}

function priceToCents(price) {
  if (typeof price !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(price)) {
    throw new ValidationError("El precio debe ser texto decimal no negativo con hasta dos cifras decimales.");
  }

  const [whole, fraction = ""] = price.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ValidationError("El precio está fuera del rango admitido.");
  }
  return Number(cents);
}

function priceFromCents(cents) {
  const value = BigInt(cents);
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

function ensureUniqueName(repository, name, currentId = null) {
  const normalizedName = normalizeComparableText(name);
  if (!normalizedName || typeof repository.findAll !== "function") return;

  const duplicate = (repository.findAll({}) || []).some((product) =>
    product.id !== currentId && normalizeComparableText(product.name) === normalizedName,
  );
  if (duplicate) {
    throw new ValidationError("Ya existe un producto con ese nombre (sin distinguir mayúsculas ni tildes).");
  }
}

function findCanonicalCategory(repository, category) {
  const normalizedCategory = normalizeComparableText(category);
  if (!normalizedCategory || typeof repository.findAll !== "function") return category;

  const existing = (repository.findAll({}) || []).find((product) =>
    normalizeComparableText(product.category) === normalizedCategory,
  );
  return existing?.category ?? category;
}

function validateProduct(input, fields) {
  assertProductInput(input, fields);
  const name = validateText(input, "name", { required: true, maxLength: 100 });
  const description = validateText(input, "description", { required: false, maxLength: 500 });
  const category = validateText(input, "category", { required: true, maxLength: 50 });
  const price_cents = priceToCents(input.price);

  const product = { name, description, category, price_cents };
  if (fields.includes("stock")) product.stock = validateStock(input.stock);
  return product;
}

function isUniqueNameConstraint(error) {
  return error?.code === "ERR_SQLITE_CONSTRAINT_UNIQUE" ||
    /idx_products_name_normalized|UNIQUE constraint failed/i.test(error?.message ?? "");
}

function createProduct(repository, input) {
  const product = validateProduct(input, creationFields);
  ensureUniqueName(repository, product.name);
  product.category = findCanonicalCategory(repository, product.category);

  try {
    return repository.create(product);
  } catch (error) {
    if (isUniqueNameConstraint(error)) {
      throw new ValidationError("Ya existe un producto con ese nombre (sin distinguir mayúsculas ni tildes).");
    }
    throw error;
  }
}

function updateProduct(repository, idValue, input) {
  const id = validateProductId(idValue);
  const canReadCurrent = typeof repository.findById === "function";
  const currentProduct = canReadCurrent ? repository.findById(id) : null;
  if (canReadCurrent && !currentProduct) return null;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Los datos del producto no son válidos.");
  }

  // El stock se modifica exclusivamente mediante PATCH /:id/stock.
  // Se ignora incluso si un cliente antiguo lo envía dentro del PUT.
  const editableInput = { ...input };
  delete editableInput.stock;
  const unexpectedField = Object.keys(editableInput).find((field) => !editableFields.includes(field));
  if (unexpectedField) {
    throw new ValidationError(`El campo ${unexpectedField} no está permitido en esta operación.`);
  }
  for (const field of ["name", "category", "price"]) {
    if (!Object.hasOwn(editableInput, field)) {
      throw new ValidationError(`El campo ${field} es obligatorio para editar un producto.`);
    }
  }

  const mergedInput = {
    name: editableInput.name,
    description: Object.hasOwn(editableInput, "description")
      ? editableInput.description
      : currentProduct?.description ?? null,
    category: editableInput.category,
    price: editableInput.price,
  };

  const product = validateProduct(mergedInput, editableFields);
  ensureUniqueName(repository, product.name, id);
  if (typeof repository.findAll === "function") {
    product.category = findCanonicalCategory(repository, product.category);
  }

  try {
    return repository.update(id, product);
  } catch (error) {
    if (isUniqueNameConstraint(error)) {
      throw new ValidationError("Ya existe un producto con ese nombre (sin distinguir mayúsculas ni tildes).");
    }
    throw error;
  }
}

function deleteProduct(repository, idValue) {
  return repository.deleteById(validateProductId(idValue));
}

function getProduct(repository, idValue) {
  return repository.findById(validateProductId(idValue));
}

function normalizeListFilters(filters) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    throw new ValidationError("Los filtros de productos no son válidos.");
  }

  const normalized = {};
  for (const [field, maxLength] of [["search", 100], ["category", 50]]) {
    if (!Object.hasOwn(filters, field)) continue;
    if (typeof filters[field] !== "string") {
      throw new ValidationError(`El filtro ${field} debe ser texto.`);
    }
    const value = filters[field].trim();
    if (value.length > maxLength) {
      throw new ValidationError(`El filtro ${field} no puede superar ${maxLength} caracteres.`);
    }
    if (value) normalized[field] = value;
  }
  return normalized;
}

function listProducts(repository, filters = {}) {
  return repository.findAll(normalizeListFilters(filters));
}

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  listProducts,
  validateProductId,
  ValidationError,
};
