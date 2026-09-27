import { randomInt } from "node:crypto";

// 32 karakter alfanumerik tanpa karakter ambigu (0, O, 1, I)
export const JOIN_CODE_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const JOIN_CODE_LENGTH = 6;

/**
 * Menghasilkan kode acak 6 karakter dengan entropi kriptografis tinggi.
 * 32^6 = 1.073.741.824 kombinasi unik.
 */
export function generateRandomJoinCode(): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    const idx = randomInt(0, JOIN_CODE_CHARSET.length);
    code += JOIN_CODE_CHARSET[idx];
  }
  return code;
}
