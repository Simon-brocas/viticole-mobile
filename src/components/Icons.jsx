/**
 * Jeu d'icônes SVG (tracé, couleur héritée via currentColor).
 * Remplace les emojis : rendu identique sur tous les postes et neutre
 * vis-à-vis du produit vendu.
 */

function Svg({ children, size = 20, className = '', strokeWidth = 1.75 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export const IconSearch = p => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></Svg>
)

export const IconChevronDown = p => (
  <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
)

export const IconSwap = p => (
  <Svg {...p}>
    <path d="M8 3 4 7l4 4" /><path d="M4 7h16" />
    <path d="m16 21 4-4-4-4" /><path d="M20 17H4" />
  </Svg>
)

export const IconPower = p => (
  <Svg {...p}><path d="M12 3v9" /><path d="M18.4 7.6a9 9 0 1 1-12.8 0" /></Svg>
)

export const IconSettings = p => (
  <Svg {...p}>
    <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3" />
    <path d="M14 2v4M8 10v4M16 18v4" />
  </Svg>
)

export const IconTag = p => (
  <Svg {...p}>
    <path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" />
    <circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconClipboard = p => (
  <Svg {...p}>
    <rect width="8" height="4" x="8" y="2" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" />
  </Svg>
)

export const IconArchive = p => (
  <Svg {...p}>
    <rect width="20" height="5" x="2" y="3" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </Svg>
)

export const IconBox = p => (
  <Svg {...p}>
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /><path d="m7.5 4.3 9 5.1" />
  </Svg>
)

export const IconCoins = p => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M18.1 10.4A6 6 0 1 1 10.3 18" />
    <path d="M7 6h1v4" />
  </Svg>
)

export const IconCart = p => (
  <Svg {...p}>
    <circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" />
    <path d="M2 3h2.2l2.6 11.6a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 1.95-1.55L21 7H5.3" />
  </Svg>
)

export const IconCash = p => (
  <Svg {...p}>
    <rect width="20" height="12" x="2" y="6" rx="2" />
    <circle cx="12" cy="12" r="2.2" />
    <path d="M6 12h.01M18 12h.01" />
  </Svg>
)

export const IconCard = p => (
  <Svg {...p}>
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <path d="M2 10h20" /><path d="M6 15h4" />
  </Svg>
)

export const IconCheque = p => (
  <Svg {...p}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v5h6" /><path d="M9 13h6M9 17h4" />
  </Svg>
)

export const IconSplit = p => (
  <Svg {...p}>
    <path d="M3 7h3.5l3.2 5" /><path d="M3 17h3.5l3.2-5" />
    <path d="M13 7h7M13 17h7" />
    <path d="m17.5 4.5 3 2.5-3 2.5" /><path d="m17.5 14.5 3 2.5-3 2.5" />
  </Svg>
)

export const IconCamera = p => (
  <Svg {...p}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3.2" />
  </Svg>
)

export const IconImage = p => (
  <Svg {...p}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <circle cx="9" cy="9" r="1.8" />
    <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
  </Svg>
)

export const IconDownload = p => (
  <Svg {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5" /><path d="M12 15V3" />
  </Svg>
)

export const IconCheck = p => (
  <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>
)

export const IconX = p => (
  <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>
)

export const IconPlus = p => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
)

export const IconMinus = p => (
  <Svg {...p}><path d="M5 12h14" /></Svg>
)

export const IconPin = p => (
  <Svg {...p}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </Svg>
)

export const IconLock = p => (
  <Svg {...p}>
    <rect width="18" height="11" x="3" y="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Svg>
)

export const IconTrash = p => (
  <Svg {...p}>
    <path d="M3 6h18" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
)

export const IconPencil = p => (
  <Svg {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
)

export const IconRestore = p => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8" />
    <path d="M3 3v5h5" />
  </Svg>
)

export const IconDatabase = p => (
  <Svg {...p}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
    <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </Svg>
)

export const IconUpload = p => (
  <Svg {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 9 5-5 5 5" /><path d="M12 4v12" />
  </Svg>
)

export const IconAlert = p => (
  <Svg {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
)

export const IconReceipt = p => (
  <Svg {...p}>
    <path d="M5 3h14v18l-2.3-1.5L14.3 21 12 19.5 9.7 21l-2.4-1.5L5 21Z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </Svg>
)

export const IconShare = p => (
  <Svg {...p}>
    <path d="M12 3v12" /><path d="m8 7 4-4 4 4" />
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </Svg>
)

export const IconPrinter = p => (
  <Svg {...p}>
    <path d="M7 8V3h10v5" />
    <rect x="3" y="8" width="18" height="9" rx="2" />
    <path d="M7 14h10v7H7Z" />
  </Svg>
)

export const IconCopy = p => (
  <Svg {...p}>
    <rect x="8" y="8" width="13" height="13" rx="2" />
    <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
  </Svg>
)

export const IconFileSheet = p => (
  <Svg {...p}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
    <path d="M14 3v6h6" /><path d="M8 13h8M8 17h8M12 11v8" />
  </Svg>
)
