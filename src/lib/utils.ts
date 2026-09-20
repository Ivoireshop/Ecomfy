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

export interface OrderScheduleInfo {
  date: string | null;
  note: string | null;
}

/**
 * Extracts scheduled delivery date and internal delivery note cleanly,
 * falling back to parsing embedded notes tags (e.g. [LIVRAISON PRÉVUE: YYYY-MM-DD]).
 */
export function getOrderScheduleInfo(order: {
  scheduled_delivery_date?: string | null;
  internal_delivery_note?: string | null;
  notes?: string | null;
}): OrderScheduleInfo {
  let date = order.scheduled_delivery_date ? String(order.scheduled_delivery_date).trim() : null;
  let note = order.internal_delivery_note ? String(order.internal_delivery_note).trim() : null;

  if (order.notes) {
    if (!date) {
      const dateMatch = order.notes.match(/\[LIVRAISON PRÉVUE:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\]/i);
      if (dateMatch) {
        date = dateMatch[1];
      }
    }
    if (!note) {
      const notePart = order.notes
        .replace(/\[LIVRAISON PRÉVUE:\s*[0-9]{4}-[0-9]{2}-[0-9]{2}\]\s*/i, "")
        .trim();
      if (notePart) {
        note = notePart;
      }
    }
  }

  return {
    date: date || null,
    note: note || null,
  };
}

