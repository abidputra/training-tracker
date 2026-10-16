/** Username rules shared by signup, login and settings. Mirrors the check in 0002_usernames.sql. */
export const USERNAME_HELP = '3–20 characters: letters, numbers or underscore.';

const RULE = /^[a-z0-9_]{3,20}$/;

export const normalizeUsername = (s) => s.trim().toLowerCase();
export const isValidUsername = (s) => RULE.test(normalizeUsername(s));
