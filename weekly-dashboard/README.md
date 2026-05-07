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
| `npm run build:weekly:sample` | サンプル JSON で `generate` → `screenshot` |
| `npm run typecheck` | 型チェック |

## Notion 連携

1. [Notion integrations](https://www.notion.so/my-integrations) でインテグレーションを作成し、対象 DB に接続を追加する。
2. `weekly-dashboard/.env.example` をコピーして `.env` を作り、`NOTION_TOKEN` と `NOTION_DATABASE_ID` を設定する。
3. DBに合わせてプロパティ名を調整する（タグ・ステータス・マイルストーンなど）。詳細は `.env.example` のコメント参照。
4. `npm run notion:payload` で `data/notion-output.json` を生成する。

マイルストーン列が **select** のときは、`NOTION_MILESTONE_SELECT_ORDER` に左から 1〜4 に対応するオプション名をカンマ区切りで必ず指定する。

## GitHub Actions

`.github/workflows/weekly-dashboard.yml` が **月曜 00:00 UTC**（日本時間だと月曜朝）と **手動実行** で動きます。

- `NOTION_TOKEN` + `NOTION_DATABASE_ID` が無い場合はサンプル JSON で HTML と PNG を生成します。
- LINE は `LINE_CHANNEL_ACCESS_TOKEN` と `LINE_TO_USER_ID` があるときだけ送信（無ければ `push:line` がスキップ）。

シークレット一覧: `docs/ci-secrets.md`

## データ形式（JSON）

`data/sample-report.json` を参照。型は `src/types.ts`、HTML への反映は `src/apply-payload.ts`。

## LINE 画像について

画像メッセージには **LINE が取得できる HTTPS URL** が必要です。CI だけでは自動アップロードしないため、公開ストレージや Raw URL 等で `LINE_IMAGE_*` を設定するか、テキストのみ運用してください（`automation-design/01-four-parts-recommendations.md`）。

## 別の JSON で生成する

```powershell
cd weekly-dashboard
npm run generate -- ..\path\to\my-week.json
```

相対パスは**カレントディレクトリ基準**。
