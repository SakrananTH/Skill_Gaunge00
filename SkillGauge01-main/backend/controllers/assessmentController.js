const AssessmentRound = require('../models/AssessmentRound');

/**
 * Controller: Assessment Rounds
 * จัดการ Business Logic สำหรับโครงสร้างข้อสอบ
 */

/**
 * ดึงรายการ Assessment Rounds ทั้งหมด
 * GET /api/admin/assessments/rounds
 * Query params: ?category=structure&status=active
 */
exports.getRounds = async (req, res) => {
  try {
    const { category, status, active } = req.query;
    
    const filters = {};
    if (category) filters.category = category;
    if (status) filters.status = status;
    if (active !== undefined) filters.active = active === 'true';

    const rounds = await AssessmentRound.findAll(filters);
    
    res.json({
      success: true,
      items: rounds,
      count: rounds.length
    });
  } catch (error) {
    console.error('getRounds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * ดึง Assessment Round ตาม ID
 * GET /api/admin/assessments/rounds/:id
 */
exports.getRoundById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const round = await AssessmentRound.findById(id);
    
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'not_found'
      });
    }
    
    res.json({
      success: true,
      data: round
    });
  } catch (error) {
    console.error('getRoundById error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * สร้าง Assessment Round ใหม่
 * POST /api/admin/assessments/rounds
 */
exports.createRound = async (req, res) => {
  try {
    const data = req.body;
    
    // Validation
    if (!data.category) {
      return res.status(400).json({
        success: false,
        message: 'invalid_category'
      });
    }
    
    if (!data.title) {
      return res.status(400).json({
        success: false,
        message: 'invalid_title'
      });
    }

    // ดึง userId จาก token (ถ้ามี middleware authentication)
    const userId = req.user?.id || req.body.userId || 'admin';
    
    const newRound = await AssessmentRound.create(data, userId);
    
    res.status(201).json({
      success: true,
      message: 'Round created successfully',
      data: newRound
    });
  } catch (error) {
    console.error('createRound error:', error);
    
    // Handle specific errors
    if (error.message.includes('Duplicate')) {
      return res.status(409).json({
        success: false,
        message: 'duplicate_title'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * อัปเดต Assessment Round
 * PUT /api/admin/assessments/rounds/:id
 */
exports.updateRound = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    // ตรวจสอบว่า Round มีอยู่หรือไม่
    const existing = await AssessmentRound.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'not_found'
      });
    }

    // ดึง userId จาก token
    const userId = req.user?.id || req.body.userId || 'admin';
    
    const updatedRound = await AssessmentRound.update(id, data, userId);
    
    res.json({
      success: true,
      message: 'Round updated successfully',
      data: updatedRound
    });
  } catch (error) {
    console.error('updateRound error:', error);
    
    if (error.message === 'Round not found') {
      return res.status(404).json({
        success: false,
        message: 'not_found'
      });
    }
    
    if (error.message === 'No fields to update') {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * ลบ Assessment Round (Soft delete)
 * DELETE /api/admin/assessments/rounds/:id
 */
exports.deleteRound = async (req, res) => {
  try {
    const { id } = req.params;
    
    // ตรวจสอบว่า Round มีอยู่หรือไม่
    const existing = await AssessmentRound.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'not_found'
      });
    }

    // ดึง userId จาก token
    const userId = req.user?.id || req.body.userId || 'admin';
    
    await AssessmentRound.delete(id, userId);
    
    res.json({
      success: true,
      message: 'Round deleted successfully'
    });
  } catch (error) {
    console.error('deleteRound error:', error);
    
    if (error.message === 'Round not found') {
      return res.status(404).json({
        success: false,
        message: 'not_found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * ดึงข้อสอบสำหรับ Worker ตาม Round ID และ Category
 * GET /api/worker/assessments/rounds/:id/questions
 * 
 * API นี้จะสุ่มข้อสอบตามโครงสร้างที่กำหนดไว้ใน Round
 * และคืนค่าข้อสอบให้ Worker ไปทำ
 */
exports.getQuestionsForWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId } = req.query;
    
    // ดึงข้อมูล Round
    const round = await AssessmentRound.findById(id);
    
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'not_found'
      });
    }

    if (!round.active || round.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Round is not active'
      });
    }

    // ตรวจสอบช่วงเวลา
    const now = new Date();
    if (round.startAt && new Date(round.startAt) > now) {
      return res.status(403).json({
        success: false,
        message: 'Round has not started yet'
      });
    }
    if (round.endAt && new Date(round.endAt) < now) {
      return res.status(403).json({
        success: false,
        message: 'Round has ended'
      });
    }

    // TODO: ดึงคำถามจากฐานข้อมูลตามโครงสร้างที่กำหนด
    // ในที่นี้จะต้องมีการสุ่มข้อสอบตาม:
    // 1. difficultyWeights (สัดส่วนระดับความยาก)
    // 2. subcategoryQuotas (สัดส่วนหมวดหมู่ย่อย)
    // 3. questionCount (จำนวนข้อสอบ)

    res.json({
      success: true,
      round: {
        id: round.id,
        title: round.title,
        description: round.description,
        category: round.category,
        questionCount: round.questionCount,
        durationMinutes: round.durationMinutes,
        passingScore: round.passingScore,
        showScore: round.showScore,
        showAnswers: round.showAnswers,
        showBreakdown: round.showBreakdown
      },
      // TODO: เพิ่มข้อสอบที่สุ่มได้
      questions: [],
      message: 'Questions will be implemented in next phase'
    });
  } catch (error) {
    console.error('getQuestionsForWorker error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * ตรวจสอบคำตอบและคำนวณคะแนน
 * POST /api/worker/assessments/rounds/:id/submit
 */
exports.submitAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const { answers, workerId, sessionId } = req.body;
    
    // ดึงข้อมูล Round
    const round = await AssessmentRound.findById(id);
    
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'not_found'
      });
    }

    // TODO: ตรวจคำตอบและคำนวณคะแนน
    // 1. เปรียบเทียบคำตอบกับเฉลย
    // 2. คำนวณคะแนนรวม
    // 3. คำนวณคะแนนแยกตามหมวดหมู่ย่อย (ถ้า showBreakdown = true)
    // 4. ตรวจสอบว่าผ่านหรือไม่ผ่านตาม criteria
    // 5. บันทึกผลลงฐานข้อมูล

    res.json({
      success: true,
      message: 'Assessment submission will be implemented in next phase',
      // TODO: เพิ่มผลการสอบ
      result: {
        roundId: id,
        workerId,
        sessionId,
        totalScore: 0,
        passed: false
      }
    });
  } catch (error) {
    console.error('submitAssessment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
