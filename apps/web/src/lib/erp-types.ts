export type ErpSyncStatus =
  | "PENDING"
  | "PROCESSING"
  | "RETRY"
  | "SYNCED"
  | "FAILED";

export interface ErpSyncJob {
  id: string;
  orderNumber: string;
  status: ErpSyncStatus;
  attempts: number;
  nextAttemptAt: string;
  externalReference: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
}

export interface ErpJobsResponse {
  provider: "mock";
  generatedAt: string;
  counts: Record<ErpSyncStatus, number>;
  jobs: ErpSyncJob[];
}

export interface ErpRetryResponse {
  queued: boolean;
}

export interface ErpInventoryItem {
  sku: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  syncedAt: string;
}

export interface ErpInventoryResponse {
  provider: "mock";
  generatedAt: string;
  inventory: ErpInventoryItem[];
}
