import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";
const STORE = "eagle-responses";
const DEADLINE = new Date("2026-11-30T17:00:00+09:00").getTime();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate" } });
const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const normalizeName = v => clean(v).normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
const normalizeEmail = v => clean(v, 254).toLowerCase();
const equal = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

async function findRecord(store, name, email) {
  let cursor;
  do {
    const page = await store.list(cursor ? { cursor } : {});
    for (const item of page.blobs) {
      const r = await store.get(item.key, { type: "json" });
      if (r && equal(normalizeName(r.representative), name) && equal(normalizeEmail(r.representativeEmail), email)) return r;
    }
    cursor = page.next_cursor;
  } while (cursor);
  return null;
}
function publicRecord(r) { return { id: r.id, attendance: r.attendance, company: r.company, representative: r.representative, representativeEmail: r.representativeEmail, participantCount: r.participantCount, participants: r.participants || [], totals: r.totals || { stay: 0, golf: 0 }, submittedAt: r.submittedAt, updatedAt: r.updatedAt || null }; }
function normalizeUpdate(input, existing) {
  const attendance = input.attendance, company = clean(input.company), representative = clean(input.representative);
  if (!["出席", "欠席"].includes(attendance) || !company || !representative) throw new Error("入力内容を確認してください。");
  let participants = [];
  if (attendance === "出席") {
    if (!Array.isArray(input.participants) || input.participants.length < 1 || input.participants.length > 4) throw new Error("参加者は1名から4名で入力してください。");
    participants = input.participants.map(p => { const name = clean(p.name); if (!name || !["有り", "無し"].includes(p.stay) || !["有り", "無し"].includes(p.golf)) throw new Error("参加者情報を確認してください。"); return { name, stay: p.stay, golf: p.golf }; });
  }
  return { ...existing, attendance, company, representative, participantCount: participants.length, participants, totals: { stay: participants.filter(p => p.stay === "有り").length, golf: participants.filter(p => p.golf === "有り").length }, updatedAt: new Date().toISOString() };
}
export default async (req) => {
  if (Date.now() > DEADLINE && req.method !== "GET") return json({ error: "回答期限を過ぎているため変更・取消しはできません。" }, 403);
  try {
    const body = req.method === "GET" ? Object.fromEntries(new URL(req.url).searchParams) : await req.json();
    const name = normalizeName(body.representative), email = normalizeEmail(body.email);
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "代表者名またはメールアドレスが正しくありません。" }, 401);
    const store = getStore({ name: STORE, consistency: "strong" });
    const record = await findRecord(store, name, email);
    if (!record) return json({ error: "代表者名またはメールアドレスが正しくありません。" }, 401);
    if (req.method === "GET") return json({ response: publicRecord(record) });
    if (req.method === "PUT") { const updated = normalizeUpdate(body.response, record); await store.setJSON(record.id, updated); return json({ ok: true, response: publicRecord(updated) }); }
    if (req.method === "DELETE") { await store.delete(record.id); return json({ ok: true }); }
    return json({ error: "Method not allowed" }, 405);
  } catch (error) { console.error(error); return json({ error: error.message || "処理に失敗しました。" }, 500); }
};
