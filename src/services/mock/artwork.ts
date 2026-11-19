function svgUri(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

type Expression = 'neutral' | 'smile' | 'surprise' | 'angry' | 'shy' | 'side'

function mouth(expression: Expression) {
  if (expression === 'smile' || expression === 'shy') {
    return '<path d="M168 214c14 16 42 16 56 0" fill="none" stroke="#7c4a3a" stroke-width="6" stroke-linecap="round"/>'
  }
  if (expression === 'surprise') {
    return '<ellipse cx="196" cy="214" rx="10" ry="12" fill="#7c4a3a"/>'
  }
  if (expression === 'angry') {
    return '<path d="M168 222c16-14 40-14 56 0" fill="none" stroke="#7c4a3a" stroke-width="6" stroke-linecap="round"/>'
  }
  return '<path d="M174 214h44" stroke="#7c4a3a" stroke-width="6" stroke-linecap="round"/>'
}

function eyes(expression: Expression) {
  const shift = expression === 'side' ? -10 : 0
  const brow = expression === 'angry' ? '<path d="M150 150l28 10M242 160l-28-10" stroke="#2b211c" stroke-width="5" stroke-linecap="round"/>' : ''
  return `${brow}
    <ellipse cx="${166 + shift}" cy="176" rx="8" ry="10" fill="#241911"/>
    <ellipse cx="${226 + shift}" cy="176" rx="8" ry="10" fill="#241911"/>
    <circle cx="${169 + shift}" cy="173" r="2.5" fill="#fff"/>
    <circle cx="${229 + shift}" cy="173" r="2.5" fill="#fff"/>`
}

export function characterArt(name: string, hue: number, expression: Expression, kind: 'bust' | 'avatar' | 'full') {
  const hair = `hsl(${hue} 72% 58%)`
  const cloth = `hsl(${(hue + 28) % 360} 55% 46%)`
  const blush = expression === 'shy' ? '<ellipse cx="150" cy="200" rx="14" ry="8" fill="#fb7185" opacity="0.45"/><ellipse cx="244" cy="200" rx="14" ry="8" fill="#fb7185" opacity="0.45"/>' : ''
  const body =
    kind === 'avatar'
      ? ''
      : `<path d="M92 390c22-70 52-96 104-96s82 26 104 96v130H92V390z" fill="${cloth}"/>
         <path d="M168 294h56l18 70h-92z" fill="#f8fafc" opacity="0.85"/>`
  const height = kind === 'full' ? 640 : kind === 'avatar' ? 320 : 420
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 392 ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="hsl(${hue} 45% 22%)"/>
        <stop offset="1" stop-color="#12182d"/>
      </linearGradient>
    </defs>
    <rect width="392" height="${height}" rx="28" fill="url(#bg)"/>
    <ellipse cx="196" cy="${kind === 'full' ? 250 : 210}" rx="118" ry="132" fill="${hair}"/>
    <circle cx="196" cy="188" r="78" fill="#f3d2bf"/>
    ${eyes(expression)}
    ${mouth(expression)}
    ${blush}
    ${body}
    <text x="196" y="${height - 28}" text-anchor="middle" fill="#f8fafc" font-size="22" font-family="sans-serif">${name}</text>
  </svg>`
  return svgUri(svg)
}

const scenePalette = ['#312e81', '#164e63', '#7c2d12', '#1e3a5f', '#3f3f46', '#4c1d95']

export function sceneArt(name: string, variant: number) {
  const color = scenePalette[Math.abs(variant) % scenePalette.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
    <rect width="640" height="360" fill="${color}"/>
    <rect x="0" y="250" width="640" height="110" fill="#0b1020" opacity="0.45"/>
    <rect x="70" y="78" width="150" height="110" rx="8" fill="#f8fafc" opacity="0.18"/>
    <rect x="250" y="48" width="120" height="160" rx="8" fill="#f8fafc" opacity="0.12"/>
    <rect x="410" y="96" width="150" height="90" rx="8" fill="#f8fafc" opacity="0.16"/>
    <circle cx="${80 + (variant % 5) * 90}" cy="70" r="28" fill="#fde68a" opacity="0.8"/>
    <text x="32" y="328" fill="#f8fafc" font-size="28" font-family="sans-serif">${name}</text>
  </svg>`
  return svgUri(svg)
}
