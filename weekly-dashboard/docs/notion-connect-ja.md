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

### ステータス列と「進行中」

- **よくある運用:** タスクは **「未着手」「進行中」** などに置き、終わったら **「完了」** に移すと、**「完了」** が `NOTION_DONE_STATUS_VALUES` に含まれる限り完了として数えられます（**未着手**は「その他」内訳に入ります）。列名と環境変数が合っていれば **完了が常に 0 件になる心配は通常ありません**。
- **`NOTION_STATUS_PROPERTY`** には、Notion 上の **プロパティの表示名**（例: `ステータス`）を **一字一句**合わせます。ここだけズレると、実際には完了にしているのに **完了 0 件扱い**になることがあります。
- 列の型は **`status`（ワークフロー）・`select`・`multi_select`** に対応しています。`multi_select` のときは **付いているタグのどれか一つ**が `NOTION_DONE_STATUS_VALUES` に含まれれば完了とみなします。
- 表示名で列が見つからないとき、データベースに **`status` 型の列が1つだけ**ある場合は、その列 ID に自動でフォールバックします（列名が英語などでデフォルトの `ステータス` と一致しないときの救済）。
- **完了**は `NOTION_DONE_STATUS_VALUES`（既定: `完了,Done,done`）に含まれる表示名だけです。**「進行中」は完了に含めない**でください（含めると設定時にエラーになります）。
- **進行中の件数**は `NOTION_IN_PROGRESS_STATUS_VALUES`（既定: `進行中`）に一致するステータスを数え、週次の本文・キャプションに出します。英語ワークスペースなら `In progress` などをカンマ区切りで追加できます。
- 週次本文には **「制作」などで絞った件数のうち、完了・進行中・その他（未着手など）の内訳**が出ます。Notion の表と突き合わせるときの目安にしてください。

### 件数が Notion の表と合わないとき

- **（重要）Notion API のページでは `properties` のキーは「列の表示名」**（例: `ステータス`, `タグ`, `Name`）です。DB スキーマの **プロパティ ID だけ**では参照できないため、このリポジトリでは **表示名で値を読み取る**実装に直しています。完了が常に 0・内訳が全部 0 に見えていた場合は、この不整合が原因だった可能性が高いです。
- **`NOTION_DATABASE_ID` は「そのデータベース自身」の ID** です。データベースを開いたときの URL の 32 文字ブロックを使い、**親のページや別 DB の ID** を入れていないか確認してください。
- **タグ列が `relation`（他 DB 参照）**の場合、このリポジトリのタグ絞り込みには対応していません（`multi_select` / `select` の列名を `NOTION_TAG_PROPERTY` に指定してください）。
- 切り分け用に **`NOTION_DIAGNOSTIC=true`** を `.env` に足してから `npm run notion:payload` を実行すると、**タグ列・ステータス列の解決結果と `sampleRows`（先頭数行のタイトル・ステータス・完了フラグ）**が JSON で出力されます。**トークンは含みません**。

#### `sampleRows` をチャットなどに共有する手順（Windows / PowerShell）

1. `weekly-dashboard` フォルダにある **`.env`** を開き、次の1行を追加（またはコメントを外す）します。  
   `NOTION_DIAGNOSTIC=true`
2. ターミナルで `weekly-dashboard` に移動してから実行します。

```powershell
cd weekly-dashboard
npm run notion:payload
```

3. 実行が終わると、コンソールに `[NOTION_DIAGNOSTIC]` で始まる JSON が流れます。あわせて **`weekly-dashboard/data/notion-diagnostic.json`** に同じ内容のファイルが自動で作られます（フォルダが無ければ作成されます）。
4. **共有のしかた**
   - **ファイルを添付できる場合:** `notion-diagnostic.json` をそのまま送る。
   - **テキストで貼る場合:** メモ帳や VS Code / Cursor で `notion-diagnostic.json` を開き、**`"sampleRows"` から始まる配列**だけ、またはファイル全体をコピーして貼り付ける。
5. 保存先を変えたいときは `.env` に **`NOTION_DIAGNOSTIC_FILE=my-diagnostic.json`**（`weekly-dashboard` からの相対パス）や、**絶対パス**を指定できます。

---

## セキュリティの注意

- **シークレットはリポジトリにコミットしない**（`.env` は `.gitignore` 推奨）。
- GitHub Actions では **Repository secrets** に `NOTION_TOKEN` と `NOTION_DATABASE_ID` を登録する（`docs/ci-secrets.md`）。
