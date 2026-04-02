import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { Equipment, EquipmentGroup } from '@/lib/api'
import { getEquipmentHex, getGroupHex } from '@/lib/colors'

export interface FloorBounds {
  x: number
  y: number
  width: number
  height: number
}

interface LayoutCanvasProps {
  equipment: Equipment[]
  selectedId: string | null
  onSelect: (eq: Equipment | null) => void
  onUpdatePosition: (equipmentId: string, x: number, y: number) => void
  onUpdateSize?: (equipmentId: string, w: number, d: number) => void
  floorBounds?: FloorBounds | null
  backgroundImage?: string | null
  showBackgroundImage?: boolean
  backgroundOpacity?: number
  multiSelectedIds?: string[]
  onMultiSelect?: (ids: string[]) => void
  onMoveMultiple?: (ids: string[], dx: number, dy: number) => void
  groups?: EquipmentGroup[]
  selectedGroupId?: string | null
  onSelectGroup?: (group: EquipmentGroup | null) => void
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | null

export default function LayoutCanvas({
  equipment,
  selectedId,
  onSelect,
  onUpdatePosition,
  onUpdateSize,
  floorBounds,
  backgroundImage,
  showBackgroundImage = true,
  backgroundOpacity = 0.5,
  multiSelectedIds = [],
  onMultiSelect,
  onMoveMultiple,
  groups = [],
  selectedGroupId,
  onSelectGroup,
}: LayoutCanvasProps) {
  // 그룹에 속한 설비 ID들 (그룹 박스로 대체되므로 개별 렌더링 제외)
  const groupedEquipmentIds = useMemo(() => {
    const ids = new Set<string>()
    groups.forEach(group => {
      group.member_ids.forEach(id => ids.add(id))
    })
    return ids
  }, [groups])

  const svgRef = useRef<SVGSVGElement>(null)
  const wasInteractingRef = useRef(false)
  const viewBoxInitialized = useRef(false)
  const baseViewBoxRef = useRef({ width: 100, height: 100 })
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 100, height: 100 })
  const viewBoxRef = useRef(viewBox)
  viewBoxRef.current = viewBox

  // 패닝 상태
  const panStateRef = useRef({ isPanning: false, startX: 0, startY: 0 })

  // 드래그 상태
  const dragStateRef = useRef<{
    equipmentId: string | null
    offsetX: number
    offsetY: number
    startClientX: number
    startClientY: number
    isDragging: boolean
    currentX: number
    currentY: number
    origW: number
    origD: number
  }>({ equipmentId: null, offsetX: 0, offsetY: 0, startClientX: 0, startClientY: 0, isDragging: false, currentX: 0, currentY: 0, origW: 0, origD: 0 })

  // 리사이즈 상태
  const resizeStateRef = useRef<{
    equipmentId: string | null
    handle: ResizeHandle
    startX: number
    startY: number
    origW: number
    origD: number
    origCx: number
    origCy: number
    currentW: number
    currentD: number
    currentCx: number
    currentCy: number
  }>({ equipmentId: null, handle: null, startX: 0, startY: 0, origW: 0, origD: 0, origCx: 0, origCy: 0, currentW: 0, currentD: 0, currentCx: 0, currentCy: 0 })

  // 영역 선택 상태
  const areaSelectRef = useRef<{
    isSelecting: boolean
    startX: number
    startY: number
    endX: number
    endY: number
  }>({ isSelecting: false, startX: 0, startY: 0, endX: 0, endY: 0 })

  const [, forceUpdate] = useState(0)
  const requestUpdate = useCallback(() => forceUpdate(n => n + 1), [])

  const scale = baseViewBoxRef.current.width / viewBox.width
  const DRAG_THRESHOLD = 3
  const MIN_SIZE = 0.3

  const equipmentGroupRefs = useRef<Map<string, SVGGElement>>(new Map())
  const areaSelectRectRef = useRef<SVGRectElement>(null)
  const prevEquipmentIdsRef = useRef<string>('')

  // 전체 보기 영역 계산
  const calculateFitBounds = useCallback(() => {
    const padding = 3

    if (floorBounds) {
      return {
        x: floorBounds.x - padding,
        y: floorBounds.y - padding,
        width: floorBounds.width + padding * 2,
        height: floorBounds.height + padding * 2,
      }
    }

    if (equipment.length === 0) return null

    const minX = Math.min(...equipment.map(e => e.centroid_x - e.size_w / 2)) - padding
    const maxX = Math.max(...equipment.map(e => e.centroid_x + e.size_w / 2)) + padding
    const minY = Math.min(...equipment.map(e => e.centroid_z - e.size_d / 2)) - padding
    const maxY = Math.max(...equipment.map(e => e.centroid_z + e.size_d / 2)) + padding

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }, [equipment, floorBounds])

  // viewBox 초기화
  useEffect(() => {
    if (equipment.length === 0 && !floorBounds) return

    const currentIds = equipment.map(e => e.equipment_id).sort().join(',')
    const idsChanged = currentIds !== prevEquipmentIdsRef.current

    if (viewBoxInitialized.current && !idsChanged) return

    prevEquipmentIdsRef.current = currentIds

    const bounds = calculateFitBounds()
    if (!bounds) return

    setViewBox(bounds)
    baseViewBoxRef.current = { width: bounds.width, height: bounds.height }
    viewBoxInitialized.current = true
  }, [equipment, calculateFitBounds])

  // SVG 좌표로 변환 (preserveAspectRatio="xMidYMid meet" 고려)
  const getSvgPoint = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    const vb = viewBoxRef.current

    // viewBox와 SVG 요소의 종횡비 계산
    const viewBoxAspect = vb.width / vb.height
    const svgAspect = rect.width / rect.height

    let renderedWidth: number, renderedHeight: number
    let offsetX = 0, offsetY = 0

    if (viewBoxAspect > svgAspect) {
      // viewBox가 더 넓음 - 위아래 여백 (letterbox)
      renderedWidth = rect.width
      renderedHeight = rect.width / viewBoxAspect
      offsetY = (rect.height - renderedHeight) / 2
    } else {
      // viewBox가 더 높음 - 좌우 여백 (pillarbox)
      renderedHeight = rect.height
      renderedWidth = rect.height * viewBoxAspect
      offsetX = (rect.width - renderedWidth) / 2
    }

    // 실제 렌더링 영역 기준으로 좌표 계산
    const x = vb.x + ((clientX - rect.left - offsetX) / renderedWidth) * vb.width
    const y = vb.y + ((clientY - rect.top - offsetY) / renderedHeight) * vb.height
    return { x, y }
  }, [])

  // 휠 줌
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9
      const rect = svg.getBoundingClientRect()
      const x = viewBox.x + ((e.clientX - rect.left) / rect.width) * viewBox.width
      const y = viewBox.y + ((e.clientY - rect.top) / rect.height) * viewBox.height

      setViewBox(prev => {
        const newWidth = prev.width * zoomFactor
        const newHeight = prev.height * zoomFactor
        const newX = x - (x - prev.x) * zoomFactor
        const newY = y - (y - prev.y) * zoomFactor
        return { x: newX, y: newY, width: newWidth, height: newHeight }
      })
    }

    svg.addEventListener('wheel', handleWheel, { passive: false })
    return () => svg.removeEventListener('wheel', handleWheel)
  }, [viewBox])

  // 키보드 이벤트
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const moveStep = e.shiftKey ? 1.0 : 0.1
      let dx = 0, dy = 0

      switch (e.key) {
        case 'ArrowLeft': dx = -moveStep; break
        case 'ArrowRight': dx = moveStep; break
        case 'ArrowUp': dy = -moveStep; break
        case 'ArrowDown': dy = moveStep; break
        default: return
      }

      e.preventDefault()

      if (multiSelectedIds.length > 0 && onMoveMultiple) {
        onMoveMultiple(multiSelectedIds, dx, dy)
      } else if (selectedId) {
        const eq = equipment.find(e => e.equipment_id === selectedId)
        if (eq) {
          onUpdatePosition(selectedId, eq.centroid_x + dx, eq.centroid_z + dy)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, multiSelectedIds, equipment, onUpdatePosition, onMoveMultiple])

  // 설비 DOM 직접 조작
  const applyTransformToEquipment = useCallback((equipmentId: string, cx: number, cy: number, w: number, d: number) => {
    const group = equipmentGroupRefs.current.get(equipmentId)
    if (!group) return

    const rect = group.querySelector('rect.eq-box') as SVGRectElement
    const idText = group.querySelector('text.eq-id') as SVGTextElement
    const typeText = group.querySelector('text.eq-type') as SVGTextElement
    const multiSelectRect = group.querySelector('rect.multi-select-bg') as SVGRectElement
    const handles = group.querySelectorAll('rect.resize-handle')

    const x = cx - w / 2
    const y = cy - d / 2

    if (rect) {
      rect.setAttribute('x', String(x))
      rect.setAttribute('y', String(y))
      rect.setAttribute('width', String(w))
      rect.setAttribute('height', String(d))
    }
    if (idText) {
      idText.setAttribute('x', String(cx))
      idText.setAttribute('y', String(cy))
      idText.setAttribute('font-size', String(Math.min(w, d) * 0.3))
    }
    if (typeText) {
      typeText.setAttribute('x', String(cx))
      typeText.setAttribute('y', String(cy + Math.min(w, d) * 0.35))
      typeText.setAttribute('font-size', String(Math.min(w, d) * 0.15))
    }
    if (multiSelectRect) {
      multiSelectRect.setAttribute('x', String(x - 0.1))
      multiSelectRect.setAttribute('y', String(y - 0.1))
      multiSelectRect.setAttribute('width', String(w + 0.2))
      multiSelectRect.setAttribute('height', String(d + 0.2))
    }
    const handleSize = Math.min(w, d) * 0.15
    handles.forEach((handle) => {
      const handleEl = handle as SVGRectElement
      const pos = handleEl.dataset.handle
      let hx = x, hy = y
      if (pos?.includes('e')) hx = x + w - handleSize
      if (pos?.includes('s')) hy = y + d - handleSize
      handleEl.setAttribute('x', String(hx))
      handleEl.setAttribute('y', String(hy))
      handleEl.setAttribute('width', String(handleSize))
      handleEl.setAttribute('height', String(handleSize))
    })
  }, [])

  // 영역 선택 사각형 업데이트
  const updateAreaSelectRect = useCallback(() => {
    const rect = areaSelectRectRef.current
    if (!rect) return

    const { isSelecting, startX, startY, endX, endY } = areaSelectRef.current
    if (!isSelecting) {
      rect.setAttribute('visibility', 'hidden')
      return
    }

    const minX = Math.min(startX, endX)
    const minY = Math.min(startY, endY)
    const width = Math.abs(endX - startX)
    const height = Math.abs(endY - startY)

    rect.setAttribute('visibility', 'visible')
    rect.setAttribute('x', String(minX))
    rect.setAttribute('y', String(minY))
    rect.setAttribute('width', String(width))
    rect.setAttribute('height', String(height))
  }, [])

  // 네이티브 mousemove/mouseup 이벤트 핸들러
  useEffect(() => {
    const handleNativeMouseMove = (e: MouseEvent) => {
      const drag = dragStateRef.current
      const resize = resizeStateRef.current
      const pan = panStateRef.current
      const area = areaSelectRef.current

      // 영역 선택 중
      if (area.isSelecting) {
        const point = getSvgPoint(e.clientX, e.clientY)
        area.endX = point.x
        area.endY = point.y
        updateAreaSelectRect()
        return
      }

      // 패닝 중
      if (pan.isPanning) {
        const vb = viewBoxRef.current
        const dx = (e.clientX - pan.startX) / (svgRef.current?.clientWidth || 1) * vb.width
        const dy = (e.clientY - pan.startY) / (svgRef.current?.clientHeight || 1) * vb.height
        setViewBox(prev => ({
          ...prev,
          x: prev.x - dx,
          y: prev.y - dy,
        }))
        pan.startX = e.clientX
        pan.startY = e.clientY
        return
      }

      // 리사이즈 중
      if (resize.equipmentId && resize.handle) {
        const point = getSvgPoint(e.clientX, e.clientY)
        const dx = point.x - resize.startX
        const dy = point.y - resize.startY

        let newW = resize.origW
        let newD = resize.origD
        let newCx = resize.origCx
        let newCy = resize.origCy

        if (resize.handle.includes('e')) {
          newW = Math.max(MIN_SIZE, resize.origW + dx)
          newCx = resize.origCx + dx / 2
        }
        if (resize.handle.includes('w')) {
          newW = Math.max(MIN_SIZE, resize.origW - dx)
          newCx = resize.origCx + dx / 2
        }
        if (resize.handle.includes('s')) {
          newD = Math.max(MIN_SIZE, resize.origD + dy)
          newCy = resize.origCy + dy / 2
        }
        if (resize.handle.includes('n')) {
          newD = Math.max(MIN_SIZE, resize.origD - dy)
          newCy = resize.origCy + dy / 2
        }

        resize.currentW = newW
        resize.currentD = newD
        resize.currentCx = newCx
        resize.currentCy = newCy

        applyTransformToEquipment(resize.equipmentId, newCx, newCy, newW, newD)
        return
      }

      // 드래그 중
      if (drag.equipmentId) {
        const dx = e.clientX - drag.startClientX
        const dy = e.clientY - drag.startClientY
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (!drag.isDragging && distance > DRAG_THRESHOLD) {
          drag.isDragging = true
        }

        if (drag.isDragging) {
          const point = getSvgPoint(e.clientX, e.clientY)
          const newX = point.x - drag.offsetX
          const newY = point.y - drag.offsetY
          drag.currentX = newX
          drag.currentY = newY
          applyTransformToEquipment(drag.equipmentId, newX, newY, drag.origW, drag.origD)
        }
      }
    }

    const handleNativeMouseUp = () => {
      const drag = dragStateRef.current
      const resize = resizeStateRef.current
      const pan = panStateRef.current
      const area = areaSelectRef.current

      // 영역 선택 완료
      if (area.isSelecting) {
        const minX = Math.min(area.startX, area.endX)
        const maxX = Math.max(area.startX, area.endX)
        const minY = Math.min(area.startY, area.endY)
        const maxY = Math.max(area.startY, area.endY)

        const width = maxX - minX
        const height = maxY - minY

        if (width > 0.5 && height > 0.5) {
          const selectedEq = equipment.filter(eq => {
            const cx = eq.centroid_x
            const cy = eq.centroid_z
            return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY
          })

          if (selectedEq.length > 0 && onMultiSelect) {
            onMultiSelect(selectedEq.map(eq => eq.equipment_id))
          }
        }

        area.isSelecting = false
        updateAreaSelectRect()
        requestUpdate()
        return
      }

      // 리사이즈 종료
      if (resize.equipmentId && resize.handle && onUpdateSize) {
        onUpdateSize(resize.equipmentId, resize.currentW, resize.currentD)
        onUpdatePosition(resize.equipmentId, resize.currentCx, resize.currentCy)
        resize.equipmentId = null
        resize.handle = null
        requestUpdate()
      }

      // 드래그 종료
      if (drag.equipmentId && drag.isDragging) {
        onUpdatePosition(drag.equipmentId, drag.currentX, drag.currentY)
      }
      drag.equipmentId = null
      drag.isDragging = false

      // 패닝 종료
      pan.isPanning = false

      setTimeout(() => {
        wasInteractingRef.current = false
      }, 0)

      requestUpdate()
    }

    document.addEventListener('mousemove', handleNativeMouseMove)
    document.addEventListener('mouseup', handleNativeMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleNativeMouseMove)
      document.removeEventListener('mouseup', handleNativeMouseUp)
    }
  }, [equipment, getSvgPoint, applyTransformToEquipment, updateAreaSelectRect, onUpdatePosition, onUpdateSize, onMultiSelect, requestUpdate])

  // 패닝 또는 영역 선택 시작
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      panStateRef.current = { isPanning: true, startX: e.clientX, startY: e.clientY }
      e.preventDefault()
    } else if (e.button === 0 && e.shiftKey && onMultiSelect) {
      const point = getSvgPoint(e.clientX, e.clientY)
      areaSelectRef.current = { isSelecting: true, startX: point.x, startY: point.y, endX: point.x, endY: point.y }
      updateAreaSelectRect()
      e.preventDefault()
    }
  }, [getSvgPoint, onMultiSelect, updateAreaSelectRect])

  // 설비 드래그 시작
  const handleEquipmentMouseDown = useCallback((e: React.MouseEvent, eq: Equipment) => {
    if (e.button === 0 && !e.shiftKey) {
      e.stopPropagation()
      wasInteractingRef.current = true
      const point = getSvgPoint(e.clientX, e.clientY)
      dragStateRef.current = {
        equipmentId: eq.equipment_id,
        offsetX: point.x - eq.centroid_x,
        offsetY: point.y - eq.centroid_z,
        startClientX: e.clientX,
        startClientY: e.clientY,
        isDragging: false,
        currentX: eq.centroid_x,
        currentY: eq.centroid_z,
        origW: eq.size_w,
        origD: eq.size_d,
      }
      onSelect(eq)
    }
  }, [getSvgPoint, onSelect])

  // 리사이즈 핸들 드래그 시작
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, eq: Equipment, handle: ResizeHandle) => {
    e.stopPropagation()
    wasInteractingRef.current = true
    const point = getSvgPoint(e.clientX, e.clientY)
    resizeStateRef.current = {
      equipmentId: eq.equipment_id,
      handle,
      startX: point.x,
      startY: point.y,
      origW: eq.size_w,
      origD: eq.size_d,
      origCx: eq.centroid_x,
      origCy: eq.centroid_z,
      currentW: eq.size_w,
      currentD: eq.size_d,
      currentCx: eq.centroid_x,
      currentCy: eq.centroid_z,
    }
  }, [getSvgPoint])

  // 배경 클릭시 선택 해제
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (wasInteractingRef.current) {
      wasInteractingRef.current = false
      return
    }

    const target = e.target as SVGElement
    if (target.tagName === 'rect' || target === svgRef.current) {
      onSelect(null)
    }
  }, [onSelect])

  return (
    <div className="w-full h-full bg-zinc-900 relative overflow-hidden">
      {/* 툴바 힌트 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-xs text-muted-foreground pointer-events-none z-10">
        드래그: 설비 이동 | Shift+드래그: 영역 선택 | 스크롤: 줌{multiSelectedIds.length > 0 && ` | 화살표: 선택 이동 (${multiSelectedIds.length}개)`}
      </div>

      {/* 스케일 표시 */}
      <div className="absolute bottom-12 left-4 flex items-center gap-2 z-10">
        <div className="font-mono text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded">
          {scale.toFixed(2)}x
        </div>
        <button
          onClick={() => {
            const bounds = calculateFitBounds()
            if (bounds) {
              setViewBox(bounds)
              baseViewBoxRef.current = { width: bounds.width, height: bounds.height }
            }
          }}
          className="font-mono text-xs text-muted-foreground bg-card/80 hover:bg-card px-2 py-1 rounded transition-colors"
          title="전체 보기 (1배율)"
        >
          1:1
        </button>
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        onMouseDown={handleMouseDown}
        onClick={handleBackgroundClick}
      >
        {/* 그리드 */}
        <defs>
          <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#333" strokeWidth="0.02" />
          </pattern>
          <pattern id="gridLarge" width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="url(#grid)" />
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#444" strokeWidth="0.04" />
          </pattern>
        </defs>
        <rect
          x={viewBox.x - 1000}
          y={viewBox.y - 1000}
          width={viewBox.width + 2000}
          height={viewBox.height + 2000}
          fill="url(#gridLarge)"
        />

        {/* 배경 이미지 */}
        {backgroundImage && showBackgroundImage && floorBounds && (
          <image
            href={backgroundImage}
            x={floorBounds.x}
            y={floorBounds.y}
            width={floorBounds.width}
            height={floorBounds.height}
            opacity={backgroundOpacity}
            preserveAspectRatio="none"
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* 공장 바닥 영역 */}
        {floorBounds && (
          <g>
            <rect
              x={floorBounds.x}
              y={floorBounds.y}
              width={floorBounds.width}
              height={floorBounds.height}
              fill="#1a1a2e"
              fillOpacity={0.6}
              stroke="#4a9eff"
              strokeWidth={0.1}
              strokeDasharray="0.5 0.2"
            />
            <text
              x={floorBounds.x + floorBounds.width / 2}
              y={floorBounds.y - 0.5}
              textAnchor="middle"
              fill="#4a9eff"
              fontSize={0.8}
              fontFamily="monospace"
            >
              {floorBounds.width.toFixed(2)}m
            </text>
            <text
              x={floorBounds.x - 0.5}
              y={floorBounds.y + floorBounds.height / 2}
              textAnchor="middle"
              fill="#4a9eff"
              fontSize={0.8}
              fontFamily="monospace"
              transform={`rotate(-90, ${floorBounds.x - 0.5}, ${floorBounds.y + floorBounds.height / 2})`}
            >
              {floorBounds.height.toFixed(2)}m
            </text>
            <circle cx={floorBounds.x} cy={floorBounds.y} r={0.15} fill="#4a9eff" />
            <circle cx={floorBounds.x + floorBounds.width} cy={floorBounds.y} r={0.15} fill="#4a9eff" />
            <circle cx={floorBounds.x} cy={floorBounds.y + floorBounds.height} r={0.15} fill="#4a9eff" />
            <circle cx={floorBounds.x + floorBounds.width} cy={floorBounds.y + floorBounds.height} r={0.15} fill="#4a9eff" />
          </g>
        )}

        {/* 그룹 연결 표시 */}
        {groups.map(group => {
          const members = equipment.filter(eq => group.member_ids.includes(eq.equipment_id))
          if (members.length < 2) return null

          const color = getGroupHex(group.group_type)

          // 바운딩 박스 계산
          const minX = Math.min(...members.map(m => m.centroid_x - m.size_w / 2))
          const maxX = Math.max(...members.map(m => m.centroid_x + m.size_w / 2))
          const minY = Math.min(...members.map(m => m.centroid_z - m.size_d / 2))
          const maxY = Math.max(...members.map(m => m.centroid_z + m.size_d / 2))

          const padding = 0.3
          const boxX = minX - padding
          const boxY = minY - padding
          const boxW = maxX - minX + padding * 2
          const boxH = maxY - minY + padding * 2

          // 연결선: 각 설비 쌍을 연결
          const lines: { x1: number; y1: number; x2: number; y2: number }[] = []
          for (let i = 0; i < members.length - 1; i++) {
            lines.push({
              x1: members[i].centroid_x,
              y1: members[i].centroid_z,
              x2: members[i + 1].centroid_x,
              y2: members[i + 1].centroid_z,
            })
          }

          const isGroupSelected = group.id === selectedGroupId

          return (
            <g key={group.id}>
              {/* 바운딩 박스 (클릭 가능) */}
              <rect
                x={boxX}
                y={boxY}
                width={boxW}
                height={boxH}
                fill={color}
                fillOpacity={isGroupSelected ? 0.2 : 0.08}
                stroke={isGroupSelected ? '#fff' : color}
                strokeWidth={isGroupSelected ? 0.12 : 0.08}
                strokeDasharray="0.3 0.15"
                rx={0.2}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectGroup?.(isGroupSelected ? null : group)
                }}
              />

              {/* 연결선 */}
              {lines.map((line, idx) => (
                <line
                  key={idx}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke={color}
                  strokeWidth={0.1}
                  strokeDasharray="0.2 0.1"
                  opacity={0.8}
                />
              ))}

              {/* 그룹 이름 및 타입 라벨 (박스 상단 외부) */}
              <text
                x={boxX + boxW / 2}
                y={boxY - 0.3}
                textAnchor="middle"
                fill={color}
                fontSize={0.35}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {group.name} [{group.group_type}]
              </text>
            </g>
          )
        })}

        {/* 설비 렌더링 */}
        {equipment.map(eq => {
          const isSelected = eq.equipment_id === selectedId
          const isMultiSelected = multiSelectedIds.includes(eq.equipment_id)
          const color = getEquipmentHex(eq.equipment_type)

          const cx = eq.centroid_x
          const cy = eq.centroid_z
          const x = cx - eq.size_w / 2
          const y = cy - eq.size_d / 2

          const strokeColor = isSelected ? '#22c55e' : isMultiSelected ? '#3b82f6' : '#fff'
          const strokeWidth = isSelected ? 0.15 : isMultiSelected ? 0.12 : 0.05

          return (
            <g
              key={eq.equipment_id}
              ref={(el) => {
                if (el) equipmentGroupRefs.current.set(eq.equipment_id, el)
                else equipmentGroupRefs.current.delete(eq.equipment_id)
              }}
              onMouseDown={(e) => handleEquipmentMouseDown(e, eq)}
              onClick={(e) => e.stopPropagation()}
              style={{ cursor: 'pointer' }}
            >
              {isMultiSelected && !isSelected && (
                <rect
                  className="multi-select-bg"
                  x={x - 0.1}
                  y={y - 0.1}
                  width={eq.size_w + 0.2}
                  height={eq.size_d + 0.2}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={0.08}
                  strokeDasharray="0.2 0.1"
                  rx={0.15}
                />
              )}
              <rect
                className="eq-box"
                x={x}
                y={y}
                width={eq.size_w}
                height={eq.size_d}
                fill={color}
                fillOpacity={isMultiSelected ? 0.85 : 0.7}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                rx={0.1}
              />
              <text
                className="eq-id"
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize={Math.min(eq.size_w, eq.size_d) * 0.3}
                fontFamily="monospace"
                fontWeight="bold"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {eq.equipment_id.split('_').pop()}
              </text>
              <text
                className="eq-type"
                x={cx}
                y={cy + Math.min(eq.size_w, eq.size_d) * 0.35}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ccc"
                fontSize={Math.min(eq.size_w, eq.size_d) * 0.15}
                fontFamily="monospace"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {eq.equipment_type}
              </text>

              {isSelected && onUpdateSize && (
                <>
                  {(['nw', 'ne', 'sw', 'se'] as const).map(handle => {
                    const handleSize = Math.min(eq.size_w, eq.size_d) * 0.15
                    const hx = handle.includes('w') ? x : x + eq.size_w - handleSize
                    const hy = handle.includes('n') ? y : y + eq.size_d - handleSize
                    const cursor = handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize'

                    return (
                      <rect
                        key={handle}
                        className="resize-handle"
                        data-handle={handle}
                        x={hx}
                        y={hy}
                        width={handleSize}
                        height={handleSize}
                        fill="#22c55e"
                        stroke="#fff"
                        strokeWidth={0.02}
                        style={{ cursor }}
                        onMouseDown={(e) => handleResizeMouseDown(e, eq, handle)}
                      />
                    )
                  })}
                </>
              )}
            </g>
          )
        })}

        {/* 영역 선택 박스 */}
        <rect
          ref={areaSelectRectRef}
          visibility="hidden"
          fill="rgba(59, 130, 246, 0.2)"
          stroke="#3b82f6"
          strokeWidth={0.1}
          strokeDasharray="0.3 0.15"
          style={{ pointerEvents: 'none' }}
        />
      </svg>
    </div>
  )
}
