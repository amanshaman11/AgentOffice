import type { WebContainer, FileSystemTree } from "@webcontainer/api";
import type { CodeFile } from "@/lib/store/code";

let wcInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

async function getWebContainer(): Promise<WebContainer> {
  if (wcInstance) return wcInstance;
  if (bootPromise) return bootPromise;

  const { WebContainer } = await import("@webcontainer/api");
  bootPromise = WebContainer.boot().then((wc) => {
    wcInstance = wc;
    bootPromise = null;
    return wc;
  });
  return bootPromise;
}

function filesToTree(files: CodeFile[]): FileSystemTree {
  const tree: FileSystemTree = {};
  for (const file of files) {
    const parts = file.path.split("/");
    let node: FileSystemTree = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!node[dir]) {
        node[dir] = { directory: {} };
      }
      node = (node[dir] as { directory: FileSystemTree }).directory;
    }
    const name = parts[parts.length - 1];
    node[name] = { file: { contents: file.content } };
  }
  return tree;
}

function detectPackageManager(files: CodeFile[]): "npm" | "yarn" | "pnpm" {
  const names = files.map((f) => f.path);
  if (names.includes("pnpm-lock.yaml")) return "pnpm";
  if (names.includes("yarn.lock")) return "yarn";
  return "npm";
}

function detectDevCommand(files: CodeFile[]): string[] {
  const packageJson = files.find((f) => f.path === "package.json");
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson.content);
      if (pkg.scripts?.dev) return ["run", "dev"];
      if (pkg.scripts?.start) return ["run", "start"];
      if (pkg.scripts?.serve) return ["run", "serve"];
    } catch {}
    return ["run", "dev"];
  }
  const hasPython = files.some((f) => f.path.endsWith(".py"));
  if (hasPython) return [];
  return [];
}

let staticBlobUrl: string | null = null;

export function previewStaticSite(
  files: CodeFile[],
  onUrl: (url: string) => void,
  onError: (err: string) => void,
): void {
  const indexFile = files.find((f) => f.path === "index.html" || f.path.endsWith("/index.html"));
  if (!indexFile) {
    onError("No index.html found in the generated project.");
    return;
  }

  const fileMap = new Map<string, CodeFile>();
  for (const f of files) {
    fileMap.set(f.path, f);
    fileMap.set(f.path.replace(/^\.\//, ""), f);
  }

  function resolveRef(base: string, ref: string): CodeFile | null {
    if (ref.startsWith("http") || ref.startsWith("//")) return null;
    const cleaned = ref.replace(/^\.\//, "");
    return fileMap.get(cleaned) ?? fileMap.get(ref) ?? null;
  }

  let html = indexFile.content;

  html = html.replace(
    /<link\b([^>]*)\bhref\s*=\s*['"]([^'"]+)['"]([^>]*)>/gi,
    (_match, before, href, after) => {
      const resolved = resolveRef(indexFile.path, href);
      if (!resolved) return _match;
      return `<style>${resolved.content}</style>`;
    },
  );

  html = html.replace(
    /<script\b([^>]*)\bsrc\s*=\s*['"]([^'"]+)['"]([^>]*)><\/script>/gi,
    (_match, before, src, after) => {
      if (src.startsWith("http") || src.startsWith("//")) return _match;
      const resolved = resolveRef(indexFile.path, src);
      if (!resolved) return _match;
      return `<script${before}${after}>${resolved.content}</script>`;
    },
  );

  if (staticBlobUrl) {
    URL.revokeObjectURL(staticBlobUrl);
  }

  const blob = new Blob([html], { type: "text/html" });
  staticBlobUrl = URL.createObjectURL(blob);
  onUrl(staticBlobUrl);
}

export async function mountAndPreview(
  files: CodeFile[],
  onUrl: (url: string) => void,
  onError: (err: string) => void,
): Promise<void> {
  const hasPackageJson = files.some((f) => f.path === "package.json");
  if (!hasPackageJson) {
    onError("No package.json found — preview only works for Node.js projects.");
    return;
  }

  try {
    const wc = await getWebContainer();
    const tree = filesToTree(files);
    await wc.mount(tree);

    const pm = detectPackageManager(files);
    const devArgs = detectDevCommand(files);

    const install = await wc.spawn(pm, ["install"]);
    install.output.pipeTo(
      new WritableStream({ write: () => {} }),
    );
    const installCode = await install.exit;
    if (installCode !== 0) {
      onError("Dependency installation failed. Check the project's package.json.");
      return;
    }

    if (devArgs.length === 0) {
      onError("No dev/start script found in package.json.");
      return;
    }

    const server = await wc.spawn(pm, devArgs);
    server.output.pipeTo(new WritableStream({ write: () => {} }));

    wc.on("server-ready", (_port, url) => {
      onUrl(url);
    });
  } catch (err) {
    onError(String(err));
  }
}

export function destroyWebContainer() {
  if (wcInstance) {
    wcInstance.teardown();
    wcInstance = null;
    bootPromise = null;
  }
}
