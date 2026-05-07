# Notion データベースを接続する手順（API キー〜このリポジトリの設定）

## 参照（公式）

- インテグレーションの作成: [Create a Notion integration](https://developers.notion.com/docs/create-a-notion-integration)
- トークンと権限の考え方: [Authorization](https://developers.notion.com/docs/authorization)
- データベースの扱い（API 全般）: [Working with databases](https://developers.notion.com/guides/data-apis/working-with-databases)

「API キー」は Notion では **インテグレーションのシークレット（Internal Integration Secret）** と呼ばれます。

---

## 1. インテグレーションを作る（＝ API 用トークンを取得）

1. ブラウザで **https://www.notion.so/my-integrations** を開く（Notion にログインした状態）。
2. **「新しいインテグレーション」**（または *New integration*）を選ぶ。
3. **名前**を付け、**関連ワークスペース**を選ぶ。
4. **種類**は通常 **「内部」**（Internal）のままでよい（自分のワークスペース内の DB を読む用途）。
5. **能力（Capabilities）** で、少なくとも **「コンテンツを読み取る」**（Read content）を有効にする。タスクの更新まで自動でやるなら「更新」も必要だが、**週次読み取りだけなら読み取りで足りる**。
6. **「送信」**で保存する。
7. 開いた画面の **「内部インテグレーションシークレット」**（*Internal Integration Secret*）の **「表示」** を押し、表示された文字列をコピーする。  
   - これが **`NOTION_TOKEN`** に相当する値（他人に見せない・Git にコミットしない）。

---

## 2. 対象データベースをインテグレーションに「接続」する

API は **インテグレーションに共有されたページ／DB だけ** 読めます。

1. Notion で **対象のデータベース**を全画面表示する。
2. 右上の **「…」**（またはデータベース名横のメニュー）を開く。
3. **「接続」**（*Connections* / *Add connections*）を選ぶ。
4. 手順 1 で作った **インテグレーション名**を検索して **追加**する。

これを忘れると API は **404** になりがちです。

---

## 3. データベース ID を取得する

1. そのデータベースをブラウザで開いたときの **URL** を見る。  
   形式の例:  
   `https://www.notion.so/workspace/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...`  
   または  
   `https://www.notion.so/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...`
2. 32 文字の **英数字（ハイフン無しのことが多い）** のブロックが **データベース ID** です。  
   - ハイフン付き UUID 形式にしたい場合は、32 文字を `8-4-4-4-12` で区切ってもよいですが、**そのまま 32 文字をコピーして `NOTION_DATABASE_ID` に使う**ので問題ありません（SDK は両方受け付けます）。

---

## 4. このリポジトリ（weekly-dashboard）に設定する

1. `weekly-dashboard/.env.example` をコピーして **`weekly-dashboard/.env`** を作る（`.env` は Git に含めない）。
2. 次を埋める:

```env
NOTION_TOKEN=secret_....（手順1のシークレット）
NOTION_DATABASE_ID=xxxxxxxx...（手順3のID）
```

3. データベースの **列名（プロパティの表示名）** に合わせて、`.env.example` のコメントどおり **`NOTION_TAG_PROPERTY`** などを調整する。  
   - マイルストーン列が **select** のときは **`NOTION_MILESTONE_SELECT_ORDER`** に、左から 1〜4 に対応する選択肢名をカンマ区切りで書く（必須）。

4. 動作確認:

```powershell
cd weekly-dashboard
npm run notion:payload
npm run generate -- data/notion-output.json
npm run screenshot
```

`data/notion-output.json` が生成され、`dist/index.html` と `dist/report.png` が更新されれば接続できています。

### GitHub Actions でのタグ

既定では **`NOTION_TAG_FILTER_MODE=value`**（未設定も同じ）で、**「タグ」列に「制作」が付いている行だけ**を取得し、**完了率・件数・次週アクション**もその集合だけを使います。

- 列名が `タグ` でない場合は Variables に **`NOTION_TAG_PROPERTY`** を設定する。
- 別のタグ名にしたい場合は **`NOTION_TAG_VALUE`** を変える。
- **タグが1つでも付いていればよい**（制作に限らない）なら `NOTION_TAG_FILTER_MODE=non_empty`。
- **「タグが付いている」かつ「制作を含む」**なら `NOTION_TAG_FILTER_MODE=both`。
- どうしても DB 全件を読むときだけ **`NOTION_SKIP_TAG_FILTER=true`**（非推奨）。

**注意:** Repository Variables に **`NOTION_TAG_FILTER_MODE=non_empty`** を入れたままだと件数が膨らみます。**削除するか `value` に変更**してください。

---

## セキュリティの注意

- **シークレットはリポジトリにコミットしない**（`.env` は `.gitignore` 推奨）。
- GitHub Actions では **Repository secrets** に `NOTION_TOKEN` と `NOTION_DATABASE_ID` を登録する（`docs/ci-secrets.md`）。
