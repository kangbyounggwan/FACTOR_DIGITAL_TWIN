# Section 02: Frontend Progress Display

**Section ID:** 02
**Status:** Pending
**Estimated Effort:** 2-3 hours

---

## Background

The FACTOR Digital Twin system processes LiDAR scan files (100MB - 1GB) through an 8-step pipeline. Currently, the frontend only shows a basic status indicator (queued/running/done/error) during processing. Users have no visibility into which step is executing or how far along the pipeline has progressed.

This section implements a rich progress display UI that shows:
- Current step name and number (e.g., "3/8 통계적 노이즈 제거")
- Percentage completion
- Visual checklist of all pipeline steps with completion indicators

This significantly improves user experience by providing transparency during long-running file processing operations.

---

## Dependencies

| Type | Section | Description |
|------|---------|-------------|
| **Requires** | Section 01 (Backend Progress Tracking) | The backend must expose `progress` object in the `GET /pipeline/{job_id}` response before the frontend can display it |
| **Blocks** | None | No other sections depend on this section |

**Important:** Do not start this section until Section 01 is complete and the backend returns the `JobProgress` object in status responses.

---

## Requirements

When this section is complete, the following must be true:

1. The PipelinePage displays a progress bar with percentage during pipeline execution
2. The current step name and step number are shown (e.g., "3/8 통계적 노이즈 제거")
3. A checklist of all 8 pipeline steps is displayed with visual indicators:
   - Completed steps show a checkmark
   - Current step is highlighted
   - Future steps show empty circles
4. The UI updates smoothly via polling without flicker
5. Polling interval is 1 second for responsive updates

---

## Pipeline Steps Reference

The backend processes files through these 8 steps (defined in Section 01):

| Step | Korean Name | English Translation |
|------|-------------|---------------------|
| 1 | 파일 로드 | File Load |
| 2 | 복셀 다운샘플링 | Voxel Downsampling |
| 3 | 통계적 노이즈 제거 | Statistical Noise Removal |
| 4 | 좌표 정규화 | Coordinate Normalization |
| 5 | RANSAC 바닥 분리 | RANSAC Floor Separation |
| 6 | DBSCAN 설비 클러스터링 | DBSCAN Equipment Clustering |
| 7 | 메타데이터 태깅 | Metadata Tagging |
| 8 | Supabase 적재 | Supabase Loading |

---

## Implementation Details

### Step 1: Update API Response Types

**File:** `frontend/src/lib/api.ts`

Add TypeScript interfaces for the progress data returned by the backend:

```typescript
// Add these interfaces to lib/api.ts

interface JobProgress {
  current_step: number      // 1-8, current step being executed
  total_steps: number       // Always 8 for this pipeline
  step_name: string         // Korean name of current step
  percentage: number        // 0-100, overall completion percentage
}

interface JobStatusResponse {
  job_id: string
  status: 'queued' | 'running' | 'done' | 'error'
  progress?: JobProgress    // Present when status is 'running'
  summary?: Record<string, any>  // Present when status is 'done'
  message?: string          // Present when status is 'error'
}
```

Ensure the `fetchJobStatus` function returns this typed response.

---

### Step 2: Update PipelinePage State

**File:** `frontend/src/pages/PipelinePage.tsx`

Add state for tracking progress:

```typescript
// Add to existing state declarations
const [progress, setProgress] = useState<JobProgress | null>(null)

// Define the steps array for the checklist display
const PIPELINE_STEPS = [
  "파일 로드",
  "복셀 다운샘플링",
  "통계적 노이즈 제거",
  "좌표 정규화",
  "RANSAC 바닥 분리",
  "DBSCAN 설비 클러스터링",
  "메타데이터 태깅",
  "Supabase 적재",
]
```

---

### Step 3: Update Polling Logic

**File:** `frontend/src/pages/PipelinePage.tsx`

Modify the existing polling interval to:
1. Use 1-second interval (instead of longer intervals) for smoother UX
2. Update progress state when data is received
3. Clear progress when job completes

```typescript
// Update the polling useEffect
useEffect(() => {
  if (!jobId || !isPolling) return

  const pollRef = { current: null as NodeJS.Timeout | null }

  pollRef.current = setInterval(async () => {
    try {
      const data = await fetchJobStatus(jobId)

      // Update progress state
      if (data.progress) {
        setProgress(data.progress)
      }

      // Handle completion
      if (data.status === 'done') {
        setProgress(null)
        setIsPolling(false)
        setSummary(data.summary)
        // ... existing completion logic
      }

      // Handle error
      if (data.status === 'error') {
        setProgress(null)
        setIsPolling(false)
        setError(data.message || 'Pipeline failed')
      }
    } catch (err) {
      console.error('Polling error:', err)
    }
  }, 1000)  // Poll every 1 second for smooth progress updates

  return () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
    }
  }
}, [jobId, isPolling])
```

---

### Step 4: Add Progress Bar UI

**File:** `frontend/src/pages/PipelinePage.tsx`

Add the progress bar component with percentage display. Uses shadcn/ui Progress component:

```tsx
// Import the Progress component
import { Progress } from '@/components/ui/progress'

// In the JSX, add when pipeline is running:
{status === 'running' && progress && (
  <div className="space-y-4">
    {/* Progress bar with percentage */}
    <div className="flex items-center gap-4">
      <Progress value={progress.percentage} className="flex-1" />
      <span className="text-lg font-semibold min-w-[3rem] text-right">
        {progress.percentage}%
      </span>
    </div>

    {/* Current step indicator */}
    <p className="text-center text-muted-foreground">
      <span className="font-medium text-foreground">
        {progress.current_step}/{progress.total_steps}
      </span>
      {' '}
      {progress.step_name}
    </p>
  </div>
)}
```

---

### Step 5: Add Step Checklist UI

**File:** `frontend/src/pages/PipelinePage.tsx`

Add the visual checklist showing all pipeline steps:

```tsx
// Import cn utility for conditional classNames
import { cn } from '@/lib/utils'

// In the JSX, below the progress bar:
{status === 'running' && progress && (
  <div className="mt-6 space-y-2">
    <h4 className="text-sm font-medium text-muted-foreground mb-3">
      처리 단계
    </h4>
    <div className="space-y-1">
      {PIPELINE_STEPS.map((step, index) => {
        const stepNumber = index + 1
        const isCompleted = stepNumber < progress.current_step
        const isCurrent = stepNumber === progress.current_step
        const isPending = stepNumber > progress.current_step

        return (
          <div
            key={index}
            className={cn(
              "flex items-center gap-2 py-1 px-2 rounded text-sm",
              isCompleted && "text-green-600 dark:text-green-400",
              isCurrent && "text-primary font-semibold bg-primary/10",
              isPending && "text-muted-foreground"
            )}
          >
            {/* Status indicator */}
            <span className="w-5 text-center">
              {isCompleted && '✓'}
              {isCurrent && '●'}
              {isPending && '○'}
            </span>

            {/* Step name */}
            <span>{step}</span>
          </div>
        )
      })}
    </div>
  </div>
)}
```

---

### Step 6: Handle Edge Cases

**File:** `frontend/src/pages/PipelinePage.tsx`

Ensure graceful handling of edge cases:

```tsx
// Show loading state while waiting for first progress update
{status === 'running' && !progress && (
  <div className="flex items-center justify-center py-8">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    <span className="ml-2 text-muted-foreground">파이프라인 시작 중...</span>
  </div>
)}

// Reset progress when starting a new job
const handleUpload = async (file: File) => {
  setProgress(null)  // Clear previous progress
  setError(null)
  // ... existing upload logic
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/lib/api.ts` | Add `JobProgress` and updated `JobStatusResponse` interfaces |
| `frontend/src/pages/PipelinePage.tsx` | Add progress state, update polling logic, add progress bar and checklist UI |

**No new files need to be created for this section.**

---

## Acceptance Criteria

Complete all checkboxes before marking this section as done:

- [ ] `JobProgress` interface defined in `lib/api.ts` matching backend schema
- [ ] `JobStatusResponse` interface includes optional `progress` field
- [ ] `progress` state added to PipelinePage
- [ ] Polling interval set to 1 second
- [ ] Progress bar displays current percentage (0-100)
- [ ] Percentage number displayed next to progress bar
- [ ] Current step shown as "X/8 [step_name]" format
- [ ] Step checklist displays all 8 pipeline steps
- [ ] Completed steps show checkmark (✓)
- [ ] Current step is visually highlighted (bold, colored background)
- [ ] Future steps show empty circle (○)
- [ ] UI updates smoothly without flicker during polling
- [ ] Progress clears when job completes or errors
- [ ] Loading state shown while waiting for first progress update

---

## Testing Instructions

### Manual Testing

1. **Start Pipeline:**
   - Navigate to Pipeline page
   - Upload a LiDAR file (.las, .laz, or .ply)
   - Verify progress UI appears

2. **Verify Progress Bar:**
   - Confirm progress bar shows percentage
   - Percentage should increase monotonically
   - Bar should fill proportionally

3. **Verify Step Display:**
   - Current step number and name should update as pipeline progresses
   - Each step transition should be visible

4. **Verify Checklist:**
   - All 8 steps should be listed
   - Steps should transition from pending (○) to current (●) to complete (✓)
   - Current step should be highlighted

5. **Verify Completion:**
   - Progress UI should disappear when job completes
   - Summary should be displayed

6. **Verify Error Handling:**
   - If pipeline fails, progress should clear
   - Error message should be shown

### Performance Testing

- Monitor network tab during polling
- Confirm requests are 1 second apart
- Ensure no memory leaks (polling cleanup on unmount)

---

## Backend API Reference

This section depends on the backend endpoint from Section 01:

**Endpoint:** `GET /pipeline/{job_id}`

**Response when running:**
```json
{
  "job_id": "abc123",
  "status": "running",
  "progress": {
    "current_step": 3,
    "total_steps": 8,
    "step_name": "통계적 노이즈 제거",
    "percentage": 37
  }
}
```

**Response when complete:**
```json
{
  "job_id": "abc123",
  "status": "done",
  "summary": {
    "equipment_count": 15,
    "points_processed": 1250000
  }
}
```

**Response on error:**
```json
{
  "job_id": "abc123",
  "status": "error",
  "message": "Failed to parse file format"
}
```

---

## Notes

- The polling approach is chosen over WebSockets for simplicity in the local development environment
- 1-second polling provides good responsiveness without overloading the server
- The PIPELINE_STEPS array should match exactly with the backend's step names for consistency
- Consider adding animation to the progress bar for smoother visual transitions (optional enhancement)
