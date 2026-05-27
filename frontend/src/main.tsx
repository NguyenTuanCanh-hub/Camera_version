import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from '@/app/store'
import App from '@/App'
import '@/styles/index.css'
import '@/index.css'

// Điểm khởi động của toàn bộ ứng dụng
// Bọc App trong Provider để các màn hình con dùng được dữ liệu chung (toast...), rồi gắn vào thẻ #root trong HTML
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
