import AppShell from '@/components/layout/AppShell'

// Component gốc của ứng dụng, chỉ hiển thị AppShell (khung chứa toàn bộ trang)
// Từ đây mọi nội dung (sidebar, topbar, các trang) đều được AppShell quản lý
export default function App() {
  return <AppShell />
}
