BEGIN;

ALTER TABLE "ErpSyncJob"
  DROP CONSTRAINT "ErpSyncJob_orderId_fkey";

ALTER TABLE "ErpSyncJob"
  ADD CONSTRAINT "ErpSyncJob_orderId_fkey"
  FOREIGN KEY ("orderId")
  REFERENCES "Order"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

COMMIT;
