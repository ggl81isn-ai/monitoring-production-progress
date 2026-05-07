import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardRoot = join(__dirname, "..");
const distDir = join(dashboardRoot, "dist");
const htmlPath = join(distDir, "index.html");
const pngPath = join(distDir, "report.png");

async function main(): Promise<void> {
  const fileUrl = pathToFileURL(htmlPath).href;
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 2200 },
    deviceScaleFactor: 2,
  });
  await page.goto(fileUrl, { waitUntil: "load", timeout: 60_000 });
  const root = page.locator("main[data-report-root]");
  await root.waitFor({ state: "visible", timeout: 30_000 });
  await root.screenshot({ path: pngPath, type: "png" });
  await browser.close();
  console.log(`スクリーンショットを保存しました: ${pngPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
