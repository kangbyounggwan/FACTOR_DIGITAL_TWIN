# Section 03: Factory Line Page

## Background
공장/라인 선택 UI를 테이블 형태로 구현합니다. 공장을 선택하면 해당 공장의 라인 목록이 표시됩니다.

## Dependencies
- **Requires**: Section 01, 02
- **Blocks**: Section 04

## Prerequisites
```bash
# shadcn/ui Table 컴포넌트 설치
cd frontend
npx shadcn@latest add table
```

## Files to Create
- `frontend/src/pages/FactoryLinePage.tsx`

## Implementation

### UI 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│ 공장 및 라인 선택                                        │
├─────────────────────────────────────────────────────────┤
│ 공장 목록                                    [새로고침]  │
│ ┌────────┬──────────┬──────────┬────────┬────────────┐ │
│ │ 코드   │ 공장명   │ 주소     │ 라인   │            │ │
│ ├────────┼──────────┼──────────┼────────┼────────────┤ │
│ │JM_MAIN │ JM 본사  │ 화성시   │ 2      │ [선택]     │ │
│ └────────┴──────────┴──────────┴────────┴────────────┘ │
├─────────────────────────────────────────────────────────┤
│ JM_MAIN 라인 목록                                       │
│ ┌──────────┬──────────┬────────┬───────────────────┐   │
│ │ 라인코드 │ 라인명   │ 설비   │ 액션              │   │
│ ├──────────┼──────────┼────────┼───────────────────┤   │
│ │JM_PCB_001│ PCB 1라인│ 5      │ [3D보기] [업로드] │   │
│ │JM_PCB_002│ PCB 2라인│ 0      │ [3D보기] [업로드] │   │
│ └──────────┴──────────┴────────┴───────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 컴포넌트 코드

```typescript
import { useState } from 'react'
import { useFactories, useFactoryLines } from '@/hooks/useFactories'
import { Factory, ProductionLine } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, Eye, Upload } from 'lucide-react'

interface Props {
  onSelectLine: (factory: Factory, line: ProductionLine) => void
  onUpload: (factory: Factory, line: ProductionLine) => void
}

export default function FactoryLinePage({ onSelectLine, onUpload }: Props) {
  const { factories, loading: factoriesLoading, reload: reloadFactories } = useFactories()
  const [selectedFactory, setSelectedFactory] = useState<Factory | null>(null)
  const { lines, loading: linesLoading } = useFactoryLines(selectedFactory?.code ?? null)

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* 공장 목록 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="font-mono text-sm uppercase tracking-widest font-normal">
            공장 목록
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={reloadFactories}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {factoriesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : factories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              등록된 공장이 없습니다
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono">코드</TableHead>
                  <TableHead>공장명</TableHead>
                  <TableHead>주소</TableHead>
                  <TableHead className="text-right">라인</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factories.map((factory) => (
                  <TableRow
                    key={factory.id}
                    className={selectedFactory?.id === factory.id ? 'bg-primary/10' : ''}
                  >
                    <TableCell className="font-mono">{factory.code}</TableCell>
                    <TableCell>{factory.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {factory.address || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">-</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant={selectedFactory?.id === factory.id ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setSelectedFactory(factory)}
                      >
                        선택
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 라인 목록 (공장 선택 후) */}
      {selectedFactory && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm uppercase tracking-widest font-normal">
              {selectedFactory.name} 라인 목록
            </CardTitle>
          </CardHeader>
          <CardContent>
            {linesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : lines.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                이 공장에 등록된 라인이 없습니다
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono">라인 코드</TableHead>
                    <TableHead>라인명</TableHead>
                    <TableHead>설명</TableHead>
                    <TableHead className="text-right">설비</TableHead>
                    <TableHead className="w-40"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono">{line.code}</TableCell>
                      <TableCell>{line.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {line.description || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{line.equipment_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => onSelectLine(selectedFactory, line)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            3D 보기
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onUpload(selectedFactory, line)}
                          >
                            <Upload className="h-4 w-4 mr-1" />
                            업로드
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

## Acceptance Criteria
- [ ] shadcn/ui Table 컴포넌트가 설치됨
- [ ] 공장 목록이 테이블로 표시됨
- [ ] 공장 선택 시 해당 공장이 하이라이트됨
- [ ] 공장 선택 후 라인 테이블이 표시됨
- [ ] "3D 보기" 버튼 클릭 시 onSelectLine 호출됨
- [ ] "업로드" 버튼 클릭 시 onUpload 호출됨
- [ ] 로딩 상태에서 스피너 표시됨
- [ ] 빈 데이터일 때 안내 메시지 표시됨
