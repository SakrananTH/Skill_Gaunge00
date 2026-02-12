import { query, queryOne, execute, withTransaction, buildUpdateClause } from '../utils/db.js';
import { getColumn, toNullableString, toISODateString, parseDateValue, parseAgeValue, parseExperienceYears, getRoleLabel, getTradeLabel } from '../utils/helpers.js';

let workerProfilesTableExists = false;
let workerProfilesWorkerIdIsNumeric = false;
let workerProfilesPayloadColumn = null;

// Initialize metadata
export async function refreshWorkerMetadata() {
  try {
    const [tableCheck] = await query(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       AND table_name = 'worker_profiles'`
    );
    workerProfilesTableExists = (tableCheck?.count > 0);
  } catch (error) {
    workerProfilesTableExists = false;
  }

  try {
    const [columnCheck] = await query(
      `SELECT DATA_TYPE 
       FROM information_schema.columns 
       WHERE table_schema = DATABASE() 
       AND table_name = 'worker_profiles' 
       AND column_name = 'worker_id'`
    );
    workerProfilesWorkerIdIsNumeric = (
        columnCheck?.DATA_TYPE === 'int' || 
        columnCheck?.DATA_TYPE === 'bigint' ||
        columnCheck?.DATA_TYPE === 'decimal'
    );
  } catch (error) {
    workerProfilesWorkerIdIsNumeric = false;
  }

  if (!workerProfilesTableExists) {
    workerProfilesPayloadColumn = null;
    return;
  }

  try {
    const columns = await query(
      `SHOW COLUMNS FROM worker_profiles`
    );
    const columnNames = new Set((columns || []).map(col => String(col.Field)));
    if (columnNames.has('payload')) {
      workerProfilesPayloadColumn = 'payload';
    } else if (columnNames.has('profile_data')) {
      workerProfilesPayloadColumn = 'profile_data';
    } else {
      workerProfilesPayloadColumn = null;
    }
  } catch (error) {
    workerProfilesPayloadColumn = null;
  }
}

// Call on load
refreshWorkerMetadata().catch(console.warn);

export const workerService = {
  async fetchWorkerProfile(connection, workerId) {
      if (!workerProfilesTableExists || !workerProfilesPayloadColumn) return {};
      // Handle ID type mismatch if schema varies
      if (workerProfilesWorkerIdIsNumeric && !Number.isInteger(Number(workerId))) return {};
      
      try {
        const rows = await query(
          `SELECT ${workerProfilesPayloadColumn} AS profile_payload
           FROM worker_profiles
           WHERE worker_id = ?
           LIMIT 1`,
          [workerId],
          connection
        );
          if (!rows.length) return {};
          
          try {
          const rawPayload = rows[0]?.profile_payload;
          return typeof rawPayload === 'string'
          ? JSON.parse(rawPayload)
          : (rawPayload || {});
          } catch {
              return {};
          }
      } catch (error) {
          console.error('Fetch worker profile failed:', error);
          return {};
      }
  },

  async saveWorkerProfile(connection, workerId, payload) {
      if (!workerProfilesTableExists || !workerProfilesPayloadColumn) return;
      if (workerProfilesWorkerIdIsNumeric && !Number.isInteger(Number(workerId))) return;

      try {
          const jsonStr = JSON.stringify(payload);
          await execute(
          `INSERT INTO worker_profiles (worker_id, ${workerProfilesPayloadColumn}) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE ${workerProfilesPayloadColumn} = VALUES(${workerProfilesPayloadColumn})`,
              [workerId, jsonStr],
              connection
          );
      } catch (error) {
          console.error('Save worker profile failed:', error);
      }
  },

  buildWorkerProfileFromRow(row, fallbackProfile) {
      const profile = typeof fallbackProfile === 'object' && fallbackProfile
        ? JSON.parse(JSON.stringify(fallbackProfile))
        : { personal: {}, identity: {}, address: {}, employment: {}, credentials: {} };
    
      profile.personal = {
        nationalId: toNullableString(getColumn(row, 'national_id', 'nationalId')) || profile.personal?.nationalId || '',
        fullName: toNullableString(getColumn(row, 'full_name', 'fullName')) || profile.personal?.fullName || '',
        birthDate: toISODateString(getColumn(row, 'birth_date', 'birthDate')) || profile.personal?.birthDate || '',
        age:
          getColumn(row, 'age') !== undefined && getColumn(row, 'age') !== null
            ? Number(getColumn(row, 'age'))
            : profile.personal?.age ?? ''
      };
    
      profile.identity = {
        issueDate: toISODateString(getColumn(row, 'card_issue_date', 'issueDate')) || profile.identity?.issueDate || '',
        expiryDate: toISODateString(getColumn(row, 'card_expiry_date', 'expiryDate')) || profile.identity?.expiryDate || ''
      };
    
      profile.address = {
        phone: toNullableString(getColumn(row, 'phone', 'Phone')) || profile.address?.phone || '',
        addressOnId:
          toNullableString(getColumn(row, 'address_on_id', 'addressOnId')) || profile.address?.addressOnId || '',
        province: toNullableString(getColumn(row, 'province', 'Province')) || profile.address?.province || '',
        district: toNullableString(getColumn(row, 'district', 'District')) || profile.address?.district || '',
        subdistrict:
          toNullableString(getColumn(row, 'subdistrict', 'Subdistrict')) || profile.address?.subdistrict || '',
        postalCode:
          toNullableString(getColumn(row, 'postal_code', 'PostalCode')) || profile.address?.postalCode || '',
        currentAddress:
          toNullableString(getColumn(row, 'current_address', 'currentAddress')) || profile.address?.currentAddress || ''
      };
    
      profile.employment = {
        role: toNullableString(getColumn(row, 'role_code', 'role', 'Role')) || profile.employment?.role || '',
        tradeType:
          toNullableString(getColumn(row, 'trade_type', 'tradeType')) || profile.employment?.tradeType || '',
        experienceYears:
          getColumn(row, 'experience_years', 'experienceYears') !== undefined &&
          getColumn(row, 'experience_years', 'experienceYears') !== null
            ? String(getColumn(row, 'experience_years', 'experienceYears'))
            : profile.employment?.experienceYears || '',
        assessmentEnabled: Boolean(profile.employment?.assessmentEnabled)
      };
    
      profile.credentials = {
        email:
          toNullableString(getColumn(row, 'account_email', 'email')) || profile.credentials?.email || '',
        password: '', // Never return password
        confirmPassword: '',
        passwordHash:
          toNullableString(getColumn(row, 'account_password_hash', 'password_hash')) ||
          profile.credentials?.passwordHash || ''
      };
    
      return profile;
  },

  mapWorkerRowToResponse(row, profilePayload, assessmentSummary, foremanAssessmentSummary) {
      const profile = this.buildWorkerProfileFromRow(row, profilePayload);
      const tradeLabel = getTradeLabel(profile.employment.tradeType);
      const roleLabel = getRoleLabel(profile.employment.role);
      const accountPasswordHash = toNullableString(
        getColumn(row, 'account_password_hash', 'password_hash')
      ) || '';
    
      return {
        id: getColumn(row, 'id'),
        name: profile.personal.fullName || 'ไม่ระบุ',
        phone: toNullableString(getColumn(row, 'phone')) || '',
        role: roleLabel,
        category: tradeLabel,
        level: tradeLabel, // Often level is mapped from trade or assessment
        status: toNullableString(getColumn(row, 'employment_status')) || 'active',
        startDate:
          toISODateString(getColumn(row, 'start_date')) ||
          toISODateString(getColumn(row, 'created_at')) ||
          '',
        province: profile.address.province || 'ไม่ระบุ',
        email: profile.credentials.email || '',
        passwordHash: accountPasswordHash,
        assessmentEnabled: Boolean(profile.employment?.assessmentEnabled),
        score: assessmentSummary?.score ?? null,
        assessmentPassed: assessmentSummary?.passed ?? null,
        assessmentTotalScore: assessmentSummary?.totalScore ?? null,
        assessmentTotalQuestions: assessmentSummary?.totalQuestions ?? null,
        assessmentRoundLevel: assessmentSummary?.roundLevel ?? null,
        foremanAssessed: Boolean(foremanAssessmentSummary),
        foremanAssessmentPercent: foremanAssessmentSummary?.percent ?? null,
        foremanAssessmentTotalScore: foremanAssessmentSummary?.totalScore ?? null,
        foremanAssessmentMaxScore: foremanAssessmentSummary?.maxScore ?? null,
        foremanAssessmentGrade: foremanAssessmentSummary?.grade ?? null,
        foremanAssessmentCreatedAt: foremanAssessmentSummary?.createdAt ?? null,
        fullData: profile
      };
  },

  buildWorkerDataFromPayload(payload, { forUpdate = false } = {}) {
      const birthDate = parseDateValue(payload.personal?.birthDate);
      const age = parseAgeValue(payload.personal?.age, birthDate);
      const experienceYears = parseExperienceYears(payload.employment?.experienceYears);
      const nowDate = new Date().toISOString().slice(0, 10);
    
      const base = {
        national_id: toNullableString(payload.personal?.nationalId),
        full_name: toNullableString(payload.personal?.fullName),
        phone: toNullableString(payload.address?.phone),
        birth_date: birthDate,
        age,
        role_code: toNullableString(payload.employment?.role),
        trade_type: toNullableString(payload.employment?.tradeType),
        experience_years: experienceYears,
        province: toNullableString(payload.address?.province),
        district: toNullableString(payload.address?.district),
        subdistrict: toNullableString(payload.address?.subdistrict),
        postal_code: toNullableString(payload.address?.postalCode),
        address_on_id: toNullableString(payload.address?.addressOnId),
        current_address: toNullableString(payload.address?.currentAddress),
        card_issue_date: parseDateValue(payload.identity?.issueDate),
        card_expiry_date: parseDateValue(payload.identity?.expiryDate),
        employment_status: 'probation',
        start_date: nowDate
      };
    
      if (forUpdate) {
         // Filter out undefineds but keep nulls
         const updateData = {};
         for (const [k, v] of Object.entries(base)) {
             if (v !== undefined) updateData[k] = v;
         }
         return updateData;
      }
    
      return base;
  }
};
