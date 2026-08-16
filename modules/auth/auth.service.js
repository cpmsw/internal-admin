const bcrypt = require("bcryptjs");

const authDb =
  require("../../db/authDb");


async function getAdminByEmail(email) {

  const result =
    await authDb.query(
      `SELECT
         id,
         email,
         display_name,
         password_hash,
         twofa_secret,
         twofa_enabled,
         is_active,
         failed_login_attempts,
         locked_until,
         last_login_at
       FROM platform_admins
       WHERE lower(email) =
         lower($1)
       LIMIT 1`,
      [email]
    );

  return result.rows[0] || null;
}


async function verifyPassword(
  password,
  passwordHash
) {
  return bcrypt.compare(
    password,
    passwordHash
  );
}


async function recordFailedLogin(admin) {

  const attempts =
    (admin.failed_login_attempts || 0) + 1;

  let lockedUntil = null;

  if (attempts >= 5) {
    lockedUntil =
      new Date(
        Date.now() +
        15 * 60 * 1000
      );
  }

  await authDb.query(
    `UPDATE platform_admins
     SET failed_login_attempts = $2,
         locked_until = $3,
         updated_at = now()
     WHERE id = $1`,
    [
      admin.id,
      attempts,
      lockedUntil
    ]
  );
}


async function clearFailedLogin(adminId) {

  await authDb.query(
    `UPDATE platform_admins
     SET failed_login_attempts = 0,
         locked_until = NULL,
         updated_at = now()
     WHERE id = $1`,
    [adminId]
  );
}

async function saveTwoFactorSecret(
  adminId,
  secret
) {
  await authDb.query(
    `UPDATE platform_admins
     SET twofa_secret = $2,
         twofa_enabled = false,
         updated_at = now()
     WHERE id = $1`,
    [
      adminId,
      secret
    ]
  );
}


async function getAdminById(adminId) {
  const result =
    await authDb.query(
      `SELECT
         id,
         email,
         display_name,
         password_hash,
         twofa_secret,
         twofa_enabled,
         is_active,
         failed_login_attempts,
         locked_until,
         last_login_at
       FROM platform_admins
       WHERE id = $1
       LIMIT 1`,
      [adminId]
    );

  return result.rows[0] || null;
}


async function enableTwoFactor(
  adminId
) {
  await authDb.query(
    `UPDATE platform_admins
     SET twofa_enabled = true,
         last_login_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [adminId]
  );
}

async function recordSuccessfulLogin(
  adminId
) {
  await authDb.query(
    `UPDATE platform_admins
     SET failed_login_attempts = 0,
         locked_until = NULL,
         last_login_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [adminId]
  );
}

module.exports = {
  getAdminByEmail,
  getAdminById,
  verifyPassword,
  recordFailedLogin,
  clearFailedLogin,
  saveTwoFactorSecret,
  enableTwoFactor,
  recordSuccessfulLogin
};