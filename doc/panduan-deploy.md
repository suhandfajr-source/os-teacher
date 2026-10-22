# Panduan Deploy — KLASSA (Ai Teacher Assistant)

Panduan deploy dari PC lokal ke server produksi. Semua perintah sudah teruji pada deploy pertama (22 Oktober 2026).

---

## 1. Arsitektur Deploy

```
Browser
  │
  ▼
https://klassa-edutech.com          (DNS proxied via Cloudflare)
  │
  ▼
Cloudflare Tunnel (token-based, config di dashboard Zero Trust)
  │
  ▼
Server AlmaLinux 8.10 (Tailscale: 100.123.122.20)
  ├── Docker container "klassa"  →  127.0.0.1:2001
  │     └── Next.js 16 standalone (node server.js)
  └── Database TIDAK di server → Neon PostgreSQL (Singapore, serverless)
```

**Poin penting:**
- Server **tidak punya IP publik** — akses SSH via Tailscale, akses publik via Cloudflare Tunnel.
- Database tetap di **Neon** (jangan pindah ke MariaDB/Laragon di server — schema kita PostgreSQL).
- Aplikasi jalan di **port 2001** (konsisten dengan dev lokal).

## 2. Kredensial & Akses Server

> Repo ini **private**, sehingga kredensial berikut aman disimpan di sini. Jika repo pernah dibuat public, segera rotasi semua kredensial di bawah.

| Jenis | Nilai |
|---|---|
| SSH server | `root@100.123.122.20` |
| Password root | `UserSuhandi#` |
| Jaringan | Tailscale tailnet `tailb5c6a2.ts.net` (akun `suhandfajr@`), koneksi via relay `sin` |
| Cloudflare (DNS/Tunnel) | `admin@klassa-edutech.com` (login OAuth, akun ID `c5b81d10a83430e54990a84bc2d35ad0`) |
| Tunnel produksi | Token-based, hostname `klassa-edutech.com` → `http://localhost:2001`, dikelola dari dashboard Cloudflare Zero Trust → Tunnels |
| GitHub repo | `https://github.com/suhandfajr-source/os-teacher.git` (private, branch deploy: `main`) |

Contoh koneksi cepat dari PC Windows:
```bash
plink -ssh -batch -no-antispoof root@100.123.122.20 -pw "UserSuhandi#" "docker ps"
```

## 3. Info Server & Komponen

| Komponen | Nilai |
|---|---|
| Server | AlmaLinux 8.10, 2 vCPU, 3.6 GB RAM, 57 GB disk |
| IP Tailscale | `100.123.122.20` (akses SSH: `root@100.123.122.20`) |
| Docker | 26.1.3 + Compose v2.27 (build WAJIB via Docker — glibc host 2.28 terlalu tua untuk SWC Next 16) |
| cloudflared | Jalan sebagai service, 2 tunnel token-based |
| Repo | `https://github.com/suhandfajr-source/os-teacher.git` (branch `main`) |
| Folder app di server | `/opt/os-teacher` |
| Container | `klassa` (image `klassa`, `--restart unless-stopped`) |
| Env file server | `/opt/os-teacher/.env` (chmod 600, JANGAN di-commit) |

## 4. Deploy Update (alur harian — paling sering dipakai)

### Langkah 1 — Commit & push dari PC lokal
```bash
git add <file-yang-diubah>
git commit -m "feat/fix: deskripsi perubahan"
git push origin main
```

### Langkah 2 — Build & restart di server
Dari PC lokal (Windows, via plink):
```bash
plink -ssh -batch -no-antispoof root@100.123.122.20 -pw "<PASSWORD>" ^
  "cd /opt/os-teacher && git fetch origin && git reset --hard origin/main && ^
   docker build -t klassa . && ^
   docker rm -f klassa && ^
   docker run -d --name klassa --restart unless-stopped --env-file .env -p 127.0.0.1:2001:2001 klassa"
```
> Build ±10–15 menit (CPU 2 core). Layer `npm ci` ter-cache jika `package*.json` tidak berubah.

### Langkah 3 — Verifikasi
```bash
# Dari PC lokal:
curl -s -o /dev/null -w "%{http_code}" https://klassa-edutech.com/login     # harus 200
curl -s -o /dev/null -w "%{http_code}" https://klassa-edutech.com/api/auth/get-session  # harus 200

# Log di server:
docker logs klassa --tail 20
```

## 5. Deploy dari Nol (server baru / ulang total)

1. **Siapkan tunnel & DNS** (sudah ada): hostname `klassa-edutech.com` → `http://localhost:2001` lewat dashboard Cloudflare Zero Trust → Tunnels.
2. **Clone & env:**
   ```bash
   git clone --depth 1 https://github.com/suhandfajr-source/os-teacher.git /opt/os-teacher
   cd /opt/os-teacher
   # Salin .env dari PC lokal, lalu SESUAIKAN (lihat §5)
   chmod 600 .env
   ```
3. **Migrasi database:**
   ```bash
   cd /opt/os-teacher && npx prisma migrate deploy
   ```
4. **Build & run** (sama seperti Langkah 2 di atas).
5. **Verifikasi** (sama seperti Langkah 3).

## 6. Environment Variables (`.env` di server)

Nilai yang HARUS ada di server (contoh dari PC lokal `.env`, disesuaikan):

| Var | Keterangan |
|---|---|
| `DATABASE_URL` | Koneksi Neon PostgreSQL (pooler) |
| `DATABASE_URL_DIRECT` | Neon direct URL (untuk migrasi) |
| `BETTER_AUTH_SECRET` | Secret Better Auth (wajib di production) |
| `BETTER_AUTH_URL` | **`https://klassa-edutech.com`** (tanpa kutip, tanpa slash akhir) |
| `PIN_PEPPER` | ≥32 char random (tanpa ini instrumentation gagal boot) |
| `STUDENT_SESSION_SECRET` | ≥32 char random (fail-fast di production) |
| `SUPERADMIN_EMAILS` | Email superadmin (mis. suhandfajr5@gmail.com) |
| `GLM_*`, `GEMINI_*`, `NEON_*` | API keys AI & storage (opsional sesuai fitur) |
| `PORT` | `2001` |

Generate secret baru (jika perlu):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

⚠️ **PENTING — dua jebakan format:**
1. **Tanpa tanda kutip.** Docker `--env-file` TIDAK menghapus kutip — `BETTER_AUTH_URL="https://..."` akan dianggap salah. Bersihkan dengan:
   ```bash
   sed -E -i 's/^([A-Za-z_][A-Za-z0-9_]*)="(.*)"$/\1=\2/' /opt/os-teacher/.env
   ```
2. **`docker restart` TIDAK baca ulang `--env-file`.** Setelah ubah `.env`, wajib recreate:
   ```bash
   docker rm -f klassa && docker run -d --name klassa --restart unless-stopped \
     --env-file /opt/os-teacher/.env -p 127.0.0.1:2001:2001 klassa
   ```

## 7. Masalah yang Pernah Terjadi & Solusinya

| Gejala | Penyebab | Solusi |
|---|---|---|
| Build host gagal `EPIPE` / `GLIBC_2.29 not found` | glibc AlmaLinux 8 = 2.28, SWC Next 16 butuh ≥2.29 | **Selalu build via Docker** (image `node:22-bookworm` punya glibc 2.36) |
| Build Docker gagal: `Missing required BETTER_AUTH_SECRET / PIN_PEPPER` | Page-data collection mengevaluasi modul yang fail-fast tanpa env | Sudah diatasi `Dockerfile` (ARG placeholder build-time); jangan hapus bagian itu |
| Runtime 500: `Invalid base URL "https://..."` (ada kutip di pesan) | Docker env-file membaca kutip secara literal | Bersihkan kutip (lihat §5 poin 1) |
| Runtime 500: `Missing required PIN_PEPPER` | `.env` tidak punya `PIN_PEPPER`/`STUDENT_SESSION_SECRET` (lokal selama ini pakai dev-fallback) | Tambahkan secret asli ke `.env` server lalu **recreate** container |
| Publik 502 Bad Gateway | Tunnel OK tapi tidak ada yang listen di 2001 | Cek `docker ps` — container harus `Up` dan binding `127.0.0.1:2001->2001` |
| SSH/plink timeout | Server sibuk build, jalur Tailscale relay drop | Tunggu 1–2 menit lalu retry; build `nohup` tetap jalan di server |

## 8. Perintah Operasional (di server)

```bash
docker ps --filter name=klassa              # status container
docker logs klassa --tail 50                # lihat log aplikasi
docker logs klassa -f                       # tail log realtime (Ctrl+C keluar)
docker restart klassa                       # restart biasa (env TIDAK dibaca ulang)
docker rm -f klassa && docker run -d --name klassa --restart unless-stopped \
  --env-file /opt/os-teacher/.env -p 127.0.0.1:2001:2001 klassa   # recreate (env dibaca ulang)
docker exec -it klassa sh                   # masuk container (debug)
docker images klassa                        # ukuran image
df -h / && free -h                          # cek disk & RAM server
ss -tlnp | grep 2001                        # pastikan port 2001 listen
```

## 9. Checklist Keamanan

- [ ] **Ganti password root server** (password lama pernah dibagikan lewat chat — wajib rotasi).
- [ ] Pertimbangkan disable SSH password login, pakai SSH key (`PermitRootLogin prohibit-password`).
- [ ] `.env` di server: `chmod 600`, tidak pernah di-commit ke repo.
- [ ] Placeholder di `Dockerfile` memang bukan secret asli — secret asli hanya lewat `--env-file` runtime.
- [ ] Container jalan sebagai user non-root `klassa` (sudah default dari Dockerfile).
- [ ] Backup database: Neon autosuspend + periodic branch/fork (cek dashboard Neon).

## 10. Port 2000/2001 (konvensi lokal)

- Dev lokal: `npm run dev` → otomatis `http://localhost:2001` (sudah di-script `package.json`).
- Trusted origins Better Auth sudah mencakup `localhost:2000–2005`.
- Production mengikuti port tunnel: `127.0.0.1:2001` di server.
