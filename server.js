const fastify = require("fastify")({ logger: true });
fastify.register(require("@fastify/cors"), {
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
});
const { Pool } = require("pg");

// -------------------------------------
// DB CONNECTIONS (use your existing DBs)
// -------------------------------------

const authDb = new Pool({
  user: "cpmsoft_user",
  host: "localhost",
  database: "authdb",
  password: "CpmSoft9(0)",
  port: 5432
});

const appDb = new Pool({
  user: "cpmsoft_user",
  host: "localhost",
  database: "appdb",
  password: "CpmSoft9(0)",
  port: 5432
});

// -------------------------------------
// HEALTH CHECK
// -------------------------------------

fastify.get("/", async () => {
  return { status: "internal-admin running" };
});

fastify.get("/db-test", async () => {
  const result = await authDb.query("SELECT NOW()");
  return result.rows;
});


// -------------------------------------
// GET TENANTS
// -------------------------------------

fastify.get("/tenants", async (request) => {

  const rawSearch = request.query.search || "";
  const search = rawSearch.trim();

  let query = `
    SELECT 
      t.id,
      t.legal_name AS name,
      t.dba_name,
      t.status,
      t.created_at,

      u.email,
      u.first_name,
      u.last_name

    FROM tenants t
    LEFT JOIN users u 
      ON u.id = t.owner_user_id
      WHERE t.is_active = true
  `;

  const params = [];

  if (search.length > 0) {
    query += ` WHERE LOWER(t.legal_name) LIKE $1`;
    params.push(`%${search.toLowerCase()}%`);
  }

  query += ` ORDER BY t.created_at DESC LIMIT 100`;

  const result = await authDb.query(query, params);

  return result.rows;
});
// -------------------------------------
// CREATE TENANT
// -------------------------------------

fastify.post("/tenants", async (request, reply) => {
  const {
    company_name,
    admin_email,
    admin_first_name,
    admin_last_name
  } = request.body;

  if (!company_name || !admin_email) {
    return reply.code(400).send({ error: "Missing fields" });
  }

  const client = await authDb.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Insert tenant (FIXED COLUMNS)
    const tenantResult = await client.query(
      `
      INSERT INTO tenants (
        legal_name,
        dba_name,
        status,
        created_at
      )
      VALUES ($1, $1, 'active', NOW())
      RETURNING id
      `,
      [company_name]
    );

    const tenantId = tenantResult.rows[0].id;

    // 2️⃣ Insert admin user (verify column names if needed)
    const userResult = await client.query(
      `
  INSERT INTO users (
    tenant_id,
    email,
    first_name,
    last_name,
    role,
    is_verified,
    created_at
  )
  VALUES ($1, $2, $3, $4, 'admin', false, NOW())
  RETURNING id
  `,
      [
        tenantId,
        admin_email,
        admin_first_name || '',
        admin_last_name || ''
      ]
    );

    const userId = userResult.rows[0].id;

    // 3️⃣ Update tenant owner
    await client.query(
      `
      UPDATE tenants
      SET owner_user_id = $2
      WHERE id = $1
      `,
      [tenantId, userId]
    );

    await client.query("COMMIT");

    // 4️⃣ Seed settings_menu (appDb) — FIXED
    await appDb.query(
      `
  INSERT INTO settings_menu (
    tenant_id,
    menu_key,
    label,
    type,
    sort_order,
    is_active,
    created_at
  )
  VALUES
    ($1, 'customers', 'Customers', 'module', 1, true, NOW()),
    ($1, 'suppliers', 'Suppliers', 'module', 2, true, NOW()),
    ($1, 'users', 'Users', 'module', 3, true, NOW())
  `,
      [tenantId]
    );
    return {
      success: true,
      tenantId,
      userId
    };

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE TENANT ERROR:", err);
    return reply.code(500).send({ error: err.message });
  } finally {
    client.release();
  }
});

// -------------------------------------
// UPDATE TENANT
// -------------------------------------
fastify.put("/tenants/:id", async (request, reply) => {

  const tenantId = request.params.id;

  const {
    company_name,
    admin_email,
    admin_first_name,
    admin_last_name
  } = request.body;

  const client = await authDb.connect();

  try {

    await client.query("BEGIN");

    // ---------------------------
    // 1. Update tenant
    // ---------------------------
    await client.query(
      `
      UPDATE tenants
      SET 
        legal_name = $2,
        updated_at = NOW()
      WHERE id = $1
      `,
      [tenantId, company_name]
    );

    // ---------------------------
    // 2. Update owner user
    // ---------------------------
    await client.query(
      `
      UPDATE users
      SET 
        email = $2,
        first_name = $3,
        last_name = $4,
        updated_at = NOW()
      WHERE id = (
        SELECT owner_user_id 
        FROM tenants 
        WHERE id = $1
      )
      `,
      [
        tenantId,
        admin_email,
        admin_first_name,
        admin_last_name
      ]
    );

    await client.query("COMMIT");

    return { success: true };

  } catch (err) {

    await client.query("ROLLBACK");

    console.error(err);

    return reply.code(500).send({
      error: err.message
    });

  } finally {

    client.release();

  }

});

// -------------------------------------
// DELETE/DEACTIVATE TENANT
// -------------------------------------

fastify.delete("/tenants/:id", async (request, reply) => {

  const tenantId = request.params.id;

  // TODO later: get from auth
  const userId = null;

  try {

    // 1. TENANT
    await authDb.query(
      `
      UPDATE tenants
      SET 
        is_active = false,
        deactivated_at = NOW(),
        deactivated_by = $2,
        updated_at = NOW()
      WHERE id = $1
      `,
      [tenantId, userId]
    );

    // 2. USERS
    await authDb.query(
      `
      UPDATE users
      SET 
        is_active = false,
        deactivated_at = NOW(),
        deactivated_by = $2,
        updated_at = NOW()
      WHERE tenant_id = $1
      `,
      [tenantId, userId]
    );

    // 3. SETTINGS_MENU
    await appDb.query(
      `
      UPDATE settings_menu
      SET 
        is_active = false,
        deactivated_at = NOW(),
        deactivated_by = $2
      WHERE tenant_id = $1
      `,
      [tenantId, userId]
    );

    return { success: true };

  } catch (err) {
    console.error(err);
    return reply.code(500).send({ error: err.message });
  }

});

// -------------------------------------
// REACTIVATE TENANT
// -------------------------------------
fastify.put("/tenants/:id/reactivate", async (request, reply) => {

  const tenantId = request.params.id;

  try {

    // 1. TENANT
    await authDb.query(
      `
      UPDATE tenants
      SET 
        is_active = true,
        deactivated_at = NULL,
        deactivated_by = NULL,
        updated_at = NOW()
      WHERE id = $1
      `,
      [tenantId]
    );

    // 2. USERS
    await authDb.query(
      `
      UPDATE users
      SET 
        is_active = true,
        deactivated_at = NULL,
        deactivated_by = NULL,
        updated_at = NOW()
      WHERE tenant_id = $1
      `,
      [tenantId]
    );

    // 3. SETTINGS_MENU
    await appDb.query(
      `
      UPDATE settings_menu
      SET 
        is_active = true,
        deactivated_at = NULL,
        deactivated_by = NULL
      WHERE tenant_id = $1
      `,
      [tenantId]
    );

    return { success: true };

  } catch (err) {
    console.error(err);
    return reply.code(500).send({ error: err.message });
  }

});

// -------------------------------------
// PURGE COUNT
// -------------------------------------
fastify.get("/tenants/purge/count", async (request, reply) => {

  try {

    const result = await authDb.query(
      `
      SELECT COUNT(*)::int AS count
      FROM tenants
      WHERE is_active = false
      `
    );

    return { count: result.rows[0].count };

  } catch (err) {
    console.error(err);
    return reply.code(500).send({ error: err.message });
  }

});

// -------------------------------------
// PURGE RECORDS
// -------------------------------------
fastify.post("/tenants/purge", async (request, reply) => {

  try {

    // 1. Get all inactive tenants
    const tenantsResult = await authDb.query(
      `
      SELECT id
      FROM tenants
      WHERE is_active = false
      `
    );

    const tenantIds = tenantsResult.rows.map(t => t.id);

    if (tenantIds.length === 0) {
      return {
        success: true,
        message: "No inactive tenants to purge"
      };
    }

    // 2. Delete from CHILD tables FIRST (important)

    // USERS
    await authDb.query(
      `
      DELETE FROM users
      WHERE tenant_id = ANY($1)
      `,
      [tenantIds]
    );

    // SETTINGS MENU
    await appDb.query(
      `
      DELETE FROM settings_menu
      WHERE tenant_id = ANY($1)
      `,
      [tenantIds]
    );

    // 3. Delete TENANTS
    await authDb.query(
      `
      DELETE FROM tenants
      WHERE id = ANY($1)
      `,
      [tenantIds]
    );

    return {
      success: true,
      deletedTenants: tenantIds.length
    };

  } catch (err) {

    console.error(err);

    return reply.code(500).send({
      error: err.message
    });

  }

});

// -------------------------------------
// START SERVER
// -------------------------------------

fastify.listen({ port: 4100, host: "127.0.0.1" }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log("CPMSOFT Platform Console running on 127.0.0.1:4100");
});
