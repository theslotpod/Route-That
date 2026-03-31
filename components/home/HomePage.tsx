"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// ─── Replace with your Spotify show ID ──────────────────────────────────────
// Find it at: open.spotify.com/show/YOUR_SHOW_ID
const SPOTIFY_SHOW_ID = "1U06y0bbSTJgq9Hc5eXyys";
// ─────────────────────────────────────────────────────────────────────────────

const RED   = "#d42b2b";
const WHITE = "#ffffff";

/* ─── Reusable section header ──────────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 72 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
        {/* Red slash accent */}
        <div style={{ display: "flex", gap: 3 }}>
          <div style={{ width: 3, height: 20, background: RED, borderRadius: 2, opacity: 0.9 }} />
          <div style={{ width: 3, height: 20, background: RED, borderRadius: 2, opacity: 0.4 }} />
        </div>
        <h2
          style={{
            margin: 0,
            fontFamily: "Impact, 'Arial Black', sans-serif",
            fontSize: 13,
            fontWeight: "normal",
            letterSpacing: "0.2em",
            color: "rgba(200,215,240,0.7)",
            textTransform: "uppercase",
          }}
        >
          {title}
        </h2>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
      </div>
      {children}
    </section>
  );
}

/* ─── Game cards ────────────────────────────────────────────────────────────── */
function GameCard({
  href, title, description, tag, icon, accent,
}: {
  href: string; title: string; description: string; tag: string; icon: string; accent: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: hover ? `linear-gradient(135deg, ${accent}12 0%, #0b1628 100%)` : "#0b1628",
          border: `1px solid ${hover ? accent + "50" : "rgba(255,255,255,0.07)"}`,
          borderRadius: 14,
          padding: "28px 24px 22px",
          cursor: "pointer",
          transition: "all 0.2s ease",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top color strip */}
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            height: 3,
            background: hover
              ? `linear-gradient(to right, transparent, ${accent}, transparent)`
              : `linear-gradient(to right, transparent, ${accent}30, transparent)`,
            transition: "all 0.2s ease",
          }}
        />
        <div style={{ fontSize: 30, marginBottom: 14 }}>{icon}</div>
        <div
          style={{
            fontFamily: "Impact, 'Arial Black', sans-serif",
            fontSize: 22,
            letterSpacing: "0.04em",
            color: WHITE,
            marginBottom: 8,
            textShadow: hover ? `0 0 20px ${accent}40` : "none",
            transition: "all 0.2s ease",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(170,195,230,0.6)",
            lineHeight: 1.6,
            marginBottom: 18,
          }}
        >
          {description}
        </div>
        <span
          style={{
            fontFamily: "Impact, 'Arial Black', sans-serif",
            fontSize: 10,
            letterSpacing: "0.14em",
            color: accent,
            background: `${accent}15`,
            border: `1px solid ${accent}35`,
            padding: "4px 12px",
            borderRadius: 4,
          }}
        >
          {tag} →
        </span>
      </div>
    </Link>
  );
}

/* ─── Article card ──────────────────────────────────────────────────────────── */
function ArticleCard({
  title, description, date, tag,
}: {
  title: string; description: string; date: string; tag: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? "rgba(212,43,43,0.05)" : "#0b1628",
        border: `1px solid ${hover ? "rgba(212,43,43,0.25)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 10,
        padding: "18px 22px",
        transition: "all 0.18s ease",
        cursor: "pointer",
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: "0 18px",
        alignItems: "start",
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          width: 3,
          height: "100%",
          minHeight: 48,
          background: hover ? RED : "rgba(212,43,43,0.3)",
          borderRadius: 2,
          transition: "all 0.18s ease",
          marginTop: 2,
        }}
      />
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
          <span
            style={{
              fontFamily: "Impact, 'Arial Black', sans-serif",
              fontSize: 9,
              letterSpacing: "0.14em",
              color: RED,
              background: "rgba(212,43,43,0.1)",
              border: "1px solid rgba(212,43,43,0.25)",
              padding: "2px 8px",
              borderRadius: 3,
            }}
          >
            {tag}
          </span>
          <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(140,165,205,0.4)" }}>
            {date}
          </span>
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#eef2f8", lineHeight: 1.4, marginBottom: 5 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: "rgba(160,185,225,0.5)", lineHeight: 1.55 }}>
          {description}
        </div>
      </div>
    </div>
  );
}

/* ─── Social link button ────────────────────────────────────────────────────── */
function SocialBtn({
  href, label, color,
}: {
  href: string; label: string; color: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: "Impact, 'Arial Black', sans-serif",
        fontSize: 10,
        letterSpacing: "0.12em",
        color: hover ? WHITE : color,
        background: hover ? color : `${color}15`,
        border: `1px solid ${hover ? color : color + "35"}`,
        padding: "7px 18px",
        borderRadius: 5,
        textDecoration: "none",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </a>
  );
}

/* ─── Data ───────────────────────────────────────────────────────────────────── */
const ARTICLES = [
  {
    title: "2026 NFL Draft: The Slot Receivers You Need to Know",
    description: "Breaking down the top slot receiver prospects heading into the 2026 NFL Draft — college production, route running, and NFL fit.",
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
    title: "PlayMap: Building an NFL Analytics Tool for Content Creators",
    description: "Behind the scenes on PlayMap — visualizing every NFL play in a shareable 9:16 format for TikTok and Reels.",
    date: "Jan 2026",
    tag: "BEHIND THE SCENES",
  },
];

const SOCIAL_LINKS = [
  { platform: "Spotify",    href: `https://open.spotify.com/show/${SPOTIFY_SHOW_ID}`, color: "#1DB954", label: "SPOTIFY" },
  { platform: "YouTube",    href: "https://www.youtube.com/@TheSlotPodcast1219",       color: "#FF0000", label: "YOUTUBE" },
  { platform: "Twitter/X",  href: "https://x.com/TheSlot_Pod",                        color: "#1DA1F2", label: "X / TWITTER" },
  { platform: "Instagram",  href: "https://instagram.com/theslotpod",                 color: "#E1306C", label: "INSTAGRAM" },
];

const STATS = [
  { num: "2025",  label: "NFL Season" },
  { num: "24",    label: "Draft Prospects" },
  { num: "32",    label: "NFL Teams" },
  { num: "1080p", label: "PlayMap Export" },
];

/* ─── Main component ────────────────────────────────────────────────────────── */
export default function HomePage() {
  const spotifyConfigured = true;

  return (
    <div style={{ minHeight: "100vh" }}>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid rgba(212,43,43,0.2)",
          padding: "80px 24px 72px",
          textAlign: "center",
          background: "#05090f",
        }}
      >
        {/* ── Stadium atmosphere layers ── */}

        {/* Base deep navy field */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #060c1a 0%, #04080f 60%, #050d0a 100%)", pointerEvents: "none" }} />

        {/* Left red stadium floodlight — matches logo photo */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at -5% 10%, rgba(200,30,20,0.55) 0%, rgba(160,20,10,0.25) 18%, transparent 45%)",
        }} />

        {/* Right white/blue twin stadium lights — matches logo photo */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at 105% 0%, rgba(220,235,255,0.18) 0%, rgba(140,180,255,0.1) 15%, transparent 38%)",
        }} />
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at 92% 8%, rgba(180,210,255,0.12) 0%, transparent 25%)",
        }} />

        {/* Turf horizon glow at bottom — green field like in logo */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 130%, rgba(10,60,25,0.55) 0%, rgba(8,45,18,0.3) 20%, transparent 45%)",
        }} />

        {/* Center vignette to focus attention on logo */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 38%, transparent 20%, rgba(4,8,15,0.45) 70%)",
        }} />

        {/* Subtle yard-line horizontal streaks */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 120, pointerEvents: "none",
          background: "linear-gradient(to top, rgba(10,55,20,0.18) 0%, transparent 100%)",
        }} />

        {/* ── Content ── */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto" }}>

          {/* Football logo — the visual anchor */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 0 }}>
            <Image
              src="/logo.png"
              alt="The Slot Pod"
              width={300}
              height={210}
              style={{
                objectFit: "contain",
                filter: [
                  "drop-shadow(0 0 40px rgba(212,43,43,0.5))",
                  "drop-shadow(0 0 80px rgba(212,43,43,0.2))",
                  "drop-shadow(0 12px 48px rgba(0,0,0,0.9))",
                ].join(" "),
              }}
              priority
            />
          </div>

          {/* "POD" — completes THE SLOT → THE SLOT POD */}
          <div
            style={{
              fontFamily: "Impact, 'Arial Black', sans-serif",
              fontSize: "clamp(38px, 8vw, 68px)",
              letterSpacing: "0.18em",
              color: "#ffffff",
              lineHeight: 1,
              marginBottom: 10,
              textShadow: "0 2px 30px rgba(0,0,0,0.9), 0 0 60px rgba(212,43,43,0.15)",
            }}
          >
            POD
          </div>

          {/* NFL PODCAST badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "Impact, 'Arial Black', sans-serif",
              fontSize: 11,
              letterSpacing: "0.26em",
              color: "rgba(200,215,240,0.6)",
              marginBottom: 28,
            }}
          >
            <div style={{ width: 28, height: 1, background: "rgba(212,43,43,0.5)" }} />
            NFL PODCAST · EST. 2024
            <div style={{ width: 28, height: 1, background: "rgba(212,43,43,0.5)" }} />
          </div>

          {/* Tagline */}
          <p
            style={{
              fontSize: 15,
              color: "rgba(170,195,235,0.55)",
              maxWidth: 440,
              margin: "0 auto 36px",
              lineHeight: 1.75,
            }}
          >
            In-depth NFL analysis, draft coverage, and football content.
            We go deep on routes, schemes, and the players that make them work.
          </p>

          {/* Social links */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            {SOCIAL_LINKS.map((s) => (
              <SocialBtn key={s.platform} href={s.href} label={s.label} color={s.color} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px 80px" }}>

        {/* Recent Episodes */}
        <Section title="Recent Episodes">
          {spotifyConfigured ? (
            <iframe
              src={`https://open.spotify.com/embed/show/${SPOTIFY_SHOW_ID}?utm_source=generator&theme=0`}
              width="100%"
              height="352"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              style={{ border: "none", borderRadius: 12, background: "#0b1628" }}
            />
          ) : (
            <div
              style={{
                background: "#0b1628",
                border: "1px solid rgba(212,43,43,0.15)",
                borderRadius: 12,
                padding: "52px 32px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 14 }}>🎙️</div>
              <div style={{ fontFamily: "Impact, 'Arial Black', sans-serif", fontSize: 14, letterSpacing: "0.15em", color: "rgba(200,215,240,0.5)", marginBottom: 8 }}>
                SPOTIFY EMBED
              </div>
              <div style={{ fontSize: 11, color: "rgba(140,165,205,0.3)", fontFamily: "monospace" }}>
                Set SPOTIFY_SHOW_ID in components/home/HomePage.tsx
              </div>
            </div>
          )}
        </Section>

        {/* Our Games */}
        <Section title="Our Games">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <GameCard
              href="/game"
              title="ROUTE-THAT"
              description="Draw routes, read the defense, and score. Design your own plays against real NFL teams and rosters."
              tag="PLAY NOW"
              accent={RED}
              icon="🏈"
            />
            <GameCard
              href="/playmap"
              title="PLAYMAP"
              description="Every NFL play from the 2025 season visualized on a 9:16 canvas. Built for TikTok and Reels content."
              tag="EXPLORE"
              accent="#3b82f6"
              icon="📡"
            />
          </div>
        </Section>

        {/* Articles */}
        <Section title="Articles & Analysis">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ARTICLES.map((a) => (
              <ArticleCard key={a.title} {...a} />
            ))}
          </div>
        </Section>

        {/* Stats + About */}
        <Section title="About The Show">
          {/* Stat strip */}
          <div
            style={{
              background: `linear-gradient(135deg, #0e1d34 0%, #0b1628 100%)`,
              border: "1px solid rgba(212,43,43,0.15)",
              borderRadius: 12,
              padding: "28px 32px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 24,
              marginBottom: 24,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Subtle diagonal stripe */}
            <div
              style={{
                position: "absolute",
                top: 0, right: 0,
                width: 200, height: "100%",
                background: "linear-gradient(to left, rgba(212,43,43,0.04), transparent)",
                pointerEvents: "none",
              }}
            />
            {STATS.map((s) => (
              <div key={s.label} style={{ textAlign: "center", position: "relative" }}>
                <div
                  style={{
                    fontFamily: "Impact, 'Arial Black', sans-serif",
                    fontSize: 34,
                    color: WHITE,
                    textShadow: `0 0 24px ${RED}40`,
                    letterSpacing: "0.03em",
                    lineHeight: 1,
                    marginBottom: 6,
                  }}
                >
                  {s.num}
                </div>
                <div
                  style={{
                    fontFamily: "Impact, 'Arial Black', sans-serif",
                    fontSize: 9,
                    letterSpacing: "0.16em",
                    color: "rgba(160,185,225,0.45)",
                    textTransform: "uppercase",
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <p
            style={{
              fontSize: 14,
              color: "rgba(160,185,225,0.55)",
              lineHeight: 1.75,
              margin: 0,
            }}
          >
            The Slot Pod is an NFL podcast focused on skill-position players, route concepts, and
            offensive schemes. Beyond the podcast, we build football tools — Route-That lets you
            design and run your own plays against real rosters, and PlayMap visualizes every
            player&apos;s season in one shareable animation.
          </p>
        </Section>

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            paddingTop: 28,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image src="/logo.png" alt="TSP" width={24} height={17} style={{ objectFit: "contain", opacity: 0.5 }} />
            <span
              style={{
                fontFamily: "Impact, 'Arial Black', sans-serif",
                fontSize: 9,
                color: "rgba(140,165,205,0.3)",
                letterSpacing: "0.14em",
              }}
            >
              © 2026 THE SLOT POD
            </span>
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.platform}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontFamily: "Impact, 'Arial Black', sans-serif",
                  fontSize: 9,
                  color: "rgba(140,165,205,0.3)",
                  textDecoration: "none",
                  letterSpacing: "0.1em",
                }}
              >
                {s.platform.toUpperCase()}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
