# Assessment Rounds API Documentation

API สำหรับจัดการโครงสร้างข้อสอบและการทำข้อสอบของ Worker

## การติดตั้ง

### 1. สร้างตารางในฐานข้อมูล

รันไฟล์ SQL ใน phpMyAdmin หรือ MySQL client:

```bash
mysql -u root -p dbweb < db/phpmyadmin/04_assessment_rounds.sql
```

### 2. ติดตั้ง Dependencies

```bash
cd backend
npm install
```

### 3. รัน Backend Server

```bash
npm start
# หรือ
node index.js
```

Server จะรันที่ `http://localhost:4000`

---

## API Endpoints

### Admin APIs

#### 1. ดึงรายการ Assessment Rounds ทั้งหมด

**GET** `/api/admin/assessments/rounds`

**Query Parameters:**
- `category` (optional): กรองตามประเภทช่าง (structure, plumbing, roofing, etc.)
- `status` (optional): กรองตามสถานะ (draft, active, archived)
- `active` (optional): กรองตามการใช้งาน (true/false)

**ตัวอย่างการเรียกใช้:**
```javascript
// ดึงทั้งหมด
const response = await fetch('http://localhost:4000/api/admin/assessments/rounds');

// กรองเฉพาะ category structure ที่ active
const response = await fetch('http://localhost:4000/api/admin/assessments/rounds?category=structure&status=active');
```

**Response:**
```json
{
  "success": true,
  "items": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "category": "structure",
      "title": "ข้อสอบโครงสร้างระดับ 1",
      "description": "ข้อสอบโครงสร้างสำหรับระดับพื้นฐาน",
      "questionCount": 60,
      "passingScore": 60.00,
      "durationMinutes": 60,
      "startAt": null,
      "endAt": null,
      "frequencyMonths": 6,
      "showScore": true,
      "showAnswers": false,
      "showBreakdown": true,
      "subcategoryQuotas": {
        "rebar": { "pct": 20, "count": 12 },
        "concrete": { "pct": 20, "count": 12 }
      },
      "difficultyWeights": {
        "easy": 100,
        "medium": 0,
        "hard": 0
      },
      "criteria": {
        "level1": 60,
        "level2": 70,
        "level3": 80
      },
      "status": "active",
      "active": true,
      "history": [
        {
          "timestamp": "2026-02-06T10:30:00.000Z",
          "user": "admin",
          "action": "Created"
        }
      ],
      "createdAt": "2026-02-06T10:30:00.000Z",
      "updatedAt": "2026-02-06T10:30:00.000Z",
      "createdBy": "admin",
      "updatedBy": "admin"
    }
  ],
  "count": 1
}
```

---

#### 2. ดึง Assessment Round ตาม ID

**GET** `/api/admin/assessments/rounds/:id`

**ตัวอย่างการเรียกใช้:**
```javascript
const roundId = '123e4567-e89b-12d3-a456-426614174000';
const response = await fetch(`http://localhost:4000/api/admin/assessments/rounds/${roundId}`);
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "category": "structure",
    "title": "ข้อสอบโครงสร้างระดับ 1",
    ...
  }
}
```

---

#### 3. สร้าง Assessment Round ใหม่

**POST** `/api/admin/assessments/rounds`

**Request Body:**
```json
{
  "category": "structure",
  "title": "ข้อสอบโครงสร้างระดับ 1",
  "description": "ข้อสอบโครงสร้างสำหรับระดับพื้นฐาน",
  "questionCount": 60,
  "passingScore": 60,
  "durationMinutes": 60,
  "frequencyMonths": 6,
  "showScore": true,
  "showAnswers": false,
  "showBreakdown": true,
  "subcategoryQuotas": {
    "rebar": { "pct": 20, "count": 12 },
    "concrete": { "pct": 20, "count": 12 },
    "formwork": { "pct": 20, "count": 12 },
    "tools": { "pct": 20, "count": 12 },
    "theory": { "pct": 20, "count": 12 }
  },
  "difficultyWeights": {
    "easy": 100,
    "medium": 0,
    "hard": 0
  },
  "criteria": {
    "level1": 60,
    "level2": 70,
    "level3": 80
  },
  "status": "active"
}
```

**ตัวอย่างการเรียกใช้:**
```javascript
const response = await fetch('http://localhost:4000/api/admin/assessments/rounds', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    category: 'structure',
    title: 'ข้อสอบโครงสร้างระดับ 1',
    questionCount: 60,
    passingScore: 60,
    durationMinutes: 60,
    // ... ข้อมูลอื่นๆ
  })
});
```

**Response:**
```json
{
  "success": true,
  "message": "Round created successfully",
  "data": {
    "id": "new-uuid-here",
    "category": "structure",
    ...
  }
}
```

---

#### 4. อัปเดต Assessment Round

**PUT** `/api/admin/assessments/rounds/:id`

**Request Body:** (ส่งเฉพาะฟิลด์ที่ต้องการอัปเดต)
```json
{
  "title": "ข้อสอบโครงสร้างระดับ 1 (แก้ไข)",
  "passingScore": 65,
  "questionCount": 70
}
```

**ตัวอย่างการเรียกใช้:**
```javascript
const roundId = '123e4567-e89b-12d3-a456-426614174000';
const response = await fetch(`http://localhost:4000/api/admin/assessments/rounds/${roundId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    passingScore: 65,
    questionCount: 70
  })
});
```

**Response:**
```json
{
  "success": true,
  "message": "Round updated successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    ...
    "history": [
      { "timestamp": "2026-02-06T10:30:00.000Z", "user": "admin", "action": "Created" },
      { "timestamp": "2026-02-06T11:30:00.000Z", "user": "admin", "action": "Updated" }
    ]
  }
}
```

---

#### 5. ลบ Assessment Round (Soft Delete)

**DELETE** `/api/admin/assessments/rounds/:id`

**ตัวอย่างการเรียกใช้:**
```javascript
const roundId = '123e4567-e89b-12d3-a456-426614174000';
const response = await fetch(`http://localhost:4000/api/admin/assessments/rounds/${roundId}`, {
  method: 'DELETE'
});
```

**Response:**
```json
{
  "success": true,
  "message": "Round deleted successfully"
}
```

**หมายเหตุ:** การลบเป็น Soft Delete (จะเปลี่ยน `active = 0` และ `status = 'archived'` ไม่ได้ลบข้อมูลออกจากฐานข้อมูล)

---

### Worker APIs

#### 6. ดึงข้อสอบสำหรับ Worker

**GET** `/api/worker/assessments/rounds/:id/questions`

**Query Parameters:**
- `sessionId` (optional): Session ID สำหรับดึงข้อสอบชุดเดิม

**ตัวอย่างการเรียกใช้:**
```javascript
const roundId = '123e4567-e89b-12d3-a456-426614174000';
const response = await fetch(`http://localhost:4000/api/worker/assessments/rounds/${roundId}/questions`);
```

**Response:**
```json
{
  "success": true,
  "round": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "ข้อสอบโครงสร้างระดับ 1",
    "description": "ข้อสอบโครงสร้างสำหรับระดับพื้นฐาน",
    "category": "structure",
    "questionCount": 60,
    "durationMinutes": 60,
    "passingScore": 60,
    "showScore": true,
    "showAnswers": false,
    "showBreakdown": true
  },
  "questions": [],
  "message": "Questions will be implemented in next phase"
}
```

**หมายเหตุ:** การสุ่มข้อสอบจะต้องพัฒนาต่อในภายหลัง

---

#### 7. ส่งคำตอบและรับผลการสอบ

**POST** `/api/worker/assessments/rounds/:id/submit`

**Request Body:**
```json
{
  "workerId": "worker-123",
  "sessionId": "session-xyz-789",
  "answers": [
    {
      "questionId": "q1",
      "answer": "A"
    },
    {
      "questionId": "q2",
      "answer": "C"
    }
  ]
}
```

**ตัวอย่างการเรียกใช้:**
```javascript
const roundId = '123e4567-e89b-12d3-a456-426614174000';
const response = await fetch(`http://localhost:4000/api/worker/assessments/rounds/${roundId}/submit`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    workerId: 'worker-123',
    sessionId: 'session-xyz-789',
    answers: [
      { questionId: 'q1', answer: 'A' },
      { questionId: 'q2', answer: 'C' }
    ]
  })
});
```

**Response:**
```json
{
  "success": true,
  "message": "Assessment submission will be implemented in next phase",
  "result": {
    "roundId": "123e4567-e89b-12d3-a456-426614174000",
    "workerId": "worker-123",
    "sessionId": "session-xyz-789",
    "totalScore": 0,
    "passed": false
  }
}
```

**หมายเหตุ:** การตรวจคำตอบและคำนวณคะแนนจะต้องพัฒนาต่อในภายหลัง

---

## โครงสร้างข้อมูล (Data Structure)

### Assessment Round Object

```typescript
{
  id: string;                    // UUID
  category: string;              // 'structure', 'plumbing', 'roofing', etc.
  title: string;                 // ชื่อกิจกรรมข้อสอบ
  description: string | null;    // คำอธิบาย
  
  // การตั้งค่าพื้นฐาน
  questionCount: number;         // จำนวนข้อสอบทั้งหมด
  passingScore: number;          // เกณฑ์ผ่าน (%)
  durationMinutes: number;       // เวลาทำข้อสอบ (นาที)
  
  // ช่วงเวลา
  startAt: string | null;        // เวลาเริ่มต้น (ISO datetime)
  endAt: string | null;          // เวลาสิ้นสุด (ISO datetime)
  frequencyMonths: number | null; // ความถี่การสอบ (เดือน)
  
  // การแสดงผล
  showScore: boolean;            // แสดงคะแนนหรือไม่
  showAnswers: boolean;          // แสดงเฉลยหรือไม่
  showBreakdown: boolean;        // แสดงสรุปรายหมวดหมู่ย่อยหรือไม่
  
  // โครงสร้างข้อสอบ (JSON)
  subcategoryQuotas: {
    [key: string]: {
      pct: number;              // เปอร์เซ็นต์
      count: number;            // จำนวนข้อ
    }
  };
  
  difficultyWeights: {
    easy: number;               // น้ำหนักระดับง่าย (%)
    medium: number;             // น้ำหนักระดับกลาง (%)
    hard: number;               // น้ำหนักระดับยาก (%)
  };
  
  criteria: {
    level1: number;             // เกณฑ์ผ่านระดับ 1 (%)
    level2: number;             // เกณฑ์ผ่านระดับ 2 (%)
    level3: number;             // เกณฑ์ผ่านระดับ 3 (%)
  };
  
  // สถานะ
  status: string;               // 'draft', 'active', 'archived'
  active: boolean;              // ใช้งานหรือไม่
  
  // ประวัติ
  history: Array<{
    timestamp: string;          // ISO datetime
    user: string;               // User ID
    action: string;             // 'Created', 'Updated', etc.
  }>;
  
  // Audit
  createdAt: string;            // ISO datetime
  updatedAt: string;            // ISO datetime
  createdBy: string | null;     // User ID
  updatedBy: string | null;     // User ID
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "invalid_category"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "not_found"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "duplicate_title"
}
```

### 500 Server Error
```json
{
  "success": false,
  "message": "Server error",
  "error": "Error message here"
}
```

---

## ตัวอย่างการใช้งานใน Frontend (AdminQuizBank.js)

```javascript
// ดึงรายการ Rounds
const loadRounds = async () => {
  try {
    const response = await fetch('http://localhost:4000/api/admin/assessments/rounds');
    const data = await response.json();
    
    if (data.success) {
      setRounds(data.items);
    }
  } catch (error) {
    console.error('Failed to load rounds:', error);
  }
};

// สร้าง Round ใหม่
const createRound = async (roundData) => {
  try {
    const response = await fetch('http://localhost:4000/api/admin/assessments/rounds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(roundData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Round created:', data.data);
      loadRounds(); // รีเฟรชรายการ
    }
  } catch (error) {
    console.error('Failed to create round:', error);
  }
};

// อัปเดต Round
const updateRound = async (roundId, updates) => {
  try {
    const response = await fetch(`http://localhost:4000/api/admin/assessments/rounds/${roundId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Round updated:', data.data);
      loadRounds(); // รีเฟรชรายการ
    }
  } catch (error) {
    console.error('Failed to update round:', error);
  }
};
```

---

## ขั้นตอนการพัฒนาต่อ (TODO)

### Phase 1: ✅ เสร็จแล้ว
- [x] สร้างตาราง assessment_rounds
- [x] สร้าง Model (AssessmentRound.js)
- [x] สร้าง Controller (assessmentController.js)
- [x] สร้าง Routes (assessmentRoutes.js, workerAssessmentRoutes.js)
- [x] เพิ่ม routes ใน index.js

### Phase 2: ⏳ รอพัฒนา
- [ ] พัฒนาระบบสุ่มข้อสอบตาม difficultyWeights และ subcategoryQuotas
- [ ] พัฒนาระบบตรวจคำตอบและคำนวณคะแนน
- [ ] สร้างตาราง worker_exam_results เพื่อเก็บผลการสอบ
- [ ] สร้างระบบ Session Management สำหรับการทำข้อสอบ
- [ ] เพิ่ม Middleware Authentication/Authorization

### Phase 3: ⏳ รอพัฒนา
- [ ] สร้าง UI สำหรับ Worker ทำข้อสอบ
- [ ] สร้างหน้าแสดงผลการสอบ
- [ ] สร้างรายงานสถิติการสอบ
- [ ] เพิ่มระบบ Notification เมื่อมีข้อสอบใหม่

---

## การทดสอบ API

ใช้ Postman หรือ curl ทดสอบ:

```bash
# ดึงรายการ Rounds
curl http://localhost:4000/api/admin/assessments/rounds

# สร้าง Round ใหม่
curl -X POST http://localhost:4000/api/admin/assessments/rounds \
  -H "Content-Type: application/json" \
  -d '{
    "category": "structure",
    "title": "ทดสอบ API",
    "questionCount": 60,
    "passingScore": 60,
    "durationMinutes": 60
  }'
```

---

## License

MIT
