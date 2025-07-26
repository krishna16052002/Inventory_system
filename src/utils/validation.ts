import { Types } from 'mongoose';

/**
 * Validates if a string is a valid MongoDB ObjectId
 * 
 * @param id - The string to validate
 * @returns True if valid ObjectId, false otherwise
 */
export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

/**
 * Converts a string to MongoDB ObjectId
 * 
 * @param id - The string to convert
 * @returns ObjectId instance
 * @throws Error if invalid ObjectId
 */
export function toObjectId(id: string): Types.ObjectId {
  if (!isValidObjectId(id)) {
    throw new Error(`Invalid ObjectId: ${id}`);
  }
  return new Types.ObjectId(id);
}

/**
 * Validates if a value is a positive number
 * 
 * @param value - The value to validate
 * @returns True if positive number, false otherwise
 */
export function isPositiveNumber(value: any): boolean {
  return typeof value === 'number' && value > 0;
}

/**
 * Validates if a value is a non-negative number
 * 
 * @param value - The value to validate
 * @returns True if non-negative number, false otherwise
 */
export function isNonNegativeNumber(value: any): boolean {
  return typeof value === 'number' && value >= 0;
}

/**
 * Validates if a string is not empty
 * 
 * @param value - The string to validate
 * @returns True if non-empty string, false otherwise
 */
export function isNonEmptyString(value: any): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Safely converts a value to number
 * 
 * @param value - The value to convert
 * @param defaultValue - Default value if conversion fails
 * @returns Number value or default
 */
export function toNumber(value: any, defaultValue: number = 0): number {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
} 