export const ROLE_LABELS = {
  admin: 'ผู้ดูแลระบบ',
  project_manager: 'ผู้จัดการโครงการ (PM)',
  pm: 'ผู้จัดการโครงการ (PM)',
  foreman: 'หัวหน้าช่าง (FM)',
  fm: 'หัวหน้าช่าง (FM)',
  worker: 'ช่าง (WK)',
  wk: 'ช่าง (WK)'
};

export const TRADE_LABELS = {
  structure: 'ช่างโครงสร้าง',
  plumbing: 'ช่างประปา',
  roofing: 'ช่างหลังคา',
  masonry: 'ช่างก่ออิฐฉาบปูน',
  aluminum: 'ช่างประตูหน้าต่างอลูมิเนียม',
  ceiling: 'ช่างฝ้าเพดาล',
  electric: 'ช่างไฟฟ้า',
  tiling: 'ช่างกระเบื้อง'
};

export const ADMIN_BYPASS = {
  id: '11111111-1111-1111-1111-111111111111',
  phone: '0863125891',
  normalizedPhone: '+66863125891',
  email: 'admin@example.com',
  fullName: 'ผู้ดูแลระบบ',
  password: '0863503381' // In a real app, this should be hashed or handled differently
};
