// Simple in-memory mock data to test Dashboard rendering and linking from forms

export const mockUser = {
  id: 'u_mock_001',
  fullName: 'สมิทธิ์ ไม่มีนี่',
  email: 'aunh888@gmail.com',
  phone: '+66861234567',
  role: 'foreman',
  username: '+66861234567',
};

export const mockProjects = [
  { id: 'p1', name: 'โรงงานบางปู', ownerId: 'u_mock_001', createdAt: '2025-10-01' },
  { id: 'p2', name: 'คอนโดฝั่งธน', ownerId: 'u_mock_001', createdAt: '2025-10-10' },
];

export const mockSites = [
  { id: 's1', projectId: 'p1', name: 'ไซต์ A', location: 'สมุทรปราการ' },
  { id: 's2', projectId: 'p2', name: 'ไซต์ B', location: 'กรุงเทพฯ' },
];

export const mockTasks = [
  { id: 't1', projectId: 'p1', siteId: 's1', title: 'ติดตั้งแผ่นยิปซัม', priority: 'high', status: 'todo', assigneeUsername: '+66861234567', dueDate: '2025-07-15' },
  { id: 't2', projectId: 'p2', siteId: 's2', title: 'ผนังกั้นรอบ', priority: 'medium', status: 'todo', assigneeUsername: '+66861234567', dueDate: '2025-07-20' },
  { id: 't3', projectId: 'p1', siteId: 's1', title: 'การเดินสายไฟฟ้า', priority: 'low', status: 'todo', assigneeUsername: '+66861234567', dueDate: '2025-07-25' },
  { id: 't4', projectId: 'p2', siteId: 's2', title: 'ความปลอดภัยหน้างาน', priority: 'medium', status: 'in-progress', assigneeUsername: '+66861234567', dueDate: '2025-10-30' },
];

// Admin mock data
export const mockAdminUsers = [
  { id: 'u1', fullName: 'สมิทธิ์ ไม่มีนี่', phone: '+66861234567', role: 'foreman', status: 'active', lastLogin: '2025-11-01 09:12' },
  { id: 'u2', fullName: 'โสภา ไพบูลย์', phone: '+66869876543', role: 'worker', status: 'active', lastLogin: '2025-11-02 08:02' },
  { id: 'u3', fullName: 'วิชัย ลิ้มเจริญ', phone: '+66853334444', role: 'project_manager', status: 'active', lastLogin: '2025-10-31 18:45' },
  { id: 'u4', fullName: 'ผู้ดูแลระบบ', phone: '0863125891', role: 'admin', status: 'active', lastLogin: '2025-11-02 07:10' },
];

export const mockQuestions = [
  { id: 'q1', text: 'ใครควรสวมอุปกรณ์ป้องกันส่วนบุคคล (PPE) หน้างาน?', category: 'safety', difficulty: 'easy', version: '1.0', active: true },
  { id: 'q2', text: 'เบรกเกอร์ทำหน้าที่อะไร?', category: 'electrical', difficulty: 'easy', version: '1.0', active: true },
  { id: 'q3', text: 'คาน (Beam) ทำหน้าที่หลักในโครงสร้างคือ?', category: 'structure', difficulty: 'medium', version: '1.0', active: true },
  { id: 'q4', text: 'เมื่อเกิดอุบัติเหตุ ควรแจ้งใครเป็นอันดับแรก?', category: 'safety', difficulty: 'easy', version: '1.1', active: false },
];

export const mockAuditLog = [
  { id: 'e1', timestamp: '2025-11-01 09:03', actor: 'admin', action: 'create_user', details: 'สร้างบัญชี worker: +66869876543', ip: '10.0.0.12' },
  { id: 'e2', timestamp: '2025-11-01 10:12', actor: 'admin', action: 'update_question', details: 'แก้ไข q3 (difficulty=medium)', ip: '10.0.0.12' },
  { id: 'e3', timestamp: '2025-11-02 07:10', actor: 'admin', action: 'deactivate_user', details: 'ปิดใช้งานผู้ใช้ชั่วคราว: +66850000000', ip: '10.0.0.15' },
];
