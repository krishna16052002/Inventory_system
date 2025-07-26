import { Types } from 'mongoose';
import { Part, IPart, IConstituentPart, PartModelType, PART_TYPES, PartType } from '../models/Part';
import { CreatePartInput, UpdatePartInput } from '../types/PartTypes';
import { MESSAGES } from '../constants/messages';

/**
 * Service class responsible for all part-related operations
 * Encapsulates business logic for part management
 */
export class PartService {
  /**
   * Retrieves all parts sorted by name
   * 
   * @returns Promise with array of all parts
   */
  async getAllParts(): Promise<IPart[]> {
    return await Part.find().sort({ name: 1 });
  }

  /**
   * Retrieves a specific part by ID
   * 
   * @param partId - The ID of the part to retrieve
   * @returns Promise with the found part
   */
  async getPartById(partId: string): Promise<IPart> {
    const part = await Part.findById(partId);
    if (!part) {
      throw new Error(MESSAGES.PART_NOT_FOUND);
    }
    return part;
  }

  /**
   * Creates a new part (raw or assembled)
   * 
   * @param createData - Data for creating the part
   * @returns Promise with the created part
   */
  async createPart(createData: CreatePartInput): Promise<IPart> {
    const { name, type, parts } = createData;

    // Validate required fields
    if (!name || !type) {
      throw new Error(MESSAGES.NAME_TYPE_REQUIRED);
    }

    // Validate part type
    if (!PART_TYPES.includes(type as PartType)) {
      throw new Error(MESSAGES.INVALID_PART_TYPE);
    }

    const partType = type as PartType;
    let formattedParts: IConstituentPart[] | undefined;

    // Handle assembled parts
    if (partType === 'ASSEMBLED') {
      if (!Array.isArray(parts) || parts.length === 0) {
        throw new Error(MESSAGES.ASSEMBLED_PARTS_REQUIRED);
      }

      formattedParts = this.formatConstituentParts(parts);
      
      // Check for circular dependencies
      const hasCycle = await this.checkCircularDependency('', formattedParts);
      if (hasCycle) {
        throw new Error(MESSAGES.CIRCULAR_DEPENDENCY);
      }
    }

    // Create and save the part
    const part = new Part({
      name,
      type: partType,
      parts: partType === 'ASSEMBLED' ? formattedParts : undefined,
    });

    try {
      await part.save();
      return part;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new Error(MESSAGES.PART_NAME_UNIQUE);
      }
      throw error;
    }
  }

  /**
   * Updates an existing part
   * 
   * @param partId - The ID of the part to update
   * @param updateData - Data for updating the part
   * @returns Promise with the updated part
   */
  async updatePart(partId: string, updateData: UpdatePartInput): Promise<IPart> {
    const { name, type, parts, quantity } = updateData;

    // Find the part
    const part = await this.getPartById(partId);

    // Validate part type if provided
    if (type && !PART_TYPES.includes(type as PartType)) {
      throw new Error(MESSAGES.INVALID_PART_TYPE);
    }

    const partType = type as PartType;
    let formattedParts: IConstituentPart[] | undefined;

    // Handle assembled parts
    if (partType === 'ASSEMBLED' || (part.type === 'ASSEMBLED' && parts)) {
      if (!Array.isArray(parts) || parts.length === 0) {
        throw new Error(MESSAGES.ASSEMBLED_PARTS_REQUIRED);
      }

      formattedParts = this.formatConstituentParts(parts);
      
      // Check for circular dependencies
      const hasCycle = await this.checkCircularDependency(partId, formattedParts);
      if (hasCycle) {
        throw new Error(MESSAGES.CIRCULAR_DEPENDENCY);
      }
    }

    // Update part properties
    if (name) part.name = name;
    if (partType) part.type = partType;
    if (formattedParts) part.parts = formattedParts;
    if (partType === 'RAW') part.parts = undefined;
    if (typeof quantity === 'number') part.quantity = quantity;

    try {
      await part.save();
      return part;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new Error(MESSAGES.PART_NAME_UNIQUE);
      }
      throw error;
    }
  }

  /**
   * Deletes a part if it's not used by other assemblies
   * 
   * @param partId - The ID of the part to delete
   * @returns Promise with success message
   */
  async deletePart(partId: string): Promise<string> {
    const part = await this.getPartById(partId);

    // Check if part is used by other assemblies
    const usedBy = await Part.find({
      type: 'ASSEMBLED',
      'parts.id': partId,
    });

    if (usedBy.length > 0) {
      const usedByNames = usedBy.map((p) => p.name).join(', ');
      throw new Error(MESSAGES.PART_USED_BY(usedByNames));
    }

    await Part.findByIdAndDelete(partId);
    return MESSAGES.PART_DELETED;
  }

  /**
   * Checks for circular dependencies in assembled parts
   * 
   * @param partId - The ID of the part being created/updated
   * @param parts - Array of constituent parts
   * @returns Promise with boolean indicating if circular dependency exists
   */
  private async checkCircularDependency(partId: string, parts: IConstituentPart[]): Promise<boolean> {
    return await (Part as PartModelType).hasCircularDependency(partId, parts);
  }

  /**
   * Formats constituent parts data for database storage
   * 
   * @param parts - Array of parts with string IDs
   * @returns Array of formatted constituent parts
   */
  private formatConstituentParts(parts: { id: string; quantity: number }[]): IConstituentPart[] {
    return parts.map((p) => ({
      id: new Types.ObjectId(p.id),
      quantity: p.quantity,
    }));
  }
} 