import { useId } from 'react'
import { APP_NAME, APP_MONOGRAM, BRAND_GRADIENT } from '../branding'

/**
 * Monogramme de l'application.
 * variant 'brand' : carré dégradé (sur fond clair)
 * variant 'glass' : verre dépoli (sur l'en-tête coloré)
 */
export default function Logo({ size = 32, variant = 'brand', className = '' }) {
  const uid = useId().replace(/:/g, '')
  const gradId = `logo-grad-${uid}`

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className}
      role="img" aria-label={APP_NAME}>
      {variant === 'brand' ? (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={BRAND_GRADIENT[0]} />
              <stop offset="100%" stopColor={BRAND_GRADIENT[1]} />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill={`url(#${gradId})`} />
        </>
      ) : (
        <>
          <rect width="48" height="48" rx="14" fill="rgba(255,255,255,0.18)" />
          <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="13.25"
            fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        </>
      )}
      <text x="24" y="25" textAnchor="middle" dominantBaseline="central"
        fill="#ffffff" fontSize="27" fontWeight="700" letterSpacing="-0.5"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
        {APP_MONOGRAM}
      </text>
    </svg>
  )
}
