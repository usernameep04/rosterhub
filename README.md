# Roster — Catálogo de Modelos IA

Sitio para explorar, subir y calificar los "modelos" (personajes) generados
con IA de tu cliente. Sin login por ahora — se agrega después sin rehacer
nada.

## Probarlo ahora mismo (sin configurar nada)

El sitio ya funciona en **modo demo**: todo se guarda en el navegador
(localStorage). Sirve para revisar el diseño y el flujo completo con tu
cliente antes de invertir tiempo en el hosting real.

1. Abre `index.html` haciendo doble clic (o arrástralo a Chrome).
2. Prueba subir un modelo, agregar fotos, calificar con estrellas, buscar
   y filtrar por etiqueta.

**Importante:** el modo demo guarda todo *solo en tu navegador*. Si lo
abres en otra computadora o borras el caché, no vas a ver los mismos
datos. Para compartirlo con tu cliente de verdad, sigue el paso 2.

## Paso 2: activar la base de datos real (gratis)

Esto hace que todos los que entren al sitio vean el mismo catálogo.

1. Crea una cuenta gratis en **[supabase.com](https://supabase.com)** y crea
   un proyecto nuevo.
2. Ve a **SQL Editor** dentro de tu proyecto, pega el contenido completo
   del archivo `schema.sql` (incluido en esta carpeta) y dale **Run**.
3. Ve a **Storage**, crea un bucket nuevo llamado exactamente
   `model-media`, márcalo como **público**.
   - **Importante:** "público" solo permite *leer* los archivos. Para
     que también se puedan *subir*, ve al **SQL Editor** y corre el
     bloque de permisos de Storage que está al final de `schema.sql`
     (dos policies para `storage.objects`). Si ya corriste `schema.sql`
     antes de esta actualización, solo corre ese bloque final, no hace
     falta repetir todo.
4. Ve a **Project Settings > API**. Copia:
   - **Project URL**
   - **anon public key**
5. Abre el archivo `js/config.js` y pégalos así:

   ```js
   const SUPABASE_URL = "https://tuproyecto.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOi...";
   ```

6. Guarda y recarga el sitio. Ya está usando la base de datos real —
   no hay que tocar nada más del código.

## Paso 3: publicar la página (hosting)

Recomendado: **[Vercel](https://vercel.com)** o **[Netlify](https://netlify.com)**
(ambos gratis para este tamaño de proyecto).

- Sube esta carpeta a un repositorio de GitHub.
- En Vercel o Netlify, elige "importar proyecto de GitHub", selecciona el
  repositorio, dale deploy — no necesita configuración especial porque es
  HTML/CSS/JS puro (sin build step).
- Te da un link público (ej. `roster-cliente.vercel.app`) que puedes
  compartir con quien tú decidas.

## Videos desactivados temporalmente / compresión de fotos

En `js/config.js`:

```js
const ALLOW_VIDEO_UPLOADS = false; // true para volver a permitir videos
```

Mientras esté en `false`, el formulario de subida y el botón "Agregar
fotos/videos" solo aceptan imágenes — ayuda a que no se llene el
almacenamiento de Supabase mientras compras más espacio. Los videos que
ya estaban subidos no se tocan.

Además, **todas las fotos que se suban se comprimen automáticamente en
el navegador antes de mandarse** (se ajustan a un máximo de 1600px de
lado más largo y se comprimen a calidad ~85%). En la práctica no se
nota diferencia a simple vista, pero el archivo pesa mucho menos —
esto ya está activo siempre, no hace falta prenderlo. Se puede ajustar
en `js/media-utils.js` (`IMAGE_MAX_DIMENSION` y `IMAGE_JPEG_QUALITY`)
si algún día quieres más o menos compresión.

## Vista previa al compartir un link de modelo (título/foto correctos)

Cuando compartes un link de un modelo en WhatsApp/Telegram/Facebook, esas
apps no ejecutan JavaScript — solo leen el HTML tal como llega del
servidor. Por eso hay una función especial (`netlify/edge-functions/model-meta.js`
+ `netlify.toml`) que arma el título y la vista previa correctos *antes*
de que la página llegue a esas apps, consultando directo a Supabase.

No necesitas configurar nada extra — ya tiene tu URL y llave de Supabase
adentro (las mismas de `js/config.js`). Si algún día cambias de proyecto
de Supabase, actualiza esos dos valores también en ese archivo.

## Links bonitos para cada modelo (opcional, ya activo)

Los modelos que subas **de ahora en adelante** obtienen automáticamente
un link corto tipo:

```
https://tusitio.netlify.app/m/valentina-nova
```

en vez de `model.html?id=a1b2c3...`. Se arma solo a partir del nombre —
no tienes que escribir nada. Si dos modelos se llaman parecido, el
segundo queda como `valentina-nova-2`, automático también.

**Los links viejos (`model.html?id=...`) que ya compartiste siguen
funcionando exactamente igual, para siempre** — no se rompe nada de lo
que ya está afuera. Los modelos que ya tenías subidos antes de este
cambio simplemente no tienen link bonito (se quedan con el link largo),
a menos que los vuelvas a subir.

Esto necesita 3 cosas además del código: el archivo `_redirects` en la
raíz del proyecto, y las columnas nuevas de `schema.sql` corridas en
Supabase (si usas la base de datos real).

## Panel de administrador

Entra por `admin.html` (ej. `tusitio.com/admin.html`). Pide una clave
simple para entrar — cámbiala en `js/config.js`:

```js
const ADMIN_PASSWORD = "tu-clave-aqui";
```

Desde ahí puedes:
- Cambiar el nombre y las etiquetas de cualquier modelo.
- Borrar fotos/videos sueltos.
- Borrar un modelo completo (con todas sus fotos y calificaciones).

**Importante sobre seguridad:** esta clave solo evita que alguien casual
la encuentre — no es una protección robusta como un login de verdad,
porque el sitio no tiene servidor propio todavía. No compartas el link
de `admin.html` públicamente. Cuando agregues login (ver sección de
Supabase Auth arriba), esto se puede reemplazar por una cuenta de
administrador real y quedará mucho más protegido.

Si ya conectaste la base de datos real, asegúrate de haber corrido la
versión más reciente de `schema.sql` — se agregaron los permisos para
editar y borrar (antes solo se podía leer y subir).

## Estructura del proyecto

```
index.html          → página principal (buscador, top modelos, subir)
model.html           → ficha de un modelo (galería, calificación)
admin.html           → panel de administrador (editar/borrar)
css/style.css        → todos los estilos
js/config.js          → aquí van tus llaves de Supabase, Turnstile y la clave de admin
js/media-utils.js     → filtra videos (si están desactivados) y comprime fotos
js/db.js              → toda la lógica de datos (demo y real, en un solo lugar)
js/app.js             → lógica de la página principal
js/model.js           → lógica de la ficha de modelo
js/admin.js           → lógica del panel de administrador
schema.sql            → tablas y permisos para pegar en Supabase
```

## Sobre "quién puede subir" mientras no hay login

Ahora mismo, cualquiera con el link puede subir un modelo — como pediste,
para no bloquear el flujo antes de tiempo. Cuando quieras agregar login:

- Supabase ya trae autenticación integrada (correo/contraseña, Google, etc.),
  no hay que migrar a otra herramienta.
- Solo hay que cambiar las políticas del final de `schema.sql` para exigir
  sesión iniciada antes de insertar, y agregar una pantalla de login.
- Aviso cuando quieras dar ese paso y lo dejamos listo.

## Sobre la detección de nombres repetidos

Al escribir el nombre en "Subir nueva/o", el sistema compara automáticamente
contra los nombres ya existentes (ignora mayúsculas, acentos y pequeñas
diferencias de escritura) y avisa si algo parecido ya existe, con link
directo para abrirlo y agregar las fotos ahí en vez de crear un duplicado.
No bloquea nada raro ni pide pasos extra — es automático como pediste.
