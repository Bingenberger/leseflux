import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type FontSize = 'normal' | 'large' | 'xlarge'
export type SyllableColors = 'off' | 'blue-red' | 'blue-green'

interface SettingsState {
  /** LRS-Schrift (OpenDyslexic) – nur die Schrift, nichts anderes */
  lrsMode: boolean
  /** Silbenfärbung unabhängig von der Schrift */
  syllableColors: SyllableColors
  /** Mehr Zeit beim Wortblitz (× 1,5) – unabhängig von der Schrift */
  flashExtraTime: boolean
  fontSize: FontSize
  highContrast: boolean
  toggleLrsMode: () => void
  setSyllableColors: (colors: SyllableColors) => void
  toggleFlashExtraTime: () => void
  setFontSize: (size: FontSize) => void
  toggleHighContrast: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      lrsMode: false,
      syllableColors: 'off',
      flashExtraTime: false,
      fontSize: 'normal',
      highContrast: false,
      toggleLrsMode: () => set((s) => ({ lrsMode: !s.lrsMode })),
      setSyllableColors: (syllableColors) => set({ syllableColors }),
      toggleFlashExtraTime: () => set((s) => ({ flashExtraTime: !s.flashExtraTime })),
      setFontSize: (fontSize) => set({ fontSize }),
      toggleHighContrast: () => set((s) => ({ highContrast: !s.highContrast })),
    }),
    {
      name: 'leseflux-settings',
      version: 1,
      // v0: der LRS-Schalter schaltete Schrift, Silbenfärbung und Wortblitz-Zeit gemeinsam
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<SettingsState>
        if (version === 0) {
          return {
            ...state,
            syllableColors: state.lrsMode ? 'blue-green' : 'off',
            flashExtraTime: state.lrsMode ?? false,
          } as SettingsState
        }
        return state as SettingsState
      },
    },
  ),
)

export const fontSizeClass: Record<FontSize, string> = {
  normal: 'text-reader',
  large: 'text-reader-lg',
  xlarge: 'text-reader-xl',
}

/** Farben der Silbenfärbung: ungerade Silben Farbe A, gerade Silben Farbe B */
export const SYLLABLE_COLOR_VALUES: Record<Exclude<SyllableColors, 'off'>, [string, string]> = {
  'blue-red': ['#1F5FAD', '#C0392B'],
  'blue-green': ['#3674B5', '#578E7E'],
}
