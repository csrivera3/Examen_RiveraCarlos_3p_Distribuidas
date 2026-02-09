# GraphQL Testing Guide — Booking Service

Este archivo proporciona comandos reproducibles para probar el servicio GraphQL.

## Prerequisites

- Servicio levantado en `http://localhost:5002/graphql`
- Token JWT válido (obtener de `user-service`)

## Ejemplos con curl

Para cada ejemplo, reemplaza `<token>` con un JWT válido.

### 1. Crear una reserva

```bash
curl -X POST http://localhost:5002/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "query": "mutation { createBooking(fecha: \"2026-02-20T14:00:00-05:00\", servicio: \"Masaje\") { id fecha fechaFormateada servicio estado } }"
  }'
```

### 2. Listar todas mis reservas

```bash
curl -X POST http://localhost:5002/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "query": "query { myBookings { id servicio fecha fechaFormateada estado canceladaEn } }"
  }'
```

### 3. Listar próximas reservas (máx 5)

```bash
curl -X POST http://localhost:5002/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "query": "query { nextBookings { id servicio fecha fechaFormateada estado } }"
  }'
```

### 4. Cancelar una reserva

```bash
curl -X POST http://localhost:5002/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "query": "mutation { cancelBooking(id: 1) { id estado canceladaEn } }"
  }'
```

### 5. Eliminar una reserva

```bash
curl -X POST http://localhost:5002/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "query": "mutation { deleteBooking(id: 1) }"
  }'
```

---

## Ejemplos con PowerShell

### 1. Crear una reserva

```powershell
$token = "<token>"
$body = @{
    query = 'mutation { createBooking(fecha: "2026-02-20T14:00:00-05:00", servicio: "Yoga") { id fecha servicio estado } }'
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:5002/graphql `
  -Method POST `
  -Headers @{
    'Content-Type' = 'application/json'
    'Authorization' = "Bearer $token"
  } `
  -Body $body
```

### 2. Listar reservas

```powershell
$token = "<token>"
$body = @{
    query = 'query { myBookings { id servicio fecha fechaFormateada estado } }'
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:5002/graphql `
  -Method POST `
  -Headers @{
    'Content-Type' = 'application/json'
    'Authorization' = "Bearer $token"
  } `
  -Body $body
```

### 3. Cancelar reserva (máx 5)

```powershell
$token = "<token>"
# Crear 6 reservas
for ($i = 1; $i -le 6; $i++) {
    $fecha = (Get-Date).AddDays($i).ToString("yyyy-MM-ddTHH:00:00-05:00")
    $body = @{
        query = "mutation { createBooking(fecha: `"$fecha`", servicio: `"Service$i`") { id } }"
    } | ConvertTo-Json
    Invoke-RestMethod -Uri http://localhost:5002/graphql `
      -Method POST `
      -Headers @{
        'Content-Type' = 'application/json'
        'Authorization' = "Bearer $token"
      } `
      -Body $body
}

# Listar y obtener IDs
$listBody = @{ query = 'query { myBookings { id } }' } | ConvertTo-Json
$bookings = (Invoke-RestMethod -Uri http://localhost:5002/graphql `
  -Method POST `
  -Headers @{
    'Content-Type' = 'application/json'
    'Authorization' = "Bearer $token"
  } `
  -Body $listBody).data.myBookings

# Cancelar todas
foreach ($booking in $bookings) {
    $cancelBody = @{
        query = "mutation { cancelBooking(id: $($booking.id)) { id estado canceladaEn } }"
    } | ConvertTo-Json
    Invoke-RestMethod -Uri http://localhost:5002/graphql `
      -Method POST `
      -Headers @{
        'Content-Type' = 'application/json'
        'Authorization' = "Bearer $token"
      } `
      -Body $cancelBody
}

# Verificar que solo 5 quedaron
$finalBody = @{ query = 'query { myBookings { estado } }' } | ConvertTo-Json
$final = (Invoke-RestMethod -Uri http://localhost:5002/graphql `
  -Method POST `
  -Headers @{
    'Content-Type' = 'application/json'
    'Authorization' = "Bearer $token"
  } `
  -Body $finalBody).data.myBookings

$cancelledCount = ($final | Where-Object { $_.estado -eq 'cancelada' }).Count
Write-Host "Reservas canceladas: $cancelledCount (esperado: máx 5)"
```

---

## Regla de negocio: Máximo 5 reservas canceladas

El test automático (`npm test`) ya valida esto, pero puedes replicarlo manualmente:

1. Crear 6 reservas
2. Cancelar las 6
3. Verificar que la BD solo contiene 5 canceladas (las más antiguas se eliminan)

---

## Autenticación (user-service)

Antes de hacer cualquier request, obtén un token válido:

```bash
# Desde auth-service o tu plataforma de identidad
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Copiar el token del response y usarlo en los requests anteriores
```

---

## Error: Unauthorized

Si recibes error `Unauthorized`:
- Verifica que el token sea válido (no expirado)
- Verifica que sea de un usuario que existe en `user-service`
- Comprueba que user-service esté levantado e integrado

---

## Esperado: Notification failed (warnings)

En tests o localmente sin notification-service, verás warnings como:
```
Notification failed getaddrinfo ENOTFOUND notification-service
```

Esto es **normal** — las notificaciones se envían async sin bloquear la operación principal.

En producción, notification-service debe estar disponible para enviar emails.

---

## Más información

- GraphQL Schema: [src/graphql/schema.js](src/graphql/schema.js)
- Resolvers: [src/graphql/resolvers.js](src/graphql/resolvers.js)
- Tests: [__tests__/booking.test.js](__tests__/booking.test.js)
- README: [README.md](README.md)
