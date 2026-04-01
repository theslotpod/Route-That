"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/",        label: "HOME",     short: "HOME"    },
  { href: "/game",    label: "ROUTE-THAT", short: "GAME"  },
  { href: "/playmap", label: "PLAYMAP",  short: "MAP"     },
  { href: "/bill",    label: "ASK BILL", short: "BILL"    },
];

export default function Nav() {
  const path = usePathname();

  return (
    <nav
      style={{
        height: 60,
        background: "linear-gradient(to bottom, #0a1628 0%, #070e1b 100%)",
        borderBottom: "1px solid rgba(212,43,43,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        position: "sticky",
        top: 0,
        zIndex: 100,
        backdropFilter: "blur(16px)",
        boxShadow: "0 2px 24px rgba(0,0,0,0.6)",
      }}
    >
      {/* Logo mark */}
      <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
        <Image
          src="/logo.png"
          alt="The Slot Pod"
          width={40}
          height={28}
          style={{ objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(212,43,43,0.4))" }}
          priority
        />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
          <span
            style={{
              fontFamily: "Impact, 'Arial Black', sans-serif",
              fontSize: 15,
              letterSpacing: "0.06em",
              color: "#ffffff",
            }}
          >
            THE{" "}
            <span style={{ color: "#d42b2b", textShadow: "0 0 12px rgba(212,43,43,0.6)" }}>
              SLOT
            </span>{" "}
            POD
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              letterSpacing: "0.18em",
              color: "rgba(180,200,230,0.4)",
              textTransform: "uppercase",
            }}
          >
            NFL PODCAST
          </span>
        </div>
      </Link>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 3 }}>
        {TABS.map((tab) => {
          const active = tab.href === "/" ? path === "/" : path.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href} style={{ textDecoration: "none" }}>
              <div
                className="nav-tab"
                data-active={active}
                style={{
                  padding: "7px 16px",
                  borderRadius: 6,
                  fontFamily: "Impact, 'Arial Black', sans-serif",
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  background: active ? "rgba(212,43,43,0.18)" : "transparent",
                  color: active ? "#ffffff" : "rgba(180,200,230,0.45)",
                  border: active ? "1px solid rgba(212,43,43,0.45)" : "1px solid transparent",
                  textShadow: active ? "0 0 8px rgba(212,43,43,0.5)" : "none",
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
        .nav-tab:hover { background: rgba(212,43,43,0.1) !important; color: rgba(255,255,255,0.8) !important; }
        @media (max-width: 520px) {
          .nav-label-full { display: none; }
          .nav-label-short { display: inline !important; }
        }
      `}</style>
    </nav>
  );
}
