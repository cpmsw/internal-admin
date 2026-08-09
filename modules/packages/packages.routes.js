const service =
  require("./packages.service");


module.exports =
  async function (fastify) {


    // ---------------------------------
    // GET PACKAGE CATALOG
    // ---------------------------------
    fastify.get(
      "/",
      {
        schema: {
          tags: [
            "Packages",
          ],

          summary:
            "Get CPMSOFT package catalog",

          description:
            "Returns active CPMSOFT commercial packages together with the resources contained in each package and their default selection state."
        }
      },

      async (request, reply) => {

        try {

          return await service
            .getPackages();

        } catch (error) {

          request.log.error(
            error
          );

          return reply
            .code(
              error.statusCode ||
              500
            )
            .send({
              code:
                error.code ||
                "PACKAGE_LOAD_FAILED",

              error:
                error.message
            });
        }
      }
    );

  };