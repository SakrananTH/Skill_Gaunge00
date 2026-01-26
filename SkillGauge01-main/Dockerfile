# Production Dockerfile - Multi-stage build
# Stage 1: Build React app
FROM node:18-alpine AS builder

WORKDIR /app

# คัดลอก package files
COPY package*.json ./

# ติดตั้ง dependencies
RUN npm install

# คัดลอกโค้ดทั้งหมด
COPY . .

# Build production app
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# คัดลอก built app จาก stage แรก
COPY --from=builder /app/build /usr/share/nginx/html

# คัดลอก nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# เปิด port 80
EXPOSE 80

# เริ่ม nginx
CMD ["nginx", "-g", "daemon off;"]