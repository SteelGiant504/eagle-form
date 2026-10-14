import { getStore } from "@netlify/blobs";
import * as XLSX from "xlsx";
import crypto from "node:crypto";

const json = (body, status) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8" },
});

function safe(a, b) {
  const x = Buffer.from(a || "");
  const y = Buffer.from(b || "");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export default async (req) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!process.env.ADMIN_PASSWORD || !safe(req.headers.get("X-Admin-Password"), process.env.ADMIN_PASSWORD)) {
    return json({ error: "管理者パスワードが正しくありません。" }, 401);
  }

  try {
    const store = getStore({ name: "eagle-responses", consistency: "strong" });
    let cursor;
    const records = [];
    do {
      const page = await store.list({ cursor });
      for (const b of page.blobs) {
        const record = await store.get(b.key, { type: "json" });
        if (record) records.push(record);
      }
      cursor = page.next_cursor;
    } while (cursor);

    records.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    const rows = [];
    for (const r of records) {
      if (r.attendance === "欠席") {
        rows.push({
          受付日時: r.submittedAt, 出欠: r.attendance, 御社名: r.company,
          代表者名: r.representative, メールアドレス: r.representativeEmail,
          参加者番号: "", 参加者名: "", 宿泊: "", ゴルフ: "",
          宿泊者数: 0, ゴルフ参加者数: 0,
        });
      } else {
        r.participants.forEach((p, i) => rows.push({
          受付日時: r.submittedAt, 出欠: r.attendance, 御社名: r.company,
          代表者名: r.representative, メールアドレス: r.representativeEmail,
          参加者番号: i + 1, 参加者名: p.name, 宿泊: p.stay, ゴルフ: p.golf,
          宿泊者数: r.totals.stay, ゴルフ参加者数: r.totals.golf,
        }));
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ メッセージ: "回答はまだありません" }]);
    ws["!cols"] = [{ wch: 24 }, { wch: 8 }, { wch: 24 }, { wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "回答一覧");
    const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(out, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=eagle-responses.xlsx",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error(e);
    return json({ error: "Excelの作成に失敗しました。" }, 500);
  }
};
