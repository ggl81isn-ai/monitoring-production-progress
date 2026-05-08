import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildWeeklyPayloadFromNotion } from "./notion/build-payload-from-notion.js";
import { readNotionMappingEnv } from "./notion/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardRoot = join(__dirname, "..");
const defaultOut = join(dashboardRoot, "data", "notion-output.json");

async function main(): Promise<void> {
  const arg = process.argv[2];
  const outPath = arg
    ? isAbsolute(arg)
      ? arg
      : join(process.cwd(), arg)
    : defaultOut;

  const env = readNotionMappingEnv();
  const { payload, diagnostic } = await buildWeeklyPayloadFromNotion(env);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Notion から週次ペイロードを書き出しました: ${outPath}`);

  if (diagnostic) {
    const rawPath = process.env.NOTION_DIAGNOSTIC_FILE?.trim();
    const diagPath = rawPath
      ? isAbsolute(rawPath)
        ? rawPath
        : join(dashboardRoot, rawPath)
      : join(dashboardRoot, "data", "notion-diagnostic.json");
    await mkdir(dirname(diagPath), { recursive: true });
    await writeFile(diagPath, JSON.stringify(diagnostic, null, 2), "utf8");
    console.log(
      `診断 JSON（sampleRows 含む）を書き出しました。チャットに貼る・共有するときはこのファイル: ${diagPath}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
