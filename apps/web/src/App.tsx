import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient.ts'
import { useSettingsStore } from './store/settingsStore.ts'
import AppRoutes from './routes/index.tsx'

export default function App() {
  const { lrsMode } = useSettingsStore()

  return (
    <QueryClientProvider client={queryClient}>
      <div className={lrsMode ? 'font-dyslexic' : 'font-sans'}>
        <AppRoutes />
      </div>
    </QueryClientProvider>
  )
}
