import { useState, useEffect, useCallback, useRef } from "react";
import { apiRequest, downloadApiFile } from "./api";

function CyBreachArena() {
/* ============================================================
   DESIGN TOKENS — single source of truth for all colours/sizes
   In a real project these would live in a theme file or
   Tailwind config. Here they're inline so everything is in
   one file you can hand to a teammate.
============================================================ */
const T = {
  bg: "#f3f7f5",
  surface: "rgba(255,255,255,.96)",
  surface2: "#e7efeb",
  surface3: "#f8fbf9",
  boxShadow: "0 12px 32px rgba(14,55,40,.08)",
  border: "rgba(21,79,57,.14)",
  neon: "#07835f",
  text: "#17251f",
  muted: "#65776e",
  safe: "#07835f",
  warning: "#a76b0c",
  danger: "#c33f47",
  warn: "#a76b0c",
  neonDim: "rgba(7,131,95,.55)",
  fontDisplay: "'Cinzel', serif"
};

/* ============================================================
   GOOGLE FONTS injection — IBM Plex Mono + IBM Plex Sans
   Technical, enterprise-security feel.
============================================================ */
useEffect(() => {
  const fontLink = document.createElement("link");
  fontLink.href =
    "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&family=Cinzel:wght@400;500;600;700;800&display=swap";
  fontLink.rel = "stylesheet";
  document.head.appendChild(fontLink);

  return () => {
    document.head.removeChild(fontLink);
  };
}, []);

/* ============================================================
   GLOBAL STYLES — injected once via a <style> tag.
   Keeps component JSX clean while letting us use keyframe
   animations that can't be done with inline styles.
============================================================ */
const globalCSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }
  body {
    background: ${T.bg};
    color: ${T.text};
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 14px;
  }
  /* CRT scanline — the signature element carried over from HTML version */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(
      0deg, transparent, transparent 2px,
      rgba(0,0,0,0.025) 2px, rgba(0,0,0,0.025) 4px
    );
    pointer-events: none;
    z-index: 9999;
  }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:.15} }
  @keyframes slideIn  { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
  @keyframes fadeOut  { to{opacity:0;transform:translateX(110%)} }
  @keyframes flashBg  { 0%{background:rgba(170,184,255,.10)} 100%{background:${T.surface}} }
  @keyframes scanBar  { 0%{width:0%} 70%{width:82%} 100%{width:100%} }
  @keyframes countUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  @keyframes fadeIn   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }

  /* ============================================================
     PARTICLE BACKGROUND — fixed canvas sits behind all content
  ============================================================ */
  .cba-particles {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
  }

  /* ============================================================
     SCROLL-REVEAL — elements start hidden/offset, then animate
     into place once they cross the viewport (via IntersectionObserver)
  ============================================================ */
  .cba-reveal {
    opacity: 0;
    transform: translateY(28px);
    transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1);
    will-change: opacity, transform;
  }
  .cba-reveal-visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* ============================================================
     BUTTON ANIMATION — shared hover-lift / press / sheen effect
     applied via className="cba-btn" on interactive buttons
  ============================================================ */
  .cba-btn {
    position: relative;
    overflow: hidden;
    transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease, filter 0.2s ease, border-color 0.2s ease;
  }
  .cba-btn::before {
    content: '';
    position: absolute;
    top: 0; left: -75%;
    width: 50%; height: 100%;
    background: linear-gradient(120deg, transparent, rgba(255,255,255,0.25), transparent);
    transform: skewX(-20deg);
    transition: left 0.6s ease;
    pointer-events: none;
  }
  .cba-btn:hover::before { left: 130%; }
  .cba-btn:hover {
    transform: translateY(-2px);
    filter: brightness(1.08);
  }
  .cba-btn:active {
    transform: translateY(0) scale(0.96);
    filter: brightness(0.95);
  }

  /* Generic hover-lift for cards/panels that don't manage hover via JS */
  .cba-hover-lift {
    transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease, border-color 0.25s ease;
  }
  .cba-hover-lift:hover {
    transform: translateY(-4px);
    border-color: rgba(170,184,255,0.35) !important;
    box-shadow: 0 12px 30px rgba(0,0,0,0.35);
  }

  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-track { background: ${T.bg}; }
  ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius:4px; }

  /* ============================================================
     RESPONSIVE BREAKPOINTS
     Inline styles set the desktop layout; these !important rules
     (which DO beat plain inline styles in the CSS cascade) collapse
     grids and the nav on narrower screens instead of letting fixed
     multi-column layouts force a horizontal overflow.
  ============================================================ */
  @media (max-width: 960px) {
    .cba-nav { padding: 10px 18px !important; }
    .cba-nav-inner { width: 100% !important; flex-wrap: wrap; gap: 8px; }
    .cba-nav-brand { font-size: 16px !important; white-space: nowrap; }
    .cba-nav-tabs {
      order: 3; flex: 0 0 100%; width: 100%;
      justify-content: space-between; gap: 0 !important;
      overflow: visible;
    }
    .cba-nav-tabs button { padding: 7px 8px !important; font-size: 11px !important; letter-spacing: 0.03em !important; }
    .cba-user-badge { gap: 8px !important; padding: 4px 8px !important; }
    .cba-user-avatar { width: 32px !important; height: 32px !important; }
    .cba-user-details div:nth-child(2) { display: none; }
    .cba-sign-out { padding: 7px 8px !important; font-size: 11px !important; }
    .cba-hero-grid { grid-template-columns: 1fr 1fr !important; }
    .cba-agents-grid { grid-template-columns: 1fr 1fr !important; }
    .cba-two-col { grid-template-columns: 1fr !important; }
    .cba-shield { display: none !important; }
  }
  @media (min-width: 961px) and (max-width: 1200px) {
    .cba-nav { padding: 10px 16px !important; }
    .cba-nav-inner { width: 100% !important; gap: 8px; }
    .cba-nav-brand { font-size: 15px !important; white-space: nowrap; }
    .cba-nav-tabs { flex: 1; min-width: 0; justify-content: center; gap: 0 !important; }
    .cba-nav-tabs button { padding: 6px 5px !important; font-size: 11px !important; letter-spacing: 0.02em !important; }
    .cba-user-badge { gap: 7px !important; padding: 4px 6px !important; }
    .cba-user-avatar { width: 32px !important; height: 32px !important; }
    .cba-user-details div:nth-child(2) { display: none; }
    .cba-sign-out { padding: 7px 8px !important; font-size: 11px !important; }
  }
  @media (max-width: 640px) {
    .cba-hero-grid { grid-template-columns: 1fr !important; }
    .cba-agents-grid { grid-template-columns: 1fr !important; }
    .cba-container { padding: 20px 16px !important; }
    .cba-nav { padding: 12px 16px !important; }
    .cba-nav-inner { flex-direction: column; align-items: flex-start !important; gap: 12px; }
    .cba-nav-tabs { width: 100%; justify-content: flex-start; overflow-x: auto; }
    .cba-nav-tabs button { flex: 0 0 auto; }
    .cba-plan-grid { grid-template-columns: 1fr 1fr !important; }
  }

  /* The navigation remains on the side at every viewport size. */
  .cba-nav {
    position: fixed !important; inset: 0 auto 0 0 !important;
    width: 252px !important; height: 100vh !important;
    flex-direction: column !important; justify-content: flex-start !important;
    align-items: stretch !important; padding: 26px 14px !important;
    border: 0 !important; border-right: 1px solid ${T.border} !important;
    background: rgba(17,19,30,.9) !important; backdrop-filter: blur(24px) !important;
    box-shadow: 18px 0 55px rgba(3,5,15,.18);
  }
  .cba-nav-inner {
    width: 100% !important; max-width: none !important; height: 100% !important;
    flex-direction: column !important; flex-wrap: nowrap !important; align-items: stretch !important;
    justify-content: flex-start !important; gap: 30px !important;
  }
  .cba-nav-brand { white-space: normal !important; font-size: 17px !important; padding: 4px 8px; }
  .cba-nav-tabs { width: 100%; flex: 0 0 auto !important; flex-direction: column; align-items: stretch; gap: 5px !important; order: 0 !important; }
  .cba-nav-tab {
    width: 100%; flex: 0 0 auto !important; text-align: left; border: 0 !important; border-left: 2px solid transparent !important;
    border-radius: 8px; padding: 12px 13px !important; letter-spacing: .08em !important;
    transition: background .2s ease, color .2s ease, border-color .2s ease;
  }
  .cba-nav-tab[aria-current="page"] { background: rgba(170,184,255,.11) !important; border-left-color: ${T.neon} !important; }
  .cba-nav-tab:hover { background: rgba(170,184,255,.07) !important; }
  .cba-nav-account { margin: auto 0 0 !important; width: 100%; flex-direction: column; align-items: stretch !important; }
  .cba-user-badge { justify-content: flex-start; }
  .cba-sign-out { width: 100%; margin-top: 8px; }
  .cba-container { margin-left: 252px !important; max-width: none !important; padding: 36px clamp(22px, 3.3vw, 58px) !important; }
  @media (max-width: 960px) {
    .cba-nav { width: 216px !important; padding: 22px 11px !important; }
    .cba-container { margin-left: 216px !important; padding: 28px 22px !important; }
  }
  @media (max-width: 640px) {
    .cba-nav { width: 70px !important; padding: 18px 7px !important; }
    .cba-nav-inner { gap: 20px !important; }
    .cba-nav-brand { justify-content: center !important; padding: 4px 0 !important; }
    .cba-brand-label, .cba-nav-label, .cba-user-details { display: none !important; }
    .cba-nav-tab { padding: 11px 0 !important; text-align: center !important; border-left: 0 !important; }
    .cba-nav-tab::before { content: attr(data-short); font: 600 10px 'IBM Plex Mono', monospace; letter-spacing: .02em; }
    .cba-nav-tab[aria-current="page"] { box-shadow: inset 0 -2px ${T.neon}; }
    .cba-nav-account { align-items: center !important; }
    .cba-user-badge { justify-content: center; padding: 4px !important; border: 0 !important; }
    .cba-sign-out { padding: 8px 2px !important; font-size: 10px !important; }
    .cba-container { margin-left: 70px !important; padding: 20px 14px !important; }
    .cba-alpha-audit-row { grid-template-columns: minmax(0,1fr) auto !important; }
    .cba-alpha-audit-row > span:nth-child(2), .cba-alpha-audit-row > time { grid-column: 1 / -1; text-align: left !important; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
  }
`;

/* ============================================================
   UTILITY HOOKS
============================================================ */

function useAnimatedNumber(target, duration = 900) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = null;
    let rafId;

    const from = 0;
    function step(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (progress < 1) rafId = requestAnimationFrame(step);
    }

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);
  return display;
}

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return { toasts, add };
}

/* ============================================================
   SCROLL-REVEAL HOOK + WRAPPER
   Uses IntersectionObserver to add a "visible" class the first
   time an element scrolls into view. Stays visible afterwards
   (no re-hiding on scroll-out) for a calmer feel.
============================================================ */
function Reveal({ children, delay = 0, style, as: Tag = "div" }) {
  const elRef = useState(() => ({ current: null }))[0];
  const [visible, setVisible] = useState(false);

  const setRef = useCallback((node) => {
    elRef.current = node;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(node);
  }, [elRef]);

  return (
    <Tag
      ref={setRef}
      className={`cba-reveal${visible ? " cba-reveal-visible" : ""}`}
      style={{ transitionDelay: `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}

/* ============================================================
   PARTICLE BACKGROUND
   Lightweight canvas field of drifting nodes with connecting
   lines when close together — a subtle "network / security mesh"
   effect that sits fixed behind all page content.
============================================================ */
function ParticleField({ color = "#aab8ff", density = 70 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return undefined;

    let width = 0, height = 0, rafId = 0;
    let particles = [];
    const pointer = { x: -1000, y: -1000, active: false };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      const count = Math.min(density, Math.max(24, Math.floor((width * height) / 22000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width, y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.4 + 0.55,
      }));
    }

    function onPointerMove(event) {
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.active = true;
    }
    function onPointerLeave() { pointer.active = false; }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      if (!reducedMotion) {
        for (const p of particles) {
          if (pointer.active) {
            const dx = p.x - pointer.x, dy = p.y - pointer.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0 && dist < 145) {
              const force = (1 - dist / 145) * 0.022;
              p.vx += (dx / dist) * force; p.vy += (dy / dist) * force;
            }
          }
          p.vx *= 0.992; p.vy *= 0.992;
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;
        }
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 130) {
            ctx.strokeStyle = color; ctx.globalAlpha = (1 - dist / 130) * 0.13;
            ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      if (pointer.active && !reducedMotion) {
        const glow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 155);
        glow.addColorStop(0, "rgba(170,184,255,.08)"); glow.addColorStop(1, "rgba(170,184,255,0)");
        ctx.globalAlpha = 1; ctx.fillStyle = glow;
        ctx.fillRect(pointer.x - 155, pointer.y - 155, 310, 310);
      }
      ctx.globalAlpha = 0.62; ctx.fillStyle = color;
      for (const p of particles) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reducedMotion) rafId = requestAnimationFrame(draw);
    }

    resize(); draw();
    if (!reducedMotion) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener("blur", onPointerLeave);
    }
    function onResize() { resize(); if (reducedMotion) draw(); }
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
    };
  }, [color, density]);

  return <canvas ref={canvasRef} className="cba-particles" aria-hidden="true" />;
}

/* ============================================================
   SMALL REUSABLE COMPONENTS
============================================================ */

function Eyebrow({ children, color = T.neon }) {
  return (
    <div style={{
      fontFamily:"'IBM Plex Mono',monospace",
      fontSize:11, letterSpacing:"0.13em",
      textTransform:"uppercase", color, marginBottom:6
    }}>{children}</div>
  );
}

function Panel({ children, style, glow, ...props }) {
  return (
    <div {...props} style={{
      background: T.surface,
      border: `1px solid ${glow ? "rgba(170,184,255,0.25)" : T.border}`,
      borderRadius:8, padding:22,
      boxShadow: glow ? "0 0 24px rgba(170,184,255,0.12)" : "none",
      ...style,
    }}>{children}</div>
  );
}

function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
      <div style={{ fontFamily:T.fontDisplay, fontSize:15, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>
        {title}
      </div>
      {action && (onAction ? (
        <button type="button" onClick={onAction} style={{ background:"none", border:"none", color:T.neon, fontSize:13, cursor:"pointer", fontWeight:600 }}>
          {action} →
        </button>
      ) : (
        <span style={{ color:T.muted, fontSize:11, fontWeight:600, letterSpacing:"0.06em", cursor:"default" }}>
          {action}
        </span>
      ))}
    </div>
  );
}

function DeltaBadge({ value }) {
  const up = value >= 0;
  return (
    <span style={{
      fontFamily:"'IBM Plex Mono',monospace", fontSize:10,
      padding:"2px 6px", borderRadius:2,
      background: up ? "rgba(34,197,94,0.09)" : "rgba(239,68,68,0.09)",
      color: up ? T.safe : T.danger,
    }}>
      {up ? "▲" : "▼"} {Math.abs(value)}
    </span>
  );
}

function RunButton({ onClick, label = "Run simulated scan", disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="cba-btn"
      style={{
        width:"100%", marginTop:12, padding:"9px 0",
        background:"transparent",
        border:"1px solid rgba(170,184,255,0.35)",
        color:T.neon,
        fontFamily:"'IBM Plex Mono',monospace", fontSize:11,
        letterSpacing:"0.1em", textTransform:"uppercase",
        borderRadius:8, cursor:"pointer",
        transition:"background 0.2s, border-color 0.2s",
      }}
      onMouseEnter={e => { e.target.style.background = "rgba(170,184,255,0.09)"; }}
      onMouseLeave={e => { e.target.style.background = "transparent"; }}
    >
      {label}
    </button>
  );
}

function ToastStack({ toasts }) {
  return (
    <div style={{ position:"fixed", bottom:24, right:24, display:"flex", flexDirection:"column", gap:8, zIndex:300 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: T.surface,
          border:`1px solid ${t.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(170,184,255,0.2)"}`,
          borderLeft:`3px solid ${t.type === "success" ? T.safe : T.neon}`,
          borderRadius:8, padding:"11px 16px",
          minWidth:280, fontSize:14,
          boxShadow:"0 8px 24px rgba(0,0,0,0.5)",
          animation:"slideIn 0.3s ease",
          color: T.text,
        }}>{t.msg}</div>
      ))}
    </div>
  );
}

function TransactionLog({ transactions }) {
  const [filter, setFilter] = useState("all");

  const types = ["all", "credit", "debit", "refund"];

  const colors = {
    credit: T.safe,
    debit: T.neon,
    refund: T.warning || "#F59E0B"
  };

  const icons = {
    credit: "⬇",
    debit: "⬆",
    refund: "↺"
  };

  const data =
    filter === "all"
      ? transactions
      : transactions.filter(t => t.type === filter);

  return (
    <Panel>
      <SectionHeader title="Transaction Log" />

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, margin: "14px 0 18px" }}>
        {types.map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: `1px solid ${filter === type ? colors[type] || T.neon : T.border}`,
              background: filter === type ? "rgba(170,184,255,.08)" : "transparent",
              color: filter === type ? colors[type] || T.neon : T.muted,
              font: "11px IBM Plex Mono",
              cursor: "pointer",
              textTransform: "uppercase"
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* List */}
      {data.length ? data.map((tx, i) => (

        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 16px",
            marginBottom: 10,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            background: "rgba(255,255,255,.02)",
            transition: ".2s"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = colors[tx.type];
            e.currentTarget.style.transform = "translateX(4px)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = T.border;
            e.currentTarget.style.transform = "translateX(0)";
          }}
        >

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>

            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: `${colors[tx.type]}22`,
                color: colors[tx.type],
                display: "grid",
                placeItems: "center",
                fontWeight: 700
              }}
            >
              {icons[tx.type]}
            </div>

            <div>
              <div style={{ fontWeight: 600 }}>{tx.desc}</div>
              <div
                style={{
                  font: "11px IBM Plex Mono",
                  color: T.muted,
                  marginTop: 3
                }}
              >
                {tx.time}
              </div>
            </div>

          </div>

          <div
            style={{
              font: "700 15px IBM Plex Mono",
              color: colors[tx.type]
            }}
          >
            {tx.type === "credit" ? "+" : "-"}{tx.amount} {tx.currency || "CR"}
          </div>

        </div>

      )) : (
        <div
          style={{
            padding: 30,
            textAlign: "center",
            color: T.muted
          }}
        >
          No Transactions Found
        </div>
      )}
    </Panel>
  );
}
function tokenClaim(token, claim) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")))[claim];
  } catch {
    return undefined;
  }
}

function AlphaAuditViewer({ token }) {
  const [tenantId, setTenantId] = useState("");
  const [entryType, setEntryType] = useState("");
  const [moduleSource, setModuleSource] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState({ entries: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const pageSize = 50;
  const financeAdmin = tokenClaim(token, "role") === "admin";

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
    if (financeAdmin && tenantId.trim()) params.set("tenant_id", tenantId.trim());
    if (entryType) params.set("entry_type", entryType);
    if (moduleSource) params.set("module_source", moduleSource);
    if (dateFrom) params.set("date_from", new Date(`${dateFrom}T00:00:00`).toISOString());
    if (dateTo) params.set("date_to", new Date(`${dateTo}T23:59:59.999`).toISOString());

    setLoading(true);
    setError("");
    apiRequest(`/api/v1/arena/wallet/history?${params}`, { token })
      .then(data => { if (active) setResult(data); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, financeAdmin, tenantId, entryType, moduleSource, dateFrom, dateTo, page]);

  async function exportCsv() {
    const params = new URLSearchParams();
    if (financeAdmin && tenantId.trim()) params.set("tenant_id", tenantId.trim());
    if (entryType) params.set("entry_type", entryType);
    if (moduleSource) params.set("module_source", moduleSource);
    if (dateFrom) params.set("date_from", new Date(`${dateFrom}T00:00:00`).toISOString());
    if (dateTo) params.set("date_to", new Date(`${dateTo}T23:59:59.999`).toISOString());
    setExporting(true);
    try {
      await downloadApiFile(`/api/v1/arena/wallet/history/export?${params}`, {
        token,
        filename: "pod-alpha-wallet-audit.csv",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  const entries = result.entries || [];
  const totalPages = Math.max(1, Math.ceil((result.total || 0) / pageSize));

  return (
    <Panel>
      <SectionHeader title="Pod Alpha Audit Trail" action={`${result.total || 0} ENTRIES`} />
      <p style={{ color:T.muted, fontSize:12, marginBottom:14 }}>
        Read-only, tenant-scoped wallet ledger from Pod Alpha. Export applies the selected filters to the full matching history.
      </p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:9, marginBottom:12 }}>
        {financeAdmin && <label style={{ color:T.muted, fontSize:11, display:"grid", gap:5 }}>Tenant ID (finance admin)
          <input value={tenantId} onChange={event => { setTenantId(event.target.value); setPage(0); }} placeholder="Your account" style={{ padding:9, color:T.text, background:T.surface3, border:`1px solid ${T.border}`, borderRadius:7 }} />
        </label>}
        <label style={{ color:T.muted, fontSize:11, display:"grid", gap:5 }}>Entry type
          <select value={entryType} onChange={event => { setEntryType(event.target.value); setPage(0); }} style={{ padding:9, color:T.text, background:T.surface3, border:`1px solid ${T.border}`, borderRadius:7 }}>
            <option value="">All entries</option><option value="CREDIT">Credits</option><option value="DEBIT">Debits</option>
          </select>
        </label>
        <label style={{ color:T.muted, fontSize:11, display:"grid", gap:5 }}>Module source
          <select value={moduleSource} onChange={event => { setModuleSource(event.target.value); setPage(0); }} style={{ padding:9, color:T.text, background:T.surface3, border:`1px solid ${T.border}`, borderRadius:7 }}>
            <option value="">All modules</option><option value="mod1">Module 1</option><option value="mod2">Module 2</option><option value="mod3">Module 3</option><option value="mod4">Module 4</option>
          </select>
        </label>
        <label style={{ color:T.muted, fontSize:11, display:"grid", gap:5 }}>From
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={event => { setDateFrom(event.target.value); setPage(0); }} style={{ padding:8, color:T.text, colorScheme:"dark", background:T.surface3, border:`1px solid ${T.border}`, borderRadius:7 }} />
        </label>
        <label style={{ color:T.muted, fontSize:11, display:"grid", gap:5 }}>To
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={event => { setDateTo(event.target.value); setPage(0); }} style={{ padding:8, color:T.text, colorScheme:"dark", background:T.surface3, border:`1px solid ${T.border}`, borderRadius:7 }} />
        </label>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginBottom:12 }}>
        <span style={{ color:T.muted, fontSize:11 }}>{loading ? "Loading from Pod Alpha…" : `Page ${page + 1} of ${totalPages}`}</span>
        <button type="button" className="cba-btn" disabled={exporting || !result.total} onClick={exportCsv} style={{ padding:"8px 11px", color:T.neon, background:"transparent", border:`1px solid ${T.border}`, borderRadius:7, cursor:"pointer", opacity:exporting || !result.total ? .55 : 1 }}>
          {exporting ? "Preparing CSV…" : "Export filtered CSV"}
        </button>
      </div>
      {error && <p role="alert" style={{ color:T.danger, fontSize:12, marginBottom:12 }}>{error}</p>}
      <div style={{ display:"grid", gap:7 }}>
        {entries.map(entry => (
          <div key={entry.id} className="cba-alpha-audit-row" style={{ display:"grid", gridTemplateColumns:"minmax(120px,1.2fr) minmax(110px,1fr) minmax(105px,.8fr) auto", alignItems:"center", gap:10, padding:"10px 12px", background:"rgba(255,255,255,.025)", border:`1px solid ${T.border}`, borderRadius:8 }}>
            <span style={{ minWidth:0 }}><strong style={{ display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{entry.reference_id || entry.transaction_type || "Ledger entry"}</strong><small style={{ color:T.muted }}>{entry.transaction_type}</small></span>
            <span style={{ color:T.muted, fontSize:11 }}>{entry.module_source || "system"} · {entry.account_code}</span>
            <span style={{ color:entry.entry_type === "CREDIT" ? T.safe : T.warning, fontFamily:"'IBM Plex Mono',monospace", fontSize:12 }}>{entry.entry_type === "CREDIT" ? "+" : "−"}{entry.amount} {entry.currency}</span>
            <time style={{ color:T.muted, fontSize:10, textAlign:"right" }}>{entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}</time>
          </div>
        ))}
        {!loading && !error && entries.length === 0 && <p style={{ color:T.muted, padding:16, textAlign:"center" }}>No Pod Alpha ledger entries match these filters.</p>}
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:12 }}>
        <button type="button" disabled={page === 0 || loading} onClick={() => setPage(value => Math.max(0, value - 1))} style={{ padding:"7px 11px", color:T.text, background:"transparent", border:`1px solid ${T.border}`, borderRadius:7, cursor:"pointer", opacity:page === 0 || loading ? .5 : 1 }}>Previous</button>
        <button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(value => value + 1)} style={{ padding:"7px 11px", color:T.text, background:"transparent", border:`1px solid ${T.border}`, borderRadius:7, cursor:"pointer", opacity:page + 1 >= totalPages || loading ? .5 : 1 }}>Next</button>
      </div>
    </Panel>
  );
}

function LeaderboardPanel({ entries }) {

  const rankStyle = (rank) => {
    switch(rank){
      case 1:
        return {
          bg:"linear-gradient(135deg,#FFD700,#F59E0B)",
          glow:"0 0 12px rgba(255,215,0,.45)"
        };
      case 2:
        return {
          bg:"linear-gradient(135deg,#E5E7EB,#94A3B8)",
          glow:"0 0 10px rgba(255,255,255,.25)"
        };
      case 3:
        return {
          bg:"linear-gradient(135deg,#CD7F32,#92400E)",
          glow:"0 0 10px rgba(205,127,50,.35)"
        };
      default:
        return {
          bg:"rgba(255,255,255,.05)",
          glow:"none"
        };
    }
  };

  const topScore = Math.max(...entries.map(e=>e.score));

  return (

    <Panel>

      <SectionHeader
        title="Global Leaderboard"
      />

      <div style={{
        display:"flex",
        flexDirection:"column",
        gap:14,
        marginTop:12
      }}>

      {entries.map((row,i)=>{

        const medal = row.rank===1 ? "🥇"
                    : row.rank===2 ? "🥈"
                    : row.rank===3 ? "🥉"
                    : "#"+row.rank;

        const pct = (row.score/topScore)*100;

        return(

        <div
          key={i}
          style={{
            display:"flex",
            alignItems:"center",
            gap:16,
            padding:"16px",
            border:`1px solid ${T.border}`,
            borderRadius:12,
            background:
              row.isYou
                ? "linear-gradient(90deg,rgba(170,184,255,.08),rgba(255,255,255,.02))"
                : "rgba(255,255,255,.02)",
            transition:"0.25s",
            cursor:"pointer",
          }}
          onMouseEnter={e=>{
            e.currentTarget.style.transform="translateX(6px)";
            e.currentTarget.style.borderColor=T.neon;
          }}
          onMouseLeave={e=>{
            e.currentTarget.style.transform="translateX(0)";
            e.currentTarget.style.borderColor=T.border;
          }}
        >

          {/* Rank */}

          <div
            style={{
              width:42,
              height:42,
              borderRadius:"50%",
              display:"flex",
              justifyContent:"center",
              alignItems:"center",
              background:rankStyle(row.rank).bg,
              boxShadow:rankStyle(row.rank).glow,
              fontSize:18
            }}
          >
            {medal}
          </div>

          {/* Avatar */}

          <div
            style={{
              width:42,
              height:42,
              borderRadius:"50%",
              background:"linear-gradient(135deg,#aab8ff,#7386df)",
              display:"flex",
              alignItems:"center",
              justifyContent:"center",
              fontFamily:"IBM Plex Mono",
              fontWeight:700,
              color:"#000"
            }}
          >
            {row.name.charAt(0)}
          </div>

          {/* Name */}

          <div style={{flex:1}}>

            <div style={{
              display:"flex",
              alignItems:"center",
              gap:8
            }}>

              <span style={{
                fontWeight:600,
                color:T.text
              }}>
                {row.name}
              </span>

              {row.isYou && (

                <span style={{
                  background:T.neon,
                  color:"#000",
                  padding:"2px 7px",
                  borderRadius:20,
                  fontSize:10,
                  fontWeight:700,
                  fontFamily:"IBM Plex Mono"
                }}>
                  YOU
                </span>

              )}

            </div>

            <div
              style={{
                height:5,
                marginTop:8,
                borderRadius:20,
                overflow:"hidden",
                background:"rgba(255,255,255,.06)"
              }}
            >
              <div
                style={{
                  width:`${pct}%`,
                  height:"100%",
                  background:
                    row.rank===1
                    ? "#FFD700"
                    : T.neon
                }}
              />
            </div>

          </div>

          {/* Score */}

          <div
            style={{
              textAlign:"right",
              minWidth:90
            }}
          >

            <div style={{
              fontFamily:"IBM Plex Mono",
              fontSize:20,
              fontWeight:700,
              color:T.text
            }}>
              {row.score}
            </div>

            <div style={{
              color:
                row.delta>0
                ? T.safe
                : T.danger,
              fontFamily:"IBM Plex Mono",
              fontSize:12
            }}>
              {row.delta>0 ? "▲":"▼"} {Math.abs(row.delta)}
            </div>

          </div>

        </div>

        )

      })}

      </div>

    </Panel>

  );
}

function BadgesPanel({ badges }) {

  const tier = {
    Bronze: { color: "#CD7F32", glow: "rgba(205,127,50,.35)" },
    Silver: { color: "#C0C0C0", glow: "rgba(192,192,192,.35)" },
    Gold: { color: "#FACC15", glow: "rgba(250,204,21,.35)" },
    Platinum: { color: T.neon, glow: "rgba(170,184,255,.35)" }
  };

  return (
    <Panel>

      <SectionHeader
        title="Achievement Badges"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 16,
          marginTop: 14
        }}
      >

        {badges
          .filter(b => b.unlocked)
          .map((b, i) => {

            const c = tier[b.tier] || {
              color: T.muted,
              glow: "transparent"
            };

            return (

              <div
                key={b.id}
                style={{
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "18px",
                  borderRadius: 14,
                  background:
                    "linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015))",
                  border: `1px solid ${T.border}`,
                  transition: ".25s",
                  animation: `fadeIn ${0.1 + i * 0.08}s ease`
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.borderColor = c.color;
                  e.currentTarget.style.boxShadow = `0 0 24px ${c.glow}`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.boxShadow = "none";
                }}
              >

                {/* Glow Circle */}

                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: `${c.color}22`,
                    border: `2px solid ${c.color}`,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: 30,
                    boxShadow: `0 0 20px ${c.glow}`,
                    flexShrink: 0
                  }}
                >
                  {b.icon}
                </div>

                {/* Content */}

                <div style={{ flex: 1 }}>

                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: T.text
                    }}
                  >
                    {b.name}
                  </div>

                  <div
                    style={{
                      marginTop: 5,
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 11,
                      color: c.color,
                      letterSpacing: ".08em",
                      textTransform: "uppercase"
                    }}
                  >
                    {b.tier} Badge
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      height: 4,
                      borderRadius: 20,
                      background: "rgba(255,255,255,.05)"
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: 20,
                        background: c.color
                      }}
                    />
                  </div>

                </div>

                {/* Verified */}

                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    fontSize: 10,
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: T.safe,
                    letterSpacing: ".08em"
                  }}
                >
                  ● SAMPLE
                </div>

              </div>

            );

          })}

      </div>

    </Panel>
  );
}
function ActivityFeed({ items }) {

  const iconStyles = {
    credit: {
      bg: "linear-gradient(135deg,#aab8ff,#7386df)",
      glow: "0 0 15px rgba(170,184,255,.35)"
    },
    badge: {
      bg: "linear-gradient(135deg,#22c55e,#16a34a)",
      glow: "0 0 15px rgba(34,197,94,.35)"
    },
    scan: {
      bg: "linear-gradient(135deg,#f59e0b,#d97706)",
      glow: "0 0 15px rgba(245,158,11,.35)"
    },
    alert: {
      bg: "linear-gradient(135deg,#ef4444,#dc2626)",
      glow: "0 0 15px rgba(239,68,68,.35)"
    }
  };

  return (
    <Panel glow>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18
        }}
      >
        <SectionHeader title="Recent Activity" />

        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 18,
            background: "rgba(170,184,255,.08)",
            color: T.neon,
            padding: "4px 10px",
            borderRadius: 20,
            border: "1px solid rgba(170,184,255,.2)"
          }}
        >
          {items.length} EVENTS
        </div>

      </div>

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column"
        }}
      >

        {/* Timeline */}

        <div
          style={{
            position: "absolute",
            left: 19,
            top: 10,
            bottom: 10,
            width: 2,
            background: "rgba(255,255,255,.05)"
          }}
        />

        {items.map((item, i) => {

          const style = iconStyles[item.type];

          return (

            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                padding: "15px 10px",
                borderRadius: 10,
                border:
                  i < items.length - 1
                    ? "1px solid rgba(255,255,255,.03)"
                    : "1px solid transparent",
                marginBottom: 6,
                transition: ".25s",
                animation: `fadeIn ${0.15 + i * .08}s ease`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,.03)";
                e.currentTarget.style.transform = "translateX(5px)";
                e.currentTarget.style.border =
                  "1px solid rgba(170,184,255,.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.transform = "translateX(0px)";
                e.currentTarget.style.border =
                  i < items.length - 1
                    ? "1px solid rgba(255,255,255,.03)"
                    : "1px solid transparent";
              }}
            >

              {/* Icon */}

              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: style.bg,
                  boxShadow: style.glow,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  color: "#fff",
                  fontSize: 20,
                  flexShrink: 0,
                  zIndex: 2
                }}
              >
                {item.icon}
              </div>

              {/* Text */}

              <div style={{ flex: 1 }}>

                <div
                  style={{
                    fontSize: 13,
                    color: T.text,
                    lineHeight: 1.6,
                    fontWeight: 500
                  }}
                >
                  {item.text}
                </div>

                <div
                  style={{
                    display: "inline-block",
                    marginTop: 8,
                    padding: "4px 8px",
                    borderRadius: 20,
                    background: "rgba(255, 255, 255, 0.12)",
                    color: T.muted,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 14,
                    letterSpacing: ".08em"
                  }}
                >
                  {item.time}
                </div>

              </div>

            </div>

          );

        })}

      </div>

    </Panel>
  );

}

function LoginScreen({ onLogin, onPreview, onBack }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [accessToken, setAccessToken] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(accessToken.trim());
    } catch (requestError) {
      setError(requestError.status === 401
        ? "That organization token was rejected or expired. For the local walkthrough, choose Enter Sample Preview below."
        : requestError.status === 403
          ? "This organization token does not have access to the Arena services."
          : requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function openPreview() {
    setError(""); setPreviewLoading(true);
    try { await onPreview(); }
    catch (requestError) { setError(requestError.message); }
    finally { setPreviewLoading(false); }
  }

  return (
    <div style={{ minHeight:"100vh", display:"grid", placeItems:"center", padding:20, background:T.bg }}>
      <ParticleField color={T.neon} density={35} />
      <Panel style={{ position:"relative", zIndex:1, width:"min(440px,100%)", padding:32, background:T.surface }}>
        <img src="/cybreach-logo.png" alt="CyBreach company shield" style={{ display:"block", width:76, height:76, objectFit:"contain", margin:"0 auto 14px" }} />
        <h1 style={{ textAlign:"center", color:T.text, fontFamily:T.fontDisplay, fontSize:27 }}>CyBreach Arena</h1>
        <p style={{ textAlign:"center", color:T.muted, margin:"8px 0 24px" }}>Secure access to live Arena services</p>
        <form onSubmit={submit}>
          <label style={{ display:"grid", gap:8, color:T.text, fontSize:13 }}>
            Organization access token
            <input
              type="password"
              autoComplete="off"
              required
              value={accessToken}
              onChange={event => setAccessToken(event.target.value)}
              placeholder="Paste a signed, unexpired Arena token"
              style={{ width:"100%", padding:12, border:`1px solid ${T.border}`, borderRadius:8, background:T.surface3, color:T.text }}
            />
          </label>
          {error && <p role="alert" style={{ color:T.danger, marginTop:12, fontSize:12 }}>{error}</p>}
          <button type="submit" disabled={loading} className="cba-btn" style={{ width:"100%", marginTop:18, padding:13, border:0, borderRadius:8, background:T.neon, color:"#fff", fontWeight:700, cursor:loading ? "wait" : "pointer" }}>
            {loading ? "CONNECTING..." : "CONNECT TO ARENA"}
          </button>
        </form>
        <div style={{ marginTop:20, padding:14, border:`1px solid ${T.warning}55`, borderRadius:8, background:`${T.warning}0c` }}>
          <strong style={{ display:"block", color:T.warning, fontSize:13 }}>Local sample preview</strong>
          <p style={{ color:T.muted, fontSize:12, lineHeight:1.55, margin:"6px 0 10px" }}>Fictional wallet activity and records. If enabled, the optional check contacts only the configured loopback lab. No live payment is made.</p>
          <button type="button" onClick={openPreview} disabled={previewLoading || loading} className="cba-btn" style={{ width:"100%", padding:11, border:`1px solid ${T.warning}`, borderRadius:8, background:"transparent", color:T.warning, fontWeight:700, cursor:previewLoading ? "wait" : "pointer" }}>{previewLoading ? "OPENING SAMPLE PREVIEW..." : "ENTER SAMPLE PREVIEW"}</button>
        </div>
        <p style={{ color:T.muted, fontSize:12, lineHeight:1.6, margin:"16px 0 0" }}>
          Use an access token issued by your organization identity provider. Tokens stay in memory for this browser session and are discarded when you sign out.
        </p>
        <button type="button" onClick={onBack} className="cba-btn" style={{ display:"block", margin:"14px auto 0", padding:"8px 12px", border:`1px solid ${T.border}`, borderRadius:8, background:"transparent", color:T.muted, cursor:"pointer" }}>Back to service dashboard</button>
      </Panel>
    </div>
  );
}

function PublicStatusDashboard({ onSignIn }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setStatus(await apiRequest("/api/v1/arena/public-status"));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const services = [
    ["Pod Delta", "Gateway, event broker and cache", "pod_delta"],
    ["Pod Beta · Campaigns", "Campaign catalog API", "pod_beta_campaigns"],
    ["Pod Beta · Engagements", "Engagement API", "pod_beta_engagements"],
    ["Pod Gamma", "Leaderboard and benchmark API", "pod_gamma"],
    ["Pod Alpha", "Wallet service API", "wallet_service"],
  ];
  const byName = new Map((status?.services || []).map(item => [item.service, item]));
  const healthyCount = services.filter(([, , key]) => byName.get(key)?.status === "healthy").length;
  const respondingCount = services.filter(([, , key]) => ["healthy", "degraded"].includes(byName.get(key)?.status)).length;
  const stateColor = value => value === "healthy" ? T.safe : value === "checking" ? T.warning : T.danger;

  return (
    <div className="cba-app-shell" style={{ minHeight:"100vh", padding:"28px 18px", background:T.bg, backgroundImage:"radial-gradient(ellipse at 78% 0%, rgba(7,131,95,.08), transparent 42%), linear-gradient(145deg, #f3f7f5 0%, #edf4f0 58%, #f8fbf9 100%)" }}>
      <ParticleField color={T.neon} density={55} />
      <main style={{ maxWidth:1180, margin:"0 auto", position:"relative", zIndex:1 }}>
        <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, padding:"10px 4px 22px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <img src="/cybreach-logo.png" alt="CyBreach company shield" style={{ width:48, height:48, objectFit:"contain" }} />
            <div><strong style={{ display:"block", color:T.text, fontFamily:T.fontDisplay, fontSize:18 }}>CYBREACH ARENA</strong><span style={{ color:T.muted, fontSize:12 }}>Security operations</span></div>
          </div>
          <button type="button" onClick={onSignIn} className="cba-btn" style={{ padding:"10px 15px", border:0, borderRadius:8, background:T.neon, color:"#fff", fontWeight:700, cursor:"pointer" }}>Sign in</button>
        </header>

        <section style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-end", justifyContent:"space-between", gap:16, padding:"28px 2px 20px" }}>
          <div><Eyebrow>PUBLIC SYSTEM STATUS</Eyebrow><h1 style={{ fontFamily:T.fontDisplay, fontSize:34, margin:"8px 0" }}>Arena service dashboard</h1><p style={{ color:T.muted, margin:0 }}>Live API reachability for the connected pods.</p></div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ color:T.muted, fontSize:13 }}>{loading ? "Checking services…" : `${healthyCount} healthy · ${respondingCount} of ${services.length} responding`}</span>
            <button type="button" onClick={refresh} disabled={loading} className="cba-btn" style={{ padding:"9px 12px", border:`1px solid ${T.border}`, borderRadius:8, background:T.surface, color:T.text, cursor:loading ? "wait" : "pointer" }}>{loading ? "Checking" : "Refresh"}</button>
          </div>
        </section>

        {error && <Panel style={{ marginBottom:12 }}><p role="alert" style={{ color:T.danger, margin:0 }}>Could not load live service status: {error}</p></Panel>}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12 }}>
          {services.map(([name, description, key]) => {
            const current = byName.get(key)?.status || (loading ? "checking" : "unknown");
            return <Panel key={key} style={{ minHeight:132 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}><strong style={{ fontSize:15 }}>{name}</strong><span style={{ display:"inline-flex", alignItems:"center", gap:7, color:stateColor(current), fontSize:11, fontWeight:700, textTransform:"uppercase" }}><i style={{ width:8, height:8, borderRadius:"50%", background:stateColor(current), display:"inline-block" }} />{current.replaceAll("_", " ")}</span></div>
              <p style={{ color:T.muted, fontSize:13, margin:"12px 0 0" }}>{description}</p>
            </Panel>;
          })}
        </div>

        <div className="cba-two-col" style={{ display:"grid", gridTemplateColumns:"1.2fr .8fr", gap:12, marginTop:14 }}>
          <Panel><SectionHeader title="What you’re seeing" /><p style={{ color:T.muted, fontSize:13, lineHeight:1.6, margin:0 }}>These cards make live HTTP health checks against the configured pod APIs. They confirm reachability only; they don’t verify tenant data, transactions, or cross-pod event flow.</p>{status?.checked_at && <p style={{ color:T.muted, fontSize:11, margin:"12px 0 0" }}>Last checked: {new Date(status.checked_at).toLocaleString()}</p>}</Panel>
          <Panel><SectionHeader title="Account dashboard" action="SIGN IN REQUIRED" /><p style={{ color:T.muted, fontSize:13, lineHeight:1.6 }}>Wallet balances, transaction history, campaigns, rankings, and tenant analytics are account-specific and stay behind sign-in.</p><button type="button" onClick={onSignIn} className="cba-btn" style={{ marginTop:6, padding:"9px 12px", border:0, borderRadius:8, background:T.neon, color:"#fff", fontWeight:700, cursor:"pointer" }}>Connect an account</button></Panel>
        </div>
        <footer style={{ padding:"18px 2px", color:T.muted, fontSize:11 }}>Status source: Pod Delta gateway · no account data is shown on this page.</footer>
      </main>
    </div>
  );
}

function CampaignLibrary({ campaigns, error }) {
  if (error) {
    return <Panel><SectionHeader title="Campaign Library" /><p style={{ color:T.warn }}>{error}</p></Panel>;
  }
  if (!campaigns?.length) {
    return <Panel><SectionHeader title="Campaign Library" /><p style={{ color:T.muted }}>No campaigns returned by Pod Beta.</p></Panel>;
  }
  return (
    <Panel>
      <SectionHeader title="Campaign Library" action={`${campaigns.length} FROM POD BETA`} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:12 }}>
        {campaigns.map(campaign => (
          <div key={campaign.campaign_id} style={{ padding:16, border:`1px solid ${T.border}`, borderRadius:10, background:"rgba(255,255,255,.02)" }}>
            <div style={{ color:T.neon, font:"11px 'IBM Plex Mono',monospace", textTransform:"uppercase" }}>{campaign.tier}</div>
            <h3 style={{ marginTop:8, fontSize:16 }}>{campaign.title}</h3>
            <p style={{ marginTop:8, color:T.muted, lineHeight:1.5 }}>{campaign.description}</p>
            <div style={{ marginTop:12, color:T.text, font:"12px 'IBM Plex Mono',monospace" }}>
              {campaign.credit_cost} credits · {(campaign.regions || []).join(", ")}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function BenchmarkPanel({ token }) {
  const [cohorts, setCohorts] = useState([]);
  const [minimumPeerCount, setMinimumPeerCount] = useState(null);
  const [cohort, setCohort] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cohortsLoading, setCohortsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setCohortsLoading(true);
    setError("");
    apiRequest("/api/v1/arena/benchmark/cohorts", { token })
      .then(response => {
        if (!active) return;
        setCohorts(response.cohorts || []);
        setMinimumPeerCount(response.minimum_peer_count);
        setCohort(current => (
          current && response.cohorts?.some(item =>
            item.industry === current.industry
            && item.region === current.region
            && item.size_band === current.size_band
          )
            ? current
            : response.cohorts?.[0] || null
        ));
      })
      .catch(requestError => {
        if (active) setError(`Could not load supported peer cohorts: ${requestError.message}`);
      })
      .finally(() => {
        if (active) setCohortsLoading(false);
      });
    return () => { active = false; };
  }, [token]);

  async function compare(event) {
    event.preventDefault();
    if (!cohort) return;
    setError("");
    setLoading(true);
    try {
      setResult(await apiRequest("/api/v1/arena/benchmark", {
        token, method:"POST", body:cohort,
      }));
    } catch (requestError) {
      setResult(null);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  const industries = [...new Set(cohorts.map(item => item.industry))];
  const regions = [...new Set(cohorts.filter(item => item.industry === cohort?.industry).map(item => item.region))];
  const sizeBands = [...new Set(cohorts.filter(item => item.industry === cohort?.industry && item.region === cohort?.region).map(item => item.size_band))];

  function updateCohort(field, value) {
    setResult(null);
    setError("");
    if (field === "industry") {
      const matching = cohorts.filter(item => item.industry === value);
      if (matching.length) setCohort({ industry:value, region:matching[0].region, size_band:matching[0].size_band });
      return;
    }
    if (field === "region") {
      const matching = cohorts.filter(item => item.industry === cohort?.industry && item.region === value);
      if (matching.length) setCohort({ ...cohort, region:value, size_band:matching[0].size_band });
      return;
    }
    const matching = cohorts.find(item => item.industry === cohort?.industry && item.region === cohort?.region && item.size_band === value);
    if (matching) setCohort({ ...cohort, size_band:value });
  }

  const fieldStyle = { padding:10, background:T.bg, border:`1px solid ${T.border}`, color:T.text, borderRadius:8 };
  return (
    <Panel>
      <SectionHeader title="Benchmark comparison" action="SEEDED DEMO DATA" />
      <p style={{ color:T.muted, marginBottom:16 }}>These cohort values are synthetic demonstration data, not real organization or industry measurements. Gamma only lists groups meeting its minimum peer threshold.</p>
      <form onSubmit={compare} style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:18 }}>
        {[
          ["industry", industries],
          ["region", regions],
          ["size_band", sizeBands],
        ].map(([key, values]) => (
          <label key={key} style={{ display:"grid", gap:5, color:T.muted, fontSize:11, textTransform:"uppercase" }}>
            {key.replace("_"," ")}
            <select
              value={cohort?.[key] || ""}
              onChange={event => updateCohort(key, event.target.value)}
              disabled={cohortsLoading || values.length === 0}
              style={fieldStyle}
            >
              {values.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        ))}
        <button className="cba-btn" type="submit" disabled={loading || cohortsLoading || !cohort} style={{ alignSelf:"end", padding:"10px 16px", background:T.neon, border:0, borderRadius:8, color:"#141625", fontWeight:700, cursor:"pointer", opacity:loading || cohortsLoading || !cohort ? .65 : 1 }}>
          {cohortsLoading ? "Loading cohorts…" : loading ? "Comparing…" : "Compare cohort"}
        </button>
      </form>
      {!cohortsLoading && cohorts.length > 0 && (
        <p style={{ color:T.muted, fontSize:11, marginBottom:12 }}>
          {cohorts.length} seeded cohorts · minimum {minimumPeerCount} peers
        </p>
      )}
      {error && <p role="alert" style={{ color:T.warn }}>{error}</p>}
      {!cohortsLoading && !error && cohorts.length === 0 && <p role="status" style={{ color:T.muted }}>Pod Gamma returned no cohorts that meet the minimum peer threshold.</p>}
      {result && (
        <div style={{ padding:14, border:`1px solid ${T.border}`, borderRadius:8 }}>
          {result.label && <div style={{ color:T.safe, font:"11px 'IBM Plex Mono',monospace", textTransform:"uppercase" }}>{result.label}</div>}
          <div style={{ display:"flex", flexWrap:"wrap", gap:24, marginTop:10 }}>
            <span>Peer group: <strong>{result.peer_count}</strong></span>
            <span>Median: <strong>{result.peer_median}</strong></span>
            <span>25th–75th: <strong>{result.peer_25th}–{result.peer_75th}</strong></span>
          </div>
        </div>
      )}
    </Panel>
  );
}

function ConnectionsPanel({ connections, loading, refresh }) {
  return (
    <Panel>
      <SectionHeader title="Pod Connectivity" action={loading ? "CHECKING…" : "REFRESH"} onAction={refresh} />
      <p style={{ color:T.muted, marginBottom:14 }}>Browser requests are routed through Pod Delta. Service URLs and credentials are not exposed to the browser.</p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:10 }}>
        {(connections ? [connections.pod_delta, ...connections.upstreams] : []).map(item => (
          <div key={item.service} style={{ display:"flex", justifyContent:"space-between", padding:12, border:`1px solid ${T.border}`, borderRadius:8 }}>
            <span>{item.service === "wallet_service" ? "Pod Alpha wallet service" : item.service.replaceAll("_"," ")}</span>
            <strong style={{ color:item.status === "healthy" ? T.safe : T.warn }}>{item.status}</strong>
          </div>
        ))}
      </div>
      {connections?.mode === "development_demo" && (
        <p style={{ marginTop:14, color:T.warn, fontSize:12 }}>Development-only identity. Do not use this mode in production.</p>
      )}
      {!connections && !loading && <p style={{ color:T.warn }}>No connection status received yet.</p>}
    </Panel>
  );
}

function RecommendationsPanel({ data, error }) {
  if (error) return <Panel><SectionHeader title="Engagement Recommendations" /><p style={{ color:T.warn }}>{error}</p></Panel>;
  if (!data) return <Panel><SectionHeader title="Engagement Recommendations" /><p style={{ color:T.muted }}>No recommendation response received from Pod Beta.</p></Panel>;
  return (
    <Panel style={{ marginTop:16 }}>
      <SectionHeader title="Engagement Recommendations" action="POD BETA" />
      <p style={{ color:T.muted, marginBottom:12 }}>{data.unresolved_gap_count} unresolved validated gaps</p>
      {data.guidance_notice && <p style={{ color:T.muted, fontSize:12, marginBottom:12 }}>{data.guidance_notice}</p>}
      {(data.recommendations || []).map((item, index) => (
        <div key={`${item.campaign_id}-${index}`} style={{ padding:"12px 0", borderTop:`1px solid ${T.border}` }}>
          <strong>{item.title}</strong>
          <div style={{ marginTop:5, color:T.muted, fontSize:12 }}>{item.reason} · {item.credit_cost} credits</div>
        </div>
      ))}
    </Panel>
  );
}

function NotificationsPanel({ notifications, preferences, error, demoMode }) {
  if (error) return <Panel><SectionHeader title="Notifications" /><p style={{ color:T.warn }}>{error}</p></Panel>;
  const items = notifications?.notifications || [];
  return (
    <Panel>
      <SectionHeader title="Arena Notifications" action={demoMode ? "SIMULATED DEMO EVENTS" : `${notifications?.total ?? 0} EVENTS`} />
      {demoMode && (
        <p style={{ color:T.warning, marginBottom:12 }}>
          Demo events are generated by simulated top-ups and scans. No email or external notification is sent.
        </p>
      )}
      {preferences && (
        <p style={{ color:T.muted, fontSize:12, marginBottom:12 }}>
          Preferences · email {preferences.email_enabled ? "on" : "off"} · in-app {preferences.in_app_enabled ? "on" : "off"} · frequency {preferences.frequency}
        </p>
      )}
      {items.map(item => (
        <div key={item.id} style={{ padding:"12px 0", borderTop:`1px solid ${T.border}` }}>
          <strong>{item.title}</strong>
          <div style={{ color:T.muted, marginTop:5 }}>{item.message}</div>
          <div style={{ color:T.muted, marginTop:5, fontSize:11 }}>{item.channel} · {item.status} · {item.created_at}</div>
        </div>
      ))}
      {!items.length && <p style={{ color:T.muted }}>No notifications have been generated yet.</p>}
    </Panel>
  );
}

function AnalyticsPanel({ data, error }) {
  if (error) return <Panel><SectionHeader title="Tenant Analytics" /><p style={{ color:T.warn }}>{error}</p></Panel>;
  if (!data) return <Panel><SectionHeader title="Tenant Analytics" /><p style={{ color:T.muted }}>No analytics response received from Pod Delta.</p></Panel>;
  const fields = [
    ["Resilience score", data.resilience_score],
    ["Active users", `${data.active_users}/${data.total_users}`],
    ["Visits", data.total_visits],
    ["Uptime", `${data.uptime_percentage}%`],
    ["Errors", data.error_count],
  ];
  return (
    <Panel>
      <SectionHeader title={`Tenant Analytics · ${data.tenant_name}`} action={data.source === "simulated_demo" ? "SIMULATED DEMO DATA" : "POD DELTA"} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
        {fields.map(([label, value]) => (
          <div key={label} style={{ padding:14, border:`1px solid ${T.border}`, borderRadius:8 }}>
            <div style={{ color:T.muted, fontSize:11 }}>{label}</div>
            <strong style={{ display:"block", marginTop:8, fontSize:20 }}>{value}</strong>
          </div>
        ))}
      </div>
      {data.source === "simulated_demo" && (
        <p style={{ color:T.warning, fontSize:11, marginTop:14 }}>
          These metrics are generated for the demo account and are not production analytics.
        </p>
      )}
    </Panel>
  );
}

function DashboardOverview({ connections, campaigns, leaderboard, leaderboardConnected, walletData, walletEntries, analytics, token, onNavigate, demoMode }) {
  const services = connections ? [connections.pod_delta, ...connections.upstreams] : [];
  const healthyServices = services.filter(service => service.status === "healthy").length;
  const tenant = tokenClaim(token, "tenant_id") || "Tenant unavailable";
  const cards = [
    { label:"Service health", value:services.length ? `${healthyServices}/${services.length}` : "Checking", detail:"Configured APIs responding", color:healthyServices === services.length && services.length ? T.safe : T.warning },
    { label:demoMode ? "Sample balance" : "Pod Alpha balance", value:walletData ? `${walletData.available_balance} ${walletData.currency}` : "No wallet data", detail:demoMode ? "Fictional preview account" : "Authenticated wallet ledger", color:walletData ? T.text : T.muted },
    { label:"Pod Beta campaigns", value:campaigns.length, detail:"Live campaign definitions", color:T.text },
    { label:"Pod Gamma rankings", value:leaderboardConnected ? leaderboard.length : "Unavailable", detail:"Live leaderboard entries", color:leaderboardConnected ? T.text : T.warning },
  ];
  const roles = [
    ["Pod Alpha", "Wallet ledger, balances, transaction audit, subscriptions and budget controls."],
    ["Pod Beta", "Campaign catalog, recommendations and engagement lifecycle."],
    ["Pod Gamma", "Live leaderboard scores and database-backed, privacy-thresholded benchmarks."],
    ["Pod Delta", "Authenticated web gateway, notifications, analytics and event integration."],
  ];
  const sessionExpiry = Number(tokenClaim(token, "exp"));

  return (
    <>
      <Panel style={{ marginBottom:16, padding:24 }}>
        <Eyebrow>ARENA OPERATIONS ? {tenant}</Eyebrow>
        <h2 style={{ fontFamily:T.fontDisplay, fontSize:28, margin:"8px 0" }}>Service and account overview</h2>
        <p style={{ color:T.muted, margin:0, lineHeight:1.6 }}>{demoMode ? "Sample preview account with fictional activity. Service status is checked live; account values are not real." : "Live values appear only when the owning pod returns data. Empty states mean no operational record is available yet; this dashboard does not substitute sample values."}</p>
      </Panel>

      <div className="cba-hero-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:12, marginBottom:16 }}>
        {cards.map(card => <Panel key={card.label}><Eyebrow>{card.label}</Eyebrow><strong style={{ display:"block", marginTop:10, color:card.color, font:"700 24px 'IBM Plex Mono',monospace" }}>{card.value}</strong><span style={{ display:"block", marginTop:6, color:T.muted, fontSize:12 }}>{card.detail}</span></Panel>)}
      </div>

      <div className="cba-two-col" style={{ display:"grid", gridTemplateColumns:"1.15fr .85fr", gap:14 }}>
        <Panel>
          <SectionHeader title={demoMode ? "Sample wallet activity" : "Recent Pod Alpha transactions"} action="View wallet" onAction={() => onNavigate("Wallet")} />
          {walletEntries?.length ? walletEntries.slice(0, 5).map(entry => (
            <div key={entry.id || `${entry.reference_id}-${entry.created_at}`} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, padding:"11px 0", borderTop:`1px solid ${T.border}` }}>
              <span style={{ minWidth:0 }}><strong style={{ display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{entry.reference_id || entry.transaction_type || "Wallet entry"}</strong><small style={{ color:T.muted }}>{entry.created_at ? new Date(entry.created_at).toLocaleString() : ""} | {entry.module_source || "system"}</small></span>
              <strong style={{ color:entry.entry_type?.toUpperCase() === "CREDIT" ? T.safe : T.text }}>{entry.entry_type?.toUpperCase() === "CREDIT" ? "+" : "-"}{entry.amount} {entry.currency}</strong>
            </div>
          )) : <div style={{ padding:"26px 12px", textAlign:"center", color:T.muted, borderTop:`1px solid ${T.border}` }}><strong style={{ display:"block", color:T.text, marginBottom:5 }}>No transaction data loaded</strong>{demoMode ? "No sample activity is available." : "Connect a wallet session or create a real wallet transaction to see activity."}</div>}
        </Panel>
        <Panel>
          <SectionHeader title="Session and tenant" action="SECURE SESSION" />
          <div style={{ padding:"12px 0", borderTop:`1px solid ${T.border}` }}><span style={{ color:T.muted, fontSize:12 }}>Authentication</span><strong style={{ display:"block", marginTop:5 }}>Signed access token validated</strong></div>
          <div style={{ padding:"12px 0", borderTop:`1px solid ${T.border}` }}><span style={{ color:T.muted, fontSize:12 }}>Tenant</span><strong style={{ display:"block", marginTop:5, overflowWrap:"anywhere" }}>{tenant}</strong></div>
          <div style={{ padding:"12px 0", borderTop:`1px solid ${T.border}` }}><span style={{ color:T.muted, fontSize:12 }}>Token expiry</span><strong style={{ display:"block", marginTop:5 }}>{Number.isFinite(sessionExpiry) ? new Date(sessionExpiry * 1000).toLocaleString() : "Not provided"}</strong></div>
          {analytics?.source && <div style={{ color:T.muted, fontSize:11, marginTop:8 }}>Activity source: {analytics.source}</div>}
        </Panel>
      </div>

      <Panel style={{ marginTop:14 }}>
        <SectionHeader title="Pod responsibilities" action="LIVE SERVICE ROUTING" />
        <div className="cba-two-col" style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:10 }}>
          {roles.map(([title, description]) => <div key={title} style={{ padding:13, border:`1px solid ${T.border}`, borderRadius:8, background:T.surface3 }}><strong style={{ display:"block", marginBottom:5 }}>{title}</strong><span style={{ color:T.muted, fontSize:12, lineHeight:1.55 }}>{description}</span></div>)}
        </div>
        <p style={{ color:T.warning, fontSize:12, lineHeight:1.55, margin:"13px 0 0" }}>The browser calls Pod Delta, which routes feature requests to the owning pod. Service health confirms API reachability; Beta lifecycle events are not yet wired into Gamma rankings, so no cross-pod update is implied.</p>
      </Panel>

      <Panel style={{ marginTop:14 }}>
        <SectionHeader title="Quick actions" />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:9 }}>
          {[["Wallet","Open wallet operations"],["Campaigns","View Pod Beta campaigns"],["Leaderboard","View Pod Gamma rankings"],["Services","Inspect connectivity"]].map(([tab, label]) => <button key={tab} onClick={() => onNavigate(tab)} className="cba-btn" style={{ padding:12, textAlign:"left", background:T.surface3, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, cursor:"pointer" }}>{label} <span style={{ color:T.neon }}>?</span></button>)}
        </div>
      </Panel>
    </>
  );
}

function SampleBillingPanel({ onCheckout }) {
  const [packageId, setPackageId] = useState("starter");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const packages = {
    starter:{ label:"Starter", credits:250, amount:"$4.99" },
    operator:{ label:"Operator", credits:750, amount:"$9.99" },
    enterprise:{ label:"Enterprise", credits:2000, amount:"$19.99" },
  };

  function submit(event) {
    event.preventDefault();
    onCheckout({
      packageId,
      customer:{ name:customerName.trim(), email:customerEmail.trim(), billingAddress:billingAddress.trim() },
      checkoutId:crypto.randomUUID(),
      product:packages[packageId],
    });
  }

  return (
    <Panel style={{ marginBottom:16 }}>
      <SectionHeader title="Billing & Sample Credits" action="SIMULATED ONLY" />
      <p style={{ color:T.muted, fontSize:12, lineHeight:1.55, margin:"0 0 14px" }}>Choose a sample package and enter billing details, then review it on the checkout screen. Nothing here contacts a payment provider or charges money.</p>
      <form onSubmit={submit} style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,240px),1fr))", gap:12, alignItems:"end" }}>
        <label style={{ display:"grid", minWidth:0, gap:6, color:T.text, fontSize:12 }}>Credit package
          <select value={packageId} onChange={event => setPackageId(event.target.value)} style={{ width:"100%", minWidth:0, boxSizing:"border-box", padding:10, border:`1px solid ${T.border}`, borderRadius:7, background:T.surface3, color:T.text }}>
            {Object.entries(packages).map(([id, item]) => <option key={id} value={id}>{item.label} · {item.credits.toLocaleString()} CR · {item.amount} sample</option>)}
          </select>
        </label>
        <label style={{ display:"grid", minWidth:0, gap:6, color:T.text, fontSize:12 }}>Name
          <input required minLength={2} value={customerName} onChange={event => setCustomerName(event.target.value)} autoComplete="name" style={{ width:"100%", minWidth:0, boxSizing:"border-box", padding:10, border:`1px solid ${T.border}`, borderRadius:7, background:T.surface3, color:T.text }} />
        </label>
        <label style={{ display:"grid", minWidth:0, gap:6, color:T.text, fontSize:12 }}>Email
          <input required type="email" value={customerEmail} onChange={event => setCustomerEmail(event.target.value)} autoComplete="email" style={{ width:"100%", minWidth:0, boxSizing:"border-box", padding:10, border:`1px solid ${T.border}`, borderRadius:7, background:T.surface3, color:T.text }} />
        </label>
        <label style={{ display:"grid", minWidth:0, gap:6, color:T.text, fontSize:12 }}>Billing address
          <input required minLength={5} value={billingAddress} onChange={event => setBillingAddress(event.target.value)} autoComplete="street-address" style={{ width:"100%", minWidth:0, boxSizing:"border-box", padding:10, border:`1px solid ${T.border}`, borderRadius:7, background:T.surface3, color:T.text }} />
        </label>
        <button type="submit" className="cba-btn" style={{ minHeight:40, padding:"10px 14px", border:0, borderRadius:8, background:T.neon, color:"#fff", fontWeight:700, cursor:"pointer" }}>CONTINUE TO CHECKOUT</button>
      </form>
    </Panel>
  );
}

function SampleCheckoutModal({ order, loading, onClose, onConfirm }) {
  const [paymentMethod, setPaymentMethod] = useState("demo_card");
  const [cardholder, setCardholder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [upiId, setUpiId] = useState("");
  if (!order) return null;
  const inputStyle = { width:"100%", padding:10, border:`1px solid ${T.border}`, borderRadius:7, background:T.surface3, color:T.text };
  const inputLabelStyle = { display:"grid", gap:6, color:T.text, fontSize:12 };
  const inputProps = { required:true, autoComplete:"off", disabled:loading, style:inputStyle };

  function submit(event) {
    event.preventDefault();
    // Sensitive-looking sample fields are intentionally not passed to the API.
    onConfirm(order, paymentMethod);
  }
  return (
    <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !loading) onClose(); }} style={{ position:"fixed", inset:0, zIndex:290, display:"grid", placeItems:"center", padding:18, background:"rgba(15,28,23,.62)", backdropFilter:"blur(5px)" }}>
      <section role="dialog" aria-modal="true" aria-labelledby="checkout-title" style={{ width:"min(540px,100%)", maxHeight:"90vh", overflowY:"auto", padding:22, border:`1px solid ${T.border}`, borderRadius:14, background:T.surface, boxShadow:"0 24px 80px rgba(0,0,0,.24)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}><div><Eyebrow>LOCAL TEST CHECKOUT</Eyebrow><h2 id="checkout-title" style={{ marginTop:6, fontFamily:T.fontDisplay, fontSize:24 }}>Review payment</h2></div><button type="button" disabled={loading} onClick={onClose} className="cba-btn" style={{ padding:"6px 10px", border:`1px solid ${T.border}`, borderRadius:7, background:"transparent", color:T.text, cursor:loading ? "wait" : "pointer" }}>Back</button></div>
        <p style={{ margin:"16px 0", padding:12, borderRadius:8, background:`${T.warning}12`, color:T.warning, fontSize:12, lineHeight:1.55 }}>Preview only. Enter fictitious values, never real card or bank details. These fields stay in this browser and are not sent or saved; no payment provider or bank is contacted.</p>
        <div style={{ padding:14, border:`1px solid ${T.border}`, borderRadius:9, display:"grid", gap:9, fontSize:13 }}><div style={{ display:"flex", justifyContent:"space-between", gap:12 }}><span>{order.product.label} sample credits</span><strong>{order.product.credits.toLocaleString()} CR</strong></div><div style={{ display:"flex", justifyContent:"space-between", gap:12 }}><span>Sample amount</span><strong>{order.product.amount} USD</strong></div><div style={{ display:"flex", justifyContent:"space-between", gap:12, color:T.muted }}><span>Customer</span><span>{order.customer.name}</span></div><div style={{ display:"flex", justifyContent:"space-between", gap:12, color:T.muted }}><span>Email</span><span style={{ overflowWrap:"anywhere" }}>{order.customer.email}</span></div></div>
        <form onSubmit={submit}>
          <label style={{ display:"grid", gap:7, marginTop:16, color:T.text, fontSize:12 }}>Payment method<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)} disabled={loading} style={{ padding:11, border:`1px solid ${T.border}`, borderRadius:7, background:T.surface3, color:T.text }}><option value="demo_card">Card details (test only)</option><option value="demo_bank">Bank transfer details (test only)</option><option value="demo_upi">UPI details (test only)</option></select></label>
          {paymentMethod === "demo_card" && <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:10, marginTop:12 }}>
            <label style={{ ...inputLabelStyle, gridColumn:"1 / -1" }}>Cardholder name<input {...inputProps} value={cardholder} onChange={event => setCardholder(event.target.value)} minLength={2} placeholder="TEST CUSTOMER" /></label>
            <label style={{ ...inputLabelStyle, gridColumn:"1 / -1" }}>Card number<input {...inputProps} value={cardNumber} onChange={event => setCardNumber(event.target.value)} inputMode="numeric" maxLength={23} pattern="[0-9 ]{13,23}" placeholder="4242 4242 4242 4242" /></label>
            <label style={inputLabelStyle}>Expiry (MM/YY)<input {...inputProps} value={expiry} onChange={event => setExpiry(event.target.value)} pattern="(0[1-9]|1[0-2])/[0-9]{2}" placeholder="12/30" /></label>
            <label style={inputLabelStyle}>Security code<input {...inputProps} value={securityCode} onChange={event => setSecurityCode(event.target.value)} inputMode="numeric" pattern="[0-9]{3,4}" maxLength={4} placeholder="123" /></label>
          </div>}
          {paymentMethod === "demo_bank" && <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:10, marginTop:12 }}>
            <label style={inputLabelStyle}>Bank name<input {...inputProps} value={bankName} onChange={event => setBankName(event.target.value)} minLength={2} placeholder="Sample Bank" /></label>
            <label style={inputLabelStyle}>Account holder<input {...inputProps} value={accountHolder} onChange={event => setAccountHolder(event.target.value)} minLength={2} placeholder="TEST CUSTOMER" /></label>
            <label style={inputLabelStyle}>Account number<input {...inputProps} value={accountNumber} onChange={event => setAccountNumber(event.target.value)} inputMode="numeric" pattern="[0-9]{6,18}" maxLength={18} placeholder="Test account number" /></label>
            <label style={inputLabelStyle}>IFSC / bank code<input {...inputProps} value={bankCode} onChange={event => setBankCode(event.target.value)} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" maxLength={11} placeholder="TEST0001234" /></label>
          </div>}
          {paymentMethod === "demo_upi" && <label style={{ ...inputLabelStyle, marginTop:12 }}>UPI ID<input {...inputProps} value={upiId} onChange={event => setUpiId(event.target.value)} pattern="[^\s@]+@[^\s@]+" placeholder="test-user@sample" /></label>}
          <div style={{ display:"flex", gap:9, marginTop:16 }}><button type="button" disabled={loading} onClick={onClose} className="cba-btn" style={{ flex:1, padding:11, border:`1px solid ${T.border}`, borderRadius:8, background:"transparent", color:T.text, cursor:"pointer" }}>Cancel</button><button type="submit" disabled={loading} className="cba-btn" style={{ flex:2, padding:11, border:0, borderRadius:8, background:T.neon, color:"#fff", fontWeight:700, cursor:loading ? "wait" : "pointer" }}>{loading ? "PROCESSING SAMPLE PAYMENT…" : `PAY ${order.product.amount} (SIMULATION)`}</button></div>
        </form>
      </section>
    </div>
  );
}

function PaymentReceiptModal({ receipt, onClose, onRefund, refunding }) {
  if (!receipt) return null;
  const packageLine = receipt.line_items?.[0] || {};
  return (
    <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} style={{ position:"fixed", inset:0, zIndex:300, display:"grid", placeItems:"center", padding:18, background:"rgba(15,28,23,.62)", backdropFilter:"blur(5px)" }}>
      <section role="dialog" aria-modal="true" aria-labelledby="receipt-title" style={{ width:"min(520px,100%)", maxHeight:"90vh", overflowY:"auto", padding:22, border:`1px solid ${T.border}`, borderRadius:14, background:T.surface, boxShadow:"0 24px 80px rgba(0,0,0,.24)" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
          <div><Eyebrow>PAYMENT RECEIPT · SAMPLE PREVIEW</Eyebrow><h2 id="receipt-title" style={{ marginTop:6, fontFamily:T.fontDisplay, fontSize:24 }}>Receipt</h2></div>
          <button type="button" onClick={onClose} aria-label="Close receipt" className="cba-btn" style={{ padding:"6px 10px", border:`1px solid ${T.border}`, borderRadius:7, background:"transparent", color:T.text, cursor:"pointer" }}>Close</button>
        </div>
        <p style={{ margin:"16px 0", padding:12, borderRadius:8, background:`${T.warning}12`, color:T.warning, fontSize:12, lineHeight:1.5 }}>{receipt.notice || "Sample preview receipt. No real payment was made."}</p>
        <div style={{ display:"grid", gap:10 }}>
          {[["Receipt number",receipt.receipt_number],["Status",receipt.status?.replaceAll("_"," ")],["Issued",receipt.issued_at ? new Date(receipt.issued_at).toLocaleString() : "—"],["Customer",receipt.customer?.name],["Email",receipt.customer?.email],["Billing address",receipt.customer?.billing_address],["Package",packageLine.description],["Credits",`${Number(receipt.credits_added || packageLine.credits || 0).toLocaleString()} CR`],["Payment method",receipt.payment?.method_label || receipt.payment?.method],["Total",`${receipt.total ?? receipt.payment?.amount ?? 0} ${receipt.currency || receipt.payment?.currency || "USD"}`],["Reference",receipt.payment?.reference]].map(([label,value]) => (
            <div key={label} style={{ display:"grid", gridTemplateColumns:"130px 1fr", gap:10, paddingBottom:9, borderBottom:`1px solid ${T.border}`, fontSize:12 }}><span style={{ color:T.muted }}>{label}</span><strong style={{ overflowWrap:"anywhere", textTransform:label === "Status" ? "capitalize" : undefined }}>{value || "—"}</strong></div>
          ))}
        </div>
        {receipt.refund && <div style={{ marginTop:14, padding:12, border:`1px solid ${T.warning}66`, borderRadius:8, color:T.warning, fontSize:12, lineHeight:1.6 }}><strong>Sample refund processed</strong><br />{receipt.refund.amount} {receipt.refund.currency} · {Number(receipt.refund.credits_reversed).toLocaleString()} CR reversed<br />Reference: {receipt.refund.reference}<br />{new Date(receipt.refund.refunded_at).toLocaleString()}</div>}
        {!receipt.refund && <button type="button" disabled={refunding} onClick={() => onRefund(receipt)} className="cba-btn" style={{ width:"100%", marginTop:16, padding:11, border:`1px solid ${T.warning}`, borderRadius:8, background:"transparent", color:T.warning, fontWeight:700, cursor:refunding ? "wait" : "pointer" }}>{refunding ? "PROCESSING SAMPLE REFUND…" : "REFUND SAMPLE PAYMENT"}</button>}
      </section>
    </div>
  );
}

function Nav({ activeTab, setActiveTab, token, onLogout }) {
  const tabs = ["Dashboard","Campaigns","Leaderboard","Benchmark","Wallet","Notifications","Analytics","Services"];
  const accountName = tokenClaim(token, "name") || tokenClaim(token, "preferred_username") || tokenClaim(token, "sub") || "Signed-in user";
  const initials = accountName.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join("");
  return (
    <nav className="cba-nav" style={{
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:"14px 32px",
      borderBottom:`1px solid ${T.border}`,
      background:"rgba(7,45,35,.97)",
      backdropFilter:"blur(12px)",
      position:"sticky", top:0, zIndex:100,
    }}>
      <div className="cba-nav-inner" style={{ width:"98%", maxWidth:1600, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <div className="cba-nav-brand" style={{ fontFamily:T.fontDisplay, fontSize:19, fontWeight:700, color:T.neon, letterSpacing:"0.04em", display:"flex", alignItems:"center", gap:8 }}>
        <img src="/cybreach-logo.png" alt="" aria-hidden="true" style={{ width:34, height:34, objectFit:"contain", flex:"0 0 auto" }} />
        <span className="cba-brand-label">CYBREACH ARENA</span>
      </div>

      <div className="cba-nav-tabs" style={{ display:"flex", gap:4 }}>
        {tabs.map(t => (
          <button
            key={t}
            className="cba-nav-tab"
            data-short={{ Dashboard:"DB", Campaigns:"CA", Leaderboard:"LB", Benchmark:"BM", Wallet:"WA", Notifications:"NO", Analytics:"AN", Services:"SV" }[t]}
            aria-current={activeTab === t ? "page" : undefined}
            onClick={() => setActiveTab(t)}
            style={{
              background:"none", border:"none",
              color: activeTab===t ? T.neon : T.muted,
              fontFamily:"'IBM Plex Sans',sans-serif",
              fontSize:14, fontWeight: activeTab===t ? 700 : 500,
              letterSpacing:"0.06em",
              padding:"6px 14px",
              cursor:"pointer",
              borderBottom: activeTab===t ? `2px solid ${T.neon}` : "2px solid transparent",
              transition:"color 0.2s, border-color 0.2s",
              textTransform:"uppercase",
            }}
          ><span className="cba-nav-label">{t}</span></button>
        ))}
      </div>

      <div className="cba-nav-account" style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div
  className="cba-user-badge"
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 10px",
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    background: "rgba(255,255,255,0.03)",
    transition: "all .2s ease",
  }}
>
  {/* Avatar */}
  <div
    className="cba-user-avatar"
    style={{
      width: 38,
      height: 38,
      borderRadius: "50%",
      background: `linear-gradient(135deg, ${T.neon}, #7386df)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#000",
      fontFamily: "'IBM Plex Mono', monospace",
      fontWeight: 700,
      boxShadow: `0 0 15px ${T.neon}55`,
    }}
  >
    {initials || "ID"}
  </div>

  {/* User Details */}
  <div className="cba-user-details" style={{ lineHeight: 1.2 }}>
    <div
      style={{
        color: T.text,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {accountName}
    </div>

    <div
      style={{
        color: T.muted,
        fontSize: 11,
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      {tokenClaim(token, "tenant_id") || "Authenticated session"}
    </div>
  </div>
</div>
      <button
        className="cba-sign-out"
        onClick={onLogout}
        aria-label="Sign out"
        style={{ padding:"8px 10px", color:T.text, background:"transparent", border:`1px solid ${T.border}`, borderRadius:7, cursor:"pointer", fontSize:12 }}
      >
        Sign out
      </button>
      </div>
      </div>
    </nav>
  );
}

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = globalCSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const [loggedIn, setLoggedIn]       = useState(false);
  const [showSignIn, setShowSignIn]   = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [accessToken, setAccessToken] = useState("");
  const [demoIdentity, setDemoIdentity] = useState(false);
  const [paymentMode, setPaymentMode] = useState("simulated");
  const [labDemoEnabled, setLabDemoEnabled] = useState(false);
  const [labTargetName, setLabTargetName] = useState("local lab");
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [demoReceipts, setDemoReceipts] = useState([]);
  const [demoEngagements, setDemoEngagements] = useState([]);
  const [currentReceipt, setCurrentReceipt] = useState(null);
  const [demoActionLoading, setDemoActionLoading] = useState(false);
  const [lastEngagement, setLastEngagement] = useState(null);
  const [connections, setConnections] = useState(null);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [apiErrors, setApiErrors] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignError, setCampaignError] = useState("");
  const [recommendations, setRecommendations] = useState(null);
  const [recommendationError, setRecommendationError] = useState("");
  const [leaderboardConnected, setLeaderboardConnected] = useState(false);
  const [leaderboardSource, setLeaderboardSource] = useState("No live ranking data");
  const [walletData, setWalletData] = useState(null);
  const [walletEntries, setWalletEntries] = useState([]);
  const [walletError, setWalletError] = useState("");
  const [walletHistoryLive, setWalletHistoryLive] = useState(false);
  const [notifications, setNotifications] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [notificationError, setNotificationError] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [activeTab, setActiveTab]     = useState("Dashboard");
  const { toasts, add: toast }        = useToasts();

  function applyDemoState(state) {
    setWalletData(state.wallet);
    setWalletError("");
    const entries = state.transactions.entries || [];
    setWalletEntries(entries);
    setTransactions(entries.map(entry => ({
      type:entry.entry_type,
      desc:entry.reference_id,
      amount:Number(entry.amount),
      currency:entry.currency || "CR",
      time:entry.created_at ? new Date(entry.created_at).toLocaleString() : "RECENT",
    })));
    const savedReceipts = state.receipts?.entries || [];
    setDemoReceipts(savedReceipts);
    const search = new URLSearchParams(window.location.search);
    if (search.get("payment") === "success") {
      const sessionId = search.get("session_id");
      const paidReceipt = savedReceipts.find(item => item.payment?.reference === sessionId);
      if (paidReceipt) {
        setCurrentReceipt(paidReceipt);
        setTopUpOpen(true);
        toast("Stripe test payment confirmed. No live funds moved.", "success");
      } else {
        toast("Checkout returned, but its signed webhook has not arrived yet. Confirm Stripe CLI is forwarding events, then sign in again.", "info");
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
    setDemoEngagements(state.engagements || []);
    setLastEngagement(state.engagements?.[0] || null);
    setWalletHistoryLive(true);
    setNotifications(state.notifications);
    setPreferences(state.preferences);
    setNotificationError("");
    setAnalytics(state.analytics);
    setAnalyticsError("");
  }

  async function refreshConnections() {
    setConnectionsLoading(true);
    try {
      setConnections(await apiRequest("/api/v1/arena/connections", { token:accessToken }));
    } catch (error) {
      toast(`Connection check failed: ${error.message}`, "info");
    } finally {
      setConnectionsLoading(false);
    }
  }

  async function handleLogin(token, { labEnabled = false, targetName = "local lab" } = {}) {
    const isPreview = tokenClaim(token, "role") === "demo";
    await apiRequest("/api/v1/arena/connections", { token });
    setAccessToken(token);
    setDemoIdentity(isPreview);
    setPaymentMode("disabled");
    setLabDemoEnabled(isPreview && labEnabled);
    setLabTargetName(targetName);
    setLoggedIn(true);
    setShowSignIn(false);
    setActiveTab("Dashboard");
    toast(isPreview ? "Sample preview loaded. Account and wallet figures are fictional." : "Connected to Arena services.", "success");
  }

  async function handlePreview() {
    const response = await apiRequest("/api/v1/auth/preview", { method:"POST", body:{} });
    await handleLogin(response.access_token, {
      labEnabled: response.lab_demo_enabled,
      targetName: response.lab_target_name,
    });
  }

  async function handleDemoTopUp(order, paymentMethod) {
    setTopUpLoading(true);
    try {
      if (paymentMode === "stripe_test") {
        const checkout = await apiRequest("/api/v1/arena/demo/top-up/stripe-checkout", {
          token:accessToken,
          method:"POST",
          body:{ package_id:order.packageId, checkout_id:order.checkoutId, customer_email:order.customer.email },
        });
        toast("Opening Stripe test checkout. No live funds will move.", "success");
        window.location.assign(checkout.checkout_url);
        return;
      }
      const result = await apiRequest("/api/v1/arena/demo/top-up", {
        token:accessToken,
        method:"POST",
        body:{
          package_id:order.packageId,
          payment_method:paymentMethod,
          checkout_id:order.checkoutId,
          customer_name:order.customer.name,
          customer_email:order.customer.email,
          billing_address:order.customer.billingAddress,
        },
      });
      applyDemoState(result.state);
      setCurrentReceipt(result.receipt);
      setPendingCheckout(null);
      setTopUpOpen(true);
      toast(result.payment.message, "success");
    } catch (error) {
      toast(`Demo top-up failed: ${error.message}`, "info");
    } finally {
      setTopUpLoading(false);
    }
  }

  async function handleDemoRefund(receipt) {
    if (!window.confirm(`Simulate a refund for receipt ${receipt.receipt_number}? The matching sample credits will be removed from the preview balance. No real payment will be refunded.`)) return;
    setRefundLoading(true);
    try {
      const result = await apiRequest("/api/v1/arena/demo/refunds", {
        token:accessToken,
        method:"POST",
        body:{ receipt_number:receipt.receipt_number },
      });
      applyDemoState(result.state);
      setCurrentReceipt(result.receipt);
      setTopUpOpen(true);
      toast(result.already_refunded ? "This sample payment was already refunded." : "Sample refund recorded and credits reversed. No real payment was refunded.", "success");
    } catch (error) {
      toast(`Sample refund could not be completed: ${error.message}`, "info");
    } finally {
      setRefundLoading(false);
    }
  }
  async function handleDemoReset() {
    try {
      const state = await apiRequest("/api/v1/arena/demo/reset", {
        token:accessToken,
        method:"POST",
      });
      applyDemoState(state);
      setLastEngagement(null);
      setCurrentReceipt(null);
      toast("Demo wallet and activity reset to the starting state.", "success");
    } catch (error) {
      toast(`Could not reset demo account: ${error.message}`, "info");
    }
  }

  function handleLogout() {
    setLoggedIn(false);
    setShowSignIn(false);
    setAccessToken("");
    setDemoIdentity(false);
    setPaymentMode("simulated");
    setLabDemoEnabled(false);
    setTopUpOpen(false);
    setLastEngagement(null);
    setConnections(null);
    setCampaigns([]);
    setCampaignError("");
    setRecommendations(null);
    setRecommendationError("");
    setLeaderboard([]);
    setLeaderboardConnected(false);
    setLeaderboardSource("No live ranking data");
    setWalletData(null);
    setWalletEntries([]);
    setWalletError("");
    setWalletHistoryLive(false);
    setTransactions([]);
    setNotifications(null);
    setPreferences(null);
    setNotificationError("");
    setAnalytics(null);
    setAnalyticsError("");
    setApiErrors([]);
    setActiveTab("Dashboard");
  }

  useEffect(() => {
    if (!accessToken) return undefined;
    let active = true;
    setConnectionsLoading(true);
    setApiErrors([]);

    const load = async (path, onSuccess, label) => {
      try {
        const data = await apiRequest(path, { token:accessToken });
        if (active) onSuccess(data);
      } catch (error) {
        if (active) {
          if (error.status === 404 && (label === "analytics" || label === "resilience score")) {
            if (label === "analytics") setAnalyticsError("No analytics record exists for this tenant yet.");
            return;
          }
          setApiErrors(current => [...current, `${label}: ${error.message}`]);
          if (label === "campaigns") setCampaignError(error.message);
          if (label === "recommendations") setRecommendationError(error.message);
          if (label === "wallet" || label === "wallet history") setWalletError(error.message);
          if (label === "notifications" || label === "preferences") setNotificationError(error.message);
          if (label === "analytics") setAnalyticsError(error.message);
        }
      }
    };

    const requests = [
      load("/api/v1/arena/connections", setConnections, "connections"),
      load("/api/v1/arena/campaigns", data => {
        setCampaigns(Array.isArray(data) ? data : []);
        setCampaignError("");
      }, "campaigns"),
      load("/api/v1/arena/engagement/recommendations", data => {
        setRecommendations(data);
        setRecommendationError("");
      }, "recommendations"),
      load("/api/v1/arena/leaderboard", data => {
        const rows = Array.isArray(data) ? data : (data.entries || []);
        setLeaderboard(rows.map((row, index) => ({
          rank:row.rank || index + 1,
          name:row.username || row.tenant_id || "Tenant",
          score:Number(row.score ?? row.security_score ?? 0),
          delta:row.delta_score ?? row.delta ?? 0,
          isYou:row.username === "1",
        })));
        setLeaderboardConnected(true);
        setLeaderboardSource(data.label || "Pod Gamma live API");
      }, "leaderboard"),
    ];

    if (demoIdentity) {
      requests.push(
        load("/api/v1/arena/demo/state", applyDemoState, "demo account"),
      );
    } else {
      requests.push(
        load("/api/v1/arena/analytics/dashboard", data => {
          setAnalytics(data);
          setAnalyticsError("");
        }, "analytics"),
        load("/api/v1/arena/wallet/balance", data => {
          setWalletData(data);
          setWalletError("");
        }, "wallet"),
        load("/api/v1/arena/wallet/history?limit=5&offset=0", data => {
          setWalletEntries(data.entries || []);
        }, "wallet history"),
        load("/api/v1/arena/notifications", data => {
          setNotifications(data);
          setNotificationError("");
        }, "notifications"),
        load("/api/v1/arena/preferences", data => {
          setPreferences(data);
          setNotificationError("");
        }, "preferences"),
      );
    }

    Promise.all(requests).finally(() => {
      if (active) setConnectionsLoading(false);
    });

    return () => { active = false; };
  }, [accessToken, demoIdentity]);

  function handleAgentRun(agent) {
    if (!demoIdentity || demoActionLoading) return;
    setDemoActionLoading(true);
    apiRequest("/api/v1/arena/demo/engagements", {
      token:accessToken,
      method:"POST",
      body:{
        campaign_id:agent.id,
        campaign_title:agent.name,
        credit_cost:agent.cost,
      },
    }).then(result => {
      setLastEngagement(result.engagement);
      applyDemoState(result.state);
      toast(
        result.engagement.status === "lab_assessed"
          ? `${agent.name} completed against ${result.engagement.target_name}: ${result.engagement.finding_count} header findings.`
          : `${agent.name} simulation completed with ${result.engagement.finding_count} sample findings. No scan ran.`,
        "success",
      );
    }).catch(error => {
      toast(
        error.status === 429
          ? "Pod Beta's quick-scan cooldown is active. Wait five minutes between local checks; the previous completed report is still available below."
          : `Demo check could not run: ${error.message}`,
        "info",
      );
    }).finally(() => setDemoActionLoading(false));
  }

  const allServicesHealthy = Boolean(
    connections
    && connections.pod_delta.status === "healthy"
    && connections.upstreams.every(item => item.status === "healthy")
  );

  if (!loggedIn && !showSignIn) return <PublicStatusDashboard onSignIn={() => setShowSignIn(true)} />;
  if (!loggedIn) return <LoginScreen onLogin={handleLogin} onPreview={handlePreview} onBack={() => setShowSignIn(false)} />;

  return (
    <div className="cba-app-shell" style={{ minHeight:"100vh", background:T.bg, backgroundImage:"radial-gradient(ellipse at 78% 0%, rgba(7,131,95,.08), transparent 42%), linear-gradient(145deg, #f3f7f5 0%, #edf4f0 58%, #f8fbf9 100%)" }}>
      <ParticleField color={T.neon} density={80} />
      <Nav activeTab={activeTab} setActiveTab={setActiveTab} token={accessToken} onLogout={handleLogout} />
      {demoIdentity && <div role="status" style={{ padding:"10px 18px", textAlign:"center", color:T.warning, background:`${T.warning}12`, borderBottom:`1px solid ${T.warning}55`, fontSize:12, fontWeight:700, letterSpacing:"0.04em" }}>SAMPLE PREVIEW | Fictional account and dashboard wallet data. {labDemoEnabled ? `Optional check is restricted to ${labTargetName} on this computer and may record a demo debit in Beta’s configured wallet.` : "No target is contacted by the sample simulation."} No customer payment is taken.</div>}
      <div className="cba-container" style={{ padding:"28px 12px", maxWidth:"1700px", margin:"0 auto", position:"relative" }}>
        <div style={{ position:"relative", zIndex:1 }}>
        <div style={{ marginBottom:26, display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
          <div>
            <Eyebrow>Module 4 — Arena</Eyebrow>
            <h1 style={{ fontFamily:T.fontDisplay, fontSize:36, fontWeight:700, letterSpacing:"0.01em", lineHeight:1.1 }}>
              {activeTab}
            </h1>
            <p style={{ color:T.muted, fontSize:14, marginTop:6 }}>
              {activeTab === "Dashboard" && "Your account overview, live service status, and connected Arena data."}
              {activeTab === "Campaigns" && "Browse campaign definitions supplied by Pod Beta."}
              {activeTab === "Leaderboard" && "Leaderboard entries are loaded from Pod Gamma when available."}
              {activeTab === "Benchmark" && "Compare persisted, privacy-thresholded cohort aggregates from Pod Gamma."}
              {activeTab === "Wallet" && (demoIdentity ? "View fictional wallet activity and use the local sample billing flow." : "Read wallet balance and ledger history from the Wallet service.")}
              {activeTab === "Notifications" && (demoIdentity ? "Sample events generated by demo payments and scan runs." : "Tenant-scoped notifications and preferences from Pod Delta.")}
              {activeTab === "Analytics" && (demoIdentity ? "Sample account metrics that update after a simulated scan." : "Tenant-scoped dashboard metrics from Pod Delta.")}
              {activeTab === "Services" && "Check upstream health and diagnose integrations."}
            </p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:allServicesHealthy ? T.safe : T.warn, letterSpacing:"0.08em" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:allServicesHealthy ? T.safe : T.warn, boxShadow:`0 0 6px ${allServicesHealthy ? T.safe : T.warn}`, display:"inline-block" }} />
            {connections
              ? `${connections.upstreams.filter(item => item.status === "healthy").length + (connections.pod_delta.status === "healthy" ? 1 : 0)}/${connections.upstreams.length + 1} SERVICES ONLINE`
              : "CHECKING POD CONNECTIONS"}
          </div>
        </div>

        {activeTab === "Dashboard" && (
          <Reveal>
            <DashboardOverview
              connections={connections}
              campaigns={campaigns}
              leaderboard={leaderboard}
              leaderboardConnected={leaderboardConnected}
              walletData={walletData}
              walletEntries={walletEntries}
              analytics={analytics}
              token={accessToken}
              onNavigate={setActiveTab}
              demoMode={demoIdentity}
            />
          </Reveal>
        )}

        {activeTab === "Campaigns" && (
          <>
            <Reveal><CampaignLibrary campaigns={campaigns} error={campaignError} /></Reveal>
            <Reveal delay={40}><RecommendationsPanel data={recommendations} error={recommendationError} /></Reveal>
            <Reveal delay={80}>
              <Panel style={{ marginTop:16 }}>
                <SectionHeader title="Pod Beta engagement operations" action={demoIdentity ? "LOCAL TEST READY" : connections?.upstreams?.find(item => item.service === "pod_beta_engagements")?.status || "CHECKING"} />
                <p style={{ color:T.muted, fontSize:13, lineHeight:1.6 }}>
                  {demoIdentity && labDemoEnabled
                    ? `Run a passive security-header check against ${labTargetName} on this computer. Pod Beta receives the engagement through its create, scope, execute, and complete lifecycle. One local HTTP request is made; no exploit payloads or external targets are used. Delta deducts five fictional credits from the preview balance; Beta bills its configured Wallet service separately. Completed findings appear in the Latest Report panel below. Pod Beta applies a five-minute cooldown after each completed quick scan.`
                    : demoIdentity
                      ? "Run a labeled sample simulation. It creates illustrative findings without contacting a target or creating a Pod Beta engagement. Five fictional credits are deducted from the preview wallet."
                      : "Campaign definitions and recommendations are live from Pod Beta. To run the included local lab check, sign in to Sample Preview; it is restricted to the configured loopback target."}
                </p>
                {demoIdentity && <button type="button" disabled={demoActionLoading} onClick={() => handleAgentRun({ id:"vuln", name:labDemoEnabled ? `${labTargetName} header baseline` : "Sample security validation", cost:5 })} className="cba-btn" style={{ marginTop:12, padding:"11px 16px", border:0, borderRadius:8, background:T.neon, color:"#fff", fontWeight:700, cursor:demoActionLoading ? "wait" : "pointer" }}>{demoActionLoading ? (labDemoEnabled ? "CHECKING LOCAL LAB THROUGH POD BETA..." : "RUNNING SAMPLE SIMULATION...") : (labDemoEnabled ? `RUN LOCAL ${labTargetName.toUpperCase()} CHECK | 5 SAMPLE CREDITS` : "RUN SAMPLE SIMULATION | 5 SAMPLE CREDITS")}</button>}
                {demoIdentity && ["lab_assessed", "simulated_completed"].includes(lastEngagement?.status) && <button type="button" onClick={() => document.getElementById("latest-beta-report")?.scrollIntoView({ behavior:"smooth", block:"start" })} className="cba-btn" style={{ margin:"12px 0 0 8px", padding:"11px 16px", border:`1px solid ${T.border}`, borderRadius:8, background:T.surface, color:T.text, fontWeight:700, cursor:"pointer" }}>OPEN LATEST REPORT</button>}
              </Panel>
              {demoIdentity && <Panel id="latest-beta-report" style={{ marginTop:12, scrollMarginTop:20 }}>
                <SectionHeader title={lastEngagement?.status === "lab_assessed" ? "Observed lab results | Pod Beta" : "Illustrative sample results"} action={lastEngagement?.status === "lab_assessed" ? "COMPLETED" : lastEngagement?.status === "simulated_completed" ? "SIMULATION ONLY" : "NO COMPLETED REPORT"} />
                {lastEngagement?.status === "lab_assessed" ? <>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10, marginTop:12 }}>
                    {[ ["Engagement ID",lastEngagement.id], ["Target",`${lastEngagement.target_name} (${lastEngagement.target})`], ["HTTP response",String(lastEngagement.http_status)], ["Header findings",String(lastEngagement.finding_count)] ].map(([label,value]) => <div key={label} style={{ padding:12, border:`1px solid ${T.border}`, borderRadius:8, overflowWrap:"anywhere" }}><span style={{ display:"block", color:T.muted, fontSize:11 }}>{label}</span><strong style={{ display:"block", marginTop:5, fontSize:13 }}>{value}</strong></div>)}
                  </div>
                  <div style={{ display:"grid", gap:8, marginTop:12 }}>{(lastEngagement.results || []).map(result => <div key={result.id} style={{ display:"grid", gridTemplateColumns:"90px 1fr", gap:10, padding:"10px 12px", border:`1px solid ${T.border}`, borderRadius:8, fontSize:12 }}><strong style={{ color:result.status === "finding" ? T.warning : T.safe, textTransform:"uppercase" }}>{result.status}</strong><span><strong>{result.title}</strong>{result.evidence && <pre style={{ display:"block", color:T.muted, margin:"4px 0 0", overflowWrap:"anywhere", whiteSpace:"pre-wrap", fontFamily:"inherit", fontSize:11 }}>{typeof result.evidence === "string" ? result.evidence : JSON.stringify(result.evidence, null, 2)}</pre>}</span></div>)}</div>
                  {lastEngagement.beta_report && <details style={{ marginTop:12, color:T.muted, fontSize:12 }}><summary style={{ cursor:"pointer" }}>View Pod Beta completed report data</summary><pre style={{ whiteSpace:"pre-wrap", overflowWrap:"anywhere", padding:12, borderRadius:8, background:T.surface3 }}>{JSON.stringify(lastEngagement.beta_report, null, 2)}</pre></details>}
                </> : lastEngagement?.status === "simulated_completed" ? <><p style={{ marginTop:10, color:T.warning, fontSize:12 }}>These are generated example findings. No target was contacted and Pod Beta did not run this simulation.</p><div style={{ display:"grid", gap:8, marginTop:12 }}>{(lastEngagement.results || []).map(result => <div key={result.id} style={{ padding:"10px 12px", border:`1px solid ${T.border}`, borderRadius:8, fontSize:12 }}><strong>{result.severity?.toUpperCase()} | {result.title}</strong><div style={{ color:T.muted, marginTop:4 }}>{result.status}</div></div>)}</div></> : <p style={{ marginTop:10, color:T.muted, fontSize:13 }}>A completed local-lab report appears here after Pod Beta finishes the configured loopback check.</p>}
              </Panel>}
            </Reveal>
          </>
        )}

        {activeTab === "Leaderboard" && (
          <Reveal>
            <p style={{ color:T.muted, fontSize:11, marginBottom:8 }}>{leaderboardConnected ? leaderboardSource : "Pod Gamma has no available ranking data."}</p>
            {demoIdentity && <p style={{ color:T.warning, fontSize:11, marginBottom:12 }}>Seeded demo rankings; no real organizations are represented.</p>}
            <LeaderboardPanel entries={leaderboard} />
          </Reveal>
        )}

        {activeTab === "Benchmark" && (
          <Reveal><BenchmarkPanel token={accessToken} /></Reveal>
        )}

        {activeTab === "Wallet" && (
          <Reveal>
            <Panel style={{ marginBottom:16 }}>
              <SectionHeader
                title={demoIdentity ? "Sample Wallet Preview" : "Pod Alpha Wallet Service"}
                action={demoIdentity ? "FICTIONAL DATA" : walletData ? "LIVE POD ALPHA" : "NOT CONNECTED"}
              />
              {walletData
                ? <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
                    <p>Available balance: <strong>{walletData.available_balance} {walletData.currency}</strong></p>
                    {demoIdentity && (
                      <div style={{ display:"flex", gap:8 }}>
                        <button className="cba-btn" onClick={handleDemoReset} style={{ padding:"9px 14px", background:"transparent", color:T.muted, border:`1px solid ${T.border}`, borderRadius:8, cursor:"pointer" }}>Reset demo</button>
                      </div>
                    )}
                  </div>
                : <p style={{ color:demoIdentity ? T.muted : T.warn }}>
                    {walletError || "Wallet response not available."}
                  </p>}
              {demoIdentity && (
                <p style={{ color:T.muted, fontSize:11, marginTop:12, lineHeight:1.6 }}>
                  Pod Alpha connection: {connections?.upstreams?.find(item => item.service === "wallet_service")?.status || "checking"}. The demo balance and entries below remain in Delta and are not Alpha ledger records.
                </p>
              )}
            </Panel>
            {demoIdentity && <SampleBillingPanel onCheckout={setPendingCheckout} />}
            {demoIdentity
              ? walletHistoryLive
                ? <TransactionLog transactions={transactions} />
                : <p style={{ color:T.muted, fontSize:12 }}>The simulated ledger shows demo top-ups and scan-credit debits.</p>
              : <AlphaAuditViewer token={accessToken} />}
            {demoIdentity && demoReceipts.length > 0 && (
              <Panel style={{ marginTop:14 }}>
                <SectionHeader title="Payment receipts" action="SIMULATED PROOF" />
                <div style={{ display:"grid", gap:8 }}>
                  {demoReceipts.map(item => (
                    <div key={item.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"10px 12px", border:`1px solid ${T.border}`, borderRadius:8 }}>
                      <div>
                        <strong style={{ display:"block", fontSize:12 }}>{item.receipt_number} · {item.line_items[0]?.description}</strong>
                        <span style={{ color:T.muted, fontSize:11 }}>{item.credits_added.toLocaleString()} CR · {new Date(item.issued_at).toLocaleString()}</span>
                      </div>
                      <button type="button" onClick={() => { setCurrentReceipt(item); setTopUpOpen(true); }} className="cba-btn" style={{ padding:"7px 10px", border:`1px solid ${T.border}`, background:"transparent", color:T.neon, borderRadius:7, cursor:"pointer", whiteSpace:"nowrap" }}>View receipt</button>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </Reveal>
        )}

        {activeTab === "Notifications" && (
          <Reveal><NotificationsPanel notifications={notifications} preferences={preferences} error={notificationError} demoMode={demoIdentity} /></Reveal>
        )}

        {activeTab === "Analytics" && (
          <Reveal><AnalyticsPanel data={analytics} error={analyticsError} /></Reveal>
        )}

        {activeTab === "Services" && (
          <Reveal>
            <ConnectionsPanel connections={connections} loading={connectionsLoading} refresh={refreshConnections} />
            {apiErrors.length > 0 && (
              <Panel style={{ marginTop:14 }}>
                <SectionHeader title="Integration Details" />
                {apiErrors.map((error, index) => <p key={index} style={{ color:T.warn, marginTop:6 }}>{error}</p>)}
              </Panel>
            )}
          </Reveal>
        )}
        </div>
      </div>

      {pendingCheckout && <SampleCheckoutModal order={pendingCheckout} loading={topUpLoading} onClose={() => setPendingCheckout(null)} onConfirm={handleDemoTopUp} />}
      {topUpOpen && currentReceipt && <PaymentReceiptModal receipt={currentReceipt} onClose={() => setTopUpOpen(false)} onRefund={handleDemoRefund} refunding={refundLoading} />}
      <ToastStack toasts={toasts} />
    </div>
  );
}

export default CyBreachArena;
