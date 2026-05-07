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
  const payload = await buildWeeklyPayloadFromNotion(env);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Notion から週次ペイロードを書き出しました: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
