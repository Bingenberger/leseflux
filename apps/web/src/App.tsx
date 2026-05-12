import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient.ts'
import { useSettingsStore } from './store/settingsStore.ts'
import AppRoutes from './routes/index.tsx'

export default function App() {
  const { highContrast } = useSettingsStore()

  const classes = highContrast ? 'high-contrast' : ''

  return (
    <QueryClientProvider client={queryClient}>
      <div className={classes}>
        <AppRoutes />
      </div>
    </QueryClientProvider>
  )
}
