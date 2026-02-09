require('dotenv').config();
const { createApp } = require('./app');

const PORT = process.env.PORT || 5002;

async function start() {
  const { app, server, sequelize } = await createApp();
  await sequelize.authenticate();
  await sequelize.sync();
  app.listen(PORT, () => console.log(`Booking GraphQL service running on http://localhost:${PORT}${server.graphqlPath}`));
}

start();
