import { Badge } from '@/components/ui/badge'
import { analysisLabel, assetStatusLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { AnalysisStatus, AssetStatus } from '@/types/domain'

const analysisClass: Record<AnalysisStatus, string> = {
  PENDING: 'bg-slate-500/15 text-slate-300',
  UPLOADING: 'bg-sky-500/15 text-sky-300',
  QUEUED: 'bg-indigo-500/15 text-indigo-200',
  ANALYZING: 'bg-violet-500/20 text-violet-200',
  EXTRACTING: 'bg-fuchsia-500/15 text-fuchsia-200',
  COMPLETED: 'bg-emerald-500/15 text-emerald-300',
  FAILED: 'bg-rose-500/15 text-rose-300',
}

const assetClass: Record<AssetStatus, string> = {
  RAW: 'bg-slate-500/15 text-slate-300',
  PROCESSING: 'bg-amber-500/15 text-amber-200',
  REVIEW: 'bg-orange-500/15 text-orange-200',
  READY: 'bg-emerald-500/15 text-emerald-300',
  FAILED: 'bg-rose-500/15 text-rose-300',
}

export function AnalysisBadge({ status }: { status: AnalysisStatus }) {
  return <Badge className={cn('border-transparent', analysisClass[status])}>{analysisLabel[status]}</Badge>
}

export function AssetBadge({ status }: { status: AssetStatus }) {
  return <Badge className={cn('border-transparent', assetClass[status])}>{assetStatusLabel[status]}</Badge>
}
