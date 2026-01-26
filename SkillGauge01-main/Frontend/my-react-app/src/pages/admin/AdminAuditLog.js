import React, { useState, useEffect } from 'react';
import '../Dashboard.css';
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
        setLogs([]);
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

  return (
    <div className="admin-audit-log" style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2d3748' }}>ประวัติการใช้งาน (Audit Log)</h2>
        <p style={{ color: '#718096' }}>ตรวจสอบกิจกรรมและการเปลี่ยนแปลงที่เกิดขึ้นในระบบ</p>
      </header>

      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '1rem', flex: 1, flexWrap: 'wrap' }}>
             <input 
               type="text" 
               placeholder="ค้นหาผู้ใช้ หรือ กิจกรรม..." 
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               style={{ padding: '0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '6px', width: '100%', maxWidth: '300px' }}
             />
             <select 
               value={filter} 
               onChange={(e) => setFilter(e.target.value)}
               style={{ padding: '0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '6px' }}
             >
               <option value="all">สถานะทั้งหมด</option>
               <option value="success">สำเร็จ (Success)</option>
               <option value="warning">แจ้งเตือน (Warning)</option>
               <option value="error">ผิดพลาด (Error)</option>
             </select>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <input 
                 type="date" 
                 value={startDate} 
                 onChange={(e) => setStartDate(e.target.value)}
                 style={{ padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#4a5568' }}
                 title="วันที่เริ่มต้น"
               />
               <span style={{ color: '#718096' }}>-</span>
               <input 
                 type="date" 
                 value={endDate} 
                 onChange={(e) => setEndDate(e.target.value)}
                 style={{ padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#4a5568' }}
                 title="วันที่สิ้นสุด"
               />
             </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #edf2f7', textAlign: 'left' }}>
                <th style={{ padding: '1rem', color: '#4a5568', fontSize: '0.875rem' }}>เวลา</th>
                <th style={{ padding: '1rem', color: '#4a5568', fontSize: '0.875rem' }}>ผู้ใช้งาน</th>
                <th style={{ padding: '1rem', color: '#4a5568', fontSize: '0.875rem' }}>กิจกรรม</th>
                <th style={{ padding: '1rem', color: '#4a5568', fontSize: '0.875rem' }}>รายละเอียด</th>
                <th style={{ padding: '1rem', color: '#4a5568', fontSize: '0.875rem' }}>IP Address</th>
                <th style={{ padding: '1rem', color: '#4a5568', fontSize: '0.875rem' }}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}>กำลังโหลดข้อมูล...</td>
                </tr>
              ) : logs.map(log => (
                <tr 
                  key={log.id} 
                  style={{ borderBottom: '1px solid #edf2f7', cursor: 'pointer', transition: 'background-color 0.2s', backgroundColor: log.action === 'DELETE_USER' ? '#fff5f5' : 'transparent' }}
                  onClick={() => setSelectedLog(log)}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f7fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#2d3748' }}>
                    {new Date(log.timestamp).toLocaleString('th-TH')}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '500', color: '#2d3748' }}>{log.user}</div>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>{log.role}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ background: '#ebf8ff', color: '#3182ce', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#4a5568' }}>{log.details}</td>
                  <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#718096', fontFamily: 'monospace' }}>{log.ip}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getStatusColor(log.status), marginRight: '6px' }}></span>
                    <span style={{ fontSize: '0.9rem', color: '#4a5568', textTransform: 'capitalize' }}>{log.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && logs.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#a0aec0' }}>ไม่พบข้อมูล</div>
          )}
        </div>

        {/* Pagination Controls */}
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid #edf2f7', paddingTop: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#718096' }}>
            <span>แสดง</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              style={{ padding: '0.25rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px', background: 'white' }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span>รายการต่อหน้า</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
              style={{ padding: '0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '6px', background: currentPage === 1 ? '#f7fafc' : 'white', color: currentPage === 1 ? '#cbd5e0' : '#4a5568', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              &lt; ก่อนหน้า
            </button>
            <span style={{ color: '#4a5568', fontSize: '0.9rem', fontWeight: '500' }}>
              หน้า {currentPage} จาก {totalPages || 1}
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || loading}
              style={{ padding: '0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '6px', background: currentPage === totalPages ? '#f7fafc' : 'white', color: currentPage === totalPages ? '#cbd5e0' : '#4a5568', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
            >
              ถัดไป &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setSelectedLog(null)}>
          <div style={{
            background: 'white', padding: '2rem', borderRadius: '8px', width: '90%', maxWidth: '600px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            <button 
                onClick={() => setSelectedLog(null)}
                style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#718096' }}
            >
                &times;
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#2d3748', borderBottom: '1px solid #edf2f7', paddingBottom: '1rem' }}>
                รายละเอียดกิจกรรม
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem', fontSize: '0.95rem' }}>
                <div style={{ color: '#718096', fontWeight: '500' }}>ID:</div>
                <div style={{ color: '#2d3748' }}>{selectedLog.id}</div>
                
                <div style={{ color: '#718096', fontWeight: '500' }}>เวลา:</div>
                <div style={{ color: '#2d3748' }}>{new Date(selectedLog.timestamp).toLocaleString('th-TH')}</div>
                
                <div style={{ color: '#718096', fontWeight: '500' }}>ผู้ใช้งาน:</div>
                <div style={{ color: '#2d3748' }}>{selectedLog.user} <span style={{ color: '#718096', fontSize: '0.85rem' }}>({selectedLog.role})</span></div>
                
                <div style={{ color: '#718096', fontWeight: '500' }}>กิจกรรม:</div>
                <div>
                    <span style={{ background: '#ebf8ff', color: '#3182ce', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '600' }}>
                        {selectedLog.action}
                    </span>
                </div>
                
                <div style={{ color: '#718096', fontWeight: '500' }}>สถานะ:</div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: getStatusColor(selectedLog.status), marginRight: '8px' }}></span>
                    <span style={{ textTransform: 'capitalize', color: '#2d3748' }}>{selectedLog.status}</span>
                </div>
                
                <div style={{ color: '#718096', fontWeight: '500' }}>IP Address:</div>
                <div style={{ fontFamily: 'monospace', color: '#4a5568' }}>{selectedLog.ip}</div>
                
                <div style={{ color: '#718096', fontWeight: '500' }}>รายละเอียด:</div>
                <div style={{ background: '#f7fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #edf2f7', color: '#2d3748', lineHeight: '1.5' }}>
                    {selectedLog.details}
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAuditLog;
