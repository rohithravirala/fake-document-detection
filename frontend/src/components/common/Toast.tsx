import { useState, useEffect } from 'react'
import { IconCheck, IconInfo } from '@/components/common/Icons'

export interface ToastMessage {
  id: string
  text: string
  type?: 'success' | 'info'
}

let toastListener: ((msg: ToastMessage) => void) | null = null

export function showToast(text: string, type: 'success' | 'info' = 'success') {
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
      }, 3000)
    }
    return () => {
      toastListener = null
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2.5 rounded-lg bg-gray-900 px-4 py-2.5 text-xs font-medium text-white shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          {t.type === 'success' ? (
            <IconCheck className="h-4 w-4 text-emerald-400" />
          ) : (
            <IconInfo className="h-4 w-4 text-sky-400" />
          )}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
