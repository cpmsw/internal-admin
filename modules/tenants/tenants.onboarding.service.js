const crypto = require("crypto");

const authDb =
  require("../../db/authDb");

const appDb =
  require("../../db/appDb");

const usersService =
  require("cpmsoft-core/users/users.service");


// ---------------------------------
// HELPERS
// ---------------------------------
function requiredText(value) {
  return String(value || "").trim();
}


function optionalText(value) {
  const text =
    String(value || "").trim();

  return text || null;
}


// ---------------------------------
// ONBOARD NEW TENANT
// ---------------------------------
async function onboardTenant(data) {

  // ---------------------------------
  // VALIDATE REQUEST
  // ---------------------------------
  if (!data) {
    const error =
      new Error("Request body is required.");

    error.statusCode = 400;
    error.code = "REQUEST_BODY_REQUIRED";

    throw error;
  }


  const tenantData =
    data.tenant || {};

  const primaryContact =
    data.primaryContact || {};


  const legalName =
    requiredText(
      tenantData.legalName
    );

  if (!legalName) {
    const error =
      new Error(
        "Company legal name is required."
      );

    error.statusCode = 400;
    error.code =
      "LEGAL_NAME_REQUIRED";

    throw error;
  }


  const firstName =
    requiredText(
      primaryContact.firstName
    );

  const lastName =
    requiredText(
      primaryContact.lastName
    );

  const primaryEmail =
    requiredText(
      primaryContact.email
    ).toLowerCase();


  if (
    !firstName ||
    !lastName ||
    !primaryEmail
  ) {
    const error =
      new Error(
        "Primary Contact first name, last name, and email are required."
      );

    error.statusCode = 400;
    error.code =
      "PRIMARY_CONTACT_REQUIRED";

    throw error;
  }


  const requestedResourceIds =
    Array.isArray(data.resourceIds)
      ? [
          ...new Set(
            data.resourceIds
              .filter(Boolean)
          )
        ]
      : [];


  // ---------------------------------
  // PREVENT ACTIVE EMAIL DUPLICATE
  // ---------------------------------
  const existingEmail =
    await authDb.query(
      `SELECT
         id,
         tenant_id
       FROM users
       WHERE LOWER(email) =
             LOWER($1)
         AND is_active = true
       LIMIT 1`,
      [primaryEmail]
    );

  if (existingEmail.rowCount) {
    const error =
      new Error(
        "This email address is already associated with an active CPMSOFT account."
      );

    error.statusCode = 409;
    error.code =
      "EMAIL_ALREADY_ACTIVE";

    throw error;
  }


  // ---------------------------------
  // ALWAYS INCLUDE BASELINE
  // ADMINISTRATION RESOURCES
  // ---------------------------------
  const baselineResult =
    await authDb.query(
      `SELECT id
       FROM resources
       WHERE resource_key IN
         ('users', 'roles')
         AND is_active = true`
    );

  if (baselineResult.rowCount !== 2) {
    const error =
      new Error(
        "Required administration resources are not configured."
      );

    error.statusCode = 500;
    error.code =
      "BASELINE_RESOURCES_MISSING";

    throw error;
  }


  const baselineIds =
    baselineResult.rows.map(
      row => row.id
    );


  const finalResourceIds =
    [
      ...new Set([
        ...baselineIds,
        ...requestedResourceIds
      ])
    ];


  // ---------------------------------
  // VERIFY ALL RESOURCE IDS
  // ---------------------------------
  const validResources =
    await authDb.query(
      `SELECT
         id,
         resource_key
       FROM resources
       WHERE id =
         ANY($1::uuid[])
         AND is_active = true`,
      [finalResourceIds]
    );


  if (
    validResources.rowCount !==
    finalResourceIds.length
  ) {
    const error =
      new Error(
        "One or more selected resources are invalid or inactive."
      );

    error.statusCode = 400;
    error.code =
      "INVALID_RESOURCE_IDS";

    throw error;
  }


  const resourceKeys =
    validResources.rows.map(
      row => row.resource_key
    );


  // ---------------------------------
  // GENERATED IDS
  // ---------------------------------
  const tenantId =
    crypto.randomUUID();

  const primaryUserId =
    crypto.randomUUID();

  const primaryRoleId =
    crypto.randomUUID();


  const authClient =
    await authDb.connect();

  const appClient =
    await appDb.connect();


  let appCommitted = false;

  let permissionIds = [];


  try {

    await authClient.query("BEGIN");
    await appClient.query("BEGIN");


    // =================================
    // AUTHDB
    // =================================

    // ---------------------------------
    // CREATE TENANT
    // ---------------------------------
    await authClient.query(
      `INSERT INTO tenants
       (
         id,
         legal_name,
         dba_name,
         company_code,
         status,
         phone,
         email,
         website,
         addr1,
         addr2,
         city,
         state,
         postal_code,
         country,
         is_active,
         primary_contact_user_id,
         pending_primary_contact_user_id,
         created_at,
         updated_at
       )
       VALUES
       (
         $1,
         $2,
         $3,
         $4,
         'active',
         $5,
         $6,
         $7,
         $8,
         $9,
         $10,
         $11,
         $12,
         $13,
         true,
         NULL,
         NULL,
         now(),
         now()
       )`,
      [
        tenantId,
        legalName,
        optionalText(
          tenantData.dbaName
        ),
        optionalText(
          tenantData.companyCode
        ),
        optionalText(
          tenantData.phone
        ),
        optionalText(
          tenantData.email
        ),
        optionalText(
          tenantData.website
        ),
        optionalText(
          tenantData.addr1
        ),
        optionalText(
          tenantData.addr2
        ),
        optionalText(
          tenantData.city
        ),
        optionalText(
          tenantData.state
        ),
        optionalText(
          tenantData.postalCode
        ),
        optionalText(
          tenantData.country
        ) || "US"
      ]
    );


    // ---------------------------------
    // CREATE PENDING PRIMARY USER
    // No email is sent yet.
    // ---------------------------------
    await authClient.query(
      `INSERT INTO users
       (
         id,
         tenant_id,
         email,
         first_name,
         last_name,
         display_name,
         phone,
         job_title,
         department,
         password_hash,
         is_active,
         is_verified,
         twofa_required,
         created_at,
         updated_at
       )
       VALUES
       (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         NULL,
         true,
         false,
         $10,
         now(),
         now()
       )`,
      [
        primaryUserId,
        tenantId,
        primaryEmail,
        firstName,
        lastName,
        `${firstName} ${lastName}`,
        optionalText(
          primaryContact.phone
        ),
        optionalText(
          primaryContact.jobTitle
        ),
        optionalText(
          primaryContact.department
        ),
        primaryContact.twofaRequired
          ?? true
      ]
    );


    // ---------------------------------
    // SET PENDING PRIMARY CONTACT
    // USER NOW EXISTS
    // ---------------------------------
    await authClient.query(
      `UPDATE tenants
       SET pending_primary_contact_user_id = $1,
           updated_at = now()
       WHERE id = $2`,
      [
        primaryUserId,
        tenantId
      ]
    );


    // ---------------------------------
    // SAVE FINAL TENANT RESOURCES
    // ---------------------------------
    await authClient.query(
      `INSERT INTO tenant_resources
       (
         tenant_id,
         resource_id,
         is_enabled,
         enabled_at,
         disabled_at,
         created_at,
         updated_at
       )
       SELECT
         $1,
         resource_id,
         true,
         now(),
         NULL,
         now(),
         now()
       FROM UNNEST($2::uuid[])
            AS resource_id`,
      [
        tenantId,
        finalResourceIds
      ]
    );


    // =================================
    // APPDB
    // =================================

    // ---------------------------------
    // CREATE PROTECTED PRIMARY ROLE
    // ---------------------------------
    await appClient.query(
      `INSERT INTO roles
       (
         id,
         tenant_id,
         role_code,
         role_name,
         description,
         is_system,
         is_active,
         created_at
       )
       VALUES
       (
         $1,
         $2,
         'PRIMARY',
         'Primary User',
         'Protected full-access role for the tenant Primary Contact.',
         true,
         true,
         now()
       )`,
      [
        primaryRoleId,
        tenantId
      ]
    );


    // ---------------------------------
    // GIVE PRIMARY ALL PERMISSIONS
    // FOR ENABLED RESOURCES
    // Includes normal + delete + special.
    // ---------------------------------
    const permissionResult =
      await appClient.query(
        `SELECT id
         FROM permissions
         WHERE is_active = true
           AND module_key =
               ANY($1::varchar[])
         ORDER BY id`,
        [resourceKeys]
      );


    permissionIds =
      permissionResult.rows.map(
        row => row.id
      );


    if (permissionIds.length > 0) {

      await appClient.query(
        `INSERT INTO role_permissions
         (
           tenant_id,
           role_id,
           permission_id,
           created_by,
           created_at
         )
         SELECT
           $1,
           $2,
           permission_id,
           NULL,
           now()
         FROM UNNEST($3::uuid[])
              AS permission_id`,
        [
          tenantId,
          primaryRoleId,
          permissionIds
        ]
      );
    }


    // ---------------------------------
    // ASSIGN PRIMARY ROLE TO USER
    // ---------------------------------
    await appClient.query(
      `INSERT INTO user_roles
       (
         tenant_id,
         user_id,
         role_id,
         is_active,
         created_at,
         created_by
       )
       VALUES
       (
         $1,
         $2,
         $3,
         true,
         now(),
         NULL
       )`,
      [
        tenantId,
        primaryUserId,
        primaryRoleId
      ]
    );


    // ---------------------------------
    // COMMIT APPDB FIRST
    // ---------------------------------
    await appClient.query("COMMIT");

    appCommitted = true;


    // ---------------------------------
    // COMMIT AUTHDB
    // ---------------------------------
    await authClient.query("COMMIT");


  } catch (error) {

    try {
      await authClient.query(
        "ROLLBACK"
      );
    } catch (_) {
      // Preserve original error.
    }


    if (!appCommitted) {

      try {
        await appClient.query(
          "ROLLBACK"
        );
      } catch (_) {
        // Preserve original error.
      }
    }


    // ---------------------------------
    // COMPENSATE IF APPDB COMMITTED
    // BUT AUTHDB FAILED TO COMMIT
    // ---------------------------------
    if (appCommitted) {

      try {

        await appDb.query(
          `DELETE FROM role_permissions
           WHERE tenant_id = $1`,
          [tenantId]
        );

        await appDb.query(
          `DELETE FROM user_roles
           WHERE tenant_id = $1`,
          [tenantId]
        );

        await appDb.query(
          `DELETE FROM roles
           WHERE tenant_id = $1`,
          [tenantId]
        );

      } catch (cleanupError) {

        console.error(
          "Onboarding compensation failed:",
          cleanupError
        );
      }
    }


    throw error;

  } finally {

    authClient.release();
    appClient.release();
  }


  // =================================
  // SEND ACTIVATION ONLY AFTER
  // PROVISIONING IS COMPLETE
  // =================================

  let invitationSent = false;

  let invitationWarning = null;


  try {

    await usersService.resendInvite(
      tenantId,
      primaryUserId
    );

    invitationSent = true;

  } catch (error) {

    invitationWarning =
      error.message ||
      "The tenant was provisioned, but the activation email could not be sent.";
  }


  // ---------------------------------
  // RESULT
  // ---------------------------------
  return {
    success: true,

    tenantId,

    primaryUserId,

    primaryRoleId,

    enabledResourceCount:
      finalResourceIds.length,

    primaryPermissionCount:
      permissionIds.length,

    invitationSent,

    invitationWarning
  };
}


module.exports = {
  onboardTenant
};