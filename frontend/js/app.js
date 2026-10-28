import { getProducts } from "./api.js";
import { createProduct } from "./api.js";

const genericErrorMessage = "No se pudieron cargar los productos. Inténtalo nuevamente.";
const genericCreateErrorMessage = "No se pudo registrar el producto. Inténtalo nuevamente.";

function setVisible(element, visible) {
  element.hidden = !visible;
}

function renderProducts(products, tableBody) {
  tableBody.replaceChildren();

  for (const product of products) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const categoryCell = document.createElement("td");
    const priceCell = document.createElement("td");
    const stockCell = document.createElement("td");

    nameCell.textContent = product.name;
    categoryCell.textContent = product.category;
    priceCell.textContent = product.price;
    stockCell.textContent = String(product.stock);

    row.append(nameCell, categoryCell, priceCell, stockCell);
    tableBody.appendChild(row);
  }
}

async function loadInventory() {
  const loadingState = document.getElementById("loading-state");
  const emptyState = document.getElementById("empty-state");
  const errorState = document.getElementById("error-state");
  const table = document.getElementById("inventory-table");
  const tableBody = document.getElementById("products-list");

  setVisible(loadingState, true);
  setVisible(emptyState, false);
  setVisible(errorState, false);
  setVisible(table, false);
  errorState.textContent = "";
  tableBody.replaceChildren();

  try {
    const products = await getProducts();
    setVisible(loadingState, false);

    if (products.length === 0) {
      setVisible(emptyState, true);
      return true;
    }

    renderProducts(products, tableBody);
    setVisible(table, true);
    return true;
  } catch (error) {
    setVisible(loadingState, false);
    errorState.textContent = error instanceof Error && error.message
      ? error.message
      : genericErrorMessage;
    setVisible(errorState, true);
    return false;
  }
}

function setFormError(message) {
  const formError = document.getElementById("form-error");
  formError.textContent = message;
  setVisible(formError, Boolean(message));
}

function resetForm(form) {
  form.reset();
  setFormError("");
}

function initializeInventoryPage() {
  const createPanel = document.getElementById("create-product-panel");
  const createForm = document.getElementById("create-product-form");
  const openButton = document.getElementById("open-create-product");
  const cancelButton = document.getElementById("cancel-create-product");
  const submitButton = document.getElementById("submit-create-product");
  const successState = document.getElementById("success-state");

  openButton.addEventListener("click", () => {
    setVisible(createPanel, true);
    setVisible(successState, false);
    document.getElementById("product-name").focus();
  });

  cancelButton.addEventListener("click", () => {
    resetForm(createForm);
    setVisible(createPanel, false);
    openButton.focus();
  });

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormError("");
    setVisible(successState, false);

    const name = createForm.elements.name.value.trim();
    const category = createForm.elements.category.value.trim();
    if (!name || !category) {
      setFormError("El nombre y la categoría son obligatorios.");
      return;
    }

    const product = {
      name,
      category,
      price: createForm.elements.price.value,
      stock: Number(createForm.elements.stock.value),
      description: createForm.elements.description.value,
    };

    submitButton.disabled = true;
    const originalSubmitLabel = submitButton.textContent;
    submitButton.textContent = "Guardando…";

    try {
      const createdProduct = await createProduct(product);
      resetForm(createForm);
      setVisible(createPanel, false);

      const refreshed = await loadInventory();
      successState.textContent = refreshed
        ? `Se registró el producto ${createdProduct.name}.`
        : `Se registró el producto ${createdProduct.name}, pero no se pudo actualizar el listado.`;
      setVisible(successState, true);
      openButton.focus();
    } catch (error) {
      setFormError(error instanceof Error && error.message
        ? error.message
        : genericCreateErrorMessage);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalSubmitLabel;
    }
  });

  loadInventory();
}

document.addEventListener("DOMContentLoaded", initializeInventoryPage);
