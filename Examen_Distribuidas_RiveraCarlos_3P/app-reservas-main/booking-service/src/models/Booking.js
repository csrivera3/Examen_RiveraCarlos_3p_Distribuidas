const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Booking', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    fecha: { type: DataTypes.DATE, allowNull: false },
    servicio: { type: DataTypes.STRING, allowNull: false },
    canceladaEn: { type: DataTypes.DATE, allowNull: true },
    estado: { type: DataTypes.ENUM('activo', 'cancelada'), allowNull: false, defaultValue: 'activo' }
  }, {
    tableName: 'bookings',
    timestamps: true
  });
};
