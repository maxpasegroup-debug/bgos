import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

function looksLikeBcryptHash(stored: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(stored);
}

export async function hashPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
}

export async function verifyPassword(
  plainTextPassword: string,
  passwordHash: string,
): Promise<boolean> {
  if (looksLikeBcryptHash(passwordHash)) {
    return bcrypt.compare(plainTextPassword, passwordHash);
  }
  // Legacy records may still have plain-text passwords.
  // Keep them login-compatible until migrated to bcrypt.
  return plainTextPassword === passwordHash;
}
