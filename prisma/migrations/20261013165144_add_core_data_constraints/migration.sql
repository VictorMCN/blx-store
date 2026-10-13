ALTER TABLE "Product"
ADD CONSTRAINT "Product_priceInCents_check"
CHECK ("priceInCents" > 0);

ALTER TABLE "ProductImage"
ADD CONSTRAINT "ProductImage_position_check"
CHECK ("position" >= 0);

ALTER TABLE "Inventory"
ADD CONSTRAINT "Inventory_quantity_check"
CHECK ("quantity" >= 0),
ADD CONSTRAINT "Inventory_reservedQuantity_check"
CHECK ("reservedQuantity" >= 0),
ADD CONSTRAINT "Inventory_reorderPoint_check"
CHECK ("reorderPoint" >= 0),
ADD CONSTRAINT "Inventory_reservedQuantity_lte_quantity_check"
CHECK ("reservedQuantity" <= "quantity");
