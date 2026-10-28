import { getProducts, createProduct, updateProduct, deleteProduct } from "./api.js";

const genericErrorMessage = "No se pudieron cargar los productos. Inténtalo nuevamente.";
const genericCreateErrorMessage = "No se pudo registrar el producto. Inténtalo nuevamente.";
const genericUpdateErrorMessage = "No se pudo actualizar el producto. Inténtalo nuevamente.";
const genericDeleteErrorMessage = "No se pudo eliminar el producto. Inténtalo nuevamente.";

function setVisible(element, visible) {
  element.hidden = !visible;
}

function renderProducts(products, tableBody, onEdit, onDelete) {
  tableBody.replaceChildren();

  for (const product of products) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const categoryCell = document.createElement("td");
    const priceCell = document.createElement("td");
    const stockCell = document.createElement("td");
    const actionsCell = document.createElement("td");
    const editButton = document.createElement("button");
    const deleteButton = document.createElement("button");

    nameCell.textContent = product.name;
    categoryCell.textContent = product.category;
    priceCell.textContent = product.price;
    stockCell.textContent = String(product.stock);

    editButton.type = "button";
    editButton.className = "button button--secondary button--table";
    editButton.textContent = "Editar";
    editButton.setAttribute("aria-label", `Editar ${product.name}`);
    editButton.addEventListener("click", () => onEdit(product, editButton));
    actionsCell.appendChild(editButton);

    deleteButton.type = "button";
    deleteButton.className = "button button--danger button--table";
    deleteButton.textContent = "Eliminar";
    deleteButton.setAttribute("aria-label", `Eliminar ${product.name}`);
    deleteButton.addEventListener("click", () => onDelete(product, deleteButton));
    actionsCell.appendChild(deleteButton);

    row.append(nameCell, categoryCell, priceCell, stockCell, actionsCell);
    tableBody.appendChild(row);
  }
}

async function loadInventory(onEdit, onDelete) {
  const loadingState = document.getElementById("loading-state");
  const emptyState = document.getElementById("empty-state");
  const errorState = document.getElementById("error-state");
  const deleteErrorState = document.getElementById("delete-error-state");
  const table = document.getElementById("inventory-table");
  const tableBody = document.getElementById("products-list");

  setVisible(loadingState, true);
  setVisible(emptyState, false);
  setVisible(errorState, false);
  setVisible(deleteErrorState, false);
  setVisible(table, false);
  errorState.textContent = "";
  deleteErrorState.textContent = "";
  tableBody.replaceChildren();

  try {
    const products = await getProducts();
    setVisible(loadingState, false);

    if (products.length === 0) {
      setVisible(emptyState, true);
      return true;
    }

    renderProducts(products, tableBody, onEdit, onDelete);
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

function setEditFormError(message) {
  const formError = document.getElementById("edit-form-error");
  formError.textContent = message;
  setVisible(formError, Boolean(message));
}

function resetForm(form, clearError = setFormError) {
  form.reset();
  clearError("");
}

function initializeInventoryPage() {
  const createPanel = document.getElementById("create-product-panel");
  const createForm = document.getElementById("create-product-form");
  const openButton = document.getElementById("open-create-product");
  const cancelButton = document.getElementById("cancel-create-product");
  const submitButton = document.getElementById("submit-create-product");
  const successState = document.getElementById("success-state");
  const editPanel = document.getElementById("edit-product-panel");
  const editForm = document.getElementById("edit-product-form");
  const cancelEditButton = document.getElementById("cancel-edit-product");
  const submitEditButton = document.getElementById("submit-edit-product");
  let editTrigger = null;
  let editingProductId = null;

  async function removeProduct(product, button) {
    const confirmed = window.confirm(
      `¿Deseas eliminar el producto "${product.name}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) {
      return;
    }

    const deleteErrorState = document.getElementById("delete-error-state");
    setVisible(deleteErrorState, false);
    setVisible(successState, false);
    button.disabled = true;
    const originalButtonLabel = button.textContent;
    button.textContent = "Eliminando…";

    try {
      await deleteProduct(product.id);
      const refreshed = await loadInventory(showEditForm, removeProduct);
      successState.textContent = refreshed
        ? `Se eliminó el producto ${product.name}.`
        : `Se eliminó el producto ${product.name}, pero no se pudo actualizar el listado.`;
      setVisible(successState, true);
      openButton.focus();
    } catch (error) {
      deleteErrorState.textContent = error instanceof Error && error.message
        ? error.message
        : genericDeleteErrorMessage;
      setVisible(deleteErrorState, true);
    } finally {
      button.disabled = false;
      button.textContent = originalButtonLabel;
    }
  }

  function showEditForm(product, trigger) {
    editTrigger = trigger;
    editingProductId = product.id;
    setVisible(createPanel, false);
    setVisible(editPanel, true);
    setVisible(successState, false);
    setEditFormError("");
    editForm.elements.name.value = product.name;
    editForm.elements.description.value = product.description || "";
    editForm.elements.category.value = product.category;
    editForm.elements.price.value = product.price;
    editForm.elements.name.focus();
  }

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

      const refreshed = await loadInventory(showEditForm, removeProduct);
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

  cancelEditButton.addEventListener("click", () => {
    resetForm(editForm, setEditFormError);
    setVisible(editPanel, false);
    if (editTrigger) editTrigger.focus();
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setEditFormError("");
    setVisible(successState, false);

    const product = {
      name: editForm.elements.name.value.trim(),
      description: editForm.elements.description.value,
      category: editForm.elements.category.value.trim(),
      price: editForm.elements.price.value,
    };

    if (!product.name || !product.category) {
      setEditFormError("El nombre y la categoría son obligatorios.");
      return;
    }

    submitEditButton.disabled = true;
    const originalSubmitLabel = submitEditButton.textContent;
    submitEditButton.textContent = "Guardando…";

    try {
      const updatedProduct = await updateProduct(editingProductId, product);
      resetForm(editForm, setEditFormError);
      setVisible(editPanel, false);

      const refreshed = await loadInventory(showEditForm, removeProduct);
      successState.textContent = refreshed
        ? `Se actualizó el producto ${updatedProduct.name}.`
        : `Se actualizó el producto ${updatedProduct.name}, pero no se pudo actualizar el listado.`;
      setVisible(successState, true);
      openButton.focus();
    } catch (error) {
      setEditFormError(error instanceof Error && error.message
        ? error.message
        : genericUpdateErrorMessage);
    } finally {
      submitEditButton.disabled = false;
      submitEditButton.textContent = originalSubmitLabel;
    }
  });

  loadInventory(showEditForm, removeProduct);
}

document.addEventListener("DOMContentLoaded", initializeInventoryPage);
