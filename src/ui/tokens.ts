// Fuente única de tokens de "La boleta compartida" (ver reportes/03-auditoria-diseno.md §5–6).
// Los ratios de contraste están verificados contra `bg`/`surface`; no agregar colores sueltos fuera de aquí.

const palette = {
  ink900: '#121110',
  ink800: '#1C1A18',
  ink700: '#262320',
  ink600: '#3A3531',
  ink500: '#736B61',
  cream100: '#F4EEE4',
  cream300: '#B5ACA0',
  cream400: '#9A9286',
  paper: '#F2EADB',
  paperLight: '#F6F1E8',
  inkDark: '#1A1714',
  inkDarkMuted: '#6B6257',
  band500: '#FF6A2B',
  band400: '#FF8A55',
  band700: '#B83A0A',
  bandOnPaper: '#A8360A',
  stamp: '#7FD99A',
  stampDark: '#1F7A3E',
  alert: '#FF7A7A',
  alertDark: '#B42318',
} as const

export type Theme = {
  scheme: 'venue' | 'papel'
  bg: string
  surface: string
  surface2: string
  border: string
  borderInput: string
  text: string
  textMuted: string
  textSubtle: string
  accent: string
  accentPressed: string
  onAccent: string
  // El acento como texto: en oscuro sirve el mismo naranja, en claro se oscurece para pasar AA.
  accentText: string
  ticket: string
  onTicket: string
  onTicketMuted: string
  ticketAccent: string
  ticketVerified: string
  ticketDanger: string
  verified: string
  danger: string
  scrim: string
}

export const themes: Record<'venue' | 'papel', Theme> = {
  venue: {
    scheme: 'venue',
    bg: palette.ink900,
    surface: palette.ink800,
    surface2: palette.ink700,
    border: palette.ink600,
    borderInput: palette.ink500,
    text: palette.cream100,
    textMuted: palette.cream300,
    textSubtle: palette.cream400,
    accent: palette.band500,
    accentPressed: palette.band400,
    onAccent: palette.ink900,
    accentText: palette.band500,
    ticket: palette.paper,
    onTicket: palette.inkDark,
    onTicketMuted: palette.inkDarkMuted,
    ticketAccent: palette.bandOnPaper,
    ticketVerified: palette.stampDark,
    ticketDanger: palette.alertDark,
    verified: palette.stamp,
    danger: palette.alert,
    scrim: 'rgba(18,17,16,0.72)',
  },
  papel: {
    scheme: 'papel',
    bg: palette.paperLight,
    surface: '#FFFFFF',
    surface2: '#EDE5D7',
    border: '#D9CFBF',
    borderInput: '#8C8377',
    text: palette.inkDark,
    textMuted: '#5E564C',
    textSubtle: '#756C61',
    accent: palette.band500,
    accentPressed: palette.band400,
    onAccent: palette.inkDark,
    accentText: palette.band700,
    ticket: palette.paper,
    onTicket: palette.inkDark,
    onTicketMuted: palette.inkDarkMuted,
    ticketAccent: palette.bandOnPaper,
    ticketVerified: palette.stampDark,
    ticketDanger: palette.alertDark,
    verified: palette.stampDark,
    danger: palette.alertDark,
    scrim: 'rgba(26,23,20,0.56)',
  },
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, gutter: 20 } as const
export const radius = { sm: 8, md: 16, full: 999 } as const
export const touch = { min: 44, comfortable: 48, large: 56 } as const

export const font = {
  display: 'BigShouldersDisplay_800ExtraBold',
  title: 'BigShouldersDisplay_700Bold',
  body: 'Archivo_400Regular',
  bodyMedium: 'Archivo_500Medium',
  bodySemibold: 'Archivo_600SemiBold',
  bodyBold: 'Archivo_700Bold',
  data: 'IBMPlexMono_500Medium',
} as const

export const type = {
  display: { fontFamily: font.display, fontSize: 40, lineHeight: 40, textTransform: 'uppercase' },
  title1: { fontFamily: font.title, fontSize: 28, lineHeight: 32 },
  title2: { fontFamily: font.bodyBold, fontSize: 22, lineHeight: 28 },
  headline: { fontFamily: font.bodySemibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 24 },
  callout: { fontFamily: font.bodyMedium, fontSize: 15, lineHeight: 20 },
  footnote: { fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.bodyMedium, fontSize: 12, lineHeight: 16 },
  data: { fontFamily: font.data, fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
} as const

export type TypeVariant = keyof typeof type

// Solo el texto de cartel limita el escalado: el resto respeta el tamaño de fuente del sistema.
export const maxFontScale: Partial<Record<TypeVariant, number>> = {
  display: 1.3,
  title1: 1.4,
  title2: 1.6,
}

export const motion = {
  duration: { fast: 160, base: 220, slow: 320, signature: 450 },
  easeOut: [0.2, 0, 0, 1] as const,
  spring: { damping: 18, stiffness: 180 },
} as const
