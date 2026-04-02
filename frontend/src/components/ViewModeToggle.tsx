import { Button } from '@/components/ui/button'
import { Box, Cloud } from 'lucide-react'

interface ViewModeToggleProps {
  viewMode: 'box' | 'cloud'
  setViewMode: (mode: 'box' | 'cloud') => void
}

export default function ViewModeToggle({ viewMode, setViewMode }: ViewModeToggleProps) {
  return (
    <div className="flex gap-0.5 bg-secondary rounded-md p-0.5">
      <Button
        variant={viewMode === 'box' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setViewMode('box')}
        className="font-mono text-xs h-7 px-2"
      >
        <Box className="h-3.5 w-3.5 mr-1" /> 박스
      </Button>
      <Button
        variant={viewMode === 'cloud' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setViewMode('cloud')}
        className="font-mono text-xs h-7 px-2"
      >
        <Cloud className="h-3.5 w-3.5 mr-1" /> 포인트
      </Button>
    </div>
  )
}
