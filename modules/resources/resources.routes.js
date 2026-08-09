const service =
  require("./resources.service");

module.exports = async function (fastify) {


  // ---------------------------------
  // GET MASTER RESOURCE CATALOG
  // ---------------------------------
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Resources"],
        summary:
          "Get CPMSOFT resource catalog",

        description:
          "Returns all active resources available in the CPMSOFT master catalog."
      }
    },
    async (request, reply) => {

      try {

        return await service
          .getResources();

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "RESOURCE_LOAD_FAILED",

            error:
              error.message
          });
      }
    }
  );


  // ---------------------------------
  // GET TENANT RESOURCE SELECTION
  // ---------------------------------
  fastify.get(
    "/tenant/:tenantId",
    {
      schema: {
        tags: ["Resources"],

        summary:
          "Get tenant resource entitlements",

        description:
          "Returns the complete CPMSOFT resource catalog together with the enabled/disabled entitlement state for the selected tenant.",

        params: {
          type: "object",
          required: [
            "tenantId"
          ],

          properties: {
            tenantId: {
              type: "string",
              format: "uuid",
              description:
                "Tenant UUID"
            }
          }
        }
      }
    },
    async (request, reply) => {

      try {

        return await service
          .getTenantResources(
            request.params.tenantId
          );

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "TENANT_RESOURCE_LOAD_FAILED",

            error:
              error.message
          });
      }
    }
  );


  // ---------------------------------
  // SAVE TENANT RESOURCE SELECTION
  // ---------------------------------
  fastify.put(
    "/tenant/:tenantId",
    {
      schema: {
        tags: ["Resources"],

        summary:
          "Update tenant resource entitlements",

        description:
          "Replaces the tenant's currently enabled resource set. Selected resources are enabled and previously enabled resources that are not selected are disabled. Existing entitlement rows are retained.",

        params: {
          type: "object",
          required: [
            "tenantId"
          ],

          properties: {
            tenantId: {
              type: "string",
              format: "uuid",
              description:
                "Tenant UUID"
            }
          }
        },

        body: {
          type: "object",
          required: [
            "resourceIds"
          ],

          additionalProperties: false,

          properties: {

            resourceIds: {
              type: "array",

              description:
                "Resource UUIDs that should remain enabled for the tenant.",

              items: {
                type: "string",
                format: "uuid"
              }
            }
          }
        },

        response: {
          200: {
            type: "object",

            properties: {
              success: {
                type: "boolean"
              },

              tenantId: {
                type: "string",
                format: "uuid"
              },

              enabledCount: {
                type: "integer"
              }
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        return await service
          .saveTenantResources(
            request.params.tenantId,
            request.body.resourceIds
          );

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "TENANT_RESOURCE_SAVE_FAILED",

            error:
              error.message
          });
      }
    }
  );

};