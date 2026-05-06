import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type FontSize = 'normal' | 'large' | 'xlarge'

interface SettingsState {
  lrsMode: boolean
  fontSize: FontSize
  toggleLrsMode: () => void
  setFontSize: (size: FontSize) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      lrsMode: false,
      fontSize: 'normal',
      toggleLrsMode: () => set((s) => ({ lrsMode: !s.lrsMode })),
      setFontSize: (fontSize) => set({ fontSize }),
    }),
    { name: 'leseflux-settings' },
  ),
)

export const fontSizeClass: Record<FontSize, string> = {
  normal: 'text-reader',
  large: 'text-reader-lg',
  xlarge: 'text-reader-xl',
}
