import { useState, useRef, useEffect } from 'react'
import { startPipeline, fetchJobStatus, JobProgress } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Upload, Play, CheckCircle, XCircle, Loader2 } from 'lucide-react'

type Status = 'idle' | 'queued' | 'running' | 'done' | 'error'

interface Props {
  lineCode: string
  onComplete: () => void
  onBack: () => void
}

const STEPS = [
  '파일 로드',
  '복셀 다운샘플링',
  '통계적 노이즈 제거',
  '좌표 정규화',
  'RANSAC 바닥 분리',
  'DBSCAN 설비 클러스터링',
  '메타데이터 태깅',
  'Supabase 적재',
]

export default function PipelinePage({ lineCode, onComplete, onBack }: Props) {
  const [file,       setFile]       = useState<File | null>(null)
  const [voxelSize,  setVoxelSize]  = useState(0.05)
  const [status,     setStatus]     = useState<Status>('idle')
  const [jobId,      setJobId]      = useState('')
  const [summary,    setSummary]    = useState<Record<string, any> | null>(null)
  const [errMsg,     setErrMsg]     = useState('')
  const [progress,   setProgress]   = useState<JobProgress | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = () => { if (pollRef.current) clearInterval(pollRef.current) }

  useEffect(() => () => stopPoll(), [])

  // 완료 시 자동 이동
  useEffect(() => {
    if (status === 'done') {
      const timer = setTimeout(() => {
        onComplete()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [status, onComplete])

  async function handleRun() {
    if (!file) return
    setStatus('queued'); setErrMsg(''); setSummary(null); setProgress(null)
    try {
      const { job_id } = await startPipeline(file, lineCode, voxelSize)
      setJobId(job_id)
      setStatus('running')
      pollRef.current = setInterval(async () => {
        try {
          const data = await fetchJobStatus(job_id)

          // Update progress state
          if (data.progress) {
            setProgress(data.progress)
          }

          if (data.status === 'done') {
            setStatus('done'); setSummary(data.summary); setProgress(null); stopPoll()
          } else if (data.status === 'error') {
            setStatus('error'); setErrMsg(data.message || '알 수 없는 오류'); setProgress(null); stopPoll()
          }
        } catch (err) {
          console.error('Polling error:', err)
        }
      }, 1000)  // Poll every 1 second for smooth progress updates
    } catch (e: any) {
      setStatus('error'); setErrMsg(e.message)
    }
  }

  return (
    <div className="flex items-start justify-center h-full overflow-y-auto p-8">
      <div className="w-full max-w-xl flex flex-col gap-6">

        {/* Line Info */}
        <div>
          <Label className="font-mono text-xs uppercase tracking-widest">대상 라인</Label>
          <p className="font-mono text-base text-foreground mt-1">{lineCode}</p>
        </div>

        {/* File Upload */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm uppercase tracking-widest font-normal text-muted-foreground">
              스캔 파일
            </CardTitle>
          </CardHeader>
          <CardContent>
            <label className={cn(
              'flex flex-col items-center justify-center border-2 border-dashed rounded-lg h-32 cursor-pointer transition-colors',
              file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            )}>
              <input
                type="file"
                accept=".e57,.las,.laz,.ply"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <>
                  <Upload className="h-6 w-6 text-primary mb-2" />
                  <span className="font-mono text-sm text-primary">{file.name}</span>
                  <span className="font-mono text-xs text-muted-foreground mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                  <span className="font-mono text-sm text-muted-foreground">.e57 / .las / .laz / .ply 파일 선택</span>
                </>
              )}
            </label>
          </CardContent>
        </Card>

        {/* Voxel Size */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="font-mono text-sm uppercase tracking-widest font-normal text-muted-foreground">
                복셀 크기
              </CardTitle>
              <Badge variant="outline" className="font-mono">
                {voxelSize.toFixed(2)} m
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              type="range" min={0.01} max={0.2} step={0.01}
              value={voxelSize}
              onChange={e => setVoxelSize(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between font-mono text-xs text-muted-foreground">
              <span>0.01 m (정밀)</span>
              <span>0.20 m (경량)</span>
            </div>
          </CardContent>
        </Card>

        {/* Run Button */}
        <Button
          size="lg"
          className="w-full font-mono"
          onClick={handleRun}
          disabled={!file || status === 'running' || status === 'queued'}
        >
          {status === 'running' || status === 'queued' ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              처리 중...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              파이프라인 실행
            </>
          )}
        </Button>

        {/* Status */}
        {status !== 'idle' && (
          <Card className={cn(
            status === 'done' && 'border-success/50 bg-success/5',
            status === 'error' && 'border-destructive/50 bg-destructive/5'
          )}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                {status === 'done' && <CheckCircle className="h-5 w-5 text-success" />}
                {status === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
                {(status === 'running' || status === 'queued') && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                <span className={cn(
                  'font-mono text-sm',
                  status === 'done' && 'text-success',
                  status === 'error' && 'text-destructive',
                  (status === 'running' || status === 'queued') && 'text-foreground'
                )}>
                  {status === 'done' && '처리 완료'}
                  {status === 'error' && '오류 발생'}
                  {status === 'running' && '처리 중...'}
                  {status === 'queued' && '대기 중...'}
                </span>
                {jobId && (
                  <Badge variant="outline" className="font-mono text-xs ml-auto">
                    {jobId}
                  </Badge>
                )}
              </div>

              {/* Progress Bar and Current Step */}
              {status === 'running' && progress && (
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    <Progress value={progress.percentage} className="flex-1" />
                    <span className="font-mono text-lg font-semibold min-w-[3rem] text-right">
                      {progress.percentage}%
                    </span>
                  </div>
                  <p className="text-center font-mono text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {progress.current_step}/{progress.total_steps}
                    </span>
                    {' '}
                    {progress.step_name}
                  </p>
                </div>
              )}

              {/* Waiting for first progress */}
              {status === 'running' && !progress && (
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="font-mono text-sm">파이프라인 시작 중...</span>
                </div>
              )}

              {status === 'error' && (
                <p className="font-mono text-sm text-destructive">{errMsg}</p>
              )}

              {status === 'done' && summary && (
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    { label: '설비 수', val: summary.equipment_count },
                    { label: '바닥 포인트', val: summary.floor_point_count?.toLocaleString() },
                    { label: '사이트', val: summary.site_id },
                  ].map(s => (
                    <div key={s.label} className="bg-card border rounded-lg px-3 py-3 text-center">
                      <p className="font-mono text-lg font-semibold text-foreground">{s.val}</p>
                      <p className="font-mono text-xs text-muted-foreground uppercase">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Processing Steps */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm uppercase tracking-widest font-normal text-muted-foreground">
              처리 순서
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {STEPS.map((step, i) => {
                const stepNumber = i + 1
                const isCompleted = progress ? stepNumber < progress.current_step : false
                const isCurrent = progress ? stepNumber === progress.current_step : false
                const isPending = progress ? stepNumber > progress.current_step : true

                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-3 py-1.5 px-2 rounded font-mono text-sm transition-colors',
                      isCompleted && 'text-success',
                      isCurrent && 'text-primary font-semibold bg-primary/10',
                      isPending && !progress && 'text-muted-foreground',
                      isPending && progress && 'text-muted-foreground/60'
                    )}
                  >
                    <span className="w-5 text-center">
                      {isCompleted && '✓'}
                      {isCurrent && '●'}
                      {isPending && '○'}
                    </span>
                    <span className="w-5 text-right">{stepNumber}</span>
                    <span>{step}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
