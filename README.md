# イーグル会出欠回答フォーム（Netlify版）

## 機能
- 出欠による条件分岐、1〜4名の参加者欄
- 宿泊・ゴルフ人数のリアルタイム集計
- 日本時間の回答期限判定（画面・サーバー双方）
- Netlify Blobsへの回答保存
- Resendによる回答完了メール
- 管理者パスワード付きExcel（.xlsx）ダウンロード
- スマートフォン対応

## Netlify公開手順
1. このフォルダーをGitHub等のリポジトリへ登録します。
2. Netlifyで **Add new project → Import an existing project** を選択し、リポジトリを接続します。
3. Build commandは `npm run build`、Publish directoryは `dist` です（netlify.toml設定済み）。
4. Netlifyの **Project configuration → Environment variables** に次を登録します。
   - `ADMIN_PASSWORD`: Excelダウンロード用の強いパスワード
   - `RESEND_API_KEY`: Resendで発行したAPIキー
   - `MAIL_FROM`: 認証済みドメインの差出人（例 `イーグル会 <info@example.jp>`）
5. Deployを実行します。
6. フォームは `/`、Excel出力画面は `/admin.html` です。

## 期限の変更
次の2ファイル内の日付を同じ値に変更してください。
- `src/main.jsx` の `DEADLINE`
- `netlify/functions/submit.mjs` の `DEADLINE`

## ローカル確認
```bash
npm install
npm run dev
```

`.env`（Gitに登録しない）例：
```env
ADMIN_PASSWORD=十分に長いパスワード
RESEND_API_KEY=re_xxxxxxxxx
MAIL_FROM=イーグル会 <info@example.jp>
```

## セキュリティ上の注意
- 回答には個人情報が含まれます。Netlifyアカウントの多要素認証、強い管理者パスワード、アクセス権管理を行ってください。
- 管理者パスワードやAPIキーをソースコードへ直接書かないでください。
- 本格運用前に、会社の情報セキュリティ規程上、Netlify・Resendへの個人情報保存と送信が許可されるか確認してください。
