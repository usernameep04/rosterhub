/*
  CONFIGURACIÓN
  =============
  Mientras estos dos valores estén vacíos, el sitio funciona en modo DEMO:
  guarda todo en tu navegador (localStorage), no necesitas crear nada.
  Sirve para probar el diseño y el flujo completo ahora mismo.

  Cuando quieras que la información se comparta entre todos (no solo en tu
  navegador) y quede guardada de verdad, sigue las instrucciones del
  archivo README.md para crear tu proyecto gratuito en supabase.com,
  y pega aquí la URL y la llave "anon public" que te den.
*/

const SUPABASE_URL = "https://mbuabdwfncctdnrizyzj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_LKA_eYIeH-pJDDYHWRvSBA_yfPWH8wR";

const ADMIN_PASSWORD = "Brian-0824";

const COMMUNITY_URL = "";

/*
  SUBIDA DE VIDEOS
  =================
  Ponlo en "false" para permitir solo fotos por ahora (por ejemplo,
  mientras compras más espacio de almacenamiento en Supabase). Los
  videos que ya se subieron antes NO se borran — esto solo afecta las
  subidas nuevas. Cuando quieras volver a permitir videos, ponlo en
  "true" otra vez.
*/
const ALLOW_VIDEO_UPLOADS = false;

