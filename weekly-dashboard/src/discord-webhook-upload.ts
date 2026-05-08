/**
 * LINE 用の HTTPS 画像 URL を得るため、Discord Incoming Webhook に PNG を投稿し、
 * 返却メッセージの attachments[].url（cdn.discordapp.com）を返す。
 *
 * Discord: https://discord.com/developers/docs/resources/webhook#execute-webhook
 * 同一 CI ジョブ内ですぐ LINE に渡す想定（URL の寿命は Discord 側仕様に依存）。
 */

export async function uploadPngViaDiscordWebhook(
  webhookUrl: string,
  pngBuffer: Buffer,
  filename = "report.png"
): Promise<{ linkHttps: string }> {
  const base = webhookUrl.trim();
  if (!base.startsWith("https://discord.com/api/webhooks/")) {
    throw new Error(
      "DISCORD_WEBHOOK_URL は https://discord.com/api/webhooks/... の形式である必要があります。"
    );
  }

  const url = base.includes("?") ? `${base}&wait=true` : `${base}?wait=true`;

  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({
      content: "[weekly-dashboard] 週次レポート PNG（LINE 送信用・自動）",
    })
  );
  const bytes = new Uint8Array(pngBuffer);
  form.append("files[0]", new Blob([bytes], { type: "image/png" }), filename);

  const res = await fetch(url, { method: "POST", body: form });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(
      `Discord Webhook 失敗 HTTP ${res.status}: ${text.slice(0, 500)}`
    );
  }

  let msg: {
    attachments?: Array<{ url?: string }>;
  };
  try {
    msg = JSON.parse(text) as typeof msg;
  } catch {
    throw new Error(
      `Discord 応答が JSON ではありません: ${text.slice(0, 240)}`
    );
  }

  const link = msg.attachments?.[0]?.url;
  if (!link || typeof link !== "string") {
    throw new Error(
      `Discord が attachments[0].url を返しませんでした: ${text.slice(0, 400)}`
    );
  }

  const linkHttps = link.replace(/^http:\/\//i, "https://");
  return { linkHttps };
}
