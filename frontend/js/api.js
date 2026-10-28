const genericErrorMessage = "No se pudieron cargar los productos. Inténtalo nuevamente.";

export async function getProducts() {
  let response;
  try {
    response = await fetch("/api/products", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.");
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(genericErrorMessage);
  }

  if (!response.ok) {
    const apiError = body && body.error;
    if (apiError && apiError.code !== "INTERNAL_SERVER_ERROR" &&
        typeof apiError.message === "string" && apiError.message.trim()) {
      throw new Error(apiError.message);
    }
    throw new Error(genericErrorMessage);
  }

  if (!Array.isArray(body)) {
    throw new Error(genericErrorMessage);
  }

  return body;
}
