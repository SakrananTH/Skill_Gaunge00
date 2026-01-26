-- สร้างตาราง dbuser ให้รองรับ v_skill_gap_analysis
-- โดยใช้ชื่อคอลัมน์ trade_type และ role_code ตามที่ View ต้องการ

CREATE TABLE IF NOT EXISTS dbuser (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prefix VARCHAR(50),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    citizen_id VARCHAR(20),
    
    -- คอลัมน์สำคัญที่ View เรียกใช้
    trade_type VARCHAR(50) COMMENT 'ประเภทช่าง (structure, plumbing, etc.)',
    role_code VARCHAR(20) DEFAULT 'worker' COMMENT 'บทบาท (worker, admin)',

    phone_number VARCHAR(20),
    birth_date DATE,
    address_details TEXT,
    zip_code VARCHAR(10),
    sub_district VARCHAR(100),
    province VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;