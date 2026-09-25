import { useState, useEffect } from 'react'
import { IconCheck, IconInfo, IconAlert, IconCross } from '@/components/common/Icons'
import { cn } from '@/lib/utils'

export interface ToastMessage {
  id: string
  text: string
  type?: 'success' | 'info' | 'error' | 'warning'
}

let toastListener: ((msg: ToastMessage) => void) | null = null

export function showToast(
  text: string,
  type: 'success' | 'info' | 'error' | 'warning' = 'success',
) {
  if (toastListener) {
    toastListener({ id: Math.random().toString(), text, type })
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    toastListener = (msg) => {
      setToasts((prev) => [...prev, msg])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id))
      }, 3500)
    }
    return () => {
      toastListener = null
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm w-full">
      {toasts.map((t) => {
        const isSuccess = t.type === 'success' || !t.type
        const isError = t.type === 'error'
        const isWarning = t.type === 'warning'

        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-center justify-between gap-3 rounded-xl border bg-navy-950/95 px-4 py-3 text-[12.5px] font-medium text-white shadow-panel backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2',
              isSuccess && 'border-clear/40 shadow-glow-clear/20',
              isError && 'border-reject/40 shadow-glow-reject/20',
              isWarning && 'border-refer/40',
              !isSuccess && !isError && !isWarning && 'border-brand-500/40',
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {isSuccess && <IconCheck className="h-4 w-4 shrink-0 text-clear" />}
              {isError && <IconCross className="h-4 w-4 shrink-0 text-reject" />}
              {isWarning && <IconAlert className="h-4 w-4 shrink-0 text-refer" />}
              {!isSuccess && !isError && !isWarning && <IconInfo className="h-4 w-4 shrink-0 text-brand-400" />}
              <span className="truncate">{t.text}</span>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-white/40 hover:text-white transition-colors"
              aria-label="Dismiss toast"
            >
              <IconCross className="h-3 w-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
