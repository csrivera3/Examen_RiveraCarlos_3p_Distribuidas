# Despliegue en Kubernetes — Booking Service

Guide práctica para desplegar booking-service en un cluster Kubernetes.

---

## Prerrequisitos

- Cluster Kubernetes configurado (`kubectl` acceso)
- Docker image `booking-service:latest` disponible en un registry accesible
- Storage provisioner (por defecto en cluster, para PVC)

---

## Paso 1: Preparar la imagen Docker

```bash
cd booking-service

# Construir imagen
docker build -t booking-service:latest .

# Pushear a registry (si es necesario)
# docker tag booking-service:latest <registry>/booking-service:latest
# docker push <registry>/booking-service:latest

# Si usas imagen local, asegurate que los nodos tengan acceso
```

---

## Paso 2: Crear Secrets (credenciales)

```bash
# Aplicar secret con credenciales de BD
kubectl apply -f k8s/secret.yaml

# Verificar
kubectl get secret booking-secrets
```

Output esperado:
```
NAME               TYPE     DATA   AGE
booking-secrets    Opaque   2      2s
```

---

## Paso 3: Crear ConfigMap (configuración)

```bash
# Aplicar config
kubectl apply -f k8s/configmap.yaml

# Verificar
kubectl get configmap booking-config
```

---

## Paso 4: Desplegar PostgreSQL (StatefulSet)

```bash
# Aplicar StatefulSet + Headless Service
kubectl apply -f k8s/postgres-statefulset.yaml

# Esperar a que postgres esté listo (puede tomar 30-60s)
kubectl wait --for=condition=ready pod -l app=postgres --timeout=300s

# Verificar
kubectl get statefulset postgres
kubectl get pvc
kubectl get pod postgres-0
```

---

## Paso 5: Aplicar migraciones SQL

```bash
# Copiar schema.sql al pod postgres
kubectl cp migrations/schema.sql postgres-0:/tmp/schema.sql

# Ejecutar migraciones
kubectl exec postgres-0 -- psql -U postgres -d bookingsdb -f /tmp/schema.sql

# Salida esperada:
# NOTICE:  relation "bookings" already exists, skipping
# CREATE TABLE
```

---

## Paso 6: Desplegar Booking Service

```bash
# Aplicar Deployment
kubectl apply -f k8s/deployment.yaml

# Aplicar Service (ClusterIP para comunicación interna)
kubectl apply -f k8s/service.yaml

# Esperar a que esté listo
kubectl wait --for=condition=ready pod -l app=booking-service --timeout=300s

# Verificar
kubectl get deployment booking-service
kubectl get svc booking-service
kubectl get pod -l app=booking-service
```

---

## Paso 7: Validación

### Verificar que todo está corriendo

```bash
# Ver estado de pods
kubectl get pods

# Esperado:
# NAME                                 READY   STATUS    RESTARTS   AGE
# booking-service-XXXXX                1/1     Running   0          10s
# postgres-0                           1/1     Running   0          60s
```

### Ver logs

```bash
# Logs de booking-service
kubectl logs -f deployment/booking-service

# Logs de postgres
kubectl logs -f postgres-0
```

Esperado en booking-service:
```
Booking GraphQL service running on http://localhost:5002/graphql
```

### Verificar readiness/liveness probes

```bash
kubectl describe pod -l app=booking-service

# Buscar sección "Events" y "Conditions"
# Events no deben mostrar errores de probe failures
```

---

## Paso 8: Acceder a GraphQL

### Port-forward (desarrollo)

```bash
# Exponer puerto localmente
kubectl port-forward svc/booking-service 5002:5002

# Acceder a:
# http://localhost:5002/graphql
```

### Crear Ingress (producción)

```bash
# Crear ingress (ejemplo)
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: booking-ingress
spec:
  rules:
  - host: booking.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: booking-service
            port:
              number: 5002
EOF
```

---

## Paso 9: Pruebas

### Desde dentro del cluster

```bash
# Acceder a través del service DNS
kubectl run test-pod --image=curlimages/curl -it --rm -- \
  curl -X POST http://booking-service:5002/graphql \
    -H "Content-Type: application/json" \
    -d '{"query":"{ myBookings { id } }"}'
```

### Desde afuera (port-forward)

```bash
# Terminal 1: port-forward
kubectl port-forward svc/booking-service 5002:5002

# Terminal 2: test
curl -X POST http://localhost:5002/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"query":"{ myBookings { id servicio } }"}'
```

---

## Paso 10: Monitoreo y debugging

### Verificar conexión a BD

```bash
# Entrar en booking-service pod
kubectl exec -it deployment/booking-service -- sh

# Desde dentro, verificar conexión
pg_isready -h postgres -p 5432 -U postgres
```

### Ver todos los objetos creados

```bash
kubectl get all -l app=booking-service
kubectl get all -l app=postgres
```

### Eliminar deployment completo

```bash
# Eliminar en orden inverso
kubectl delete deployment booking-service
kubectl delete svc booking-service
kubectl delete statefulset postgres
kubectl delete svc postgres
kubectl delete configmap booking-config
kubectl delete secret booking-secrets
kubectl delete pvc --all
```

---

## Variables de entorno en K8s

Los siguientes se inyectan automáticamente:

**Desde ConfigMap (`booking-config`):**
- `PORT=5002`
- `DB_HOST=postgres`
- `DB_PORT=5432`
- `DB_NAME=bookingsdb`
- `DB_DIALECT=postgres`
- `USER_SERVICE_URL=http://user-service:5001`
- `NOTIFICATION_SERVICE_URL=http://notification-service:5002`

**Desde Secret (`booking-secrets`):**
- `DB_USER=postgres`
- `DB_PASS=123456`

Para cambiar, edita `k8s/secret.yaml` y `k8s/configmap.yaml` antes de aplicar.

---

## Troubleshooting

### Error: "connection refused" a postgres

```bash
# Verificar que postgres está corriendo
kubectl get pod postgres-0

# Verificar que el service existe
kubectl get svc postgres

# Verificar logs de postgres
kubectl logs postgres-0 | tail -20
```

### Error: "readiness probe failed"

```bash
# Verificar que el servicio está respondiendo
kubectl exec deployment/booking-service -- curl -s http://localhost:5002/graphql | head -20

# Aumentar initialDelaySeconds en deployment.yaml si postgres toma tiempo iniciar
```

### Error: "table bookings doesn't exist"

```bash
# Verificar que migraciones se ejecutaron
kubectl exec postgres-0 -- psql -U postgres -d bookingsdb -c "\dt"

# Debería mostrar "bookings" table

# Si no existe, ejecutar migraciones de nuevo
kubectl cp migrations/schema.sql postgres-0:/tmp/schema.sql
kubectl exec postgres-0 -- psql -U postgres -d bookingsdb -f /tmp/schema.sql
```

### Error: "Unauthorized" en GraphQL

- Verificar que `user-service` está disponible y corriendo
- Verificar que el token JWT es válido
- Comprobar que `USER_SERVICE_URL` en ConfigMap apunta correctamente

---

## Escalado

Para aumentar réplicas de booking-service:

```bash
kubectl scale deployment booking-service --replicas=3

# Verificar
kubectl get deployment booking-service
```

---

## Más información

- [README.md](../README.md) - Instrucciones de ejecución local
- [TESTING.md](../TESTING.md) - Ejemplos de pruebas GraphQL
- [schema.sql](../migrations/schema.sql) - Script de migraciones
- [src/](../src/) - Código fuente
