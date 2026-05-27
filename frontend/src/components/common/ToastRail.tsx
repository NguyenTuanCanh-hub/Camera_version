import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { removeToast, selectToasts } from '@/features/ui/uiSlice'

// Container hiển thị tất cả toast thông báo đang có trong danh sách (góc màn hình)
// Đọc danh sách toast từ kho dữ liệu chung, tự động xóa từng toast sau 5 giây
export default function ToastRail() {
  const toasts = useAppSelector(selectToasts)
  const dispatch = useAppDispatch()

  return (
    <div className="toast-rail">
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onDismiss={() => dispatch(removeToast(t.id))} />
      ))}
    </div>
  )
}

function Toast({ toast, onDismiss }: { toast: { id: string; type: string; message: string; title?: string }; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const iconMap: Record<string, string> = { success: '✓', error: '✕', warning: '▲', info: 'ℹ' }

  return (
    <div className={`toast ${toast.type}`} onClick={onDismiss} style={{ cursor: 'pointer' }}>
      <div className={`toast-icon ${toast.type}`}>{iconMap[toast.type] ?? 'ℹ'}</div>
      <div className="toast-body">
        {toast.title && <div className="toast-title">{toast.title}</div>}
        <div className="toast-msg">{toast.message}</div>
      </div>
    </div>
  )
}
