// Étoiles scintillantes et étoile filante en fond d'écran (purement décoratif).

// Positions figées pour que le ciel ne « saute » pas d'un rendu à l'autre.
const STARS = Array.from({ length: 38 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 9301 + n * 49297) + 1) / 2) % 1
  return {
    left: `${(r(1) * 100).toFixed(1)}%`,
    top: `${(r(2) * 70).toFixed(1)}%`,
    size: 1 + Math.round(r(3) * 2),
    delay: `${(r(4) * 3).toFixed(2)}s`,
    gold: i % 7 === 0,
  }
})

export function Sky() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {STARS.map((s, i) => (
        <span
          key={i}
          className={`absolute animate-twinkle rounded-full ${s.gold ? 'bg-gold-300 shadow-[0_0_6px_2px_rgb(255_214_107/0.6)]' : 'bg-white shadow-[0_0_4px_1px_rgb(255_255_255/0.5)]'}`}
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }}
        />
      ))}
      <span className="shooting-star absolute top-[12%] left-[70%] h-px w-24 rotate-[-25deg] bg-gradient-to-l from-white to-transparent" />
      <style>{`
        .shooting-star { opacity: 0; animation: shoot 9s ease-in 2s infinite; }
        @keyframes shoot {
          0%, 92% { opacity: 0; transform: translate(0, 0) rotate(-25deg); }
          93% { opacity: 1; }
          100% { opacity: 0; transform: translate(-260px, 120px) rotate(-25deg); }
        }
        @media (prefers-reduced-motion: reduce) { .shooting-star { display: none; } }
      `}</style>
    </div>
  )
}

/** Silhouette de vallée enchantée : collines, château de conte et lune. */
export function ValleyScene({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 -10 400 140" className={className} aria-hidden preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="castle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a58bff" />
          <stop offset="1" stopColor="#5b3fae" />
        </linearGradient>
        <radialGradient id="window">
          <stop offset="0" stopColor="#fff6c9" />
          <stop offset="1" stopColor="#ffcf5c" />
        </radialGradient>
      </defs>
      {/* château de conte (générique) */}
      <g fill="url(#castle)" opacity="0.95">
        <rect x="170" y="52" width="60" height="50" />
        <rect x="160" y="40" width="14" height="62" />
        <rect x="226" y="40" width="14" height="62" />
        <rect x="192" y="22" width="16" height="40" />
        <polygon points="160,40 167,22 174,40" />
        <polygon points="226,40 233,22 240,40" />
        <polygon points="192,22 200,2 208,22" />
        <rect x="140" y="66" width="22" height="36" />
        <rect x="238" y="66" width="22" height="36" />
        <polygon points="140,66 151,50 162,66" />
        <polygon points="238,66 249,50 260,66" />
      </g>
      <g fill="#ffe08a">
        <line x1="200" y1="2" x2="200" y2="-6" stroke="#ffe08a" strokeWidth="1" />
        <polygon points="200,-6 208,-3 200,0" />
      </g>
      <g fill="url(#window)">
        <path d="M194 102 v-14 a6 6 0 0 1 12 0 v14z" />
        <rect x="197" y="32" width="6" height="9" rx="3" />
        <rect x="164" y="56" width="5" height="8" rx="2.5" />
        <rect x="231" y="56" width="5" height="8" rx="2.5" />
        <rect x="148" y="78" width="5" height="8" rx="2.5" />
        <rect x="247" y="78" width="5" height="8" rx="2.5" />
      </g>
      {/* collines */}
      <path d="M0 95 C 60 70 120 92 180 96 S 300 70 400 90 V130 H0Z" fill="#3f8f6b" />
      <path d="M0 112 C 80 96 160 118 240 108 S 360 98 400 108 V130 H0Z" fill="#2f7356" />
      {/* lucioles */}
      <g fill="#fff1a8">
        <circle cx="60" cy="88" r="1.6" className="animate-twinkle" />
        <circle cx="320" cy="84" r="1.6" className="animate-twinkle" style={{ animationDelay: '1s' }} />
        <circle cx="110" cy="104" r="1.3" className="animate-twinkle" style={{ animationDelay: '2s' }} />
        <circle cx="290" cy="110" r="1.3" className="animate-twinkle" style={{ animationDelay: '0.5s' }} />
      </g>
    </svg>
  )
}
