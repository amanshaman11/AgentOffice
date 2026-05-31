import { getProjectFiles } from "@/lib/api";
import { useCodeStore, type CodeFile } from "@/lib/store/code";
import { useUiStore } from "@/lib/store/ui";
import { mountAndPreview, previewStaticSite } from "@/lib/webcontainer";

function startPreview(files: CodeFile[]) {
  const codeStore = useCodeStore.getState();
  codeStore.setPreviewUrl(null);

  const hasPackageJson = files.some((f) => f.path === "package.json");
  const hasIndexHtml = files.some(
    (f) => f.path === "index.html" || f.path.endsWith("/index.html"),
  );

  if (hasIndexHtml && !hasPackageJson) {
    previewStaticSite(
      files,
      (url) => codeStore.setPreviewUrl(url),
      () => codeStore.setBuildStatus("error"),
    );
    return;
  }

  if (hasPackageJson) {
    void mountAndPreview(
      files,
      (url) => codeStore.setPreviewUrl(url),
      () => codeStore.setBuildStatus("error"),
    );
  }
}

export async function loadProjectPreview(
  researchId: number,
): Promise<{ ok: boolean; error?: string }> {
  const codeStore = useCodeStore.getState();
  useUiStore.getState().setActiveLeft("code");
  codeStore.setPreviewUrl(null);
  codeStore.setBuildStatus("building");

  try {
    const project = await getProjectFiles(researchId);
    if (!project.files?.length) {
      codeStore.setBuildStatus("error");
      return { ok: false, error: "No source files found for this project." };
    }

    codeStore.setFiles(project.files);
    codeStore.setResearchId(project.research_id);
    codeStore.setSetupInstructions(project.setup_instructions ?? "");
    codeStore.setBuildStatus("ready");
    startPreview(project.files);

    return { ok: true };
  } catch (err) {
    codeStore.setBuildStatus("error");
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function previewLoadedFiles() {
  const { files } = useCodeStore.getState();
  if (!files.length) return;
  startPreview(files);
}
