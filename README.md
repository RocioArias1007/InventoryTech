# InventoryTech

Aplicación híbrida de inventario y ventas para tiendas de barrio. Permite controlar productos, existencias, ventas y reportes desde el celular o desde el navegador, y consultar los datos en lenguaje natural con un asistente de inteligencia artificial llamado Katia.

Proyecto del curso **Desarrollo Híbrido**, Ingeniería de Software, Universidad de Cundinamarca, extensión Soacha.

- **Autora:** Nidia Rocio Arias Cruz

## Enlaces

| Recurso | Dirección |
|---|---|
| Aplicación web | https://inventorytech-web.onrender.com |
| API (backend) | https://inventorytech-xyuy.onrender.com/api |

> Nota: el servidor y la base de datos usan planes gratuitos. Si la aplicación lleva un rato sin usarse, la primera respuesta puede tardar hasta un minuto mientras el servidor despierta. Después funciona con normalidad.

## Usuarios de prueba

Estos usuarios existen solo para la revisión del proyecto.

| Rol | Usuario | Contraseña |
|---|---|---|
| Administrador | admin | Admin2026 |
| Empleado | empleado2 | Empleado2026 |

## Funcionalidades

**Administrador**
- Gestión de productos (con foto opcional), categorías y empleados.
- Ingreso de mercancía con actualización opcional del precio de compra.
- Reportes de corte de caja, historial de ventas, movimientos de inventario, rentabilidad, alertas de stock y demanda por período, con exportación a PDF y Excel.
- Historial de auditoría de los cambios realizados.
- Consultas al asistente Katia.

**Empleado**
- Registro de ventas con cálculo de IVA y cambio, y ticket en PDF.
- Consulta de existencias.
- Consultas al asistente Katia.

**Reglas importantes del sistema**
- No se puede vender más de lo que hay en stock; la venta se rechaza con un mensaje que indica los faltantes.
- Cada venta e ingreso de mercancía se guarda en una transacción: se completa por entero o no se ejecuta.
- Un empleado desactivado pierde el acceso de inmediato, aunque conserve una sesión abierta.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | Ionic con Angular (standalone) y Capacitor (Android y web) |
| Backend | Node.js con Express (API REST) |
| Base de datos | MySQL 8, alojada en Aiven, diseñada con MySQL Workbench |
| Seguridad | JSON Web Tokens (JWT) y contraseñas con hash bcrypt |
| Asistente | Google Gemini |
| Reportes | jsPDF (PDF) y write-excel-file (Excel) |
| Despliegue | Render (servidor y sitio web) |
| Pruebas | Postman y Newman |

## Estructura del repositorio

```
InventoryTech/
  backend/      Servidor Node.js y Express (API REST)
  frontend/     Aplicación Ionic, Angular y Capacitor
  pruebas/      Colección de Postman y evidencias de las pruebas
  esquema.sql   Estructura de la base de datos (sin datos)
  README.md
```

## Cómo ejecutarlo en local

### Requisitos
- Node.js 22 o superior y npm.
- Acceso a una base de datos MySQL 8 (local o en la nube).
- Para la app Android: Android Studio.

### 1. Base de datos
1. Crea una base de datos vacía en MySQL.
2. Ejecuta el contenido de `esquema.sql` para crear las tablas.
3. Crea al menos un usuario administrador. Las contraseñas se guardan con bcrypt, así que no se pueden insertar en texto plano.

### 2. Backend
```bash
cd backend
npm install
npm start
```
El servidor queda disponible en `http://localhost:` seguido del puerto que configures en `PUERTO`, con la API en la ruta `/api`.

### 3. Frontend
```bash
cd frontend
npm install
ionic serve
```
Antes de iniciar, revisa que `API_URL` en `frontend/src/app/configuracion.ts` apunte al backend que quieres usar.

### 4. Aplicación Android
```bash
cd frontend
ionic build
npx cap sync
npx cap open android
```
Desde Android Studio se ejecuta en un dispositivo o emulador, o se genera el APK con **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

## Variables de entorno (backend)

Este repositorio **no incluye ningún archivo de ejemplo** de variables de entorno (por ejemplo `.env.example`), porque los valores reales son secretos y no deben publicarse. Para ejecutar el backend hay que crear manualmente un archivo `.env` dentro de la carpeta `backend`, con las variables de la tabla siguiente. En Render se configuran en la sección **Environment** del servicio.

| Variable | Qué es |
|---|---|
| `PUERTO` | Puerto en el que escucha el servidor (en Render, 10000). |
| `DB_HOST` | Dirección del servidor MySQL. |
| `DB_PORT` | Puerto del servidor MySQL. |
| `DB_USER` | Usuario de la base de datos. |
| `DB_PASSWORD` | Contraseña del usuario de la base de datos. |
| `DB_NAME` | Nombre de la base de datos. |
| `DB_SSL_CA` | Ruta del certificado de la autoridad certificadora para la conexión cifrada con Aiven. |
| `JWT_SECRET` | Clave larga y aleatoria para firmar los tokens de sesión. Debe ser distinta en cada entorno. |
| `ORIGENES_PERMITIDOS` | Direcciones desde las que se permite llamar a la API (CORS), separadas por coma y sin barra final. Incluye la dirección del sitio web y `https://localhost` para la app Android. |
| `GEMINI_API_KEY` | Clave de acceso al servicio de Google Gemini. Solo existe en el servidor. |

## Seguridad

- Las contraseñas se almacenan con bcrypt, nunca en texto plano.
- La sesión usa un JWT con vigencia de 8 horas; el servidor verifica en la base de datos que el usuario siga activo en cada petición.
- El acceso a cada función depende del rol (administrador o empleado).
- Todas las consultas a la base de datos usan parámetros, lo que previene la inyección SQL.
- El inicio de sesión tiene límite de intentos fallidos por usuario y por dirección.
- CORS solo acepta las direcciones listadas en `ORIGENES_PERMITIDOS`.
- La clave de Gemini nunca llega al frontend, y Katia solo ejecuta consultas de lectura.
- No se publican en el repositorio: archivos `.env`, certificados, respaldos de la base de datos ni entornos locales de Postman.

## Pruebas

La carpeta `pruebas/` contiene la colección de Postman con **76 solicitudes y 175 verificaciones automáticas**, todas aprobadas. Cubren inicio de sesión, roles (401 y 403), CRUD de productos y categorías, ventas con control de stock y reportes.

Para ejecutarla desde la terminal con Newman:

```bash
npm install -g newman
newman run pruebas/coleccion.json -e pruebas/entorno.json
```

El archivo de entorno con valores reales no se publica; hay que crearlo en Postman con la variable de la dirección base de la API y exportarlo.

Además, se midió el efecto del índice `idx_venta_fecha` con `EXPLAIN ANALYZE` sobre 100.000 ventas: la consulta por rango de fechas pasó de 57,8 ms a 4,11 ms (unas 14 veces más rápida).

## Limitaciones conocidas

- Las alertas de stock bajo se muestran al abrir la pantalla de alertas; no se envían notificaciones fuera de la aplicación.
- Los listados usan un límite de filas, no paginación por páginas.
- El contador de intentos de inicio de sesión vive en la memoria del servidor y se reinicia cuando este se reinicia.
- La versión para iOS no se ha compilado.

## Licencia

Proyecto académico. Todos los derechos reservados por la autora.
