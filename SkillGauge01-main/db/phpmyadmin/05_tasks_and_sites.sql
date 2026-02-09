-- ===============================================================================
-- SkillGauge - งานและสถานที่ (สำหรับ phpMyAdmin)
-- ===============================================================================

-- 1. ตาราง Sites (สถานที่)
CREATE TABLE IF NOT EXISTS sites (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO sites (id, name, address) VALUES
(UUID(), 'Site A: Silom Condo', '123 Silom Rd, Bangkok'),
(UUID(), 'Site B: Asoke Office', '456 Asoke Rd, Bangkok'),
(UUID(), 'Site C: Pattaya Hotel', '789 Beach Rd, Pattaya');

CREATE TABLE IF NOT EXISTS tasks (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    project_id CHAR(36) NOT NULL,
    site_id CHAR(36) NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('todo', 'in-progress', 'submitted', 'approved', 'rejected', 'completed') DEFAULT 'todo',
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    due_date DATE,
    assignee_user_id CHAR(36) NULL,
    milp_condition VARCHAR(100) DEFAULT 'Standard',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS task_worker_assignments (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    task_id CHAR(36) NOT NULL,
    worker_id INT UNSIGNED NOT NULL,
    assignment_type VARCHAR(50) NOT NULL DEFAULT 'general',
    status ENUM('assigned', 'in-progress', 'completed') NOT NULL DEFAULT 'assigned',
    assigned_by_user_id CHAR(36) NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    KEY idx_task_worker_assignments_task (task_id),
    KEY idx_task_worker_assignments_worker (worker_id),
    KEY idx_task_worker_assignments_status (status),
    KEY idx_task_worker_assignments_type (assignment_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Tasks
SET @p_id = (SELECT id FROM projects LIMIT 1);
SET @s_id = (SELECT id FROM sites LIMIT 1);
SET @u_id = (SELECT id FROM users LIMIT 1); -- Demo User

INSERT INTO tasks (project_id, site_id, title, description, status, priority, due_date, assignee_user_id) VALUES
(@p_id, @s_id, 'ติดตั้งระบบไฟชั้น 1', 'เดินสายไฟหลักและติดตั้งตู้คอนโทรล', 'todo', 'high', DATE_ADD(CURDATE(), INTERVAL 7 DAY), @u_id),
(@p_id, @s_id, 'ทาสีภายนอกอาคาร A', 'ทาสีกันความร้อนภายนอก', 'in-progress', 'medium', DATE_ADD(CURDATE(), INTERVAL 14 DAY), @u_id);
