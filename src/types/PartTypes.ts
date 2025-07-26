export interface CreatePartInput {
  name: string;
  type: string;
  parts?: { id: string; quantity: number }[];
}

export interface UpdatePartInput {
  name?: string;
  type?: string;
  parts?: { id: string; quantity: number }[];
  quantity?: number;
}

export interface InventoryOperation {
  partId: string;
  quantity: number;
}

export interface BatchInventoryInput {
  parts: InventoryOperation[];
} 