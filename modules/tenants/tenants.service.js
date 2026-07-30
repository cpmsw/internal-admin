async function notImplemented() {
  const error = new Error('Tenant service is not implemented yet');
  error.statusCode = 501;
  throw error;
}

module.exports = {
  getTenants: notImplemented,
  createTenant: notImplemented,
  updateTenant: notImplemented,
  deactivateTenant: notImplemented,
  reactivateTenant: notImplemented,
  getPurgeCount: notImplemented,
  purgeTenants: notImplemented
};