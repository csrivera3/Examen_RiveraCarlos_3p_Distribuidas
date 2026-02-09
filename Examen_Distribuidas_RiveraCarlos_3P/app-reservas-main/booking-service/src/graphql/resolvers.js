const bookingService = require('../services/bookingService');
const { formatInTimeZone } = require('date-fns-tz');

module.exports = {
  Query: {
    myBookings: async (_, __, { userId }) => {
      const rows = await bookingService.listBookings(userId);
      return rows.map(r => {
        const obj = r.toJSON();
        obj.fechaFormateada = formatInTimeZone(obj.fecha, 'America/Guayaquil', 'dd/MM/yyyy HH:mm:ss');
        return obj;
      });
    },
    nextBookings: async (_, __, { userId }) => {
      const rows = await bookingService.listNext(userId);
      return rows.map(r => {
        const obj = r.toJSON();
        obj.fechaFormateada = formatInTimeZone(obj.fecha, 'America/Guayaquil', 'dd/MM/yyyy HH:mm:ss');
        return obj;
      });
    }
  },
  Mutation: {
    createBooking: async (_, { fecha, servicio }, { userId }) => {
      const created = await bookingService.createBooking(userId, fecha, servicio);
      return created.toJSON();
    },
    cancelBooking: async (_, { id }, { userId }) => {
      const canceled = await bookingService.cancelBooking(userId, id);
      return canceled.toJSON();
    },
    deleteBooking: async (_, { id }, { userId }) => {
      return bookingService.deleteBooking(userId, id);
    }
  }
};
