const { gql } = require('apollo-server-express');

module.exports = gql`
  scalar DateTime

  type Booking {
    id: ID!
    userId: String!
    fecha: String!
    servicio: String!
    canceladaEn: String
    estado: String!
    createdAt: String
    updatedAt: String
    fechaFormateada: String
  }

  type Query {
    myBookings: [Booking!]!
    nextBookings: [Booking!]!
  }

  type Mutation {
    createBooking(fecha: String!, servicio: String!): Booking!
    cancelBooking(id: ID!): Booking!
    deleteBooking(id: ID!): Boolean!
  }
`;
