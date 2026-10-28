import { getProducts } from "./api.js";

const genericErrorMessage = "No se pudieron cargar los productos. Inténtalo nuevamente.";

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
      return;
    }

    renderProducts(products, tableBody);
    setVisible(table, true);
  } catch (error) {
    setVisible(loadingState, false);
    errorState.textContent = error instanceof Error && error.message
      ? error.message
      : genericErrorMessage;
    setVisible(errorState, true);
  }
}

document.addEventListener("DOMContentLoaded", loadInventory);
