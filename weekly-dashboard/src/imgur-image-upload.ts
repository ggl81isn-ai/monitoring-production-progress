/**
 * LINE の画像メッセージ用に HTTPS URL が必要なため、
 * `dist/report.png` を Imgur（匿名アップロード API）に載せて公開 URL を得る。
 *
 * Imgur: https://apidocs.imgur.com/#de179b6a-0663-441b-a618-acb0cbfd6a18
 * 画像は Imgur 上で公開リンクになる点に注意（週次レポート用途向け）。
 */

export async function uploadPngToImgur(
  clientId: string,
  pngBuffer: Buffer
): Promise<{ linkHttps: string }> {
  const res = await fetch("https://api.imgur.com/3/image", {
    method: "POST",
    headers: {
      Authorization: `Client-ID ${clientId.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "base64",
      image: pngBuffer.toString("base64"),
    }),
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Imgur 応答が JSON ではありません (HTTP ${res.status}): ${text.slice(0, 240)}`
    );
  }

  const obj = json as {
    data?: { link?: string; error?: string };
    success?: boolean;
    status?: number;
  };

  if (!res.ok || obj.success !== true) {
    const err =
      obj.data?.error ??
      (typeof obj.status === "number" ? String(obj.status) : text.slice(0, 400));
    throw new Error(`Imgur アップロード失敗 HTTP ${res.status}: ${err}`);
  }

  const link = obj.data?.link;
  if (!link || typeof link !== "string") {
    throw new Error(`Imgur が link を返しませんでした: ${text.slice(0, 400)}`);
  }

  const linkHttps = link.replace(/^http:\/\//i, "https://");
  return { linkHttps };
}
