const { Sequelize, Op } = require('sequelize');

const dialect = process.env.DB_DIALECT || 'postgres';
const sequelizeOptions = { logging: false };

if (dialect === 'sqlite') {
  sequelizeOptions.dialect = 'sqlite';
  sequelizeOptions.storage = process.env.DB_STORAGE || ':memory:';
} else {
  sequelizeOptions.dialect = dialect;
  sequelizeOptions.host = process.env.DB_HOST || 'localhost';
  sequelizeOptions.port = process.env.DB_PORT || 5432;
}

const sequelize = new Sequelize(
  process.env.DB_NAME || 'app-reservas',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'postgres',
  sequelizeOptions
);

const Booking = require('./Booking')(sequelize);

module.exports = { sequelize, Booking, Op };
