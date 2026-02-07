const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/assessmentController');

/**
 * Routes สำหรับ Worker - Assessment
 * Base path: /api/worker/assessments
 */

/**
 * GET /api/worker/assessments/rounds/:id/questions
 * ดึงข้อสอบสำหรับ Worker ตาม Round ID
 * Query params: ?sessionId=xxx (optional)
 */
router.get('/rounds/:id/questions', assessmentController.getQuestionsForWorker);

/**
 * POST /api/worker/assessments/rounds/:id/submit
 * ส่งคำตอบและรับผลการสอบ
 * Body: {
 *   workerId: string,
 *   sessionId: string,
 *   answers: [{ questionId: string, answer: string }]
 * }
 */
router.post('/rounds/:id/submit', assessmentController.submitAssessment);

module.exports = router;
