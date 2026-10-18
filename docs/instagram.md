# Conexión con Instagram

Esta guía deja a Marketing actualizándose solo. Se hace una vez.

## Qué se carga solo

Una vez al día el servidor consulta Instagram y guarda:

- Cada publicación con su alcance, me gusta, comentarios, envíos, guardados y vistas.
- Los seguidores del día, que permiten calcular el crecimiento mensual.
- El alcance y las interacciones de la cuenta por día.
- El resumen del mes, que se calcula en la página con esos datos diarios y alimenta el semáforo.

Lo que Instagram no sabe lo escribe el equipo: a qué evento pertenece cada publicación, las menciones en medios y los pedidos de cada acta.

## Orden de los pasos

El orden importa. Si se despliega la página antes de ejecutar el SQL, aparece un aviso rojo de datos que no cargaron.

### 1. Base de datos

En Supabase, abre SQL Editor, pega el contenido de `supabase/002_instagram_publicaciones.sql` y ejecútalo completo. Es seguro ejecutarlo más de una vez.

### 2. Cuenta de Instagram

La cuenta de Cinergia debe ser profesional, de tipo empresa o creador. Se cambia en Instagram, Configuración, Tipo de cuenta. No hace falta una página de Facebook.

### 3. Aplicación en Meta

1. Entra a developers.facebook.com con la cuenta personal de quien administra el Instagram.
2. Crea una aplicación de tipo Business.
3. En el panel de la aplicación abre Instagram, Configuración de la API con inicio de sesión de Instagram.
4. Agrega la cuenta de Cinergia. Si pide aceptar una invitación de tester, acéptala desde la app de Instagram.
5. Pulsa Generar token y copia el valor. Dura 60 días y el servidor lo renueva solo.

Al ser la propia cuenta de la asociación, no hace falta pasar por la revisión de Meta.

### 4. Servidor en Render

En el servicio de Render agrega la variable `CRON_SECRET` con un valor largo y al azar. Se genera con `openssl rand -hex 32`. Guarda y deja que redespliegue.

### 5. Programación diaria en GitHub

En el repositorio, Settings, Secrets and variables, Actions, crea dos secretos:

- `API_URL` con la dirección del servidor de Render, sin barra final.
- `CRON_SECRET` con el mismo valor del paso anterior.

El archivo `.github/workflows/instagram-sync.yml` ejecuta la actualización todos los días a las 6 de la mañana de Lima. También se puede lanzar a mano desde la pestaña Actions.

### 6. Conectar la cuenta

Entra a la página como SuperAdmin, abre Analítica de Marketing, pulsa Conectar Instagram, pega el token y confirma. La primera carga trae las últimas 100 publicaciones y 30 días de métricas de la cuenta.

El token se pega solo en esa ventana. No lo envíes por chat ni correo.

## Cómo se usa día a día

- Los seguidores y las métricas se actualizan solos cada mañana. El botón Actualizar ahora fuerza una carga.
- Para una publicación nueva no hace falta registrar nada. Aparece sola. Para indicar a qué evento pertenece, toca su fila en la tabla de publicaciones.
- Para planificar el calendario editorial, usa Registrar publicación con estado Planificada y la fecha prevista.
- Las menciones en medios se anotan en Métricas del mes.
- En el cierre de cada evento se cargan inscritos, participantes, encuesta, meta del acta y por qué medio se enteraron. Eso alimenta el embudo de difusión a asistencia.

## Cómo se arma el resumen mensual

- Seguidores del mes: el último dato diario del mes.
- Alcance e interacciones del mes: suma de los días, solo si el mes tiene todos sus días cargados hasta ayer. Si falta alguno, se usa lo escrito en Métricas del mes. El alcance mensual es la suma del alcance diario, que cuenta cuentas únicas por día, así que sale mayor que la cifra mensual que muestra Meta.
- Publicaciones realizadas y planificadas: se cuentan desde el registro de publicaciones. Si el mes no tiene ninguna, se usa lo escrito a mano.
- Menciones en medios: siempre se anotan a mano.
- El cumplimiento del calendario tiene tope de 100 %.

## Qué puede fallar

- El acceso vence si pasan más de 60 días sin que corra la actualización. La página avisa cuando quedan 10 días o menos. Se soluciona generando un token nuevo y pegándolo en Conectar Instagram.
- Las cifras de Instagram pueden tardar hasta 48 horas en consolidarse, por eso las métricas de la cuenta de los últimos días se recalculan en cada carga.
- Instagram solo entrega métricas de las publicaciones de la cuenta conectada. No incluye historias.
- Si una publicación no admite alguna métrica, por ejemplo vistas en imágenes, esa cifra queda vacía y el resto se guarda.
- El servidor gratuito de Render se duerme. La programación diaria reintenta hasta que despierta.
