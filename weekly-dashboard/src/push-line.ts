import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { uploadPngViaDiscordWebhook } from "./discord-webhook-upload.js";
import { uploadPngToImgur } from "./imgur-image-upload.js";
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

/**
 * LINE 画像用 URL の解決順:
 * 1. `LINE_IMAGE_ORIGINAL_URL` + `LINE_IMAGE_PREVIEW_URL` が両方ある → そのまま
 * 2. `DISCORD_WEBHOOK_URL` がある → PNG を Webhook に投稿し attachments の HTTPS URL
 * 3. `IMGUR_CLIENT_ID` がある → Imgur 匿名 API（新規 Client ID が取れない場合が多い）
 */
async function resolveLineImageUrls(): Promise<{
  original: string;
  preview: string;
  source: "env" | "discord" | "imgur";
} | null> {
  const original = process.env.LINE_IMAGE_ORIGINAL_URL?.trim();
  const preview = process.env.LINE_IMAGE_PREVIEW_URL?.trim();
  const discordWebhook = process.env.DISCORD_WEBHOOK_URL?.trim();
  const imgurClientId = process.env.IMGUR_CLIENT_ID?.trim();

  console.log(
    `[LINE_IMAGE_CONFIG] manualOriginal=${original ? "yes" : "no"} manualPreview=${preview ? "yes" : "no"} discordWebhook=${discordWebhook ? "yes" : "no"} imgurClientId=${imgurClientId ? "yes" : "no"}`
  );

  if ((original && !preview) || (!original && preview)) {
    console.warn(
      "LINE_IMAGE_ORIGINAL_URL / LINE_IMAGE_PREVIEW_URL は両方セットが必要です。片方のみのため手動URLを無視します。"
    );
  }

  if (original && preview) {
    return { original, preview, source: "env" };
  }
  if (!discordWebhook && !imgurClientId) return null;

  const rel =
    process.env.LINE_REPORT_PNG_PATH?.trim() || join("dist", "report.png");
  const pngPath = isAbsolute(rel) ? rel : join(dashboardRoot, rel);
  const pngBuffer = await readFile(pngPath);

  if (discordWebhook) {
    const { linkHttps } = await uploadPngViaDiscordWebhook(
      discordWebhook,
      pngBuffer
    );
    return { original: linkHttps, preview: linkHttps, source: "discord" };
  }

  if (imgurClientId) {
    const { linkHttps } = await uploadPngToImgur(imgurClientId, pngBuffer);
    return { original: linkHttps, preview: linkHttps, source: "imgur" };
  }

  return null;
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

  const imageUrls = await resolveLineImageUrls();
  if (imageUrls) {
    messages.push({
      type: "image",
      originalContentUrl: imageUrls.original,
      previewImageUrl: imageUrls.preview,
    });
    if (imageUrls.source === "discord") {
      console.log(
        "LINE 画像: Discord Webhook にアップロードし、返却 URL で送信します。"
      );
    } else if (imageUrls.source === "imgur") {
      console.log(
        "LINE 画像: Imgur にアップロードし、その HTTPS URL で送信します。"
      );
    }
  } else {
    console.log(
      "LINE 画像: 画像URL/Discord/Imgur の設定が無いため、テキストのみ送信します。"
    );
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
