const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/assessmentController');

/**
 * Routes สำหรับ Assessment Rounds
 * Base path: /api/admin/assessments
 */

// ==================== Admin Routes ====================

/**
 * GET /api/admin/assessments/rounds
 * ดึงรายการ Assessment Rounds ทั้งหมด
 * Query params: ?category=structure&status=active&active=true
 */
router.get('/rounds', assessmentController.getRounds);

/**
 * GET /api/admin/assessments/rounds/:id
 * ดึง Assessment Round ตาม ID
 */
router.get('/rounds/:id', assessmentController.getRoundById);

/**
 * POST /api/admin/assessments/rounds
 * สร้าง Assessment Round ใหม่
 * Body: {
 *   category: string,
 *   title: string,
 *   description?: string,
 *   questionCount?: number,
 *   passingScore?: number,
 *   durationMinutes?: number,
 *   startAt?: datetime,
 *   endAt?: datetime,
 *   frequencyMonths?: number,
 *   showScore?: boolean,
 *   showAnswers?: boolean,
 *   showBreakdown?: boolean,
 *   subcategoryQuotas?: object,
 *   difficultyWeights?: object,
 *   criteria?: object,
 *   status?: string
 * }
 */
router.post('/rounds', assessmentController.createRound);

/**
 * PUT /api/admin/assessments/rounds/:id
 * อัปเดต Assessment Round
 * Body: { ...fields to update }
 */
router.put('/rounds/:id', assessmentController.updateRound);

/**
 * DELETE /api/admin/assessments/rounds/:id
 * ลบ Assessment Round (Soft delete)
 */
router.delete('/rounds/:id', assessmentController.deleteRound);

module.exports = router;
