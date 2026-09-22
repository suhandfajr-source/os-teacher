import { describe, it, expect } from "vitest";
import {
  SuperAdminRequiredError,
  SUPERADMIN_STATIC_ERROR_MESSAGE,
  isPlatformAdminRole,
} from "../superadmin";

/**
 * Unit test kontrak terkeras deferred work Story 1 (requireSuperAdmin):
 * - strict equality `platformRole === "ADMIN"` — nilai asing tertolak
 * - satu jenis error dengan pesan statis identik semua jalur (anti-enumerasi)
 */
describe("superadmin guard contract (deferred work Story 1)", () => {
  describe("isPlatformAdminRole — deny-by-default strict equality", () => {
    it("menerima hanya string 'ADMIN' exact", () => {
      expect(isPlatformAdminRole("ADMIN")).toBe(true);
    });

    it("menolak nilai asing seperti 'MODERATOR' (bukan pola !== 'USER')", () => {
      expect(isPlatformAdminRole("MODERATOR")).toBe(false);
    });

    it("menolak 'USER', 'admin' lowercase, dan ' ADMIN' ber-spasi", () => {
      expect(isPlatformAdminRole("USER")).toBe(false);
      expect(isPlatformAdminRole("admin")).toBe(false);
      expect(isPlatformAdminRole(" ADMIN")).toBe(false);
    });

    it("menolak null, undefined, angka, dan objek", () => {
      expect(isPlatformAdminRole(null)).toBe(false);
      expect(isPlatformAdminRole(undefined)).toBe(false);
      expect(isPlatformAdminRole(123)).toBe(false);
      expect(isPlatformAdminRole({ role: "ADMIN" })).toBe(false);
    });
  });

  describe("SuperAdminRequiredError — satu jenis error, pesan statis identik", () => {
    it("pesan selalu identik STATIC_ERROR_MESSAGE semua instansiasi", () => {
      const a = new SuperAdminRequiredError();
      const b = new SuperAdminRequiredError();
      expect(a.message).toBe(SUPERADMIN_STATIC_ERROR_MESSAGE);
      expect(b.message).toBe(a.message);
      expect(a.name).toBe("SuperAdminRequiredError");
    });

    it("adalah instance Error sehingga catch (e) umum tetap menangkap", () => {
      expect(new SuperAdminRequiredError()).toBeInstanceOf(Error);
    });
  });
});
