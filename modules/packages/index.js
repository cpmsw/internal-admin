module.exports = async function (fastify) {
  fastify.register(
    require("./packages.routes")
  );
};