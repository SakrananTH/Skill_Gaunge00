const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { registerUser, loginUser } = require('../controllers/authController');

// Route: POST /api/register
router.post('/register',
  [
    // --- ส่วนที่แก้ไข: เปลี่ยนจาก full_name เป็น first_name และ last_name ---
    body('first_name').notEmpty().withMessage('First name is required'),
    body('last_name').notEmpty().withMessage('Last name is required'),
    
    // เช็ค Email และ Password เหมือนเดิม
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
    
    // เช็ค Citizen ID (ถ้ามีส่งมา ต้องเป็นตัวเลข 13 หลัก)
    body('citizen_id')
      .optional({ checkFalsy: true }) // ถ้าไม่ส่งมา หรือเป็นค่าว่าง ให้ข้ามไป
      .isLength({ min: 13, max: 13 }).withMessage('Citizen ID must be 13 digits'),
      
    // เช็คเบอร์โทร (Optional)
    body('phone_number').optional(),
  ],
  registerUser
);

// Route: POST /api/auth/login
router.post('/auth/login',
  [
    body('identifier').optional().trim().notEmpty().withMessage('Identifier is required'),
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('password').notEmpty().withMessage('Password is required'),
    body().custom(value => {
      if (!value.identifier && !value.email) {
        throw new Error('Email or identifier is required');
      }
      return true;
    })
  ],
  loginUser
);

module.exports = router;