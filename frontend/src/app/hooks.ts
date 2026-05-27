import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from './store'

// Hook để gửi lệnh thay đổi dữ liệu vào kho chung (ví dụ: thêm toast thông báo)
// Dùng thay cho useDispatch để được kiểm tra kiểu dữ liệu tự động
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()

// Hook để đọc dữ liệu từ kho chung (ví dụ: lấy danh sách toast đang hiển thị)
// Dùng thay cho useSelector để được kiểm tra kiểu dữ liệu tự động
export const useAppSelector = useSelector.withTypes<RootState>()
