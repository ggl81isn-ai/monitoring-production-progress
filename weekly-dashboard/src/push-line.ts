import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WeeklyReportPayload } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardRoot = join(__dirname, "..");

type LineTextMessage = { type: "text"; text: string };
type LineImageMessage = {
  type: "image";
  originalContentUrl: string;
  previewImageUrl: string;
};

function buildTextFromPayload(p: WeeklyReportPayload): string {
  const lines = [
    p.header.weekRange,
    "",
    p.header.reportTitle,
    "",
    p.weeklySummary.lead,
    p.weeklySummary.body,
    "",
    "【次週アクション】",
    ...p.nextActions.map((a, i) => `${i + 1}. ${a.text}`),
  ];
  return lines.join("\n").slice(0, 4900);
}

async function main(): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  const to = process.env.LINE_TO_USER_ID?.trim();
  if (!token || !to) {
    console.log(
      "LINE_CHANNEL_ACCESS_TOKEN または LINE_TO_USER_ID が無いため、LINE Push をスキップします。"
    );
    process.exit(0);
  }

  const arg = process.argv[2];
  const payloadPath = arg
    ? isAbsolute(arg)
      ? arg
      : join(process.cwd(), arg)
    : join(dashboardRoot, "data", "notion-output.json");

  const raw = await readFile(payloadPath, "utf8");
  const payload = JSON.parse(raw) as WeeklyReportPayload;

  const messages: Array<LineTextMessage | LineImageMessage> = [
    { type: "text", text: buildTextFromPayload(payload) },
  ];

  const original = process.env.LINE_IMAGE_ORIGINAL_URL?.trim();
  const preview = process.env.LINE_IMAGE_PREVIEW_URL?.trim();
  if (original && preview) {
    messages.push({
      type: "image",
      originalContentUrl: original,
      previewImageUrl: preview,
    });
  }

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to, messages }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE Push 失敗 HTTP ${res.status}: ${body}`);
  }
  console.log("LINE Push が完了しました。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
