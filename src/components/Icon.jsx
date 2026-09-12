/**
 * One inline SVG icon set.
 *
 * No icon font, no icon library. Each icon is a fragment of SVG children
 * rendered inside a shared <svg> wrapper, so the sizing, stroke and colour
 * rules are written once.
 *
 * Everything is stroked with `currentColor`, which means an icon inherits
 * the text colour of whatever contains it — including through a theme
 * switch, with no per-icon work.
 */

const paths = {
  /* --- navigation & chrome --- */
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5 21 21" />
    </>
  ),
  menu: (
    <>
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronUp: <path d="M6 15l6-6 6 6" />,
  arrowRight: (
    <>
      <path d="M4 12h16" />
      <path d="M14 6l6 6-6 6" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M20 12H4" />
      <path d="M10 6l-6 6 6 6" />
    </>
  ),
  check: <path d="M4 12.5 9 17.5 20 6.5" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  minus: <path d="M5 12h14" />,

  /* --- theme --- */
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.9 4.9l1.4 1.4" />
      <path d="M17.7 17.7l1.4 1.4" />
      <path d="M4.9 19.1l1.4-1.4" />
      <path d="M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,

  /* --- account --- */
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  heart: <path d="M12 20.5 4.2 12.7a4.8 4.8 0 0 1 6.8-6.8l1 1 1-1a4.8 4.8 0 0 1 6.8 6.8Z" />,
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),

  /* --- property specs --- */
  bed: (
    <>
      <path d="M2 19v-7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7" />
      <path d="M2 15h20" />
      <path d="M6 10V7h6v3" />
    </>
  ),
  bath: (
    <>
      <path d="M3 12h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <path d="M7 12V6.5a2.5 2.5 0 0 1 5 0V7" />
      <path d="M6 22l1-2" />
      <path d="M18 22l-1-2" />
    </>
  ),
  /* Four corner brackets — reads as "floor area". */
  area: (
    <>
      <path d="M4 9V5a1 1 0 0 1 1-1h4" />
      <path d="M20 9V5a1 1 0 0 0-1-1h-4" />
      <path d="M4 15v4a1 1 0 0 0 1 1h4" />
      <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
    </>
  ),
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  building: (
    <>
      <path d="M5 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17" />
      <path d="M16 10h3a1 1 0 0 1 1 1v10" />
      <path d="M3 21h18" />
      <path d="M9 7h3" />
      <path d="M9 11h3" />
      <path d="M9 15h3" />
    </>
  ),
  car: (
    <>
      <path d="M4 16v-3l2-5h12l2 5v3" />
      <path d="M3 16h18" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
    </>
  ),
  tree: (
    <>
      <path d="M12 3 6 12h4l-3 5h10l-3-5h4Z" />
      <path d="M12 17v4" />
    </>
  ),

  /* --- location & map --- */
  pin: (
    <>
      <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  mapLayers: (
    <>
      <path d="M12 3 3 7.5l9 4.5 9-4.5Z" />
      <path d="M3 12.5 12 17l9-4.5" />
      <path d="M3 17 12 21.5 21 17" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
    </>
  ),
  /* A lasso, for draw-on-map search. */
  draw: (
    <>
      <path d="M4 7l6-3 5 4 5-2v9l-6 3-5-4-5 2Z" />
      <circle cx="4" cy="7" r="1.6" />
      <circle cx="20" cy="6" r="1.6" />
    </>
  ),

  /* --- booking --- */
  calendar: (
    <>
      <path d="M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
      <path d="M4 10h16" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),

  /* --- contact --- */
  phone: (
    <path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 4 5a2 2 0 0 1 2-2Z" />
  ),
  mail: (
    <>
      <path d="M3 6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
      <path d="M3.5 6.5 12 13l8.5-6.5" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8 15.8 6.5" />
      <path d="M8.2 13.2 15.8 17.5" />
    </>
  ),
  print: (
    <>
      <path d="M7 8V4h10v4" />
      <path d="M5 8h14a1 1 0 0 1 1 1v6h-3" />
      <path d="M4 15H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1" />
      <path d="M7 13h10v7H7Z" />
    </>
  ),

  /* --- controls --- */
  filter: (
    <>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 8h10" />
      <path d="M18 8h2" />
      <path d="M4 16h4" />
      <path d="M12 16h8" />
      <circle cx="16" cy="8" r="2" />
      <circle cx="10" cy="16" r="2" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3.5 6h.01" />
      <path d="M3.5 12h.01" />
      <path d="M3.5 18h.01" />
    </>
  ),
  grid: (
    <>
      <path d="M4 4h7v7H4Z" />
      <path d="M13 4h7v7h-7Z" />
      <path d="M4 13h7v7H4Z" />
      <path d="M13 13h7v7h-7Z" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L20 8l-4-4L4 16Z" />
      <path d="M14 6l4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  zoomIn: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5 21 21" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.8l6.1-.7Z" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.5" />
      <path d="M12 16h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  image: (
    <>
      <path d="M3 5h18v14H3Z" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M3 16.5 9 11l4 3.5 3-2.5 5 4.5" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-8 8" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
}

export const iconNames = Object.keys(paths)

/**
 * @param name         key from `paths`
 * @param size         px, applied to both width and height
 * @param strokeWidth  1.5 reads well at 16-24px; 1.25 for large display sizes
 * @param filled       fill with currentColor instead of stroking (hearts, stars)
 * @param title        supply ONLY when the icon carries meaning no nearby text
 *                     already gives. Otherwise leave it out and the icon is
 *                     hidden from assistive technology.
 */
export default function Icon({
  name,
  size = 18,
  strokeWidth = 1.5,
  filled = false,
  title,
  className = '',
  ...rest
}) {
  const shape = paths[name]

  /* A typo in a name should be obvious in development and silent in
     production, not a crash either way. */
  if (!shape) {
    if (import.meta.env.DEV) console.warn(`Icon: no such icon "${name}"`)
    return null
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {shape}
    </svg>
  )
}