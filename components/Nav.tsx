"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/",        label: "THE SLOT POD", short: "HOME"     },
  { href: "/game",    label: "ROUTE-THAT",   short: "GAME"     },
  { href: "/playmap", label: "PLAYMAP",       short: "PLAYMAP"  },
];

export default function Nav() {
  const path = usePathname();

  return (
    <nav
      style={{
        height: 56,
        background: "#07100a",
        borderBottom: "1px solid rgba(0,255,80,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        position: "sticky",
        top: 0,
        zIndex: 100,
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ textDecoration: "none" }}>
        <span
          style={{
            fontFamily: "Impact, 'Arial Black', sans-serif",
            fontSize: 18,
            letterSpacing: "0.08em",
            color: "#00ff88",
            textShadow: "0 0 18px rgba(0,255,80,0.5)",
          }}
        >
          TSP
        </span>
      </Link>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4 }}>
        {TABS.map((tab) => {
          const active = tab.href === "/" ? path === "/" : path.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href} style={{ textDecoration: "none" }}>
              <div
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontFamily: "monospace",
                  fontSize: 11,
                  fontWeight: active ? "bold" : "normal",
                  letterSpacing: "0.08em",
                  background: active ? "rgba(0,255,80,0.12)" : "transparent",
                  color: active ? "#00ff88" : "rgba(160,210,175,0.5)",
                  border: active ? "1px solid rgba(0,255,80,0.3)" : "1px solid transparent",
                  textShadow: active ? "0 0 10px rgba(0,255,80,0.6)" : "none",
                  transition: "all 0.15s ease",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <span className="nav-label-full">{tab.label}</span>
                <span className="nav-label-short" style={{ display: "none" }}>{tab.short}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <style>{`
        @media (max-width: 480px) {
          .nav-label-full { display: none; }
          .nav-label-short { display: inline !important; }
        }
      `}</style>
    </nav>
  );
}
