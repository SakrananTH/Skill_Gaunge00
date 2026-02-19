import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import '../Dashboard.css';
import './AdminUsersTable.css';
import { apiRequest } from '../../utils/api';

const workerErrorMessages = {
  workers_table_missing_id: 'ตาราง workers ไม่มีคอลัมน์ id กรุณาตรวจสอบฐานข้อมูล',
  worker_accounts_table_missing_columns: 'ตารางบัญชีผู้ใช้ยังไม่พร้อมใช้งาน',
  worker_columns_unavailable: 'ไม่สามารถบันทึกข้อมูลพนักงานได้ กรุณาตรวจสอบโครงสร้างตาราง',
  duplicate_email: 'อีเมลนี้ถูกใช้งานแล้ว',
  duplicate_national_id: 'เลขบัตรประชาชนนี้ถูกใช้งานแล้ว',
  invalid_national_id_length: 'เลขบัตรประชาชนต้องมี 13 หลัก',
  assessment_not_passed: 'ยังไม่ผ่านการสอบทักษะ ไม่สามารถเลื่อนเป็นพนักงานประจำได้'
};

const STATUS_LABELS = {
  probation: 'ทดลองงาน',
  permanent: 'พนักงานประจำ',
  active: 'ทดลองงาน'
};

const STATUS_BADGE_CLASSES = {
  probation: 'status-badge status-badge--probation',
  permanent: 'status-badge status-badge--permanent',
  active: 'status-badge status-badge--probation'
};

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const isWorkerRole = (role, category) => {
  const key = normalizeRole(role);
  if (!key && category) return true;
  if (key.includes('หัวหน้า') || key.includes('foreman') || key === 'fm' || key.includes('(fm)')) return false;
  if (key.includes('ผู้จัดการ') || key.includes('project_manager') || key === 'pm' || key.includes('(pm)')) return false;
  if (key.includes('worker') || key === 'wk' || key.includes('(wk)')) return true;
  if (key.includes('ช่าง')) return true;
  return false;
};

const isForemanRole = (role) => {
  const key = normalizeRole(role);
  return key.includes('หัวหน้า') || key.includes('foreman') || key === 'fm' || key.includes('(fm)');
};

const isProjectManagerRole = (role) => {
  const key = normalizeRole(role);
  return key.includes('ผู้จัดการ') || key.includes('project_manager') || key === 'pm' || key.includes('(pm)');
};

const AdminUsersTable = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState(location.state?.filterCategory || 'all');
  const [filterStatus, setFilterStatus] = useState(location.state?.filterStatus || 'all');
  const [filterSkill, setFilterSkill] = useState(location.state?.filterSkill || 'all');
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resettingId, setResettingId] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const refreshWorkersFlag = Boolean(location.state?.refreshWorkers);

  // Auto-hide toast notification
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const loadWorkers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiRequest('/api/admin/workers');
      const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];
      setWorkers(items);
    } catch (err) {
      console.error('Failed to load workers', err);
      const messageKey = err?.data?.message || err?.message;
      setError(workerErrorMessages[messageKey] || err.message || 'ไม่สามารถโหลดข้อมูลพนักงานได้');
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  useEffect(() => {
    if (!refreshWorkersFlag) return;
    loadWorkers();
    if (location.state) {
      const { refreshWorkers, ...rest } = location.state;
      navigate(location.pathname, { replace: true, state: Object.keys(rest).length ? rest : undefined });
    } else {
      navigate(location.pathname, { replace: true });
    }
  }, [refreshWorkersFlag, loadWorkers, navigate, location.pathname, location.state]);

  const filteredWorkers = useMemo(() => {
    return workers.filter(worker => {
      const workerRoleIsWorker = isWorkerRole(worker.role, worker.category);
      const matchesSearch = (worker.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (worker.phone || '').includes(searchTerm);
      const matchesCategory = filterCategory === 'all'
        ? true
        : filterCategory === 'pm'
          ? isProjectManagerRole(worker.role)
          : filterCategory === 'fm'
            ? isForemanRole(worker.role)
            : workerRoleIsWorker && worker.category === filterCategory;
      const matchesStatus = filterStatus === 'all'
        ? true
        : workerRoleIsWorker && (
          (filterStatus === 'probation' && (worker.status === 'probation' || worker.status === 'active')) ||
          (filterStatus === 'permanent' && worker.status === 'permanent')
        );
      const matchesSkill = filterSkill === 'all'
        ? true
        : workerRoleIsWorker && (
          (filterSkill === 'none' && (worker.score === undefined || worker.score === null)) ||
          (filterSkill === 'passed' && worker.score !== undefined && worker.score !== null && worker.score >= 60) ||
          (filterSkill === 'failed' && worker.score !== undefined && worker.score !== null && worker.score < 60)
        );

      return matchesSearch && matchesCategory && matchesStatus && matchesSkill;
    });
  }, [workers, searchTerm, filterCategory, filterStatus, filterSkill]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(searchTerm.trim()) || filterCategory !== 'all' || filterStatus !== 'all' || filterSkill !== 'all';
  }, [searchTerm, filterCategory, filterStatus, filterSkill]);

  const handleDelete = async (id) => {
    if (!id) {
      console.warn('Cannot delete worker without id');
      return;
    }

    const confirmResult = await Swal.fire({
      title: 'ยืนยันการลบ',
      text: 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลพนักงานนี้?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก'
    });

    if (!confirmResult.isConfirmed) {
      return;
    }

    try {
      await apiRequest(`/api/admin/workers/${id}`, { method: 'DELETE' });
      await loadWorkers();
    } catch (err) {
      console.error('Failed to delete worker', err);
      setError(err.message || 'ไม่สามารถลบข้อมูลพนักงานได้');
    }
  };

  const openWorkerForm = async (worker, viewOnly = false) => {
    if (!worker?.id) {
      console.warn('Worker data is incomplete');
      return;
    }

    try {
      const rawPayload = worker.fullData
        ? worker
        : await apiRequest(`/api/admin/workers/${worker.id}`);
      const payload = rawPayload?.data ?? rawPayload;
      navigate('/admin/worker-registration', {
        state: {
          editWorker: payload,
          viewOnly
        }
      });
    } catch (err) {
      console.error('Failed to load worker detail', err);
      setError(err.message || 'ไม่สามารถเปิดรายละเอียดพนักงานได้');
    }
  };

  const handleEdit = (worker) => {
    openWorkerForm(worker, false);
  };

  const handleView = (worker) => {
    openWorkerForm(worker, true);
  };

  const handlePromote = async (worker) => {
    if (!worker?.id) return;
    if (worker.status === 'permanent') return;
    const hasPassedAssessment = worker.assessmentPassed === true ||
      (typeof worker.score === 'number' && worker.score >= 60);

    if (!hasPassedAssessment) {
      setError(workerErrorMessages.assessment_not_passed);
      return;
    }

    const confirmResult = await Swal.fire({
      title: 'ยืนยันการเลื่อนขั้น',
      text: 'ยืนยันเปลี่ยนสถานะเป็นพนักงานประจำ?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก'
    });

    if (!confirmResult.isConfirmed) {
      return;
    }

    try {
      const updated = await apiRequest(`/api/admin/workers/${worker.id}/status`, {
        method: 'PATCH',
        body: { status: 'permanent' }
      });
      setWorkers(prev => prev.map(item => (item.id === worker.id ? { ...item, ...updated } : item)));
    } catch (err) {
      console.error('Failed to update worker status', err);
      const messageKey = err?.data?.message || err?.message;
      setError(workerErrorMessages[messageKey] || err?.message || 'ไม่สามารถอัปเดตสถานะพนักงานได้');
    }
  };

  const handleResetAssessment = async (worker) => {
    if (!worker?.id) return;

    const confirmResult = await Swal.fire({
      title: 'รีเซ็ตผลการสอบ',
      text: `ยืนยันล้างผลการสอบของ ${worker.name} เพื่อให้สามารถสอบใหม่ได้?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ffc107', 
      cancelButtonColor: '#d33',
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก'
    });

    if (!confirmResult.isConfirmed) {
      return;
    }

    setResettingId(worker.id);
    try {
      await apiRequest(`/api/admin/workers/${worker.id}/reset-assessment`, {
        method: 'POST'
      });
      setToast({ show: true, message: `รีเซ็ตการสอบของ ${worker.name} สำเร็จแล้ว`, type: 'success' });
      await loadWorkers();
    } catch (err) {
      console.error('Failed to reset assessment', err);
      setError(err?.message || 'ไม่สามารถล้างผลการสอบได้');
    } finally {
      setResettingId(null);
    }
  };

  const handleAssessmentAccessToggle = async (worker) => {
    if (!worker?.id) return;
    const nextEnabled = !Boolean(worker.assessmentEnabled);
    const confirmMessage = nextEnabled
      ? 'ยืนยันเปิดให้เข้าสอบทักษะสำหรับพนักงานคนนี้?'
      : 'ยืนยันปิดการเข้าสอบทักษะสำหรับพนักงานคนนี้?';

    const confirmResult = await Swal.fire({
      title: nextEnabled ? 'เปิดสอบทักษะ' : 'ปิดสอบทักษะ',
      text: confirmMessage,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก'
    });

    if (!confirmResult.isConfirmed) {
      return;
    }

    try {
      const updated = await apiRequest(`/api/admin/workers/${worker.id}/assessment-access`, {
        method: 'PATCH',
        body: { enabled: nextEnabled }
      });
      setWorkers(prev => prev.map(item => (item.id === worker.id ? { ...item, ...updated } : item)));
    } catch (err) {
      console.error('Failed to toggle assessment access', err);
      setError(err?.message || 'ไม่สามารถเปลี่ยนสถานะการเข้าสอบได้');
    }
  };

  return (
    <div className="admin-users-table">
      <header className="admin-users-table__header">
        <h2>จัดการข้อมูลและบัญชี Project Manager & Foreman & Worker</h2>
        <p>
          แยกขั้นตอนการเก็บข้อมูลพนักงานและการสร้างบัญชีเข้าสู่ระบบ เพื่อให้ HR เลือกทำงานได้ตามความจำเป็น
        </p>
      </header>

      <div className="admin-users-table__cards">
        <article className="admin-users-card admin-users-card--primary">
          <h3>แบบฟอร์มลงทะเบียนพนักงานละเอียด</h3>
          <p>
            เก็บข้อมูลสำคัญครบทุกหมวด ทั้งข้อมูลส่วนตัว เอกสาร ทักษะ ความปลอดภัย และ เพื่อเตรียมเอกสาร HR ได้ทันที
          </p>
          <button
            type="button"
            className="admin-users-card__button admin-users-card__button--primary"
            onClick={() => navigate('/admin/worker-registration')}
          >
            เปิดแบบฟอร์มลงทะเบียน
          </button>
        </article>
      </div>

      <section className="admin-workers-section">
        <div className="admin-workers-section__header">
          <h3>รายชื่อพนักงานทั้งหมด</h3>
          <div className="admin-workers-filters">
            <div className="search-box">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
              </svg>
              <input
                type="text"
                placeholder="ค้นหาชื่อหรือเบอร์โทร..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all">ทุกประเภท</option>
              <option value="pm">Project Manager (PM)</option>
              <option value="fm">Foreman (FM)</option>
              <option value="structure">ช่างโครงสร้าง</option>
              <option value="plumbing">ช่างประปา</option>
              <option value="roofing">ช่างหลังคา</option>
              <option value="masonry">ช่างก่ออิฐฉาบปูน</option>
              <option value="aluminum">ช่างประตูหน้าต่างอลูมิเนียม</option>
              <option value="ceiling">ช่างฝ้าเพดาล</option>
              <option value="electric">ช่างไฟฟ้า</option>
              <option value="tiling">ช่างกระเบื้อง</option>
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="user-filter-select">
              <option value="all">ทุกสถานะ</option>
              <option value="permanent">ผ่านโปร (Permanent)</option>
              <option value="probation">ทดลองงาน (Probation)</option>
            </select>
          </div>
        </div>

        <div className="admin-workers-table">
          <div className="admin-workers-table__header">
            <div className="col col-name">ชื่อ-นามสกุล</div>
            <div className="col col-email">อีเมล</div>
            <div className="col col-password">รหัสผ่าน</div>
            <div className="col col-phone">เบอร์โทร</div>
            <div className="col col-role">Role</div>
            <div className="col col-status">สถานะ</div>
            <div className="col col-actions">จัดการ</div>
          </div>
          <div className="admin-workers-table__body">
            {loading ? (
              <div className="empty-state">กำลังโหลดข้อมูล...</div>
            ) : error ? (
              <div className="empty-state">{error}</div>
            ) : filteredWorkers.length === 0 ? (
              <div className="empty-state">
                {hasActiveFilters ? 'ไม่มีข้อมูลที่ตรงกับการค้นหา/ตัวกรอง' : 'ยังไม่มีข้อมูลพนักงานในระบบ' }
              </div>
            ) : (
              filteredWorkers.map(worker => {
                const workerRoleIsWorker = isWorkerRole(worker.role, worker.category);
                const isProbation = worker.status === 'probation' || worker.status === 'active';
                const hasPassedAssessment = worker.assessmentPassed === true ||
                  (typeof worker.score === 'number' && worker.score >= 60);
                const canPromote = isProbation && hasPassedAssessment;
                const assessmentOpen = Boolean(worker.assessmentEnabled);
                const promoteTitle = !isProbation
                  ? 'พนักงานประจำแล้ว'
                  : hasPassedAssessment
                    ? 'เลื่อนเป็นพนักงานประจำ'
                    : 'ยังไม่ผ่านการสอบทักษะ';

                return (
                <div key={worker.id} className="admin-workers-table__row">
                  <div className="col col-name" data-label="ชื่อ-นามสกุล">
                    <span className="worker-name">{worker.name}</span>
                  </div>
                  <div className="col col-email" data-label="อีเมล">{worker.email || '—'}</div>
                  <div className="col col-password" data-label="รหัสผ่าน">{worker.passwordHash || '—'}</div>
                  <div className="col col-phone" data-label="เบอร์โทร">{worker.phone || '—'}</div>
                  <div className="col col-role" data-label="Role">{worker.role || '—'}</div>
                  <div className="col col-status" data-label="สถานะ">
                    {workerRoleIsWorker ? (
                      <span className={STATUS_BADGE_CLASSES[worker.status] || 'status-badge'}>
                        {STATUS_LABELS[worker.status] || '—'}
                      </span>
                    ) : (
                      <span className="status-badge">—</span>
                    )}
                  </div>
                  <div className="col col-actions" data-label="จัดการ">
                    {workerRoleIsWorker && !hasPassedAssessment && (worker.score !== null && worker.score !== undefined) && (
                      <button
                        type="button"
                        className={`action-btn action-btn--reset ${resettingId === worker.id ? 'is-loading' : ''}`}
                        title="รีเซ็ตการสอบ (เพื่อให้สอบใหม่ได้)"
                        onClick={() => handleResetAssessment(worker)}
                        disabled={resettingId === worker.id}
                      >
                        {resettingId === worker.id ? (
                          <div className="spinner-small"></div>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658a.25.25 0 0 1-.41-.192z"/>
                          </svg>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      className="action-btn action-btn--view"
                      title="ดูรายละเอียด"
                      onClick={() => handleView(worker)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
                        <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="action-btn action-btn--edit"
                      title="แก้ไข"
                      onClick={() => handleEdit(worker)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="action-btn action-btn--delete"
                      title="ลบ"
                      onClick={() => handleDelete(worker.id)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
            )}
          </div>
        </div>
      </section>

      {/* Toast Notification */}
      {toast.show && (
        <div className={`toast-notification toast-notification--${toast.type}`}>
          <div className="toast-notification__content">
            {toast.type === 'success' ? (
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
              </svg>
            ) : (
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersTable;
