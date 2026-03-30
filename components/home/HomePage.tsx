"use client";

import Link from "next/link";
import { useState } from "react";

// ─── Replace with your Spotify show ID ──────────────────────────────────────
// Find it at: open.spotify.com/show/YOUR_SHOW_ID
const SPOTIFY_SHOW_ID = "YOUR_SHOW_ID_HERE";
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#00ff88";
const GOLD = "#ffaa00";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 64 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: 3,
            height: 22,
            background: ACCENT,
            borderRadius: 2,
            boxShadow: `0 0 12px ${ACCENT}80`,
          }}
        />
        <h2
          style={{
            margin: 0,
            fontFamily: "monospace",
            fontSize: 12,
            fontWeight: "bold",
            letterSpacing: "0.18em",
            color: "rgba(180,230,195,0.7)",
            textTransform: "uppercase",
          }}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function GameCard({
  href,
  title,
  description,
  tag,
  accentColor,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  tag: string;
  accentColor: string;
  icon: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: hover ? `${accentColor}0e` : "#0f1512",
          border: `1px solid ${hover ? accentColor + "55" : "rgba(0,255,80,0.12)"}`,
          borderRadius: 14,
          padding: "24px 24px 20px",
          cursor: "pointer",
          transition: "all 0.2s ease",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: hover
              ? `linear-gradient(to right, transparent, ${accentColor}, transparent)`
              : "transparent",
            transition: "all 0.2s ease",
          }}
        />
        <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
        <div
          style={{
            fontFamily: "Impact, 'Arial Black', sans-serif",
            fontSize: 20,
            letterSpacing: "0.04em",
            color: "#fff",
            marginBottom: 6,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(160,210,175,0.6)",
            lineHeight: 1.5,
            marginBottom: 14,
          }}
        >
          {description}
        </div>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.1em",
            color: accentColor,
            background: `${accentColor}15`,
            border: `1px solid ${accentColor}35`,
            padding: "3px 10px",
            borderRadius: 20,
          }}
        >
          {tag} ↗
        </span>
      </div>
    </Link>
  );
}

function ArticleCard({
  title,
  description,
  date,
  tag,
}: {
  title: string;
  description: string;
  date: string;
  tag: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? "rgba(0,255,80,0.04)" : "#0f1512",
        border: `1px solid ${hover ? "rgba(0,255,80,0.2)" : "rgba(0,255,80,0.08)"}`,
        borderRadius: 12,
        padding: "18px 20px",
        transition: "all 0.18s ease",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            letterSpacing: "0.12em",
            color: GOLD,
            background: "rgba(255,170,0,0.1)",
            border: "1px solid rgba(255,170,0,0.25)",
            padding: "2px 8px",
            borderRadius: 20,
          }}
        >
          {tag}
        </span>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            color: "rgba(120,180,140,0.4)",
          }}
        >
          {date}
        </span>
      </div>
      <div
        style={{
          fontWeight: 600,
          fontSize: 14,
          color: "#e8f5ec",
          marginBottom: 6,
          lineHeight: 1.4,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 12, color: "rgba(140,190,155,0.55)", lineHeight: 1.5 }}>
        {description}
      </div>
    </div>
  );
}

const ARTICLES = [
  {
    title: "2026 NFL Draft: The Slot Receivers You Need to Know",
    description: "Breaking down the top slot receiver prospects heading into the 2026 NFL Draft, from college production to route running.",
    date: "Mar 2026",
    tag: "DRAFT",
  },
  {
    title: "Route Trees Explained: Why the Slot Is the Most Valuable Position",
    description: "A deep dive into modern route concepts and why offensive coordinators are building entire systems around the slot receiver.",
    date: "Feb 2026",
    tag: "ANALYSIS",
  },
  {
    title: "PlayMap: How We Built an NFL Analytics Tool for Content Creators",
    description: "Behind the scenes on building PlayMap — visualizing every NFL play in a shareable 9:16 format for TikTok and Reels.",
    date: "Jan 2026",
    tag: "BEHIND THE SCENES",
  },
];

const SOCIAL_LINKS = [
  { platform: "Spotify", href: `https://open.spotify.com/show/${SPOTIFY_SHOW_ID}`, color: "#1DB954", label: "Listen on Spotify" },
  { platform: "YouTube", href: "https://youtube.com/@theslotpod", color: "#FF0000", label: "Watch on YouTube" },
  { platform: "Twitter/X", href: "https://twitter.com/theslotpod", color: "#1DA1F2", label: "Follow on X" },
  { platform: "Instagram", href: "https://instagram.com/theslotpod", color: "#E1306C", label: "Follow on Instagram" },
];

export default function HomePage() {
  const spotifyConfigured = SPOTIFY_SHOW_ID !== "YOUR_SHOW_ID_HERE";

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "48px 24px 80px",
      }}
    >
      {/* Hero */}
      <div style={{ marginBottom: 72, textAlign: "center" }}>
        <div
          style={{
            display: "inline-block",
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            color: ACCENT,
            background: "rgba(0,255,80,0.08)",
            border: "1px solid rgba(0,255,80,0.2)",
            padding: "5px 16px",
            borderRadius: 20,
            marginBottom: 20,
          }}
        >
          NFL PODCAST · EST. 2024
        </div>
        <h1
          style={{
            fontFamily: "Impact, 'Arial Black', sans-serif",
            fontSize: "clamp(40px, 8vw, 72px)",
            letterSpacing: "0.04em",
            margin: "0 0 16px",
            lineHeight: 1,
            color: "#fff",
          }}
        >
          THE{" "}
          <span
            style={{
              color: ACCENT,
              textShadow: `0 0 40px ${ACCENT}55, 0 0 80px ${ACCENT}22`,
            }}
          >
            SLOT
          </span>{" "}
          POD
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "rgba(160,210,175,0.65)",
            maxWidth: 480,
            margin: "0 auto 32px",
            lineHeight: 1.6,
          }}
        >
          In-depth NFL analysis, draft coverage, and football content.
          We go deep on routes, schemes, and the players that make them work.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          {SOCIAL_LINKS.map((s) => (
            <a
              key={s.platform}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              style={{
                fontFamily: "monospace",
                fontSize: 10,
                letterSpacing: "0.1em",
                color: s.color,
                background: `${s.color}12`,
                border: `1px solid ${s.color}30`,
                padding: "6px 16px",
                borderRadius: 20,
                textDecoration: "none",
                transition: "all 0.15s ease",
              }}
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>

      {/* Recent Episodes */}
      <Section title="Recent Episodes">
        {spotifyConfigured ? (
          <iframe
            src={`https://open.spotify.com/embed/show/${SPOTIFY_SHOW_ID}?utm_source=generator&theme=0`}
            width="100%"
            height="352"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            style={{
              border: "none",
              borderRadius: 14,
              background: "#0f1512",
            }}
          />
        ) : (
          <div
            style={{
              background: "#0f1512",
              border: "1px solid rgba(0,255,80,0.12)",
              borderRadius: 14,
              padding: "48px 32px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎙️</div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 13,
                color: "rgba(140,190,155,0.5)",
                marginBottom: 8,
              }}
            >
              Spotify embed goes here
            </div>
            <div style={{ fontSize: 11, color: "rgba(120,170,135,0.35)", fontFamily: "monospace" }}>
              Set SPOTIFY_SHOW_ID in components/home/HomePage.tsx
            </div>
          </div>
        )}
      </Section>

      {/* Our Games */}
      <Section title="Our Games">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          <GameCard
            href="/game"
            title="ROUTE-THAT"
            description="Draw routes, read the defense, and score. A retro football simulation game where you design the play."
            tag="PLAY NOW"
            accentColor="#22c55e"
            icon="🏈"
          />
          <GameCard
            href="/playmap"
            title="PLAYMAP"
            description="Visualize every NFL play from the 2025 season on a 9:16 canvas. Built for TikTok and Reels content."
            tag="EXPLORE"
            accentColor={ACCENT}
            icon="📡"
          />
        </div>
      </Section>

      {/* Articles */}
      <Section title="Articles & Analysis">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ARTICLES.map((a) => (
            <ArticleCard key={a.title} {...a} />
          ))}
        </div>
      </Section>

      {/* About */}
      <Section title="About The Show">
        <div
          style={{
            background: "#0f1512",
            border: "1px solid rgba(0,255,80,0.1)",
            borderRadius: 14,
            padding: "28px 28px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 24,
          }}
        >
          {[
            { num: "2025", label: "Season Covered" },
            { num: "24", label: "Draft Prospects Tracked" },
            { num: "32", label: "NFL Teams in Route-That" },
            { num: "1080p", label: "PlayMap Export Quality" },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "Impact, 'Arial Black', sans-serif",
                  fontSize: 32,
                  color: ACCENT,
                  textShadow: `0 0 20px ${ACCENT}50`,
                  letterSpacing: "0.04em",
                }}
              >
                {stat.num}
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  color: "rgba(140,190,155,0.5)",
                  marginTop: 4,
                  textTransform: "uppercase",
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
        <p
          style={{
            fontSize: 14,
            color: "rgba(150,200,165,0.55)",
            lineHeight: 1.7,
            marginTop: 20,
          }}
        >
          The Slot Pod is an NFL podcast focused on skill-position players, route concepts, and
          offensive schemes. Beyond the podcast, we build football tools — Route-That lets you
          design and run your own plays, and PlayMap visualizes every player's season in one
          shareable animation.
        </p>
      </Section>

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid rgba(0,255,80,0.08)",
          paddingTop: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: "rgba(100,160,120,0.35)",
            letterSpacing: "0.1em",
          }}
        >
          © 2026 THE SLOT POD
        </span>
        <div style={{ display: "flex", gap: 16 }}>
          {SOCIAL_LINKS.map((s) => (
            <a
              key={s.platform}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                color: "rgba(100,160,120,0.35)",
                textDecoration: "none",
                letterSpacing: "0.08em",
              }}
            >
              {s.platform.toUpperCase()}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
