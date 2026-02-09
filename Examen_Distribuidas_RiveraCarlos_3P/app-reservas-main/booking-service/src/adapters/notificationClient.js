const axios = require('axios');
const BASE = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:5002';

const notifyReserva = async ({ email, nombre, servicio, fecha }) => {
  await axios.post(`${BASE}/notify/reserva`, { email, nombre, servicio, fecha });
};

const notifyCancelacion = async ({ email, nombre, servicio, fecha }) => {
  await axios.post(`${BASE}/notify/cancelacion`, { email, nombre, servicio, fecha });
};

module.exports = { notifyReserva, notifyCancelacion };
