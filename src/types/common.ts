/** Branded-ish primitive aliases for clarity across the domain. */
export type UUID = string;
export type ISODate = string; // 'YYYY-MM-DD'
export type ISOTime = string; // 'HH:mm'
export type ISODateTime = string; // full ISO 8601

/** A value that is only computable when the required inputs are present. */
export type Computable<T> = T | null;
