function formatPrice(priceCents) {
  const cents = BigInt(priceCents);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

function toProductDto(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    price: formatPrice(product.price_cents),
    stock: product.stock,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}

function createProductsController(productsService) {
  function createProduct(request, response, next) {
    try {
      const product = productsService.createProduct(request.body);
      response.status(201).json(toProductDto(product));
    } catch (error) {
      next(error);
    }
  }

  function listProducts(request, response, next) {
    try {
      const products = productsService.listProducts(request.query);
      response.json(products.map(toProductDto));
    } catch (error) {
      next(error);
    }
  }

  function getProduct(request, response, next) {
    try {
      const product = productsService.findProduct(request.params.id);
      if (!product) {
        response.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "No se encontró el producto solicitado.",
          },
        });
        return;
      }

      response.json(toProductDto(product));
    } catch (error) {
      next(error);
    }
  }

  function updateProduct(request, response, next) {
    try {
      const product = productsService.updateProduct(
        request.params.id,
        request.body,
      );
      if (!product) {
        response.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "No se encontró el producto solicitado.",
          },
        });
        return;
      }

      response.json(toProductDto(product));
    } catch (error) {
      next(error);
    }
  }

  function deleteProduct(request, response, next) {
    try {
      const deleted = productsService.deleteProduct(request.params.id);
      if (!deleted) {
        response.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "No se encontró el producto solicitado.",
          },
        });
        return;
      }

      response.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  function adjustStock(request, response, next) {
    try {
      const product = productsService.adjustStock(
        request.params.id,
        request.body,
      );
      if (product.status === "not_found") {
        response.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "No se encontró el producto solicitado.",
          },
        });
        return;
      }

      response.json(toProductDto(product));
    } catch (error) {
      next(error);
    }
  }

  return {
    createProduct,
    listProducts,
    getProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
  };
}

module.exports = { createProductsController };
