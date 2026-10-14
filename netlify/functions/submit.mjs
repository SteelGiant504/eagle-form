import { getStore } from "@netlify/blobs";

const DEADLINE = new Date("2026-11-30T17:00:00+09:00").getTime();
const STORE = "eagle-responses";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const text = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const emailKey = (v) => text(v, 254).toLowerCase();

async function emailExists(store, email) {
  let cursor;
  do {
    const page = await store.list(cursor ? { cursor } : {});
    for (const item of page.blobs) {
      const record = await store.get(item.key, { type: "json" });
      if (record && emailKey(record.representativeEmail) === email) return true;
    }
    cursor = page.next_cursor;
  } while (cursor);
  return false;
}

function normalize(input) {
  const attendance = input.attendance;
  const company = text(input.company);
  const representative = text(input.representative);
  const representativeEmail = emailKey(input.representativeEmail);
  if (!["出席", "欠席"].includes(attendance) || !company || !representative || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(representativeEmail)) throw new Error("入力内容を確認してください。");
  let participants = [];
  if (attendance === "出席") {
    if (!Array.isArray(input.participants) || input.participants.length < 1 || input.participants.length > 4) throw new Error("参加者は1名から4名で入力してください。");
    participants = input.participants.map((p) => {
      const name = text(p.name);
      if (!name || !["有り", "無し"].includes(p.stay) || !["有り", "無し"].includes(p.golf)) throw new Error("参加者情報を確認してください。");
      return { name, stay: p.stay, golf: p.golf };
    });
  }
  return { attendance, company, representative, representativeEmail, participantCount: participants.length, participants, totals: { stay: participants.filter(p => p.stay === "有り").length, golf: participants.filter(p => p.golf === "有り").length } };
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (Date.now() > DEADLINE) return json({ error: "回答期限を過ぎています。" }, 403);
  try {
    const data = normalize(await req.json());
    const store = getStore({ name: STORE, consistency: "strong" });
    if (await emailExists(store, data.representativeEmail)) return json({ error: "このメールアドレスはすでに登録されています。『変更・お取消しはこちら』から内容をご確認ください。" }, 409);
    const record = { id: crypto.randomUUID(), ...data, submittedAt: new Date().toISOString(), updatedAt: null };
    await store.setJSON(record.id, record);
    return json({ ok: true, id: record.id }, 201);
  } catch (error) {
    console.error(error);
    return json({ error: error.message || "送信に失敗しました。" }, 400);
  }
};
