const { Booking, Op } = require('../models');

const create = async (payload, transaction) => {
  return Booking.create(payload, { transaction });
};

const findByUser = async (userId) => {
  return Booking.findAll({ where: { userId } , order: [['fecha','ASC']]});
};

const findNextByUser = async (userId, today, limit = 5) => {
  return Booking.findAll({ where: { userId, estado: 'activo', fecha: { [Op.gte]: today } }, order: [['fecha','ASC']], limit });
};

const findByIdAndUser = async (id, userId, transaction) => {
  return Booking.findOne({ where: { id, userId }, transaction });
};

const save = async (booking, transaction) => booking.save({ transaction });

const deleteManyByIds = async (ids, transaction) => {
  return Booking.destroy({ where: { id: ids }, transaction });
};

const deleteByIdAndUser = async (id, userId) => Booking.destroy({ where: { id, userId } });

const findCancelledSorted = async (userId, transaction) => Booking.findAll({ where: { userId, estado: 'cancelada' }, order: [['canceladaEn','ASC']], transaction });

module.exports = {
  create,
  findByUser,
  findNextByUser,
  findByIdAndUser,
  save,
  deleteManyByIds,
  deleteByIdAndUser,
  findCancelledSorted
};
