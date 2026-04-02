import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Box, LayoutGrid, Settings } from 'lucide-react'
import { Company, Factory, ProductionLine } from '@/lib/api'
import FactoryLinePage from './pages/FactoryLinePage'
import LayoutEditorPage from './pages/LayoutEditorPage'
import AdminPage from './pages/AdminPage'

const APP_VERSION = 'v0.2.3'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

type PageType = '3d' | '2d' | 'admin'

export interface SelectionState {
  company: Company | null
  factory: Factory | null
  line: ProductionLine | null
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('3d')

  // 공유 선택 상태
  const [selection, setSelection] = useState<SelectionState>({
    company: null,
    factory: null,
    line: null,
  })

  const handleSelectCompany = (company: Company | null) => {
    setSelection({ company, factory: null, line: null })
  }

  const handleSelectFactory = (factory: Factory | null) => {
    setSelection(prev => ({ ...prev, factory, line: null }))
  }

  const handleSelectLine = (line: ProductionLine | null) => {
    setSelection(prev => ({ ...prev, line }))
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex flex-col h-screen overflow-hidden bg-background">
          {/* Header */}
          <header className="flex items-center justify-between px-6 h-12 border-b bg-card flex-shrink-0">
            <span className="font-mono text-sm font-semibold tracking-widest text-primary">
              FACTOR
            </span>

            {/* Page Navigation */}
            <div className="flex gap-0.5 bg-secondary rounded-md p-0.5">
              <Button
                variant={currentPage === '3d' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentPage('3d')}
                className="font-mono text-xs h-7 px-3"
              >
                <Box className="h-3.5 w-3.5 mr-1.5" />
                3D 뷰어
              </Button>
              <Button
                variant={currentPage === '2d' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentPage('2d')}
                className="font-mono text-xs h-7 px-3"
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
                2D 레이아웃
              </Button>
              <Button
                variant={currentPage === 'admin' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentPage('admin')}
                className="font-mono text-xs h-7 px-3"
              >
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                관리
              </Button>
            </div>

            <span className="font-mono text-xs text-muted-foreground">
              {APP_VERSION}
            </span>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-hidden">
            {currentPage === '3d' && (
              <FactoryLinePage
                selection={selection}
                onSelectCompany={handleSelectCompany}
                onSelectFactory={handleSelectFactory}
                onSelectLine={handleSelectLine}
              />
            )}
            {currentPage === '2d' && (
              <LayoutEditorPage
                selection={selection}
                onSelectCompany={handleSelectCompany}
                onSelectFactory={handleSelectFactory}
                onSelectLine={handleSelectLine}
              />
            )}
            {currentPage === 'admin' && <AdminPage />}
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
