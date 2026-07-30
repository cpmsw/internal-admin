const service = require('./tenants.service');

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