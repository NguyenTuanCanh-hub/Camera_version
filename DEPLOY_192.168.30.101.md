# Deploy lyg-scan-platform lên server 192.168.30.101

## 1. Cài môi trường trên server

Cần có Node.js 20+ và npm.

```bash
node -v
npm -v
```

## 2. Copy project lên server

Ví dụ đặt project tại:

```bash
D:\web\lyg-scan-platform
```

Hoặc Linux:

```bash
/var/www/lyg-scan-platform
```

## 3. Tạo file cấu hình backend/.env

Copy từ file mẫu:

```bash
copy backend\.env.example backend\.env
```

Nếu dùng Linux:

```bash
cp backend/.env.example backend/.env
```

Sửa các dòng quan trọng:

```env
NODE_ENV=production
PORT=5000
FRONTEND_URL=http://192.168.30.101:5000

DB_PORT=1433
DB_NAME=TEN_DATABASE_THAT
DB_USER=sa
DB_PASSWORD=MAT_KHAU_SQL
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

DB_LHG_SERVER=192.168.30.1
```

Nếu SQL Server nằm chung trên máy deploy `192.168.30.101` thì đổi:

```env
DB_LHG_SERVER=192.168.30.101
```

## 4. Cài package

Chạy ở thư mục gốc project:

```bash
npm install
```

## 5. Build production

```bash
npm run build
```

Lệnh này sẽ build:

- Frontend React/Vite vào `frontend/dist`
- Backend TypeScript vào `backend/dist`

## 6. Chạy web

```bash
npm run start --workspace=backend
```

Mở trên máy khác cùng mạng:

```text
http://192.168.30.101:5000
```

Kiểm tra API health:

```text
http://192.168.30.101:5000/health
```

## 7. Chạy nền bằng PM2

Cài PM2:

```bash
npm install -g pm2
```

Chạy app:

```bash
pm2 start backend/dist/index.js --name lyg-scan-platform --cwd D:\web\lyg-scan-platform
pm2 save
```

Nếu dùng Linux:

```bash
pm2 start backend/dist/index.js --name lyg-scan-platform --cwd /var/www/lyg-scan-platform
pm2 save
```

## 8. Mở firewall

Mở inbound port `5000` trên server để máy khác truy cập được:

```text
TCP 5000
```

## 9. Lỗi thường gặp

### Lỗi connect SQL

```text
Failed to connect to 192.168.30.1:1433
```

Cách xử lý:

- Kiểm tra `DB_LHG_SERVER` đúng IP SQL Server chưa.
- Kiểm tra SQL Server đã bật TCP/IP chưa.
- Kiểm tra port 1433 đã mở firewall chưa.
- Kiểm tra user/password/database trong `.env`.

### Lỗi không truy cập được web từ máy khác

- Kiểm tra server có đúng IP `192.168.30.101` không.
- Kiểm tra app đang chạy port `5000` không.
- Kiểm tra firewall đã mở TCP 5000 chưa.

### Lỗi Cannot find module '@/...'

Đã sửa bằng `tsc-alias`. Sau khi sửa phải chạy lại:

```bash
npm run build
```
