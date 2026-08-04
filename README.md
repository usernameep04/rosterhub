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

## Estructura del proyecto

```
index.html          → página principal (buscador, top modelos, subir)
model.html           → ficha de un modelo (galería, calificación)
css/style.css        → todos los estilos
js/config.js          → aquí van tus llaves de Supabase
js/db.js              → toda la lógica de datos (demo y real, en un solo lugar)
js/app.js             → lógica de la página principal
js/model.js           → lógica de la ficha de modelo
schema.sql            → tablas para pegar en Supabase
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
