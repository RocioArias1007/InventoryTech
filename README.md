# InventoryTech

Plataforma híbrida de inventario para tiendas de barrio. Permite organizar productos, controlar el stock, registrar ventas y consultar reportes, con un asistente conversacional (Katia) que responde preguntas sobre los datos del negocio.

Proyecto integrador de Ingeniería de Software, desarrollado por Rocio Arias.

## Qué resuelve

Muchas microempresas del barrio Alicante llevan su inventario en Excel o a mano, con errores humanos y sin información al día. InventoryTech ofrece una herramienta simple, enfocada en lo básico y con baja curva de aprendizaje.

## Funcionalidades

- Inicio de sesión con dos roles: administrador y empleado.
- Gestión de categorías, productos (con foto) y usuarios.
- Ingreso de mercancía que suma solo al inventario, guardando el costo de cada ingreso.
- Registro de ventas con una regla central: el stock nunca queda negativo y no se puede vender más de lo disponible.
- Ventas por período con unidades vendidas y demanda calculada con la regla del trapecio.
- Centro de reportes: movimientos de inventario, historial de ventas, corte y cierre de caja del día, alertas de stock bajo y rentabilidad, con opción de imprimir y exportar a CSV.
- Historial y auditoría de cambios (quién modificó qué, con el antes y el después).
- Katia, el chatbot con IA generativa (Google Gemini): responde sobre existencias, precios, ventas, productos más vendidos, demanda y costos. Lo que puede responder depende del rol.
- Seguridad: contraseñas cifradas, sesiones con token, permisos por rol y límite de intentos de inicio de sesión.

## Roles

| Rol | Puede hacer |
|---|---|
| Administrador | Todo: usuarios, categorías, productos, ventas, reportes y Katia completa |
| Empleado | Registrar ventas, consultar stock y preguntarle a Katia por existencias y precios de venta |

## Tecnologías

| Parte | Tecnología |
|---|---|
| Frontend | Ionic con Angular y Capacitor |
| Backend | Node.js con Express |
| Base de datos | MySQL (en la nube con Aiven) |
| Chatbot | Google Gemini |
| Pruebas | Postman |

## Arquitectura

```
App Ionic  --API REST (JSON, token JWT)-->  Backend Node/Express  --SQL con SSL-->  MySQL (Aiven)
                                                    |
                                                    +--HTTPS-->  Google Gemini
```

Katia nunca accede directamente a la base de datos: Gemini solo pide consultas predefinidas y seguras, que el backend ejecuta según el rol de la persona.

## Estructura del repositorio

```
InventoryTech/
  backend/    API REST (Node.js y Express)
  frontend/   App Ionic (Angular y Capacitor)
  pruebas/    Colección de Postman
```

## Requisitos

- Node.js 20 o superior
- Ionic CLI (`npm install -g @ionic/cli`)
- Una base de datos MySQL 8 con el esquema de InventoryTech
- Una clave de la API de Google Gemini (opcional, solo para Katia)

## Cómo correr el backend

1. Entra a la carpeta `backend` e instala las dependencias:
   ```
   npm install
   ```
2. Crea un archivo `.env` con estas variables:

   | Variable | Para qué sirve |
   |---|---|
   | `PUERTO` | Puerto del servidor (por ejemplo 3000) |
   | `DB_HOST` | Dirección del servidor MySQL |
   | `DB_PUERTO` | Puerto de MySQL |
   | `DB_USUARIO` | Usuario de la base de datos |
   | `DB_CLAVE` | Contraseña de ese usuario |
   | `DB_NOMBRE` | Nombre de la base (`inventorytech`) |
   | `DB_SSL_CA` | Ruta del certificado SSL (si la base está en la nube) |
   | `JWT_SECRET` | Texto secreto para firmar los tokens |
   | `ORIGENES_PERMITIDOS` | Direcciones del frontend permitidas (por ejemplo `http://localhost:8100`) |
   | `GEMINI_API_KEY` | Clave de la API de Gemini |
   | `GEMINI_MODEL` | Modelo de Gemini a usar |
   | `GEMINI_PENSAMIENTO` | Nivel de razonamiento (`low` recomendado) |

3. Enciende el servidor:
   ```
   node src/servidor.js
   ```
   Debe mostrar que la conexión a MySQL fue exitosa.

## Cómo correr el frontend

1. Entra a la carpeta `frontend` e instala las dependencias:
   ```
   npm install
   ```
2. Revisa que `src/app/configuracion.ts` apunte al backend (`http://localhost:3000/api`).
3. Enciende la app:
   ```
   ionic serve
   ```
   Se abre en `http://localhost:8100`.

## Pruebas

La carpeta `pruebas` contiene la colección de Postman con 76 peticiones y 175 verificaciones automáticas. Cubren autenticación, roles y permisos, validación de datos, reglas de negocio (stock), usuarios, reportes, demanda y seguridad de Katia. Para usarla: importar el archivo en Postman, llenar las variables de la colección y ejecutarla con Collection Runner.

## Limitaciones conocidas

- La base de datos usa el plan gratuito de Aiven, que puede apagarse tras un tiempo sin uso.
- El backend corre en el computador del desarrollador; para usar la app desde un celular, ambos deben estar en la misma red.
- Katia depende de la disponibilidad de la API de Gemini y puede tardar unos segundos en responder.

## Autoría

Rocio Arias — Estudiante de Ingeniería de Software, Universidad de Cundinamarca.
