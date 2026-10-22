import {sha256} from "@oslojs/crypto/sha2";

export const PAIR_TTL = 10 * 60_000;
export const TV_SESSION_TTL = 30 * 24 * 60 * 60_000;
export const POLL_MS = 5_000;
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function secretHash(secret: string): string | null {
  if (!/^[a-f0-9]{64}$/.test(secret)) return null;
  return Array.from(sha256(new TextEncoder().encode(secret)), b => b.toString(16).padStart(2, "0")).join("");
}
export function normalizeTvCode(value: string) {
  const code = value.trim().toUpperCase().replace(/[\s-]/g, "");
  return /^[A-HJ-NP-Z2-9]{10}$/.test(code) ? code : null;
}
export function displayTvCode(code: string) { return code.slice(0, 5) + "-" + code.slice(5); }
export function deviceLabel(value: string) { return value.replace(/[\x00-\x1f\x7f<>]/g, "").trim().slice(0, 64) || "Android TV"; }
