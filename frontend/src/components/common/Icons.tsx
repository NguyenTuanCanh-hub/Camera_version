const s = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

// Tập hợp các icon SVG nhỏ dùng chung trong toàn bộ ứng dụng
// Mỗi key là một hàm trả về JSX, gọi bằng <Icon.bell /> hoặc <Icon.collapse(true) />
export const Icon = {
  device:   () => <svg {...s} className="nav-icon"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  vision:   () => <svg {...s} className="nav-icon"><circle cx="12" cy="12" r="3.5"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/></svg>,
  bell:     () => <svg {...s} width="18" height="18"><path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>,
  export:   () => <svg {...s} width="14" height="14"><path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M5 21h14"/></svg>,
  search:   () => <svg {...s} width="14" height="14"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  calendar: () => <svg {...s} width="14" height="14"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg>,
  x:        () => <svg {...s} width="16" height="16"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  check:    () => <svg {...s} width="14" height="14"><path d="M20 6 9 17l-5-5"/></svg>,
  chevD:    () => <svg {...s} width="14" height="14"><path d="m6 9 6 6 6-6"/></svg>,
  alert:    () => <svg {...s} width="14" height="14"><path d="M12 9v4"/><circle cx="12" cy="16" r="1" fill="currentColor"/><path d="M10.3 4.2a2 2 0 0 1 3.4 0l7.6 13.2A2 2 0 0 1 19.6 20H4.4a2 2 0 0 1-1.7-2.6z"/></svg>,
  globe:    () => <svg {...s} width="16" height="16"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>,
  collapse: (open: boolean) => open
    ? <svg {...s} width="15" height="15"><path d="M15 18l-6-6 6-6"/></svg>
    : <svg {...s} width="15" height="15"><path d="M9 18l6-6-6-6"/></svg>,
  menu:     () => <svg {...s} width="18" height="18"><path d="M4 6h16M4 12h16M4 18h16"/></svg>,
}
