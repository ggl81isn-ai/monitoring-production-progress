# GitHub Actions 用シークレット・変数

ワークフロー: `.github/workflows/weekly-dashboard.yml`

## シークレット（Repository secrets）

| 名前 | 必須 | 説明 |
|------|------|------|
| `NOTION_TOKEN` | Notion 利用時 | インテグレーションのシークレット |
| `NOTION_DATABASE_ID` | Notion 利用時 | 対象データベースの ID |
| `NOTION_WEEK_GOALS` | 任意 | 改行区切りの今週の目標（長文はシークレット向き） |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE 利用時 | Messaging API のチャネルアクセストークン |
| `LINE_TO_USER_ID` | LINE 利用時 | プッシュ先のユーザー ID |
| `LINE_IMAGE_ORIGINAL_URL` | 任意 | 画像メッセージ用（HTTPS）。未設定ならテキストのみ |
| `LINE_IMAGE_PREVIEW_URL` | 任意 | プレビュー用画像 URL |

### Variables（タグの絞り込み）

| Name | 例 | 説明 |
|------|-----|------|
| `NOTION_TAG_PROPERTY` | `タグ` | タグ列の表示名（未設定時はコード側で `タグ` を仮定） |
| `NOTION_TAG_FILTER_MODE` | `value` | `value`（既定・「制作」等で絞る）/ `non_empty` / `both` |
| `NOTION_TAG_VALUE` | `制作` | `value` または `both` のときに使用 |
| `NOTION_SKIP_TAG_FILTER` | `true` | `true` のときだけタグ条件なしで全件（通常は空のまま） |
| `NOTION_IN_PROGRESS_STATUS_VALUES` | `進行中` | 進行中件数の集計に使う（カンマ区切り可）。`NOTION_DONE_STATUS_VALUES` と重複不可 |

`NOTION_TOKEN` と `NOTION_DATABASE_ID` の両方があるときだけ `npm run notion:payload` を実行します。無い場合は `data/sample-report.json` をコピーしてビルドします。

## 変数（Repository variables / `vars`）

タグ名・マイルストーン列名など、**機密でない**マッピングは Variables で渡せます（ワークフロー内の `vars.*`）。

例: `NOTION_TAG_PROPERTY`, `NOTION_TAG_VALUE`, `NOTION_MILESTONE_SELECT_ORDER`, `NOTION_SKIP_TAG_FILTER` など。

未設定の項目はローカルと同じく `.env` / `readNotionMappingEnv` のデフォルトが使われます（空文字のとき）。
