import { buildRoleRouter } from './roleCrud.js';
import { requireAuth, authorizeRoles } from '../middlewares/auth.js';

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

export default adminRoleRoutes;
