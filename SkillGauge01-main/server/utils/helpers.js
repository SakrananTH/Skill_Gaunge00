import { z } from 'zod';
import { ROLE_LABELS, TRADE_LABELS } from '../config/constants.js';

export function normalizePhoneTH(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (raw.startsWith('+')) return raw; // Assume already normalized if starts with +
  if (/^0\d{9}$/.test(raw)) return '+66' + raw.substring(1);
  if (/^66\d{9}$/.test(raw)) return '+' + raw;
  return raw;
}

export const uuidSchema = z.string().uuid();

export function getRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || null;
}

export function getRoleLabel(role) {
  if (!role) return '';
  return ROLE_LABELS[role] || role;
}

export function getTradeLabel(trade) {
  if (!trade) return '';
  return TRADE_LABELS[trade] || trade;
}

export function toNullableString(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

export function parseDateValue(value) {
  const trimmed = toNullableString(value);
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function parseDateTimeInput(value) {
    if (value === null || value === undefined || value === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

export function toISODateString(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    return '';
}

export function calculateAgeFromDate(dateString) {
  if (!dateString) return null;
  const birth = new Date(dateString);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function parseExperienceYears(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  if (numeric < 0) return 0;
  if (numeric > 255) return 255;
  return Math.round(numeric);
}

export function parseAgeValue(ageInput, birthDate) {
  const ageFromBirth = calculateAgeFromDate(birthDate);
  if (ageFromBirth !== null) return ageFromBirth;
  if (ageInput === null || ageInput === undefined || ageInput === '') return null;
  const numeric = Number(ageInput);
  if (Number.isNaN(numeric)) return null;
  if (numeric < 0) return 0;
  if (numeric > 120) return 120;
  return Math.round(numeric);
}

// Added missing exports
export function getColumn(row, ...candidates) {
  if (!row) return undefined;
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, candidate)) {
      return row[candidate];
    }
    const lower = candidate.toLowerCase();
    const matchKey = keys.find(key => key.toLowerCase() === lower);
    if (matchKey) return row[matchKey];
  }
  return undefined;
}


