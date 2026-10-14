export interface ThemeConfig {
  accent: string
  accentSoft: string
  accentShadow: string
  bubbleStyle: 'paper' | 'glass' | 'novel'
  fontFamily: 'serif' | 'sans'
  bgPreset: 'none' | 'warm-paper' | 'frosted-glass' | 'sunset' | 'night' | 'custom'
  customBgBase64?: string
  bgBlur: number   // 0 - 25 px
  bgDim: number    // 0 - 0.75
}

export const PRESET_COLORS = [
  { name: '松针墨绿', accent: '#3b6659', soft: '#e8eee3', shadow: 'rgba(59, 102, 89, 0.25)' },
  { name: '加州晴蓝', accent: '#007aff', soft: '#e8f2ff', shadow: 'rgba(0, 122, 255, 0.28)' },
  { name: '暮山紫藤', accent: '#7852ff', soft: '#f0ebff', shadow: 'rgba(120, 82, 255, 0.25)' },
  { name: '落樱绯粉', accent: '#d9536f', soft: '#fdecf0', shadow: 'rgba(217, 83, 111, 0.25)' },
  { name: '琥珀暖杏', accent: '#b87333', soft: '#fbf0e4', shadow: 'rgba(184, 115, 51, 0.25)' }
]

export const PRESET_BACKGROUNDS = {
  none: '',
  'warm-paper': 'radial-gradient(ellipse at 80% 20%, #faf6eb 0%, #ede6d4 100%)',
  'frosted-glass': 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)',
  'sunset': 'linear-gradient(135deg, #fad0c4 0%, #ffd1ff 100%)',
  'night': 'radial-gradient(ellipse at top, #1e2638 0%, #0d1117 100%)'
}

const STORAGE_KEY = 'hds_ui_theme_config'

export const defaultTheme: ThemeConfig = {
  accent: '#3b6659',
  accentSoft: '#e8eee3',
  accentShadow: 'rgba(59, 102, 89, 0.25)',
  bubbleStyle: 'glass',
  fontFamily: 'serif',
  bgPreset: 'none',
  bgBlur: 10,
  bgDim: 0.15
}

export function loadTheme(): ThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultTheme
    return { ...defaultTheme, ...JSON.parse(raw) }
  } catch {
    return defaultTheme
  }
}

export function saveTheme(theme: ThemeConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme))
  } catch {}
  applyTheme(theme)
}

export function applyTheme(theme: ThemeConfig): void {
  const root = document.documentElement
  root.style.setProperty('--accent', theme.accent)
  root.style.setProperty('--accent-soft', theme.accentSoft)
  root.style.setProperty('--accent-shadow', theme.accentShadow)
  root.style.setProperty('--bg-blur', `${theme.bgBlur}px`)
  root.style.setProperty('--bg-dim', String(theme.bgDim))

  if (theme.fontFamily === 'serif') {
    root.style.setProperty('--font-main', '"Noto Serif CJK SC", "Songti SC", Georgia, serif')
  } else {
    root.style.setProperty('--font-main', '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif')
  }

  // 气泡样式
  root.setAttribute('data-bubble-style', theme.bubbleStyle)
  root.setAttribute('data-bg-preset', theme.bgPreset)
}
