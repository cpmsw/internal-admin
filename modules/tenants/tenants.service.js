const authDb = require("cpmsoft-core/common/db/authDb");

async function getTenants(searchValue = '') {
  const search = String(searchValue || '').trim().toLowerCase();

  let query = `
    SELECT
      t.id,
      t.legal_name AS name,
      t.dba_name,
      t.status,
      t.is_active,
      t.created_at,
      t.updated_at,
      u.id AS owner_user_id,
      u.email,
      u.first_name,
      u.last_name,
      u.is_active AS owner_is_active,
      u.is_verified AS owner_is_verified
    FROM tenants t
    LEFT JOIN users u
      ON u.id = t.owner_user_id
  `;

  const params = [];

  if (search) {
    query += `
      WHERE
        LOWER(COALESCE(t.legal_name, '')) LIKE $1
        OR LOWER(COALESCE(t.dba_name, '')) LIKE $1
        OR LOWER(COALESCE(u.email, '')) LIKE $1
        OR LOWER(COALESCE(u.first_name, '')) LIKE $1
        OR LOWER(COALESCE(u.last_name, '')) LIKE $1
    `;

    params.push(`%${search}%`);
  }

  query += `
    ORDER BY t.created_at DESC
    LIMIT 100
  `;

  const result = await authDb.query(query, params);
  return result.rows;
}

async function notImplemented() {
  const error = new Error('Tenant service is not implemented yet');
  error.statusCode = 501;
  throw error;
}

module.exports = {
  getTenants,
  createTenant: notImplemented,
  updateTenant: notImplemented,
  deactivateTenant: notImplemented,
  reactivateTenant: notImplemented,
  getPurgeCount: notImplemented,
  purgeTenants: notImplemented
};