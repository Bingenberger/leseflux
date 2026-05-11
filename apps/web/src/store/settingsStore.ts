import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type FontSize = 'normal' | 'large' | 'xlarge'

interface SettingsState {
  lrsMode: boolean
  fontSize: FontSize
  highContrast: boolean
  toggleLrsMode: () => void
  setFontSize: (size: FontSize) => void
  toggleHighContrast: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      lrsMode: false,
      fontSize: 'normal',
      highContrast: false,
      toggleLrsMode: () => set((s) => ({ lrsMode: !s.lrsMode })),
      setFontSize: (fontSize) => set({ fontSize }),
      toggleHighContrast: () => set((s) => ({ highContrast: !s.highContrast })),
    }),
    { name: 'leseflux-settings' },
  ),
)

export const fontSizeClass: Record<FontSize, string> = {
  normal: 'text-reader',
  large: 'text-reader-lg',
  xlarge: 'text-reader-xl',
}
