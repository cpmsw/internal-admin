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


  const requestedPackageIds =
    Array.isArray(data.packageIds)
      ? [
        ...new Set(
          data.packageIds
            .filter(Boolean)
        )
      ]
      : [];


  if (requestedPackageIds.length === 0) {
    const error =
      new Error(
        "At least one package must be selected."
      );

    error.statusCode = 400;
    error.code =
      "PACKAGE_REQUIRED";

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
  // VERIFY SELECTED PACKAGES
  // ---------------------------------
  const validPackages =
    await authDb.query(
      `SELECT
       id,
       package_key
     FROM packages
     WHERE id =
       ANY($1::uuid[])
       AND is_active = true`,
      [requestedPackageIds]
    );


  if (
    validPackages.rowCount !==
    requestedPackageIds.length
  ) {
    const error =
      new Error(
        "One or more selected packages are invalid or inactive."
      );

    error.statusCode = 400;
    error.code =
      "INVALID_PACKAGE_IDS";

    throw error;
  }


  // ---------------------------------
  // ALWAYS INCLUDE ADMINISTRATION
  // RESOURCES FOR EVERY TENANT
  // ---------------------------------
  const baselineResult =
    await authDb.query(
      `SELECT
       id,
       resource_key
     FROM resources
     WHERE category = 'administration'
       AND is_active = true
     ORDER BY display_order,
              resource_name`
    );


  const requiredAdministrationKeys =
    new Set([
      "users",
      "roles_permissions",
      "company",
      "status"
    ]);


  const configuredAdministrationKeys =
    new Set(
      baselineResult.rows.map(
        row => row.resource_key
      )
    );


  const missingAdministrationKeys =
    [...requiredAdministrationKeys]
      .filter(
        key =>
          !configuredAdministrationKeys.has(key)
      );


  if (missingAdministrationKeys.length > 0) {
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


  // ---------------------------------
  // VERIFY SELECTED RESOURCES BELONG
  // TO AT LEAST ONE SELECTED PACKAGE
  // ---------------------------------
  let validRequestedResources = [];


  if (requestedResourceIds.length > 0) {

    const packageResourceResult =
      await authDb.query(
        `SELECT DISTINCT
         r.id,
         r.resource_key
       FROM package_resources pr
       JOIN resources r
         ON r.id = pr.resource_id
       WHERE pr.package_id =
             ANY($1::uuid[])
         AND r.id =
             ANY($2::uuid[])
         AND r.is_active = true`,
        [
          requestedPackageIds,
          requestedResourceIds
        ]
      );


    if (
      packageResourceResult.rowCount !==
      requestedResourceIds.length
    ) {
      const error =
        new Error(
          "One or more selected resources do not belong to the selected packages or are inactive."
        );

      error.statusCode = 400;
      error.code =
        "INVALID_PACKAGE_RESOURCE_IDS";

      throw error;
    }


    validRequestedResources =
      packageResourceResult.rows;
  }


  const finalResourceIds =
    [
      ...new Set([
        ...baselineIds,
        ...requestedResourceIds
      ])
    ];

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
  let rolePermissionCount = 0;


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
    // SAVE TENANT PACKAGE ASSIGNMENTS
    // ---------------------------------
    await authClient.query(
      `INSERT INTO tenant_packages
   (
     tenant_id,
     package_id,
     is_active,
     enabled_at,
     disabled_at,
     created_at,
     updated_at
   )
   SELECT
     $1,
     package_id,
     true,
     now(),
     NULL,
     now(),
     now()
   FROM UNNEST($2::uuid[])
        AS package_id`,
      [
        tenantId,
        requestedPackageIds
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
    // GIVE PRIMARY ALL ACTIVE GENERIC
    // PERMISSIONS FOR ENABLED RESOURCES
    // ---------------------------------
    const permissionResult =
      await appClient.query(
        `SELECT id
     FROM permissions
     WHERE is_active = true
     ORDER BY display_order,
              permission_key`
      );


    permissionIds =
      permissionResult.rows.map(
        row => row.id
      );



    if (
      finalResourceIds.length > 0 &&
      permissionIds.length > 0
    ) {

      const rolePermissionResult =
        await appClient.query(
          `INSERT INTO role_permissions
       (
         tenant_id,
         role_id,
         resource_id,
         permission_id,
         created_by,
         created_at
       )
       SELECT
         $1,
         $2,
         resource_id,
         permission_id,
         NULL,
         now()
       FROM UNNEST($3::uuid[])
            AS r(resource_id)
       CROSS JOIN UNNEST($4::uuid[])
            AS p(permission_id)
       RETURNING id`,
          [
            tenantId,
            primaryRoleId,
            finalResourceIds,
            permissionIds
          ]
        );


      rolePermissionCount =
        rolePermissionResult.rowCount;
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
      rolePermissionCount,

    invitationSent,

    invitationWarning
  };
}


module.exports = {
  onboardTenant
};