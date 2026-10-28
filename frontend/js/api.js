const genericErrorMessage = "No se pudieron cargar los productos. Inténtalo nuevamente.";
const createErrorMessage = "No se pudo registrar el producto. Inténtalo nuevamente.";

async function requestJson(url, options, fallbackMessage) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error("No se pudo conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.");
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }

  if (!response.ok) {
    const apiError = body && body.error;
    if (apiError && apiError.code === "VALIDATION_ERROR" &&
        typeof apiError.message === "string" && apiError.message.trim()) {
      throw new Error(apiError.message);
    }
    throw new Error(fallbackMessage);
  }

  return body;
}

export async function getProducts() {
  const body = await requestJson(
    "/api/products",
    { method: "GET", headers: { Accept: "application/json" } },
    genericErrorMessage,
  );
  if (!Array.isArray(body)) {
    throw new Error(genericErrorMessage);
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
