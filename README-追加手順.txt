追加・上書きするファイル
1. netlify/functions/submit.mjs（上書き）
2. netlify/functions/guest-response.mjs（新規）
3. public/change.html（新規）

ゲスト画面には、送信ボタンの下などに次のリンクを追加してください。
<a className="change-link" href="/change.html">変更・お取消しはこちら</a>

src/style.cssには必要に応じて次を追加してください。
.change-link{display:block;text-align:center;margin:18px auto 0;color:#475569;font-weight:700}

同梱のmain.jsx差分例.txtも参照してください。
