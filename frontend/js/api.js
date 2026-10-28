const genericErrorMessage = "No se pudieron cargar los productos. Inténtalo nuevamente.";
const summaryErrorMessage = "No se pudo cargar el resumen del inventario. Inténtalo nuevamente.";
const createErrorMessage = "No se pudo registrar el producto. Inténtalo nuevamente.";
const updateErrorMessage = "No se pudo actualizar el producto. Inténtalo nuevamente.";
const deleteErrorMessage = "No se pudo eliminar el producto. Inténtalo nuevamente.";
const notFoundErrorMessage = "El producto ya no existe o no fue encontrado.";

async function requestJson(
  url,
  options,
  fallbackMessage,
  notFoundMessage = fallbackMessage,
  expectedSuccessStatus,
) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error("No se pudo conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.");
  }

  let body;
  if (response.status === 204) {
    body = null;
  } else {
    try {
      body = await response.json();
    } catch {
      throw new Error(fallbackMessage);
    }
  }

  if (!response.ok) {
    const apiError = body && body.error;
    if (response.status === 404) {
      throw new Error(notFoundMessage);
    }
    if (apiError && apiError.code === "VALIDATION_ERROR" &&
        typeof apiError.message === "string" && apiError.message.trim()) {
      throw new Error(apiError.message);
    }
    throw new Error(fallbackMessage);
  }

  if (expectedSuccessStatus !== undefined && response.status !== expectedSuccessStatus) {
    throw new Error(fallbackMessage);
  }

  return body;
}

export async function getProducts(filters = {}) {
  const parameters = [];
  for (const field of ["search", "category"]) {
    const value = typeof filters[field] === "string" ? filters[field].trim() : "";
    if (value) {
      parameters.push(`${field}=${encodeURIComponent(value)}`);
    }
  }
  const url = `/api/products${parameters.length ? `?${parameters.join("&")}` : ""}`;
  const body = await requestJson(
    url,
    { method: "GET", headers: { Accept: "application/json" } },
    genericErrorMessage,
  );
  if (!Array.isArray(body)) {
    throw new Error(genericErrorMessage);
  }

  return body;
}

export async function getSummary() {
  const body = await requestJson(
    "/api/summary",
    { method: "GET", headers: { Accept: "application/json" } },
    summaryErrorMessage,
  );

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(summaryErrorMessage);
  }

  return body;
}

export async function createProduct(product) {
  const body = await requestJson(
    "/api/products",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(product),
    },
    createErrorMessage,
  );

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(createErrorMessage);
  }

  return body;
}

export async function updateProduct(id, product) {
  const body = await requestJson(
    `/api/products/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(product),
    },
    updateErrorMessage,
    notFoundErrorMessage,
  );

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(updateErrorMessage);
  }

  return body;
}

export async function adjustProductStock(id, adjustment) {
  const body = await requestJson(
    `/api/products/${encodeURIComponent(id)}/stock`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(adjustment),
    },
    "No se pudo ajustar el stock. Inténtalo nuevamente.",
    "El producto ya no existe o no fue encontrado.",
  );

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("No se pudo ajustar el stock. Inténtalo nuevamente.");
  }

  return body;
}

export async function deleteProduct(id) {
  await requestJson(
    `/api/products/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    },
    deleteErrorMessage,
    notFoundErrorMessage,
    204,
  );
}
