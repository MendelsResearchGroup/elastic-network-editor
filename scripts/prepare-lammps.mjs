import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Serve the package's serial ES modules together so its module worker can
// resolve its own relative imports on both localhost and GitHub Pages.
const dist = dirname(fileURLToPath(import.meta.resolve("lammps.js/client")));
const target = fileURLToPath(new URL("../public/lammps-runtime/", import.meta.url));
await mkdir(join(target, "cpp"), { recursive: true });
for (const name of ["client.js", "worker.js", "worker-client.js", "worker-host.js", "worker-protocol.js", "cpp/lammps.js"]) {
  await copyFile(join(dist, name), join(target, name));
}
await copyFile(join(dist, "..", "LICENSE"), join(target, "LICENSE"));
