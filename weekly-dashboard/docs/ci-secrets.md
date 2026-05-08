# GitHub Actions 用シークレット・変数

ワークフロー: `.github/workflows/weekly-dashboard.yml`

## シークレット（Repository secrets）

| 名前 | 必須 | 説明 |
|------|------|------|
| `NOTION_TOKEN` | Notion 利用時 | インテグレーションのシークレット |
| `NOTION_DATABASE_ID` | Notion 利用時 | 対象データベースの ID |
| `NOTION_WEEK_GOALS` | 任意 | 改行区切りの今週の目標（長文はシークレット向き） |
| `NOTION_NEXT_ACTIONS` | 任意 | 改行区切りの次週アクション（長文はシークレット向き） |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE 利用時 | Messaging API のチャネルアクセストークン |
| `LINE_TO_USER_ID` | LINE 利用時 | プッシュ先のユーザー ID |
| `LINE_IMAGE_ORIGINAL_URL` | 任意 | 画像メッセージ用（HTTPS）。**`LINE_IMAGE_PREVIEW_URL` とセット**で最優先 |
| `LINE_IMAGE_PREVIEW_URL` | 任意 | プレビュー用画像 URL |
| `DISCORD_WEBHOOK_URL` | 任意 | **上記2つ未設定時**、`dist/report.png` を Incoming Webhook で投稿し、返却の `attachments[].url` で LINE に画像を付ける（**推奨**。専用チャンネルにWebhookを作る） |
| `IMGUR_CLIENT_ID` | 任意 | 同上を Imgur 匿名 API で行う（**新規 Client ID 登録が Imgur 側でできない報告が多い**ため、Discord の利用を推奨） |

### Variables（タグの絞り込み）

| Name | 例 | 説明 |
|------|-----|------|
| `NOTION_TAG_PROPERTY` | `タグ` | タグ列の表示名（未設定時はコード側で `タグ` を仮定） |
| `NOTION_TAG_FILTER_MODE` | `value` | `value`（既定・「制作」等で絞る）/ `non_empty` / `both` |
| `NOTION_TAG_VALUE` | `制作` | `value` または `both` のときに使用 |
| `NOTION_SKIP_TAG_FILTER` | `true` | `true` のときだけタグ条件なしで全件（通常は空のまま） |
| `NOTION_IN_PROGRESS_STATUS_VALUES` | `進行中` | 進行中件数の集計に使う（カンマ区切り可）。`NOTION_DONE_STATUS_VALUES` と重複不可 |
| `NOTION_DERIVE_GOALS_FROM_TASKS` | `false` | `false` で、`NOTION_WEEK_GOALS` 未設定時のタスク自動生成を無効化 |
| `NOTION_DERIVE_NEXT_ACTIONS_FROM_TASKS` | `false` | `false` で、`NOTION_NEXT_ACTIONS` 未設定時のタスク自動生成を無効化 |

`NOTION_TOKEN` と `NOTION_DATABASE_ID` の両方があるときだけ `npm run notion:payload` を実行します。無い場合は `data/sample-report.json` をコピーしてビルドします。

## 変数（Repository variables / `vars`）

タグ名・マイルストーン列名など、**機密でない**マッピングは Variables で渡せます（ワークフロー内の `vars.*`）。

例: `NOTION_TAG_PROPERTY`, `NOTION_TAG_VALUE`, `NOTION_MILESTONE_SELECT_ORDER`, `NOTION_SKIP_TAG_FILTER` など。

未設定の項目はローカルと同じく `.env` / `readNotionMappingEnv` のデフォルトが使われます（空文字のとき）。
