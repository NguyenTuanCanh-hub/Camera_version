import { useState, useEffect, useRef } from 'react'

interface CountUpProps {
  value: number
  fmt?: (n: number) => string
  duration?: number
}

// Hiển thị số đếm tăng/giảm mượt mà khi value thay đổi (dùng hiệu ứng easing)
// Nhận value (số cần hiển thị) và fmt (hàm định dạng tùy chọn) → render chuỗi số đã format
export default function CountUp({ value, fmt, duration = 900 }: CountUpProps) {
  const [display, setDisplay] = useState(0)
  const start = useRef(0)
  const raf = useRef<number>(0)

  useEffect(() => {
    const from = start.current
    const diff = value - from
    const t0 = performance.now()

    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplay(from + diff * ease)
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else start.current = value
    }

    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, duration])

  const str = fmt ? fmt(display) : Math.round(display).toLocaleString()
  return <>{str}</>
}
