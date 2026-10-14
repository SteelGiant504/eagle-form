import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const STORE_NAME = "eagle-responses";
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

function secureEqual(received, expected) {
  const a = Buffer.from(received || "");
  const b = Buffer.from(expected || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authorized(req) {
  return Boolean(process.env.ADMIN_PASSWORD) &&
    secureEqual(req.headers.get("X-Admin-Password"), process.env.ADMIN_PASSWORD);
}

function cleanText(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function validateAndNormalize(input, existing = {}) {
  const attendance = input.attendance;
  if (!["出席", "欠席"].includes(attendance)) throw new Error("出欠を確認してください。");

  const company = cleanText(input.company);
  const representative = cleanText(input.representative);
  const representativeEmail = cleanText(input.representativeEmail, 254);
  if (!company || !representative || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(representativeEmail)) {
    throw new Error("会社名、代表者名、メールアドレスを確認してください。");
  }

  let participants = [];
  if (attendance === "出席") {
    if (!Array.isArray(input.participants) || input.participants.length < 1 || input.participants.length > 4) {
      throw new Error("参加者は1名から4名で登録してください。");
    }
    participants = input.participants.map((p) => {
      const name = cleanText(p.name);
      const stay = p.stay;
      const golf = p.golf;
      if (!name || !["有り", "無し"].includes(stay) || !["有り", "無し"].includes(golf)) {
        throw new Error("参加者名、宿泊、ゴルフを確認してください。");
      }
      return { name, stay, golf };
    });
  }

  return {
    ...existing,
    id: existing.id,
    attendance,
    company,
    representative,
    representativeEmail,
    participantCount: participants.length,
    participants,
    totals: {
      stay: participants.filter((p) => p.stay === "有り").length,
      golf: participants.filter((p) => p.golf === "有り").length,
    },
    submittedAt: existing.submittedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function listAll(store) {
  const records = [];
  let cursor;
  do {
    const page = await store.list(cursor ? { cursor } : {});
    for (const item of page.blobs) {
      const record = await store.get(item.key, { type: "json" });
      if (record) records.push(record);
    }
    cursor = page.next_cursor;
  } while (cursor);
  return records.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
}

export default async (req) => {
  if (!authorized(req)) return reply({ error: "管理者パスワードが正しくありません。" }, 401);
  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  try {
    if (req.method === "GET") {
      return reply({ responses: await listAll(store) });
    }

    if (req.method === "PUT") {
      const input = await req.json();
      const id = cleanText(input.id, 100);
      if (!id) return reply({ error: "回答IDがありません。" }, 400);
      const existing = await store.get(id, { type: "json" });
      if (!existing) return reply({ error: "対象の回答が見つかりません。" }, 404);
      const updated = validateAndNormalize(input, existing);
      await store.setJSON(id, updated);
      return reply({ ok: true, response: updated });
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const id = cleanText(url.searchParams.get("id"), 100);
      if (!id) return reply({ error: "回答IDがありません。" }, 400);
      const existing = await store.get(id, { type: "json" });
      if (!existing) return reply({ error: "対象の回答が見つかりません。" }, 404);
      await store.delete(id);
      return reply({ ok: true });
    }

    return reply({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error(error);
    return reply({ error: error.message || "管理処理に失敗しました。" }, 500);
  }
};
