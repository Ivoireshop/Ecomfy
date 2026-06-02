import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Returns true if the string contains any digit (0-9). */
export function containsDigits(value: string): boolean {
  return /\d/.test(value);
}

/** Removes all digits (0-9) from a string. */
export function stripDigits(value: string): string {
  return value.replace(/\d/g, "");
}
