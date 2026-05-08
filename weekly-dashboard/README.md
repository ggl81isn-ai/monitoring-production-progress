# 週次アプリ制作進捗ダッシュボード（ジェネレータ）

`report-preview/index.html` を**単一のテンプレート**として、`data/*.json` から週次レポート用 HTML を **`dist/`** に生成します。設計メモは `automation-design/` を参照。

## 前提

- テンプレート・スタイルの編集は **`report-preview/`**（`npm run build:css`）。
- データ適用・Notion・スクショ・LINE は **`weekly-dashboard/`**。

## ローカル（最短）

```powershell
cd report-preview
npm install
npm run build:css
```

```powershell
cd ..\weekly-dashboard
npm install
Copy-Item data\sample-report.json data\notion-output.json -Force
npm run generate -- data/notion-output.json
npx playwright install chromium
npm run screenshot
```

生成物:

- `dist/index.html` / `dist/tailwind.css`
- `dist/report.png`（`main[data-report-root]` のキャプチャ）

## npm scripts

| script | 説明 |
|--------|------|
| `npm run generate` | `dist/` に HTML + CSS（第2引数で JSON パス可） |
| `npm run notion:payload` | Notion API から `data/notion-output.json` を生成（要 `.env`） |
| `npm run screenshot` | `dist/index.html` を開き `dist/report.png` を出力 |
| `npm run push:line` | LINE Push（テキスト＋任意で画像 URL）。トークン無しならスキップ |
| `npm run build:weekly` | `notion:payload` → `generate` → `screenshot`（要 Notion の `.env`） |
| `npm run build:weekly:line` | 上記に続けて `push:line`（同じ `data/notion-output.json` を送信） |
| `npm run build:weekly:sample` | サンプル JSON で `generate` → `screenshot` |
| `npm run build:weekly:sample:line` | サンプルで `generate` → `screenshot` → LINE（**Notion なしで LINE 試験向け**） |
| `npm run typecheck` | 型チェック |

## Notion 連携

1. [Notion integrations](https://www.notion.so/my-integrations) でインテグレーションを作成し、対象 DB に接続を追加する。
2. `weekly-dashboard/.env.example` をコピーして `.env` を作り、`NOTION_TOKEN` と `NOTION_DATABASE_ID` を設定する。
3. DBに合わせてプロパティ名を調整する（タグ・ステータス・マイルストーンなど）。詳細は `.env.example` のコメント参照。
4. `npm run notion:payload` で `data/notion-output.json` を生成する。

**タグ列**: 既定は **`NOTION_TAG_FILTER_MODE=value`**（未指定も同じ）で、**「タグ」に「制作」が付いた行だけ**を Notion から取得し、進捗もその件数で計算します。別モードは `.env.example` を参照。

マイルストーン列が **select** のときは、`NOTION_MILESTONE_SELECT_ORDER` に左から 1〜4 に対応するオプション名をカンマ区切りで必ず指定する。

## GitHub Actions

`.github/workflows/weekly-dashboard.yml` が **月曜 00:00 UTC**（日本時間だと月曜朝）と **手動実行** で動きます。

- `NOTION_TOKEN` + `NOTION_DATABASE_ID` が無い場合はサンプル JSON で HTML と PNG を生成します。
- LINE は `LINE_CHANNEL_ACCESS_TOKEN` と `LINE_TO_USER_ID` があるときだけ送信（無ければ `push:line` がスキップ）。

LINE の作り方から Secrets まで: **`docs/line-setup-ja.md`**  
シークレット一覧: `docs/ci-secrets.md`  
成果物（Artifact）のダウンロード手順: `docs/github-artifacts-ja.md`

## データ形式（JSON）

`data/sample-report.json` を参照。型は `src/types.ts`、HTML への反映は `src/apply-payload.ts`。

## LINE 画像について

画像メッセージには **HTTPS の公開 URL** が必要です。

- **自動（推奨）:** **`DISCORD_WEBHOOK_URL`**（Incoming Webhook）で `dist/report.png` を投稿し、返却 URL で LINE に画像を付けます。手順は `docs/line-setup-ja.md`。
- **自動（補助）:** **`IMGUR_CLIENT_ID`** … Imgur の新規 API 登録ができない報告が多いため、Discord を推奨。
- **手動:** **`LINE_IMAGE_ORIGINAL_URL`** と **`LINE_IMAGE_PREVIEW_URL`** の両方を設定すると最優先。

## 別の JSON で生成する

```powershell
cd weekly-dashboard
npm run generate -- ..\path\to\my-week.json
```

相対パスは**カレントディレクトリ基準**。
