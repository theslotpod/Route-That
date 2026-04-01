"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// Simple UUID for session persistence
function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let sid = sessionStorage.getItem("bill_session");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("bill_session", sid);
  }
  return sid;
}

type MessageRole = "user" | "bill";
interface Message {
  id: string;
  role: MessageRole;
  text: string;
}

const STARTERS = [
  "Who is the best QB right now?",
  "What are the biggest storylines this offseason?",
  "Break down the top WR corps in the league",
  "Who should I pick up on waivers this week?",
];

export default function BillPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bill",
      text: "Yo. I'm BILL — your NFL insider. Ask me anything: stats, picks, fantasy advice, history, you name it. What do you got?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionId = useRef<string>("");

  useEffect(() => {
    sessionId.current = getSessionId();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, session_id: sessionId.current }),
      });
      const data = await res.json();
      const parts: string[] = data.messages ?? ["..."];

      // Add each part as a separate bubble with a small stagger
      for (let i = 0; i < parts.length; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 0 : 350));
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "bill", text: parts[i] },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "bill", text: "Connection dropped. Try again." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 60px)",
        background: "#060e1c",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient background glow */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,43,43,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid rgba(212,43,43,0.15)",
          background: "linear-gradient(to bottom, #0a1628, #070e1b)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 14,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Football icon */}
        <svg width={36} height={26} viewBox="0 0 36 26" style={{ flexShrink: 0 }}>
          <ellipse cx={18} cy={13} rx={16} ry={11} fill="#0b1e3d" stroke="rgba(212,43,43,0.6)" strokeWidth={1.5} />
          <line x1={18} y1={3} x2={18} y2={23} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
          {[7, 10, 13, 16, 19].map((y) => (
            <line key={y} x1={15} y1={y} x2={21} y2={y} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
          ))}
        </svg>
        <div>
          <div
            style={{
              fontFamily: "Impact, 'Arial Black', sans-serif",
              fontSize: 18,
              letterSpacing: "0.08em",
              color: "#fff",
            }}
          >
            ASK{" "}
            <span style={{ color: "#d42b2b", textShadow: "0 0 10px rgba(212,43,43,0.5)" }}>
              BILL
            </span>
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 9,
              letterSpacing: "0.18em",
              color: "rgba(180,200,230,0.4)",
              textTransform: "uppercase",
            }}
          >
            NFL AI · POWERED BY CLAUDE
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "78%",
                padding: "10px 14px",
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background:
                  msg.role === "user"
                    ? "linear-gradient(135deg, #d42b2b, #a01f1f)"
                    : "rgba(255,255,255,0.06)",
                border:
                  msg.role === "bill"
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "none",
                fontFamily: "'Segoe UI', system-ui, sans-serif",
                fontSize: 14,
                lineHeight: 1.55,
                color: msg.role === "user" ? "#fff" : "rgba(220,235,255,0.9)",
                boxShadow:
                  msg.role === "user"
                    ? "0 2px 12px rgba(212,43,43,0.3)"
                    : "0 2px 8px rgba(0,0,0,0.3)",
              }}
              dangerouslySetInnerHTML={{
                __html: msg.text
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  // Re-allow only the safe HTML tags BILL uses
                  .replace(/&lt;b&gt;/g, "<b>")
                  .replace(/&lt;\/b&gt;/g, "</b>")
                  .replace(/&lt;i&gt;/g, "<i>")
                  .replace(/&lt;\/i&gt;/g, "</i>"),
              }}
            />
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "12px 18px",
                borderRadius: "18px 18px 18px 4px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                gap: 5,
                alignItems: "center",
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "rgba(212,43,43,0.7)",
                    animation: "bill-dot 1.2s ease-in-out infinite",
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Starter prompts — only show before first user message */}
      {messages.length === 1 && (
        <div
          style={{
            padding: "0 16px 12px",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
          }}
        >
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              style={{
                background: "rgba(212,43,43,0.1)",
                border: "1px solid rgba(212,43,43,0.3)",
                color: "rgba(220,235,255,0.8)",
                borderRadius: 20,
                padding: "6px 14px",
                fontSize: 12,
                fontFamily: "monospace",
                letterSpacing: "0.04em",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.background = "rgba(212,43,43,0.2)";
                (e.target as HTMLButtonElement).style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.background = "rgba(212,43,43,0.1)";
                (e.target as HTMLButtonElement).style.color = "rgba(220,235,255,0.8)";
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div
        style={{
          padding: "12px 16px 16px",
          borderTop: "1px solid rgba(212,43,43,0.12)",
          background: "rgba(6,14,28,0.95)",
          backdropFilter: "blur(8px)",
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          position: "relative",
          zIndex: 1,
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask BILL anything about the NFL..."
          rows={1}
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(212,43,43,0.25)",
            borderRadius: 12,
            color: "#fff",
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            fontSize: 14,
            padding: "10px 14px",
            outline: "none",
            resize: "none",
            maxHeight: 120,
            overflowY: "auto",
            lineHeight: 1.5,
          }}
          onInput={(e) => {
            const t = e.target as HTMLTextAreaElement;
            t.style.height = "auto";
            t.style.height = Math.min(t.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: loading || !input.trim()
              ? "rgba(212,43,43,0.2)"
              : "linear-gradient(135deg, #d42b2b, #a01f1f)",
            border: "none",
            cursor: loading || !input.trim() ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.15s",
            boxShadow: loading || !input.trim() ? "none" : "0 2px 12px rgba(212,43,43,0.4)",
          }}
          aria-label="Send"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <path
              d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
              stroke={loading || !input.trim() ? "rgba(255,255,255,0.3)" : "#fff"}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes bill-dot {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1.2); }
        }
        textarea::placeholder { color: rgba(180,200,230,0.3); }
        textarea:focus { border-color: rgba(212,43,43,0.5) !important; box-shadow: 0 0 0 2px rgba(212,43,43,0.1); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(212,43,43,0.3); border-radius: 2px; }
      `}</style>
    </div>
  );
}
