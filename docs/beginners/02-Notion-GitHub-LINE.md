# Notion・GitHub・LINE を使う場合（何を作る・どこに貼るか）

## Notion を使う場合

### 必要なもの

- すでに使っている **Notion アカウント** でよい  
- 追加で作るのは **「インテグレーション」**（外部ツールが DB を読むための入り口）

### 具体的な作業

1. **インテグレーションを作る**  
   - Notion の [My integrations](https://www.notion.so/my-integrations) を開く  
   - 新規作成 → 表示名を付ける → **Internal Integration** として保存  
   - 表示される **「Secrets」の長い文字列** をコピー（これが `NOTION_TOKEN`）

2. **データベースに「接続」する**  
   - Notion 上で対象のデータベースページを開く  
   - 右上の `⋯` → **Connections**（接続）→ さきほどのインテグレーションを追加  
   - これで「そのインテグレーションがこの DB を読める」ようになる

3. **データベース ID を控える**  
   - データベースをブラウザで開いたときの URL に含まれる **32文字のID**（ハイフンあり）が `NOTION_DATABASE_ID`

4. **PC 用の設定ファイル `.env` を作る**  
   - `weekly-dashboard\.env.example` をコピーして `weekly-dashboard\.env` にリネーム  
   - 中に最低限次を入れる:  
     - `NOTION_TOKEN=`（コピーしたシークレット）  
     - `NOTION_DATABASE_ID=`（DB の ID）  
   - 列名がサンプルと違う場合は、`NOTION_TAG_PROPERTY` などを **自分の DB のプロパティ名** に合わせて直す（`.env.example` のコメント参照）  
   - **マイルストーン列が「選択（select）」タイプ**なら、`NOTION_MILESTONE_SELECT_ORDER` に **左から 1〜4 に対応する選択肢名** をカンマ区切りで必ず書く

5. **コマンドで JSON → HTML → PNG**  

```powershell
cd weekly-dashboard
npm run notion:payload
npm run generate -- data/notion-output.json
npm run screenshot
```

または一行で:

```powershell
npm run build:weekly
```

---

## GitHub で自動化する場合

### 必要なもの

- このフォルダを **GitHub のリポジトリ** に push した状態

### 具体的な作業

1. GitHub リポジトリの **Settings → Secrets and variables → Actions** を開く  
2. **Repository secrets** に、Notion を使うなら少なくとも次を登録:  
   - `NOTION_TOKEN`  
   - `NOTION_DATABASE_ID`  
   詳細一覧: `weekly-dashboard/docs/ci-secrets.md`（README の `docs/ci-secrets.md` は、このパスを指します）

3. **Actions** タブで **「Weekly dashboard」** ワークフローを **手動実行（Run workflow）**  
4. 完了後、**Artifacts** に `index.html` / `report.png` などが付いていれば成功  

**Notion のシークレットを入れない場合:** 自動処理は **サンプル JSON** で HTML と PNG を作ります（本番データではない）。

---

## LINE に届けたい場合

### 必要なもの

- **LINE Developers** で Messaging API チャネルを作成したアカウント  
- チャネルの **Channel Access Token（長い文字列）**  
- プッシュ先の **ユーザー ID**（自分の ID を調べて設定する運用が一般的）

### 具体的な作業

1. LINE Developers でチャネルを作成し、**Messaging API を有効化**  
2. **Channel access token** を発行してコピー → GitHub Secrets の `LINE_CHANNEL_ACCESS_TOKEN` に保存  
3. 送り先のユーザー ID を控える → `LINE_TO_USER_ID` に保存  

**画像も送る場合:** LINE の仕様上、**インターネット上の HTTPS URL** から画像を取得できる必要があります。  
まだ URL が用意できない間は、**テキストだけのプッシュ**でも動きます。  
任意の Secrets: `LINE_IMAGE_ORIGINAL_URL` / `LINE_IMAGE_PREVIEW_URL`（`ci-secrets.md` 参照）

---

## まとめ（おすすめの順）

1. ローカルで `build:weekly:sample` まで通して `dist` を確認  
2. Notion を使うならインテグレーション＋`.env` → `notion:payload` / `build:weekly`  
3. 問題なければ GitHub の Secrets と Actions の手動実行  
4. LINE は必要になったらトークンとユーザー ID を追加  
