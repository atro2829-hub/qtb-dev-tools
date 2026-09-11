/**
 * Real server-side run progress.
 *
 * Every tool run gets a client-generated runKey. The server creates a
 * "processing" ToolJob row immediately, bumps `progress` (0-100) and `stage`
 * at each real milestone of the pipeline, then finalizes the row. The client
 * polls GET /api/tools/progress?run=<key> and shows genuine progress instead
 * of a fake spinner.
 */
import { db } from '@/lib/db'

export type RunStage =
  | 'queued'
  | 'preparing'
  | 'transcribing'
  | 'translating'
  | 'converting'
  | 'processing'
  | 'organizing'
  | 'building'
  | 'saving'

export interface RunHandle {
  /** Bumps progress + stage. Never throws — progress must not break the run. */
  step: (progress: number, stage: RunStage) => void
  /** Marks the run completed (progress 100) and stores detail. */
  finish: (detail: string, resultUrl?: string) => Promise<void>
  /** Marks the run failed with an error detail. */
  fail: (detail: string) => Promise<void>
}

export async function startRun(opts: {
  userId: string
  runKey: string
  toolType: string
  fileName: string
  sourceFormat?: string
  targetFormat?: string
}): Promise<RunHandle | null> {
  if (!opts.runKey) return null
  try {
    await db.toolJob.create({
      data: {
        userId: opts.userId,
        runKey: opts.runKey,
        toolType: opts.toolType,
        fileName: (opts.fileName || '').slice(0, 200),
        sourceFormat: (opts.sourceFormat ?? '').slice(0, 20),
        targetFormat: (opts.targetFormat ?? '').slice(0, 20),
        status: 'processing',
        progress: 5,
        stage: 'queued',
        detail: '',
      },
    })
  } catch (err) {
    console.error('[progress] startRun failed:', err instanceof Error ? err.message : err)
    return null
  }

  let lastProgress = 5
  let failed = false
  return {
    step(progress: number, stage: RunStage) {
      const next = Math.max(lastProgress, Math.min(97, Math.round(progress)))
      if (failed || next === lastProgress) return
      lastProgress = next
      db.toolJob
        .updateMany({
          where: { userId: opts.userId, runKey: opts.runKey },
          data: { progress: next, stage },
        })
        .catch((e: unknown) => console.error('[progress] step failed', e))
    },
    async finish(detail: string, resultUrl?: string) {
      try {
        await db.toolJob.updateMany({
          where: { userId: opts.userId, runKey: opts.runKey },
          data: {
            status: 'completed',
            progress: 100,
            stage: 'done',
            detail: detail.slice(0, 500),
            ...(resultUrl ? { resultUrl: resultUrl.slice(0, 500) } : {}),
          },
        })
      } catch (e: unknown) {
        console.error('[progress] finish failed', e)
      }
    },
    async fail(detail: string) {
      failed = true
      try {
        await db.toolJob.updateMany({
          where: { userId: opts.userId, runKey: opts.runKey },
          data: {
            status: 'failed',
            stage: 'failed',
            detail: detail.slice(0, 500),
          },
        })
      } catch (e: unknown) {
        console.error('[progress] fail failed', e)
      }
    },
  }
}
