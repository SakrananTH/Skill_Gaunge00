import { buildRoleRouter } from './roleCrud.js';
import { requireAuth, authorizeRoles } from '../middlewares/auth.js';

const tables = [
  { path: 'sites', table: 'sites', idColumn: 'id' },
  { path: 'workers', table: 'workers', idColumn: 'id' },
  { path: 'worker-profiles', table: 'worker_profiles', idColumn: 'worker_id' },
  { path: 'assessment-rounds', table: 'assessment_rounds', idColumn: 'id' },
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

const pmRoleRoutes = buildRoleRouter({
  requireAuth,
  authorizeRoles,
  allowedRoles: ['project_manager', 'pm'],
  tables,
  views
});

export default pmRoleRoutes;
