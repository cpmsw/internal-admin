const authDb =
  require("../../db/authDb");


// ---------------------------------
// GET PACKAGES WITH RESOURCES
// ---------------------------------
async function getPackages() {

  const result = await authDb.query(
    `SELECT
       p.id AS package_id,
       p.package_key,
       p.package_name,
       p.description AS package_description,
       p.display_order AS package_display_order,

       r.id AS resource_id,
       r.resource_key,
       r.resource_name,
       r.category,
       r.description AS resource_description,

       pr.is_default,
       pr.display_order AS resource_display_order

     FROM packages p

     LEFT JOIN package_resources pr
       ON pr.package_id = p.id

     LEFT JOIN resources r
       ON r.id = pr.resource_id
      AND r.is_active = true

     WHERE p.is_active = true

     ORDER BY
       p.display_order,
       p.package_name,
       pr.display_order,
       r.resource_name`
  );


  const packages = new Map();


  for (const row of result.rows) {

    if (!packages.has(row.package_id)) {

      packages.set(
        row.package_id,
        {
          packageId:
            row.package_id,

          packageKey:
            row.package_key,

          packageName:
            row.package_name,

          description:
            row.package_description,

          displayOrder:
            row.package_display_order,

          resources: []
        }
      );
    }


    if (row.resource_id) {

      packages
        .get(row.package_id)
        .resources
        .push({
          resourceId:
            row.resource_id,

          resourceKey:
            row.resource_key,

          resourceName:
            row.resource_name,

          category:
            row.category,

          description:
            row.resource_description,

          isDefault:
            row.is_default,

          displayOrder:
            row.resource_display_order
        });
    }
  }


  return [...packages.values()];
}


module.exports = {
  getPackages
};