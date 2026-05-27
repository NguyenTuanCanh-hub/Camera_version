import { createPortal } from 'react-dom'
import { Icon } from '@/components/common/Icons'

interface ModalProps {
  onClose: () => void
  title?: string
  width?: number
  children: React.ReactNode
  footer?: React.ReactNode
}

// Hộp thoại nổi (modal) dùng chung cho toàn ứng dụng, hiển thị đè lên nội dung trang
// Bọc nội dung children + footer tùy chọn, bấm ra ngoài hoặc nút X để đóng
export default function Modal({ onClose, title, width = 760, children, footer }: ModalProps) {
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width }}>
        {title && (
          <div className="row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-hair)' }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
            <button className="icon-btn ml-auto" onClick={onClose}><Icon.x /></button>
          </div>
        )}
        <div style={{ padding: 22, overflow: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div className="row" style={{ padding: '14px 20px', borderTop: '1px solid var(--border-hair)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

