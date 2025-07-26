import { ClientSession, Types } from 'mongoose';
import { Part, IPart } from '../models/Part';
import { MESSAGES } from '../constants/messages';
import { InventoryOperation } from '../types/PartTypes';

/**
 * Result interface for inventory operations
 */
export interface InventoryResult {
  partId: string;
  status: string;
  message?: string;
}

/**
 * Service class responsible for all inventory-related operations
 * Encapsulates business logic for inventory management
 */
export class InventoryService {
  /**
   * Deducts quantities from parts inventory (both raw and assembled)
   * Handles recursive deduction for assembled parts
   * 
   * @param partsToDeduct - Array of parts to deduct from inventory
   * @param session - MongoDB session for transaction management
   * @returns Promise with insufficient parts and operation results
   */
  async deductParts(
    partsToDeduct: InventoryOperation[],
    session: ClientSession
  ): Promise<{ allInsufficient: string[]; results: InventoryResult[] }> {
    let allInsufficient: string[] = [];
    let results: InventoryResult[] = [];

    for (const { partId, quantity } of partsToDeduct) {
      try {
        // Validate quantity
        if (!quantity || quantity <= 0) {
          results.push({ 
            partId, 
            status: MESSAGES.STATUS_FAILED, 
            message: MESSAGES.QUANTITY_POSITIVE 
          });
          continue;
        }

        // Find part
        const part: IPart | null = await Part.findById(partId).session(session);
        if (!part) {
          results.push({ 
            partId, 
            status: MESSAGES.STATUS_FAILED, 
            message: MESSAGES.PART_NOT_FOUND 
          });
          continue;
        }

        // Handle raw parts
        if (part.type === 'RAW') {
          await this.deductRawPart(part, quantity, session);
          results.push({ partId, status: MESSAGES.STATUS_SUCCESS });
          continue;
        }

        // Handle assembled parts
        const insufficient = await this.checkAndDeductRaw(part, quantity, session);
        if (insufficient.length > 0) {
          allInsufficient = allInsufficient.concat(insufficient);
          results.push({ 
            partId, 
            status: MESSAGES.STATUS_FAILED, 
            message: MESSAGES.INSUFFICIENT_QUANTITY(insufficient) 
          });
          continue;
        }

        // Deduct from the main assembled part
        part.quantity -= quantity;
        await part.save({ session });
        results.push({ partId, status: MESSAGES.STATUS_SUCCESS });

      } catch (error) {
        // Handle unexpected errors
        results.push({ 
          partId, 
          status: MESSAGES.STATUS_FAILED, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return { allInsufficient, results };
  }

  /**
   * Deducts quantity from a raw part
   * 
   * @param part - The raw part to deduct from
   * @param quantity - Quantity to deduct
   * @param session - MongoDB session
   */
  private async deductRawPart(part: IPart, quantity: number, session: ClientSession): Promise<void> {
    if (part.quantity < quantity) {
      throw new Error(`Insufficient quantity for part ${part.name}`);
    }
    part.quantity -= quantity;
    await part.save({ session });
  }

  /**
   * Recursively checks and deducts quantities for assembled parts
   * Traverses the assembly tree and deducts only from raw parts
   * 
   * @param part - The assembled part to process
   * @param qty - Quantity needed
   * @param session - MongoDB session
   * @param visited - Set of visited part IDs to prevent circular references
   * @returns Array of insufficient part IDs
   */
  private async checkAndDeductRaw(
    part: IPart,
    qty: number,
    session: ClientSession,
    visited: Set<string> = new Set()
  ): Promise<string[]> {
    // Prevent infinite loops
    if (visited.has(part._id.toString())) {
      return [part._id.toString()];
    }
    visited.add(part._id.toString());

    // Handle raw parts directly
    if (part.type === 'RAW') {
      if (part.quantity < qty) {
        return [part._id.toString()];
      }
      part.quantity -= qty;
      await part.save({ session });
      return [];
    }

    // Process constituent parts recursively
    let insufficient: string[] = [];
    for (const constituent of part.parts || []) {
      const constituentPart: IPart | null = await Part.findById(constituent.id).session(session);
      if (!constituentPart) {
        insufficient.push(constituent.id.toString());
        continue;
      }

      const needed = constituent.quantity * qty;
      const subInsufficient = await this.checkAndDeductRaw(
        constituentPart, 
        needed, 
        session, 
        visited
      );
      
      if (subInsufficient.length > 0) {
        insufficient = insufficient.concat(subInsufficient);
      }
    }

    return insufficient;
  }
} 