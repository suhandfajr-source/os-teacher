/**
 * Utility functions for schedule date, timezone and day normalization.
 * Standardizes Indonesian school days (1 = Senin s/d 7 = Minggu).
 */

/**
 * Mengubah objek Date menjadi indeks hari standar Indonesia (1 = Senin s/d 7 = Minggu)
 * Berdasarkan zona waktu lokal guru (Default: Asia/Jakarta).
 */
export function getNormalizedDayOfWeek(date: Date = new Date(), timeZone = "Asia/Jakarta"): number {
  const formatter = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone });
  const dayName = formatter.format(date).toLowerCase();

  const map: Record<string, number> = {
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
    sun: 7,
  };

  return map[dayName] || 1;
}

/**
 * Mengambil waktu saat ini dalam format "HH:mm" sesuai zona waktu lokal.
 */
export function getCurrentTimeString(date: Date = new Date(), timeZone = "Asia/Jakarta"): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
  return formatter.format(date);
}

/**
 * Format nama hari Indonesia dari angka dayOfWeek (1-7).
 */
export function getDayNameIndonesia(dayOfWeek: number): string {
  const names: Record<number, string> = {
    1: "Senin",
    2: "Selasa",
    3: "Rabu",
    4: "Kamis",
    5: "Jumat",
    6: "Sabtu",
    7: "Minggu",
  };
  return names[dayOfWeek] || "Senin";
}
