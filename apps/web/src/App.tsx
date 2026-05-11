import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient.ts'
import { useSettingsStore } from './store/settingsStore.ts'
import AppRoutes from './routes/index.tsx'

export default function App() {
  const { lrsMode, highContrast } = useSettingsStore()

  const classes = [
    lrsMode ? 'font-dyslexic' : 'font-sans',
    highContrast ? 'high-contrast' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <QueryClientProvider client={queryClient}>
      <div className={classes}>
        <AppRoutes />
      </div>
    </QueryClientProvider>
  )
}
