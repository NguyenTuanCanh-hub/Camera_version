// Quản lý danh sách toast thông báo hiển thị góc màn hình (success/error/warning/info)
// addToast thêm thông báo mới, removeToast xóa theo id, selectToasts đọc danh sách để ToastRail hiển thị
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/app/store'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  title?: string
}

interface UiState {
  toasts: Toast[]
}

const initialState: UiState = {
  toasts: [],
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    addToast(state, action: PayloadAction<Omit<Toast, 'id'>>) {
      const id = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      state.toasts.push({ ...action.payload, id })
    },
    removeToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter(t => t.id !== action.payload)
    },
  },
})

export const { addToast, removeToast } = uiSlice.actions
export const selectToasts = (state: RootState) => state.ui.toasts
export default uiSlice.reducer
