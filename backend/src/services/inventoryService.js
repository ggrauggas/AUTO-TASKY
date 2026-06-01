const pool = require('../config/db');

async function getQuantity(client, locationId, materialId) {
  const { rows } = await client.query(
    'SELECT quantity FROM inventory WHERE location_id=$1 AND material_id=$2',
    [locationId, materialId]
  );
  return rows.length ? parseFloat(rows[0].quantity) : 0;
}

async function adjustQuantity(client, locationId, materialId, delta) {
  await client.query(
    `INSERT INTO inventory (location_id, material_id, quantity)
     VALUES ($1,$2,$3)
     ON CONFLICT (location_id, material_id)
     DO UPDATE SET quantity = inventory.quantity + $3, updated_at=NOW()`,
    [locationId, materialId, delta]
  );
}

// Mueve `quantity` unidades de material de origen a destino (atómico)
async function moveInventory(client, originId, destinationId, materialId, quantity) {
  const available = await getQuantity(client, originId, materialId);
  if (available < quantity) {
    throw { code: 'INSUFFICIENT_INVENTORY', message: `Inventario insuficiente en origen. Disponible: ${available}` };
  }
  await adjustQuantity(client, originId,      materialId, -quantity);
  await adjustQuantity(client, destinationId, materialId,  quantity);
}

module.exports = { getQuantity, adjustQuantity, moveInventory };
