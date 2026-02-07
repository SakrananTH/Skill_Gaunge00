const pool = require('../config/db');
const crypto = require('crypto');

/**
 * Model: AssessmentRound
 * จัดการข้อมูลโครงสร้างข้อสอบและกิจกรรมข้อสอบ
 */
class AssessmentRound {
  
  /**
   * ดึงรายการ Assessment Rounds ทั้งหมด หรือตาม category
   * @param {Object} filters - { category, status, active }
   * @returns {Promise<Array>}
   */
  static async findAll(filters = {}) {
    try {
      let sql = `
        SELECT 
          id, category, title, description,
          question_count, passing_score, duration_minutes,
          start_at, end_at, frequency_months,
          show_score, show_answers, show_breakdown,
          subcategory_quotas, difficulty_weights, criteria,
          status, active, history,
          created_at, updated_at, created_by, updated_by
        FROM assessment_rounds
        WHERE 1=1
      `;
      const params = [];

      if (filters.category) {
        sql += ' AND category = ?';
        params.push(filters.category);
      }

      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.active !== undefined) {
        sql += ' AND active = ?';
        params.push(filters.active ? 1 : 0);
      }

      sql += ' ORDER BY created_at DESC';

      const [rows] = await pool.query(sql, params);
      
      // แปลง JSON strings เป็น objects
      return rows.map(row => this.parseJsonFields(row));
    } catch (error) {
      console.error('AssessmentRound.findAll error:', error);
      throw error;
    }
  }

  /**
   * ดึง Assessment Round ตาม ID
   * @param {string} id - UUID ของ Round
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    try {
      const sql = `
        SELECT 
          id, category, title, description,
          question_count, passing_score, duration_minutes,
          start_at, end_at, frequency_months,
          show_score, show_answers, show_breakdown,
          subcategory_quotas, difficulty_weights, criteria,
          status, active, history,
          created_at, updated_at, created_by, updated_by
        FROM assessment_rounds
        WHERE id = ?
        LIMIT 1
      `;
      
      const [rows] = await pool.query(sql, [id]);
      
      if (rows.length === 0) {
        return null;
      }

      return this.parseJsonFields(rows[0]);
    } catch (error) {
      console.error('AssessmentRound.findById error:', error);
      throw error;
    }
  }

  /**
   * สร้าง Assessment Round ใหม่
   * @param {Object} data - ข้อมูลที่จะสร้าง
   * @param {string} userId - User ID ของผู้สร้าง
   * @returns {Promise<Object>}
   */
  static async create(data, userId = null) {
    try {
      // สร้าง UUID สำหรับ record ใหม่
      const newId = crypto.randomUUID();

      const finalValues = {
        category: data.category,
        title: data.title,
        description: data.description || null,
        questionCount: data.questionCount || 60,
        passingScore: data.passingScore || 60,
        durationMinutes: data.durationMinutes || 60,
        startAt: data.startAt || null,
        endAt: data.endAt || null,
        frequencyMonths: data.frequencyMonths || null,
        showScore: data.showScore !== false,
        showAnswers: data.showAnswers === true,
        showBreakdown: data.showBreakdown !== false,
        subcategoryQuotas: data.subcategoryQuotas || {},
        difficultyWeights: data.difficultyWeights || { easy: 0, medium: 0, hard: 0 },
        criteria: data.criteria || { level1: 60, level2: 70, level3: 80 },
        status: data.status || 'draft',
        active: data.active !== false
      };
      
      const sql = `
        INSERT INTO assessment_rounds (
          id, category, title, description,
          question_count, passing_score, duration_minutes,
          start_at, end_at, frequency_months,
          show_score, show_answers, show_breakdown,
          subcategory_quotas, difficulty_weights, criteria,
          status, active, history,
          created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const history = [
        {
          timestamp: new Date().toISOString(),
          user: userId || 'system',
          action: 'Created',
          changes: Object.keys(finalValues).map(key => ({
            field: key,
            from: null,
            to: finalValues[key]
          }))
        }
      ];

      const params = [
        newId,
        finalValues.category,
        finalValues.title,
        finalValues.description,
        finalValues.questionCount,
        finalValues.passingScore,
        finalValues.durationMinutes,
        finalValues.startAt,
        finalValues.endAt,
        finalValues.frequencyMonths,
        finalValues.showScore ? 1 : 0,
        finalValues.showAnswers ? 1 : 0,
        finalValues.showBreakdown ? 1 : 0,
        JSON.stringify(finalValues.subcategoryQuotas),
        JSON.stringify(finalValues.difficultyWeights),
        JSON.stringify(finalValues.criteria),
        finalValues.status,
        finalValues.active ? 1 : 0,
        JSON.stringify(history),
        userId,
        userId
      ];

      await pool.query(sql, params);
      
      // ดึงข้อมูลที่สร้างใหม่กลับมา
      return await this.findById(newId);
    } catch (error) {
      console.error('AssessmentRound.create error:', error);
      throw error;
    }
  }

  /**
   * อัปเดต Assessment Round
   * @param {string} id - UUID ของ Round
   * @param {Object} data - ข้อมูลที่จะอัปเดต
   * @param {string} userId - User ID ของผู้แก้ไข
   * @returns {Promise<Object>}
   */
  static async update(id, data, userId = null) {
    try {
      // ดึงข้อมูลเดิมก่อน
      const existing = await this.findById(id);
      if (!existing) {
        throw new Error('Round not found');
      }

      const stableStringify = (value) => {
        if (value === undefined) return 'undefined';
        if (value === null) return 'null';
        if (typeof value !== 'object') return JSON.stringify(value);
        if (Array.isArray(value)) {
          return `[${value.map(item => stableStringify(item)).join(',')}]`;
        }
        const keys = Object.keys(value).sort();
        return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
      };

      const fieldMap = [
        { key: 'category', label: 'category' },
        { key: 'title', label: 'title' },
        { key: 'description', label: 'description' },
        { key: 'questionCount', label: 'questionCount' },
        { key: 'passingScore', label: 'passingScore' },
        { key: 'durationMinutes', label: 'durationMinutes' },
        { key: 'startAt', label: 'startAt' },
        { key: 'endAt', label: 'endAt' },
        { key: 'frequencyMonths', label: 'frequencyMonths' },
        { key: 'showScore', label: 'showScore' },
        { key: 'showAnswers', label: 'showAnswers' },
        { key: 'showBreakdown', label: 'showBreakdown' },
        { key: 'subcategoryQuotas', label: 'subcategoryQuotas' },
        { key: 'difficultyWeights', label: 'difficultyWeights' },
        { key: 'criteria', label: 'criteria' },
        { key: 'status', label: 'status' },
        { key: 'active', label: 'active' }
      ];

      const changes = fieldMap
        .filter(field => data[field.key] !== undefined)
        .map(field => ({
          field: field.label,
          from: existing[field.key],
          to: data[field.key]
        }))
        .filter(change => stableStringify(change.from) !== stableStringify(change.to));

      // สร้าง history entry ใหม่
      const existingHistory = existing.history || [];
      const newHistoryEntry = {
        timestamp: new Date().toISOString(),
        user: userId || 'system',
        action: 'Updated',
        changes
      };
      const updatedHistory = [...existingHistory, newHistoryEntry];

      const fields = [];
      const params = [];

      if (data.category !== undefined) {
        fields.push('category = ?');
        params.push(data.category);
      }
      if (data.title !== undefined) {
        fields.push('title = ?');
        params.push(data.title);
      }
      if (data.description !== undefined) {
        fields.push('description = ?');
        params.push(data.description);
      }
      if (data.questionCount !== undefined) {
        fields.push('question_count = ?');
        params.push(data.questionCount);
      }
      if (data.passingScore !== undefined) {
        fields.push('passing_score = ?');
        params.push(data.passingScore);
      }
      if (data.durationMinutes !== undefined) {
        fields.push('duration_minutes = ?');
        params.push(data.durationMinutes);
      }
      if (data.startAt !== undefined) {
        fields.push('start_at = ?');
        params.push(data.startAt);
      }
      if (data.endAt !== undefined) {
        fields.push('end_at = ?');
        params.push(data.endAt);
      }
      if (data.frequencyMonths !== undefined) {
        fields.push('frequency_months = ?');
        params.push(data.frequencyMonths);
      }
      if (data.showScore !== undefined) {
        fields.push('show_score = ?');
        params.push(data.showScore ? 1 : 0);
      }
      if (data.showAnswers !== undefined) {
        fields.push('show_answers = ?');
        params.push(data.showAnswers ? 1 : 0);
      }
      if (data.showBreakdown !== undefined) {
        fields.push('show_breakdown = ?');
        params.push(data.showBreakdown ? 1 : 0);
      }
      if (data.subcategoryQuotas !== undefined) {
        fields.push('subcategory_quotas = ?');
        params.push(JSON.stringify(data.subcategoryQuotas));
      }
      if (data.difficultyWeights !== undefined) {
        fields.push('difficulty_weights = ?');
        params.push(JSON.stringify(data.difficultyWeights));
      }
      if (data.criteria !== undefined) {
        fields.push('criteria = ?');
        params.push(JSON.stringify(data.criteria));
      }
      if (data.status !== undefined) {
        fields.push('status = ?');
        params.push(data.status);
      }
      if (data.active !== undefined) {
        fields.push('active = ?');
        params.push(data.active ? 1 : 0);
      }

      // เพิ่ม history และ updated_by
      fields.push('history = ?');
      params.push(JSON.stringify(updatedHistory));
      
      fields.push('updated_by = ?');
      params.push(userId);

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      params.push(id);
      const sql = `UPDATE assessment_rounds SET ${fields.join(', ')} WHERE id = ?`;
      
      await pool.query(sql, params);
      
      // ดึงข้อมูลที่อัปเดตแล้วกลับมา
      return await this.findById(id);
    } catch (error) {
      console.error('AssessmentRound.update error:', error);
      throw error;
    }
  }

  /**
   * ลบ Assessment Round (Soft delete)
   * @param {string} id - UUID ของ Round
   * @param {string} userId - User ID ของผู้ลบ
   * @returns {Promise<void>}
   */
  static async delete(id, userId = null) {
    try {
      const existing = await this.findById(id);
      if (!existing) {
        throw new Error('Round not found');
      }

      const existingHistory = existing.history || [];
      const newHistoryEntry = {
        timestamp: new Date().toISOString(),
        user: userId || 'system',
        action: 'Deleted (archived)'
      };
      const updatedHistory = [...existingHistory, newHistoryEntry];

      const sql = `
        UPDATE assessment_rounds 
        SET active = 0, status = 'archived', history = ?, updated_by = ?
        WHERE id = ?
      `;
      
      await pool.query(sql, [JSON.stringify(updatedHistory), userId, id]);
    } catch (error) {
      console.error('AssessmentRound.delete error:', error);
      throw error;
    }
  }

  /**
   * Helper: แปลง JSON fields จาก string เป็น object
   * @param {Object} row - Database row
   * @returns {Object}
   */
  static parseJsonFields(row) {
    const parsed = { ...row };

    // แปลง JSON strings เป็น objects
    ['subcategory_quotas', 'difficulty_weights', 'criteria', 'history'].forEach(field => {
      if (parsed[field]) {
        try {
          parsed[field] = typeof parsed[field] === 'string' 
            ? JSON.parse(parsed[field]) 
            : parsed[field];
        } catch (e) {
          console.warn(`Failed to parse ${field}:`, e);
          parsed[field] = null;
        }
      }
    });

    // แปลง boolean fields
    ['show_score', 'show_answers', 'show_breakdown', 'active'].forEach(field => {
      if (parsed[field] !== undefined) {
        parsed[field] = Boolean(parsed[field]);
      }
    });

    // แปลง camelCase
    parsed.questionCount = parsed.question_count;
    parsed.passingScore = parsed.passing_score;
    parsed.durationMinutes = parsed.duration_minutes;
    parsed.startAt = parsed.start_at;
    parsed.endAt = parsed.end_at;
    parsed.frequencyMonths = parsed.frequency_months;
    parsed.showScore = parsed.show_score;
    parsed.showAnswers = parsed.show_answers;
    parsed.showBreakdown = parsed.show_breakdown;
    parsed.subcategoryQuotas = parsed.subcategory_quotas;
    parsed.difficultyWeights = parsed.difficulty_weights;
    parsed.createdAt = parsed.created_at;
    parsed.updatedAt = parsed.updated_at;
    parsed.createdBy = parsed.created_by;
    parsed.updatedBy = parsed.updated_by;

    // ลบ snake_case ออก
    delete parsed.question_count;
    delete parsed.passing_score;
    delete parsed.duration_minutes;
    delete parsed.start_at;
    delete parsed.end_at;
    delete parsed.frequency_months;
    delete parsed.show_score;
    delete parsed.show_answers;
    delete parsed.show_breakdown;
    delete parsed.subcategory_quotas;
    delete parsed.difficulty_weights;
    delete parsed.created_at;
    delete parsed.updated_at;
    delete parsed.created_by;
    delete parsed.updated_by;

    return parsed;
  }
}

module.exports = AssessmentRound;
