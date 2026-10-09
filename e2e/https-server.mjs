import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer as createHttpsServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import next from "next";

const certificateDirectory = mkdtempSync(join(tmpdir(), "sharedschedule-e2e-"));
const key = join(certificateDirectory, "key.pem");
const certificate = join(certificateDirectory, "certificate.pem");
const generated = spawnSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    key,
    "-out",
    certificate,
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ],
  { stdio: "ignore" },
);
if (generated.status !== 0) {
  rmSync(certificateDirectory, { recursive: true, force: true });
  throw new Error("OpenSSL is required for the Playwright HTTPS server");
}

const application = next({ dev: false, hostname: "127.0.0.1", port: 3101 });
await application.prepare();
const handle = application.getRequestHandler();
const server = createHttpsServer(
  { key: readFileSync(key), cert: readFileSync(certificate) },
  (request, response) => {
    void handle(request, response);
  },
);
server.listen(3101, "127.0.0.1");
process.on("SIGTERM", () => {
  server.close();
  rmSync(certificateDirectory, { recursive: true, force: true });
});
