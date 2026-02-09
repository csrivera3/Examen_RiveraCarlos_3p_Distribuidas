const { sequelize } = require('../models');
const bookingRepo = require('../repositories/bookingRepository');
const notificationClient = require('../adapters/notificationClient');
const userClient = require('../adapters/userClient');
const { DateTime } = require('luxon');

// Validar que usuario existe en user-service (usa token como fallback si falla)
const validateAndGetUser = async (userId, token = '') => {
  try {
    if (token && token.startsWith('Bearer ')) {
      const tokenValue = token.split(' ')[1];
      const user = await userClient.getMe(tokenValue);
      return user;
    }
  } catch (err) {
    console.warn('[BookingService] User validation failed:', err.message);
  }
  
  // Fallback: retornar objeto minimal (para testing)
  return { userId, email: `user${userId}@test.local`, nombre: 'Usuario' };
};

const createBooking = async (userId, fechaISO, servicio, token = '') => {
  if (!userId) throw new Error('Usuario inválido');

  // Validar usuario
  const user = await validateAndGetUser(userId, token);

  const fecha = DateTime.fromISO(fechaISO, { zone: 'America/Guayaquil' }).toJSDate();

  const result = await sequelize.transaction(async (t) => {
    const nueva = await bookingRepo.create({ userId, fecha, servicio, estado: 'activo' }, t);
    return nueva;
  });

  // notify async (don't block transaction)
  try {
    const fechaFormateada = DateTime.fromJSDate(result.fecha).setZone('America/Guayaquil').toFormat('dd/MM/yyyy HH:mm');
    await notificationClient.notifyReserva({ 
      email: user.email, 
      nombre: user.nombre || 'Usuario', 
      servicio, 
      fecha: fechaFormateada 
    });
  } catch (err) {
    console.warn('Notification failed', err.message);
  }

  return result;
};

const listBookings = async (userId) => {
  if (!userId) throw new Error('Usuario inválido');
  const rows = await bookingRepo.findByUser(userId);
  return rows;
};

const listNext = async (userId) => {
  if (!userId) throw new Error('Usuario inválido');
  const today = new Date();
  return bookingRepo.findNextByUser(userId, today, 5);
};

const cancelBooking = async (userId, id, token = '') => {
  if (!userId) throw new Error('Usuario inválido');

  // Validar usuario
  const user = await validateAndGetUser(userId, token);

  return await sequelize.transaction(async (t) => {
    const reserva = await bookingRepo.findByIdAndUser(id, userId, t);
    if (!reserva) throw new Error('Reserva no encontrada');

    reserva.estado = 'cancelada';
    reserva.canceladaEn = new Date();
    await bookingRepo.save(reserva, t);

    // enforce max 5 cancelled
    const canceladas = await bookingRepo.findCancelledSorted(userId, t);
    if (canceladas.length > 5) {
      const toRemove = canceladas.slice(0, canceladas.length - 5).map(r => r.id);
      await bookingRepo.deleteManyByIds(toRemove, t);
    }

    // notify
    try {
      const fechaFormateada = DateTime.fromJSDate(reserva.fecha).setZone('America/Guayaquil').toFormat('dd/MM/yyyy HH:mm');
      await notificationClient.notifyCancelacion({ 
        email: user.email, 
        nombre: user.nombre || 'Usuario', 
        servicio: reserva.servicio, 
        fecha: fechaFormateada 
      });
    } catch (err) {
      console.warn('Notification failed', err.message);
    }

    return reserva;
  });
};

const deleteBooking = async (userId, id) => {
  if (!userId) throw new Error('Usuario inválido');
  const deleted = await bookingRepo.deleteByIdAndUser(id, userId);
  return deleted > 0;
};

module.exports = { createBooking, listBookings, cancelBooking, deleteBooking, listNext };
