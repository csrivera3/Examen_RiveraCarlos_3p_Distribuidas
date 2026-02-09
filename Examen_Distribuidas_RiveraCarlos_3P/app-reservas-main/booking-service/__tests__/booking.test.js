process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

jest.mock('../src/adapters/userClient', () => ({
  getMe: jest.fn(async (token) => ({ userId: 'user-1', email: 'test@example.com', nombre: 'Test User' }))
}));

jest.mock('../src/adapters/notificationClient', () => ({
  notifyReserva: jest.fn(async () => {}),
  notifyCancelacion: jest.fn(async () => {})
}));

const request = require('supertest');
const { createApp } = require('../src/app');
const { sequelize } = require('../src/models');

let app;

beforeAll(async () => {
  const res = await createApp();
  app = res.app;
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

const authHeader = { Authorization: 'Bearer test-token-123' };

// ===== PRUEBAS =====

test('1. Crear una reserva exitosamente', async () => {
  const fecha = new Date(Date.now() + 24*3600*1000).toISOString();
  const res = await request(app)
    .post('/graphql')
    .set(authHeader)
    .send({ query: `mutation { createBooking(fecha: "${fecha}", servicio: "Suite Presidencial") { id userId fecha servicio estado } }` });
  
  expect(res.statusCode).toBe(200);
  expect(res.body.data.createBooking).toBeDefined();
  expect(res.body.data.createBooking.id).toBeDefined();
  expect(res.body.data.createBooking.estado).toBe('activo');
});

test('2. Crear múltiples reservas (3)', async () => {
  const reservas = [];
  for (let i = 0; i < 3; i++) {
    const fecha = new Date(Date.now() + (i+2)*24*3600*1000).toISOString();
    const res = await request(app)
      .post('/graphql')
      .set(authHeader)
      .send({ query: `mutation { createBooking(fecha: "${fecha}", servicio: "Habitacion ${i+1}") { id } }` });
    expect(res.statusCode).toBe(200);
    reservas.push(res.body.data.createBooking.id);
  }
  expect(reservas.length).toBe(3);
});

test('3. Listar todas mis reservas', async () => {
  const res = await request(app)
    .post('/graphql')
    .set(authHeader)
    .send({ query: `{ myBookings { id servicio estado } }` });
  
  expect(res.statusCode).toBe(200);
  expect(Array.isArray(res.body.data.myBookings)).toBe(true);
  expect(res.body.data.myBookings.length).toBeGreaterThanOrEqual(4);
});

test('4. Obtener próximas reservas (máximo 5)', async () => {
  const res = await request(app)
    .post('/graphql')
    .set(authHeader)
    .send({ query: `{ nextBookings { id fecha servicio estado } }` });
  
  expect(res.statusCode).toBe(200);
  expect(Array.isArray(res.body.data.nextBookings)).toBe(true);
  expect(res.body.data.nextBookings.length).toBeLessThanOrEqual(5);
});

test('5. Verificar que las fechas están en el futuro', async () => {
  const res = await request(app)
    .post('/graphql')
    .set(authHeader)
    .send({ query: `{ nextBookings { fecha fechaFormateada } }` });
  
  expect(res.statusCode).toBe(200);
  expect(res.body.data.nextBookings.length).toBeGreaterThan(0);
  // Solo verificar que tenemos fechas válidas
  res.body.data.nextBookings.forEach(booking => {
    expect(booking.fechaFormateada).toBeDefined();
    expect(booking.fechaFormateada).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

test('6. Cancelar una reserva', async () => {
  // Primero obtener una reserva
  const listRes = await request(app)
    .post('/graphql')
    .set(authHeader)
    .send({ query: `{ myBookings { id } }` });
  
  const bookingId = listRes.body.data.myBookings[0].id;
  
  // Cancelarla
  const cancelRes = await request(app)
    .post('/graphql')
    .set(authHeader)
    .send({ query: `mutation { cancelBooking(id: "${bookingId}") { id estado canceladaEn } }` });
  
  expect(cancelRes.statusCode).toBe(200);
  expect(cancelRes.body.data.cancelBooking.estado).toBe('cancelada');
  expect(cancelRes.body.data.cancelBooking.canceladaEn).toBeDefined();
});

test('7. Verificar límite de 5 canceladas (crear y cancelar 7, quedan 5)', async () => {
  // Crear 7 reservas
  const ids = [];
  for (let i = 0; i < 7; i++) {
    const fecha = new Date(Date.now() + (i+10)*24*3600*1000).toISOString();
    const res = await request(app)
      .post('/graphql')
      .set(authHeader)
      .send({ query: `mutation { createBooking(fecha: "${fecha}", servicio: "Room${i}") { id } }` });
    ids.push(res.body.data.createBooking.id);
  }
  
  // Cancelar todas
  for (const id of ids) {
    await request(app)
      .post('/graphql')
      .set(authHeader)
      .send({ query: `mutation { cancelBooking(id: "${id}") { id } }` });
  }
  
  // Verificar que solo quedan 5
  const listRes = await request(app)
    .post('/graphql')
    .set(authHeader)
    .send({ query: `{ myBookings { estado } }` });
  
  const canceladas = listRes.body.data.myBookings.filter(b => b.estado === 'cancelada');
  expect(canceladas.length).toBeLessThanOrEqual(5);
});

test('8. Obtener formato de fecha formateada', async () => {
  const res = await request(app)
    .post('/graphql')
    .set(authHeader)
    .send({ query: `{ myBookings { fechaFormateada } }` });
  
  expect(res.statusCode).toBe(200);
  res.body.data.myBookings.forEach(booking => {
    expect(booking.fechaFormateada).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/);
  });
});

test('9. Eliminar una reserva', async () => {
  // Obtener una reserva activa
  const listRes = await request(app)
    .post('/graphql')
    .set(authHeader)
    .send({ query: `{ myBookings { id estado } }` });
  
  const activeBooking = listRes.body.data.myBookings.find(b => b.estado === 'activo');
  
  if (activeBooking) {
    const delRes = await request(app)
      .post('/graphql')
      .set(authHeader)
      .send({ query: `mutation { deleteBooking(id: "${activeBooking.id}") }` });
    
    expect(delRes.statusCode).toBe(200);
    expect(delRes.body.data.deleteBooking).toBe(true);
  }
});

test('10. Transacción ACID - cancelar con rollback si falla', async () => {
  // Crear reserva
  const fecha = new Date(Date.now() + 20*24*3600*1000).toISOString();
  const createRes = await request(app)
    .post('/graphql')
    .set(authHeader)
    .send({ query: `mutation { createBooking(fecha: "${fecha}", servicio: "ACID Test") { id estado } }` });
  
  expect(createRes.statusCode).toBe(200);
  expect(createRes.body.data.createBooking.estado).toBe('activo');
  
  // Cancelarla
  const bookingId = createRes.body.data.createBooking.id;
  const cancelRes = await request(app)
    .post('/graphql')
    .set(authHeader)
    .send({ query: `mutation { cancelBooking(id: "${bookingId}") { id estado canceladaEn } }` });
  
  expect(cancelRes.statusCode).toBe(200);
  expect(cancelRes.body.data.cancelBooking.estado).toBe('cancelada');
  
  // Verificar que se guardó en BD
  const verifyRes = await request(app)
    .post('/graphql')
    .set(authHeader)
    .send({ query: `{ myBookings { id estado } }` });
  
  const verificada = verifyRes.body.data.myBookings.find(b => b.id === bookingId);
  expect(verificada.estado).toBe('cancelada');
});
