import React, { useState, useEffect } from 'react';
import '../Dashboard.css';
import './AdminAuditLog.css';
import { apiRequest } from '../../utils/api';

// API Endpoint สำหรับดึงข้อมูล Audit Log
const fetchAuditLogs = async (page = 1, limit = 5, search = '', filter = 'all', startDate = '', endDate = '') => {
  const params = new URLSearchParams();
  params.append('page', page);
  params.append('limit', limit);
  if (search) params.append('search', search);
  if (filter && filter !== 'all') params.append('status', filter);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  try {
    const response = await apiRequest(`/api/admin/audit-logs?${params.toString()}`);
    return {
      items: Array.isArray(response?.items) ? response.items : [],
      total: response?.total || 0
    };
  } catch (error) {
    console.error('Fetch audit logs error:', error);
    throw error;
  }
};

const AdminAuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { items, total } = await fetchAuditLogs(currentPage, itemsPerPage, search, filter, startDate, endDate);
        setLogs(items);
        setTotalPages(Math.ceil(total / itemsPerPage));
      } catch (err) {
        console.error('Failed to fetch logs', err);
        const status = err?.status ? ` [${err.status}]` : '';
        const message = err?.message ? ` ${err.message}` : '';
        setLogs([]);
        setSelectedLog({
          id: 'error',
          timestamp: new Date().toISOString(),
          user: 'System',
          role: '-',
          action: 'โหลดประวัติการใช้งานไม่สำเร็จ',
          details: `ไม่สามารถโหลดประวัติการใช้งานได้${status}${message}`.trim(),
          ip: '-',
          status: 'error'
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [currentPage, search, filter, itemsPerPage, startDate, endDate]);

  // รีเซ็ตหน้าเมื่อมีการค้นหาหรือกรองใหม่
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter, itemsPerPage, startDate, endDate]);

  const getStatusColor = (status) => {
    switch(status) {
      case 'success': return '#48bb78'; // สีเขียว
      case 'warning': return '#ed8936'; // สีส้ม
      case 'error': return '#f56565';   // สีแดง
      default: return '#a0aec0';        // สีเทา
    }
  };

  const formatDetails = (details) => {
    if (details === null || details === undefined) return '-';
    if (typeof details === 'string') return details;
    try {
      return JSON.stringify(details, null, 2);
    } catch (error) {
      return String(details);
    }
  };

  return (
    <div className="admin-audit-log-container">
      <header className="page-header">
        <h2 className="page-title">ประวัติการใช้งาน (Audit Log)</h2>
        <p className="page-description">ตรวจสอบกิจกรรมและการเปลี่ยนแปลงที่เกิดขึ้นในระบบ</p>
      </header>

      <div className="content-card">
        <div className="filter-section">
          <div className="search-group">
             <input 
               type="text" 
               placeholder="ค้นหาผู้ใช้ หรือ กิจกรรม..." 
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="search-input"
             />
             <select 
               value={filter} 
               onChange={(e) => setFilter(e.target.value)}
               className="status-select"
             >
               <option value="all">สถานะทั้งหมด</option>
               <option value="success">สำเร็จ (Success)</option>
               <option value="warning">แจ้งเตือน (Warning)</option>
               <option value="error">ผิดพลาด (Error)</option>
             </select>
             <div className="date-group">
               <input 
                 type="date" 
                 value={startDate} 
                 onChange={(e) => setStartDate(e.target.value)}
                 lang="th"
                 className="date-input"
                 title="วันที่เริ่มต้น"
               />
               <span className="date-separator">-</span>
               <input 
                 type="date" 
                 value={endDate} 
                 onChange={(e) => setEndDate(e.target.value)}
                 lang="th"
                 className="date-input"
                 title="วันที่สิ้นสุด"
               />
             </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="audit-table">
            <thead>
              <tr>
                <th>เวลา</th>
                <th>ผู้ใช้งาน</th>
                <th>กิจกรรม</th>
                <th>รายละเอียด</th>
                <th>IP Address</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="loading-message">กำลังโหลดข้อมูล...</td>
                </tr>
              ) : logs.map(log => (
                <tr 
                  key={log.id} 
                  className={log.action === 'DELETE_USER' ? 'action-delete-user' : ''}
                  onClick={() => setSelectedLog(log)}
                >
                  <td>
                    {new Date(log.timestamp).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td>
                    <div className="user-info">{log.user}</div>
                    <div className="user-role">{log.role}</div>
                  </td>
                  <td>
                    <span className="activity-badge">
                      {log.action}
                    </span>
                  </td>
                  <td className="details-cell">{formatDetails(log.details)}</td>
                  <td className="ip-cell">{log.ip}</td>
                  <td className="status-cell">
                    <span 
                      className="status-dot" 
                      style={{ backgroundColor: getStatusColor(log.status) }}
                    ></span>
                    <span className="status-text">{log.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && logs.length === 0 && (
            <div className="empty-message">ไม่พบข้อมูล</div>
          )}
        </div>

        {/* Pagination Controls */}
        <div className="pagination-container">
          <div className="items-per-page">
            <span>แสดง</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="items-select"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span>รายการต่อหน้า</span>
          </div>

          <div className="page-controls">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
              className={`page-btn ${currentPage === 1 ? 'active' : ''}`}
            >
              &lt; ก่อนหน้า
            </button>
            <span className="page-info">
              หน้า {currentPage} จาก {totalPages || 1}
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || loading}
              className={`page-btn ${currentPage === totalPages ? 'active' : ''}`}
            >
              ถัดไป &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button 
                onClick={() => setSelectedLog(null)}
                className="modal-close-btn"
            >
                &times;
            </button>
            <h3 className="modal-header">
                รายละเอียดกิจกรรม
            </h3>
            
            <div className="modal-details-grid">
                <div className="detail-label">ID:</div>
                <div className="detail-value">{selectedLog.id}</div>
                
                <div className="detail-label">เวลา:</div>
                <div className="detail-value">{new Date(selectedLog.timestamp).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                
                <div className="detail-label">ผู้ใช้งาน:</div>
                <div className="detail-value">{selectedLog.user} <span className="detail-sub-label">({selectedLog.role})</span></div>
                
                <div className="detail-label">กิจกรรม:</div>
                <div>
                    <span className="activity-badge">
                        {selectedLog.action}
                    </span>
                </div>
                
                <div className="detail-label">สถานะ:</div>
                <div className="status-cell">
                    <span className="status-dot" style={{ backgroundColor: getStatusColor(selectedLog.status) }}></span>
                    <span className="status-text">{selectedLog.status}</span>
                </div>
                
                <div className="detail-label">IP Address:</div>
                <div className="ip-cell">{selectedLog.ip}</div>
                
                <div className="detail-label">รายละเอียด:</div>
                <div className="detail-json-box">
                  {formatDetails(selectedLog.details)}
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAuditLog;
