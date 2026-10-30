/** Petite gerbe d'étincelles « poussière de fée » à l'endroit touché. */
export function sparkleAt(e: { clientX: number; clientY: number }) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const glyphs = ['✦', '✧', '⋆', '✦', '✧', '⋆', '✦']
  for (let i = 0; i < glyphs.length; i++) {
    const s = document.createElement('span')
    const angle = (i / glyphs.length) * Math.PI * 2 + Math.random() * 0.5
    const dist = 28 + Math.random() * 26
    s.textContent = glyphs[i]
    s.setAttribute('aria-hidden', 'true')
    s.className = 'pointer-events-none fixed z-[60] animate-sparkle text-gold-300'
    s.style.left = `${e.clientX - 6}px`
    s.style.top = `${e.clientY - 10}px`
    s.style.fontSize = `${10 + Math.random() * 10}px`
    s.style.textShadow = '0 0 6px rgb(255 214 107 / 0.9)'
    s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`)
    s.style.setProperty('--dy', `${Math.sin(angle) * dist}px`)
    document.body.appendChild(s)
    setTimeout(() => s.remove(), 750)
  }
}
