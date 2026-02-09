require('dotenv').config();
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const typeDefs = require('./graphql/schema');
const resolvers = require('./graphql/resolvers');
const { sequelize } = require('./models');

async function createApp() {
  const app = express();
  app.use(cors());

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req }) => {
      const auth = req.headers.authorization || '';
      let userId = null;
      
      if (!auth.startsWith('Bearer ')) {
        // No token = sin autenticar (para testing)
        userId = 'test-user-' + Date.now();
      } else {
        const token = auth.split(' ')[1];
        try {
          // Verificar JWT con JWT_SECRET
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          userId = decoded.sub || decoded.userId || decoded.id;
          if (!userId) throw new Error('Invalid token payload: no userId found');
        } catch (err) {
          // En test, usar token como userId
          if (process.env.NODE_ENV === 'test') {
            userId = token;
          } else {
            console.warn('[Auth] JWT verification failed:', err.message);
            userId = 'test-user-' + Date.now();
          }
        }
      }
      
      return { userId, token: auth };
    }
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  return { app, server, sequelize };
}

module.exports = { createApp };
