interface ProductThumbProps {
  ry: string
  size?: 'sm' | 'lg'
}

// Hiển thị ảnh minh họa giày dạng SVG khi không có ảnh thật từ máy quét
// Màu sắc được tạo tự động từ mã sản phẩm (RY) để phân biệt trực quan giữa các mặt hàng
export default function ProductThumb({ ry, size = 'sm' }: ProductThumbProps) {
  const hue = Array.from(ry || 'x').reduce((s, c) => s + c.charCodeAt(0), 0) % 360
  const dim = size === 'lg' ? 64 : 40
  return (
    <div className={`thumb${size === 'lg' ? ' lg' : ''}`} style={{ width: dim, height: dim }}>
      <svg viewBox="0 0 40 40" width={dim} height={dim}>
        <path d="M4 32 Q8 14 16 14 L28 14 Q34 20 34 32 L34 36 L4 36 Z" fill={`hsl(${hue} 65% 28%)`} opacity="0.9"/>
        <ellipse cx="20" cy="14" rx="12" ry="3" fill={`hsl(${hue} 75% 48%)`} opacity="0.7"/>
        <path d="M5 30 L35 30" stroke={`hsl(${hue} 65% 55%)`} strokeWidth="0.8" opacity="0.5"/>
      </svg>
    </div>
  )
}
