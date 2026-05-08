# LINE に週次レポートを送る設定（Messaging API）

このリポジトリの `npm run push:line` は、**テキスト**（週次の要約など）を送り、任意で **画像メッセージ**も送れます。  
GitHub Actions では、ワークフロー末尾の **「LINE Push if configured」** で同じ処理が走ります。

参照コード: `weekly-dashboard/src/push-line.ts`  
シークレット名一覧: `docs/ci-secrets.md`

---

## まずはこれだけ（ローカルで LINE まで一気に）

1. **LINE Developers** で Messaging API チャネルを作り、**チャネルアクセストークン**と、**自分の `LINE_TO_USER_ID`（`U` 始まり）** を用意する。ユーザー ID は **コンソールの「基本設定」に表示される**ことが多く、友だち追加や Webhook は必須ではありません（下の「手順 2・方法 0」）。
2. `weekly-dashboard/.env` に次を書く（`#` を外す）:

```env
LINE_CHANNEL_ACCESS_TOKEN=（Issue した長いトークン）
LINE_TO_USER_ID=Uxxxxxxxx...
```

3. **Notion の件数は後回し**でよいときは、サンプル JSON で HTML・PNG を作ってから LINE する:

```powershell
cd weekly-dashboard
npm run build:weekly:sample:line
```

4. **Notion 連携込み**で週次ビルドのあと LINE する:

```powershell
cd weekly-dashboard
npm run build:weekly:line
```

5. **GitHub Actions** で送るときは、**Settings → Secrets and variables → Actions** に `LINE_CHANNEL_ACCESS_TOKEN` と `LINE_TO_USER_ID` を登録する。**週次 PNG も LINE に付けたい**ときは、あわせて **`DISCORD_WEBHOOK_URL`**（推奨）または **`IMGUR_CLIENT_ID`** を登録する（下の「HTML のスクショ」参照）。

---

## 必要なもの（ざっくり）

| 名前 | 何か |
|------|------|
| **Messaging API チャネル** | LINE Developers で作る「ボット用」のチャネル |
| **`LINE_CHANNEL_ACCESS_TOKEN`** | そのチャネル用の長い文字列（チャネルアクセストークン） |
| **`LINE_TO_USER_ID`** | **送り先の LINE ユーザー ID**（あなた自身の ID を入れることが多い） |
| **`DISCORD_WEBHOOK_URL`**（任意） | **スクショを自動で付ける**とき（推奨）。Discord の Incoming Webhook の URL |
| **`IMGUR_CLIENT_ID`**（任意） | 同上を Imgur で行う（**新規 API 登録ができない**という報告が多い） |

トークンとユーザー ID の **両方が揃うまで**、スクリプトは送らずにスキップします（エラーにはなりません）。**Webhook / Imgur だけでは送信は始まらず**、LINE の2つが先に必要です。

---

## よくある取り違え: チャネルシークレット ≠ チャネルアクセストークン

LINE Developers の **「チャネルシークレット」**（短めの英数字）と、**Messaging API** タブで **Issue（発行）** する **「チャネルアクセストークン」**（長い `eyJ...` のような文字列）は **別物**です。

| 画面上の名前 | このリポジトリでの用途 |
|--------------|------------------------|
| **チャネルアクセストークン**（Issue したもの） | **`LINE_CHANNEL_ACCESS_TOKEN`** に入れる。**プッシュ送信に必須。** |
| **チャネルシークレット** | 主に **Webhook の署名検証**用。`push-line.ts` では **使いません。** |

**「Channel secret を保存した」だけ**の場合、GitHub の Secret 名は `LINE_CHANNEL_ACCESS_TOKEN` ですが、中身は **必ずアクセストークン**にしてください。シークレットをその変数に入れると **401 などで送れません。**

---

## 手順 1: LINE Developers でチャネルを作る

1. ブラウザで **https://developers.line.biz/console/** を開き、ログインする。  
2. **プロバイダー**が無ければ作成する。  
3. **チャネルを作成** → 種類は **Messaging API** を選ぶ。  
4. 作成したチャネルを開き、**Messaging API** のタブで次を確認する。  
   - **Channel access token** を **Issue**（発行）する。  
   - 表示されたトークンをコピーする → これが **`LINE_CHANNEL_ACCESS_TOKEN`**。  
   - （Webhook を使ってユーザー ID を取る場合は後述。プッシュだけなら「応答設定」で開発用にしておいてもよい。）

**注意:** トークンは **パスワードと同じ**扱い。GitHub には **Repository secrets** にだけ入れ、リポジトリのファイルに書かない。

---

## 手順 2: 自分のユーザー ID（`LINE_TO_USER_ID`）を知る

プッシュ API は **「誰に送るか」** をユーザー IDで指定します。  
**チャネルの管理者**でも、メールアドレスや「LINE ID（検索用）」とは **別の `U` 始まりの ID** が必要です。

### 方法 0（まず試す）: LINE Developers コンソールの「基本設定」

公式ドキュメントでも案内されている方法です。**友だち追加や Webhook をまだ触っていなくても**、条件が揃えばここに出ます。

1. **https://developers.line.biz/console/** を開き、対象の **Messaging API チャネル**を開く。  
2. 左メニューまたはタブから **「基本設定」**（英語 UI なら **Basic settings**）を開く。  
3. **「Your user ID」**／**あなたのユーザー ID** のような欄に、`U` で始まる文字列（例: `U8189cf6745fc0d808977bdb0b9f22995`）が表示されていれば、それを **`LINE_TO_USER_ID`** にそのままコピーする。

**表示されないとき**は、コンソールにログインしている **Business ID と、普段使っている LINE アカウントが連携していない**ことが多いです。次の公式手順で連携すると、上記のユーザー ID が表示されるようになります。

- [LINE アカウントを連携する（LINE Developers Console）](https://developers.line.biz/ja/docs/line-developers-console/login-account/#link-business-account-with-line-account)

（英語版: [Link your Business ID with your LINE account](https://developers.line.biz/en/docs/line-developers-console/login-account/#link-business-account-with-line-account)）

**補足:** 「公式アカウントの管理者」は **LINE Official Account Manager** 側の権限で、Developers の **Your user ID** とは別の話です。プッシュの `to` に必要なのは **Developers に出る `U...` 形式のユーザー ID** です。

### 方法 A: Webhook で一度だけ確認する（無料・一般的）

1. **Webhook を受け取れる URL** を用意する。  
   - 試しに **https://webhook.site** など、自分専用 URL を発行できるサービスを使うと手軽です。  
2. LINE Developers の該当チャネルで **Webhook URL** に、その URL を設定する。  
3. **Webhook の利用**をオンにする（検証に失敗する場合は、Webhook 先が 200 を返すようにする等、公式ドキュメントに従う）。  
4. スマホの LINE で **その公式アカウントを友だち追加**し、**何かメッセージを送る**。  
5. Webhook 先に届いた **JSON** の中に、`"userId": "Uxxxxxxxx..."` のような文字列があるので、それをコピーする → **`LINE_TO_USER_ID`**。

公式のイベント形式の説明: [Webhook イベントオブジェクト](https://developers.line.biz/ja/reference/messaging-api/#webhook-event-objects)

### 方法 B: すでに別の bot で ID を把握している

その ID が **同じ LINE アカウント（同じ `@` のユーザー）** に対するものなら、そのまま `LINE_TO_USER_ID` に使えます（チャネルが違うと送れない場合があるため、**この Messaging API チャネルから送る相手**として有効な ID かは公式仕様に従ってください）。

---

## 手順 3: このリポジトリに値を入れる

### ローカルで試す

1. `weekly-dashboard/.env` を開く（無ければ `.env.example` をコピーして作成）。  
2. 次を設定する（先頭の `#` を外す）:

```env
LINE_CHANNEL_ACCESS_TOKEN=（発行したトークン）
LINE_TO_USER_ID=（Webhook などで取得した U で始まる ID）
```

3. 週次用の JSON が用意できたあとで:

```powershell
cd weekly-dashboard
npm run push:line -- data/notion-output.json
```

成功すると `LINE Push が完了しました。` と表示されます。

### GitHub Actions で送る

1. リポジトリの **Settings → Secrets and variables → Actions**。  
2. **Repository secrets** に次を追加する。  
   - `LINE_CHANNEL_ACCESS_TOKEN`  
   - `LINE_TO_USER_ID`  
   - （任意・画像付き）`DISCORD_WEBHOOK_URL` … 推奨（下記「方法 1」）  
   - （任意）`IMGUR_CLIENT_ID` … Imgur が使える場合のみ  

3. **Weekly dashboard** ワークフローを実行する（手動でもスケジュールでも可）。  
   - ビルドが成功したあと、**LINE Push if configured** のステップで送信されます。

---

## HTML のスクショ（`report.png`）を LINE に送りたい場合

週次パイプでは **`dist/report.png`** にダッシュボードのキャプチャが保存されます。  
LINE の画像メッセージは **HTTPS の公開 URL** から画像を取得する仕様のため、**ローカルパスや Artifact だけ**では送れません。

### Imgur の新規 API（Client ID）について

SNS 等でも言及があるとおり、**Imgur で新しい API アプリ／Client ID を作れない・登録ページに飛ばされない**ことがあります。  
**画像を自動で付けたい場合は、下の「方法 1（Discord）」を推奨**します。

### 方法 1（推奨・自動）: Discord Webhook に投稿して URL を使う

**`LINE_IMAGE_*` が未設定**で **`DISCORD_WEBHOOK_URL`** があるとき、`npm run push:line` が **`dist/report.png` をその Webhook にファイル投稿**し、返ってきた **`attachments[0].url`（HTTPS）** で LINE に画像を付けます。

1. Discord で **自分用のサーバ**（または既存サーバ）を開き、**週次通知用のテキストチャンネル**を用意する。  
2. チャンネル設定 → **連携サービス** → **ウェブフック** → **ウェブフックを作成** → URL をコピーする（形式は `https://discord.com/api/webhooks/数字/トークン`）。  
3. **Repository secrets**（またはローカル `.env`）に **`DISCORD_WEBHOOK_URL`** として登録する。  
4. **`LINE_IMAGE_ORIGINAL_URL` / `LINE_IMAGE_PREVIEW_URL` は空**のまま（両方あると **手動 URL が最優先**）。  
5. **`IMGUR_CLIENT_ID` は未設定**にすると Discord だけが使われます（両方あると **Discord が優先**）。

**注意:** Webhook の URL を知っている人はそのチャンネルに投稿できます。**URL は Secret にだけ入れ、共有しない。** 週次の PNG はそのチャンネルにも1件流れます（履歴に残る）。

**任意:** 画像パスは **`LINE_REPORT_PNG_PATH`** で変更可。未指定は `dist/report.png`。

### 方法 2（自動・補助）: Imgur（Client ID が取れる場合のみ）

**`DISCORD_WEBHOOK_URL` が無く** **`IMGUR_CLIENT_ID` だけ**あるとき、従来どおり Imgur 匿名 API にアップロードします。登録ができない場合は **方法 1** を使ってください。

### 方法 3（手動）: 自分で HTTPS URL を用意する

**`LINE_IMAGE_ORIGINAL_URL` と `LINE_IMAGE_PREVIEW_URL` の両方**を入れているときは **最優先**で、その URL で画像を送ります。

**まとめ:** 自動で付けるなら **`DISCORD_WEBHOOK_URL`**（推奨）。Imgur が使えるなら **`IMGUR_CLIENT_ID`**。固定 URL なら **`LINE_IMAGE_*` の2つ**。

---

## うまくいかないとき

| 症状 | 確認すること |
|------|----------------|
| GitHub では送られない | Secrets の名前が **`LINE_CHANNEL_ACCESS_TOKEN` / `LINE_TO_USER_ID`** と完全一致しているか（大文字小文字含む）。 |
| `HTTP 401` など | **チャネルシークレット**を **`LINE_CHANNEL_ACCESS_TOKEN`** に入れていないか。Messaging API で **Issue したアクセストークン**に差し替える。 |
| `HTTP 400` と `Invalid userId` など | `LINE_TO_USER_ID` がこのボットの友だち／対象として有効か。ブロックしていないか。 |
| ローカルでは動くが CI では送られない | リポジトリの Secrets が **fork 先では使えない**等、リポジトリの権限・場所が正しいか。 |
| 画像だけ失敗（Discord） | `DISCORD_WEBHOOK_URL` が `https://discord.com/api/webhooks/...` 形式か。Webhook が削除されていないか。 |
| Imgur で Client ID が取れない | 報告どおり **新規登録できない**ことがある。**`DISCORD_WEBHOOK_URL`** に切り替える。 |

---

## セキュリティ

- チャネルアクセストークンを知られた人は **あなたの公式アカウントとしてメッセージを送れる**可能性があります。  
- ユーザー ID も組み合わさると悪用のリスクが上がるため、**Secrets のみ**で管理し、チャットや issue に貼らない。
