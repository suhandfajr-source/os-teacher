import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { Readable } from "node:stream";
import { LlmSettingsError, normalizeApiUrl } from "./llm-settings.schema";

const blocked = new BlockList();
for (const [ip, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const) blocked.addSubnet(ip, prefix, "ipv4");
for (const [ip, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) {
  blocked.addSubnet(ip, prefix, "ipv6");
}

export function isPublicLlmAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  // Reject mapped IPv4, local/reserved and transition ranges; only global unicast.
  return family === 6 && /^[23][0-9a-f]{0,3}:/i.test(address) && !blocked.check(address, "ipv6");
}

export async function resolveLlmEndpoint(value: string) {
  const url = new URL(normalizeApiUrl(value));
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const localDev = process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1", "::1"].includes(hostname);
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) =>
    !isPublicLlmAddress(address) && !(localDev && ["127.0.0.1", "::1"].includes(address)))) {
    throw new LlmSettingsError("Endpoint jaringan internal/private tidak diizinkan.");
  }
  return { url, address: addresses[0].address, family: addresses[0].family };
}

/** Pin the validated DNS answer to the socket. No redirects, including same-host ones. */
export function createLlmEndpointFetch(baseURL: string): typeof fetch {
  const base = new URL(normalizeApiUrl(baseURL));
  return async (input, init) => {
    const request = new Request(input, init);
    const target = new URL(request.url);
    if (target.origin !== base.origin ||
        !(target.pathname === base.pathname || target.pathname.startsWith(base.pathname.replace(/\/$/, "") + "/"))) {
      throw new LlmSettingsError("Đích API tidak cocok dengan endpoint tersimpan.");
    }
    const resolved = await resolveLlmEndpoint(request.url);
    const body = request.body ? Buffer.from(await request.arrayBuffer()) : undefined;
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(120_000)]);
    return new Promise<Response>((resolve, reject) => {
      const headers = Object.fromEntries(request.headers.entries());
      delete headers.host;
      const transport = target.protocol === "https:" ? httpsRequest : httpRequest;
      const req = transport(resolved.url, {
        method: request.method,
        headers,
        signal,
        // Disable connection reuse across DNS validations and pin the checked address.
        agent: false,
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [{ address: resolved.address, family: resolved.family }]);
          else callback(null, resolved.address, resolved.family);
        },
      }, (res) => {
        const status = res.statusCode || 502;
        if (status >= 300 && status < 400) {
          res.destroy();
          reject(new LlmSettingsError("Redirect endpoint ditolak. Gunakan API URL final."));
          return;
        }
        if (status >= 400) {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(Buffer.from(c)));
          res.on("end", () => {
            const rawBody = Buffer.concat(chunks).toString("utf8");
            let errorMsg = `Provider error HTTP ${status}`;
            try {
              const parsed = JSON.parse(rawBody);
              errorMsg = parsed?.error?.message || parsed?.message || errorMsg;
            } catch {
              if (rawBody.trim()) errorMsg = rawBody.slice(0, 150);
            }
            resolve(
              new Response(
                JSON.stringify({ error: { message: errorMsg } }),
                { status, headers: { "content-type": "application/json" } }
              )
            );
          });
          return;
        }
        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(res.headers)) {
          if (value !== undefined) responseHeaders.set(name, Array.isArray(value) ? value.join(", ") : value);
        }
        const stream = [204, 205, 304].includes(status) || request.method === "HEAD"
          ? null : Readable.toWeb(res) as ReadableStream<Uint8Array>;
        resolve(new Response(stream, { status, headers: responseHeaders }));
      });
      req.on("error", () => reject(new LlmSettingsError("Koneksi LLM gagal atau melewati batas waktu.")));
      req.end(body);
    });
  };
}
