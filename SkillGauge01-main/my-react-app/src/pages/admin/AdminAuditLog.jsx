import React from 'react';
import { mockAuditLog } from '../../mock/mockData';

const AdminAuditLog = () => {
  return (
    <div className="panel" style={{ marginTop: '1rem' }}>
      <h2 className="panel-title">Audit Log</h2>
      <div className="table" role="table" aria-label="Audit log table">
        <div className="thead" role="row">
          <div>เวลา</div>
          <div>ผู้ใช้</div>
          <div>เหตุการณ์</div>
          <div>รายละเอียด</div>
          <div>IP</div>
        </div>
        <div className="tbody">
          {mockAuditLog.map(e => (
            <div className="tr" role="row" key={e.id}>
              <div className="td">{e.timestamp}</div>
              <div className="td">{e.actor}</div>
              <div className="td">{e.action}</div>
              <div className="td">{e.details}</div>
              <div className="td">{e.ip}</div>
            </div>
          ))}
          {mockAuditLog.length === 0 && <div className="empty">ยังไม่มีบันทึก</div>}
        </div>
      </div>
    </div>
  );
};

export default AdminAuditLog;
