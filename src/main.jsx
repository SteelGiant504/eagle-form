import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const RESPONSE_DEADLINE = "2026-11-30T17:00:00+09:00";
const SUBMIT_API_URL = "/.netlify/functions/submit";
const CHANGE_PAGE_URL = "/change.html";
const ADMIN_PAGE_URL = "/admin.html";

const createBlankParticipant = () => ({
  name: "",
  stay: "",
  golf: "",
});

function ChoiceButtons({ value, onChange }) {
  return (
    <div className="choices">
      {["有り", "無し"].map((option) => (
        <button
          key={option}
          type="button"
          className={value === option ? "selected" : ""}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function App() {
  const [attendance, setAttendance] = useState("");
  const [company, setCompany] = useState("");
  const [representative, setRepresentative] = useState("");
  const [email, setEmail] = useState("");
  const [participantCount, setParticipantCount] = useState(1);
  const [participants, setParticipants] = useState(
    Array.from({ length: 4 }, createBlankParticipant)
  );
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  // タイトルを短時間に5回クリックすると管理画面へ移動します。
  const adminClickCount = useRef(0);
  const adminClickTimer = useRef(null);

  const deadline = new Date(RESPONSE_DEADLINE);
  const isClosed = Date.now() > deadline.getTime();
  const visibleParticipants = participants.slice(0, participantCount);

  const totals = useMemo(
    () => ({
      stay:
        attendance === "出席"
          ? visibleParticipants.filter((person) => person.stay === "有り").length
          : 0,
      golf:
        attendance === "出席"
          ? visibleParticipants.filter((person) => person.golf === "有り").length
          : 0,
    }),
    [attendance, visibleParticipants]
  );

  const updateParticipant = (index, key, value) => {
    setParticipants((current) =>
      current.map((person, personIndex) =>
        personIndex === index ? { ...person, [key]: value } : person
      )
    );
  };

  const handleSecretAdminAccess = () => {
    adminClickCount.current += 1;
    window.clearTimeout(adminClickTimer.current);

    if (adminClickCount.current >= 5) {
      adminClickCount.current = 0;
      window.location.href = ADMIN_PAGE_URL;
      return;
    }

    adminClickTimer.current = window.setTimeout(() => {
      adminClickCount.current = 0;
    }, 2500);
  };

  const validate = () => {
    if (!attendance || !company.trim() || !representative.trim() || !email.trim()) {
      return "必須項目をすべて入力してください。";
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      return "メールアドレスを正しく入力してください。";
    }

    if (attendance === "出席") {
      const incomplete = visibleParticipants.some(
        (person) => !person.name.trim() || !person.stay || !person.golf
      );

      if (incomplete) {
        return "表示されている参加者情報をすべて入力してください。";
      }
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (isClosed) {
      setError(
        "回答期限を過ぎているため送信できません。事務局へお問い合わせください。"
      );
      return;
    }

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setStatus("sending");

    const payload = {
      attendance,
      company: company.trim(),
      representative: representative.trim(),
      representativeEmail: email.trim().toLowerCase(),
      participantCount: attendance === "出席" ? participantCount : 0,
      participants: attendance === "出席" ? visibleParticipants : [],
      totals: attendance === "出席" ? totals : { stay: 0, golf: 0 },
    };

    try {
      const response = await fetch(SUBMIT_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let responseData = {};
      try {
        responseData = await response.json();
      } catch {
        // JSON以外のエラーでも既定メッセージを表示します。
      }

      if (!response.ok) {
        throw new Error(
          responseData.error || "送信できませんでした。時間をおいて再度お試しください。"
        );
      }

      setStatus("success");
    } catch (submitError) {
      setStatus("idle");
      setError(
        submitError.message ||
          "送信できませんでした。時間をおいて再度お試しください。"
      );
    }
  };

  if (status === "success") {
    return (
      <main className="success-page">
        <section className="card thanks">
          <div className="check" aria-hidden="true">
            ✓
          </div>
          <h1>ご回答ありがとうございました</h1>
          <p>内容を受け付けました。</p>

          <div className="summary">
            <p>
              <strong>出欠：</strong>
              {attendance}
            </p>
            {attendance === "出席" && (
              <>
                <p>
                  <strong>ご人数：</strong>
                  {participantCount}名
                </p>
                <p>
                  <strong>宿泊：</strong>
                  {totals.stay}名
                </p>
                <p>
                  <strong>ゴルフ：</strong>
                  {totals.golf}名
                </p>
              </>
            )}
          </div>

          <a className="change-link" href={CHANGE_PAGE_URL}>
            変更・お取消しはこちら
          </a>
        </section>
      </main>
    );
  }

  return (
    <>
      <header>
        <div className="flag" aria-hidden="true">
          ⚑
        </div>
        <small>EAGLE MEETING</small>
        <h1
          className="secret-title"
          onClick={handleSecretAdminAccess}
          title="イーグル会出欠回答フォーム"
        >
          イーグル会出欠回答フォーム
        </h1>
        <p>回答期限：2026年11月30日（月）17:00</p>
      </header>

      <main>
        {isClosed ? (
          <section className="card thanks">
            <h2>回答受付は終了しました</h2>
            <p>変更やお問い合わせは事務局へご連絡ください。</p>
            <a className="change-link" href={CHANGE_PAGE_URL}>
              登録内容の確認はこちら
            </a>
          </section>
        ) : (
          <form className="card" onSubmit={handleSubmit} noValidate>
            <h2>基本情報</h2>

            <label>
              出欠 <em>*</em>
            </label>
            <div className="choices">
              {["出席", "欠席"].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={attendance === option ? "selected" : ""}
                  onClick={() => setAttendance(option)}
                  aria-pressed={attendance === option}
                >
                  {option}
                </button>
              ))}
            </div>

            <label htmlFor="company">
              御社名 <em>*</em>
            </label>
            <input
              id="company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="例：株式会社〇〇"
              autoComplete="organization"
            />

            <label htmlFor="representative">
              代表者名 <em>*</em>
            </label>
            <input
              id="representative"
              value={representative}
              onChange={(event) => setRepresentative(event.target.value)}
              placeholder="例：山田 太郎"
              autoComplete="name"
            />

            <label htmlFor="representativeEmail">
              代表者メールアドレス <em>*</em>
            </label>
            <input
              id="representativeEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@company.co.jp"
              autoComplete="email"
              inputMode="email"
            />
            <p className="field-note">
              同じメールアドレスで複数の回答は登録できません。
            </p>

            {attendance === "出席" && (
              <section className="participant-section">
                <h2>参加者情報</h2>

                <label htmlFor="participantCount">
                  ご人数 <em>*</em>
                </label>
                <select
                  id="participantCount"
                  value={participantCount}
                  onChange={(event) =>
                    setParticipantCount(Number(event.target.value))
                  }
                >
                  {[1, 2, 3, 4].map((number) => (
                    <option key={number} value={number}>
                      {number}名
                    </option>
                  ))}
                </select>

                <div className="participant-list">
                  {visibleParticipants.map((person, index) => (
                    <div className="person" key={index}>
                      <h3>参加者 {index + 1}</h3>

                      <label htmlFor={`participant-${index}`}>
                        参加者名 <em>*</em>
                      </label>
                      <input
                        id={`participant-${index}`}
                        value={person.name}
                        onChange={(event) =>
                          updateParticipant(index, "name", event.target.value)
                        }
                        placeholder="氏名を入力"
                      />

                      <div className="twocol">
                        <div>
                          <label>
                            宿泊 <em>*</em>
                          </label>
                          <ChoiceButtons
                            value={person.stay}
                            onChange={(value) =>
                              updateParticipant(index, "stay", value)
                            }
                          />
                        </div>

                        <div>
                          <label>
                            ゴルフ <em>*</em>
                          </label>
                          <ChoiceButtons
                            value={person.golf}
                            onChange={(value) =>
                              updateParticipant(index, "golf", value)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="totals">
                  <div>
                    宿泊者数
                    <strong>{totals.stay}名</strong>
                  </div>
                  <div>
                    ゴルフ参加者数
                    <strong>{totals.golf}名</strong>
                  </div>
                </div>
              </section>
            )}

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <button
              className="submit"
              type="submit"
              disabled={status === "sending"}
            >
              {status === "sending" ? "送信しています…" : "回答を送信"}
            </button>

            <a className="change-link" href={CHANGE_PAGE_URL}>
              変更・お取消しはこちら
            </a>
          </form>
        )}
      </main>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
