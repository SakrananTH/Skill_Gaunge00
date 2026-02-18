import { buildRoleRouter } from './roleCrud.js';
import { requireAuth, authorizeRoles } from '../middlewares/auth.js';
import { execute, query } from '../utils/db.js';

const tables = [
  { path: 'roles', table: 'roles', idColumn: 'id' },
  { path: 'sites', table: 'sites', idColumn: 'id' },
  { path: 'workers', table: 'workers', idColumn: 'id' },
  { path: 'worker-accounts', table: 'worker_accounts', idColumn: 'worker_id' },
  { path: 'worker-profiles', table: 'worker_profiles', idColumn: 'worker_id' },
  { path: 'questions', table: 'questions', idColumn: 'id' },
  { path: 'question-options', table: 'question_options', idColumn: 'id' },
  { path: 'question-structural', table: 'question_Structural', idColumn: 'id' },
  { path: 'assessment-rounds', table: 'assessment_rounds', idColumn: 'id' },
  { path: 'assessment-settings', table: 'assessment_settings', idColumn: 'id' },
  { path: 'assessment-sessions', table: 'assessment_sessions', idColumn: 'id' },
  {
    path: 'assessment-session-questions',
    table: 'assessment_session_questions',
    compositeKeys: ['session_id', 'question_id']
  },
  { path: 'task-worker-assignments', table: 'task_worker_assignments', idColumn: 'id' },
  { path: 'worker-assessment-results', table: 'worker_assessment_results', idColumn: 'id' }
];

const views = [
  { path: 'assessment-session-questions-with-level', name: 'v_assessment_session_questions_with_level' }
];

const adminRoleRoutes = buildRoleRouter({
  requireAuth,
  authorizeRoles,
  allowedRoles: ['admin'],
  tables,
  views
});

// Custom route to reset worker assessment
adminRoleRoutes.post('/workers/:id/reset-assessment', async (req, res) => {
  const workerId = req.params.id;
  try {
    // 1. Delete assessment results
    await execute('DELETE FROM worker_assessment_results WHERE worker_id = ?', [workerId]);

    // 2. Find sessions related to this worker to clean up dependent data
    // (If foreign keys cascade, this might happen automatically, but we do it explicitly to be safe)
    const sessions = await query('SELECT id FROM assessment_sessions WHERE worker_id = ?', [workerId]);
    
    if (sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);
      // Create placeholders for IN clause
      const placeholders = sessionIds.map(() => '?').join(',');
      
      // Delete session questions
      await execute(`DELETE FROM assessment_session_questions WHERE session_id IN (${placeholders})`, sessionIds);
      
      // Delete sessions
      await execute(`DELETE FROM assessment_sessions WHERE id IN (${placeholders})`, sessionIds);
    }

    // 3. Just in case, if assessment_sessions uses id/worker_id directly without cascading and we missed something
    // (The above covers it)

    res.json({ success: true, message: 'Assessment reset successfully' });
  } catch (error) {
    console.error('Failed to reset assessment:', error);
    res.status(500).json({ message: 'Failed to reset assessment', error: error.message });
  }
});

export default adminRoleRoutes;
