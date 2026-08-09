const service = require('cpmsoft-core/tenants/tenants.service');

const onboardingService = require("./tenants.onboarding.service");

module.exports = async function (fastify) {

  // GET TENANTS
  fastify.get('/', async (request, reply) => {
    try {
      const { search } = request.query;
      return await service.getTenants(search);
    } catch (error) {
      request.log.error(error);
      return reply.code(error.statusCode || 500).send({
        error: error.message
      });
    }
  });

  // CREATE TENANT
  fastify.post('/', async (request, reply) => {
    try {
      const result = await service.createTenant(request.body);
      return reply.code(201).send(result);
    } catch (error) {
      request.log.error(error);
      return reply.code(error.statusCode || 500).send({
        error: error.message
      });
    }
  });

  // PURGE COUNT
  fastify.get('/purge/count', async (request, reply) => {
    try {
      return await service.getPurgeCount();
    } catch (error) {
      request.log.error(error);
      return reply.code(error.statusCode || 500).send({
        error: error.message
      });
    }
  });

  // PURGE TENANTS
  fastify.post('/purge', async (request, reply) => {
    try {
      return await service.purgeTenants();
    } catch (error) {
      request.log.error(error);
      return reply.code(error.statusCode || 500).send({
        error: error.message
      });
    }
  });

  // ---------------------------------
  // ONBOARD NEW TENANT
  // ---------------------------------
  fastify.post(
    "/onboard",
    {
      schema: {
        tags: ["Tenants"],

        summary:
          "Onboard a new CPMSOFT customer",

        body: {
          type: "object",
          additionalProperties: false,

          required: [
            "tenant",
            "primaryContact",
            "resourceIds"
          ],

          properties: {

            tenant: {
              type: "object",
              additionalProperties: false,

              required: [
                "legalName"
              ],

              properties: {
                legalName: {
                  type: "string",
                  minLength: 1
                },

                dbaName: {
                  type: "string"
                },

                companyCode: {
                  type: "string"
                },

                phone: {
                  type: "string"
                },

                email: {
                  type: "string",
                  format: "email"
                },

                website: {
                  type: "string"
                },

                addr1: {
                  type: "string"
                },

                addr2: {
                  type: "string"
                },

                city: {
                  type: "string"
                },

                state: {
                  type: "string"
                },

                postalCode: {
                  type: "string"
                },

                country: {
                  type: "string"
                }
              }
            },


            primaryContact: {
              type: "object",
              additionalProperties: false,

              required: [
                "firstName",
                "lastName",
                "email"
              ],

              properties: {
                firstName: {
                  type: "string",
                  minLength: 1
                },

                lastName: {
                  type: "string",
                  minLength: 1
                },

                email: {
                  type: "string",
                  format: "email"
                },

                phone: {
                  type: "string"
                },

                jobTitle: {
                  type: "string"
                },

                department: {
                  type: "string"
                },

                twofaRequired: {
                  type: "boolean",
                  default: true
                }
              }
            },


            resourceIds: {
              type: "array",

              items: {
                type: "string",
                format: "uuid"
              }
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        const result =
          await onboardingService
            .onboardTenant(
              request.body
            );

        return reply
          .code(201)
          .send(result);

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode ||
            500
          )
          .send({
            code:
              error.code ||
              "TENANT_ONBOARDING_FAILED",

            message:
              error.message ||
              "The customer could not be onboarded."
          });
      }
    }
  );

  // REACTIVATE TENANT
  fastify.put('/:id/reactivate', async (request, reply) => {
    try {
      return await service.reactivateTenant(request.params.id);
    } catch (error) {
      request.log.error(error);
      return reply.code(error.statusCode || 500).send({
        error: error.message
      });
    }
  });

  // UPDATE TENANT
  fastify.put('/:id', async (request, reply) => {
    try {
      return await service.updateTenant(
        request.params.id,
        request.body
      );
    } catch (error) {
      request.log.error(error);
      return reply.code(error.statusCode || 500).send({
        error: error.message
      });
    }
  });

  // DEACTIVATE TENANT
  fastify.delete('/:id', async (request, reply) => {
    try {
      return await service.deactivateTenant(request.params.id);
    } catch (error) {
      request.log.error(error);
      return reply.code(error.statusCode || 500).send({
        error: error.message
      });
    }
  });

};
