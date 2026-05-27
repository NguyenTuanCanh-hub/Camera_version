import { configureStore } from '@reduxjs/toolkit'
import uiReducer from '@/features/ui/uiSlice'

// Kho lưu dữ liệu chung của toàn ứng dụng (hiện chứa danh sách toast thông báo)
// Mọi màn hình đều có thể đọc/ghi dữ liệu tại đây thông qua hooks.ts
export const store = configureStore({
  reducer: {
    ui: uiReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
