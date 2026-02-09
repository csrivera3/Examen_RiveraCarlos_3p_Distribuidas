**Booking Service — GraphQL + PostgreSQL**

## Entorno

- **Variables de entorno requeridas**:
  - `PORT` (default 5002)
  - `DB_HOST`, `DB_PORT` (default 5432), `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_DIALECT` 
  - `USER_SERVICE_URL` (default http://user-service:5001)
  - `NOTIFICATION_SERVICE_URL` (default http://notification-service:5002)

---

## Ejecución local (recomendado)

### Opción 1: Docker Compose (Postgres + booking-service)

```bash
# Cambiar a directorio booking-service
cd booking-service

# Levantar servicios (postgres + booking-service)
docker compose up --build

# En otra terminal, aplicar migraciones
docker cp migrations/schema.sql booking-service-postgres-1:/tmp/schema.sql
docker exec booking-service-postgres-1 psql -U postgres -d bookingsdb -f /tmp/schema.sql

# GraphQL estará disponible en http://localhost:5002/graphql
```

### Opción 2: Node.js local + Postgres Docker

```bash
# Levantar solo postgres
docker run --name pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=123456 -e POSTGRES_DB=bookingsdb -p 5432:5432 -d postgres:15

# Instalar dependencias e iniciar servicio
npm install
npm run migrate
npm run dev

# GraphQL estará disponible en http://localhost:5002/graphql
```

---

## Pruebas automáticas

```bash
npm test
```

Ejecuta test suite (Jest + SQLite en memoria) que verifica:
- ✅ Crear reserva
- ✅ Listar reservas del usuario
- ✅ Listar próximas reservas (máx 5)
- ✅ Cancelar reserva (transacción ACID + máx 5 canceladas)
- ✅ Eliminar reserva
- ✅ Regla de negocio: máximo 5 reservas canceladas por usuario

---

## Ejemplos GraphQL

Enviar requests POST a `http://localhost:5002/graphql` con header `Authorization: Bearer <token>`

### 1. Crear reserva

```graphql
mutation {
  createBooking(fecha: "2026-02-15T10:00:00-05:00", servicio: "Spa") {
    id
    userId
    fecha
    fechaFormateada
    servicio
    estado
  }
}
```

### 2. Listar mis reservas

```graphql
query {
  myBookings {
    id
    servicio
    fecha
    fechaFormateada
    estado
    canceladaEn
  }
}
```

### 3. Listar próximas reservas (máx 5, fecha >= hoy)

```graphql
query {
  nextBookings {
    id
    servicio
    fecha
    fechaFormateada
    estado
  }
}
```

### 4. Cancelar reserva

```graphql
mutation {
  cancelBooking(id: 1) {
    id
    estado
    canceladaEn
  }
}
```

### 5. Eliminar reserva

```graphql
mutation {
  deleteBooking(id: 1)
}
```

---

## Validación de usuario

El servicio valida que el usuario sea válido consultando **user-service** antes de cualquier operación:

1. El cliente envía `Authorization: Bearer <token>` en el header
2. En modo **producción** (docker/k8s): booking-service llama a `GET user-service/me` con el token
3. Si user-service devuelve datos del usuario (200), se permite la operación
4. Si falla o retorna 401, se rechaza con "Unauthorized"

En **tests locales**: se usa mock que simula el user-service

---

## Despliegue en Kubernetes

### Aplicar manifiestos

```bash
# Crear secret con credenciales (db-user=postgres, db-pass=123456)
kubectl apply -f k8s/secret.yaml

# Crear configmap con configuración
kubectl apply -f k8s/configmap.yaml

# Levantar postgres (StatefulSet con PVC)
kubectl apply -f k8s/postgres-statefulset.yaml

# Esperar a que postgres esté listo
kubectl wait --for=condition=ready pod -l app=postgres --timeout=300s

# Aplicar migraciones (ejecutar schema.sql en postgres)
kubectl cp migrations/schema.sql postgres-0:/tmp/schema.sql
kubectl exec postgres-0 -- psql -U postgres -d bookingsdb -f /tmp/schema.sql

# Levantar booking-service (Deployment + Service)
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Verificar que esté listo
kubectl wait --for=condition=ready pod -l app=booking-service --timeout=300s
```

### Verificar despliegue

```bash
# Ver pods
kubectl get pods

# Ver servicios
kubectl get svc

# Ver logs
kubectl logs -f deployment/booking-service

# Port-forward para probar GraphQL
kubectl port-forward svc/booking-service 5002:5002
# Acceder a http://localhost:5002/graphql
```

---

## Arquitectura (SOLID)

- **Resolvers** ([src/graphql/resolvers.js](src/graphql/resolvers.js)): punto de entrada GraphQL, valida autenticación
- **Services** ([src/services/bookingService.js](src/services/bookingService.js)): lógica de negocio (transacciones ACID, máx 5 canceladas)
- **Repositories** ([src/repositories/bookingRepository.js](src/repositories/bookingRepository.js)): acceso a datos con Sequelize
- **Adapters** 
  - [src/adapters/userClient.js](src/adapters/userClient.js): consulta a user-service
  - [src/adapters/notificationClient.js](src/adapters/notificationClient.js): notifica a notification-service
- **Models** ([src/models/](src/models/)): Sequelize Postgres models

---

## Stack

- **GraphQL**: Apollo Server v3
- **ORM**: Sequelize (PostgreSQL)
- **BD**: PostgreSQL 15
- **Tests**: Jest + Supertest (SQLite en memoria)
- **Formato de fechas**: date-fns-tz (America/Guayaquil)
