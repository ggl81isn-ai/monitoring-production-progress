import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyWeeklyReportPayload } from "./apply-payload.js";
import type { WeeklyReportPayload } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardRoot = join(__dirname, "..");
const repoRoot = join(dashboardRoot, "..");
const templatePath = join(repoRoot, "report-preview", "index.html");
const cssSourcePath = join(repoRoot, "report-preview", "tailwind.css");
const distDir = join(dashboardRoot, "dist");
const defaultDataPath = join(dashboardRoot, "data", "sample-report.json");

async function main(): Promise<void> {
  const arg = process.argv[2];
  const dataPath = arg
    ? isAbsolute(arg)
      ? arg
      : join(process.cwd(), arg)
    : defaultDataPath;

  const [templateHtml, rawJson] = await Promise.all([
    readFile(templatePath, "utf8"),
    readFile(dataPath, "utf8"),
  ]);

  let cssOk = true;
  try {
    await readFile(cssSourcePath, "utf8");
  } catch {
    cssOk = false;
    console.warn(
      "警告: report-preview/tailwind.css が見つかりません。report-preview で npm run build:css を実行してください。"
    );
  }

  const payload = JSON.parse(rawJson) as WeeklyReportPayload;
  let outHtml = applyWeeklyReportPayload(templateHtml, payload);
  if (!outHtml.trim().toLowerCase().startsWith("<!doctype")) {
    outHtml = "<!DOCTYPE html>\n" + outHtml;
  }

  await mkdir(distDir, { recursive: true });
  await writeFile(join(distDir, "index.html"), outHtml, "utf8");

  if (cssOk) {
    await copyFile(cssSourcePath, join(distDir, "tailwind.css"));
  }

  console.log(`生成完了: ${join(distDir, "index.html")}`);
  console.log(`データ: ${dataPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
