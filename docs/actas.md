# Lectura de actas

El servidor lee actas en formato `.docx` o `.pdf`. Reconoce el tipo por el contenido, no por el nombre del archivo. Cada tipo aporta datos distintos y ninguno se completa con valores inventados. Si un dato no está en el acta, queda vacío.

## Tipos reconocidos

### Acta de evento

Área Eventos. Se lee:

- Título, responsable, fecha, sede o modalidad y aforo.
- Resumen y objetivo general.
- Presupuesto, tomado de la fila TOTAL.
- Metas, de la tabla de métricas o de los objetivos con porcentaje.
- Riesgos con su mitigación.
- Plan de difusión como piezas de comunicación. Solo se crean si el evento aún no ocurrió.

No contiene resultados. La asistencia real, la satisfacción y la fecha real se registran al cierre del evento.

### Acta de constitución de proyecto

Área Proyectos. Se lee:

- Nombre, líder y fecha de inicio.
- Objetivo general, metas y criterios de éxito.
- Riesgos.
- Fases con su fecha, que pasan a ser hitos. Una fase sin fecha confirmada queda sin fecha límite.

Una fase marcada como en curso indica que las anteriores ya terminaron. Ese dato se deduce del acta y se avisa al cargarla.

### Carta, convenio o propuesta de alianza

Área Gestión de Oportunidades. Se lee:

- Aliado, tipo de documento y fecha de suscripción.
- Vigencia, cuando el texto indica hasta qué fecha rige.
- Compromisos de cada parte, que se guardan sin fecha límite porque el documento no las trae.

Se descartan correos, teléfonos y números de documento.

## Reglas generales

- Un archivo con el mismo contenido que otro ya cargado no se registra de nuevo.
- Un acta de un proyecto existente actualiza sus datos y conserva su etapa.
- Los compromisos se comparan por descripción. Los nuevos se agregan, los pendientes se actualizan y los completados no se tocan.
- Los avisos de lectura, como un día de la semana que no coincide con la fecha, se muestran al subir el acta.
- Las plantillas sin completar y los formatos que no se reconocen se rechazan con el motivo.
- El modo estricto rechaza las actas sin responsable.

## Carga inicial

`Ingestor/actas_vigentes.txt` lista las actas vigentes. La etapa se toma de la carpeta de origen: Culminados es Finalizado, ACTAS EN APROBACIÓN es Aprobación Directiva, Activos es Ejecución Activa. En los demás casos se usa la que sugiere el acta. Para fijar otra etapa se escribe `ruta | Etapa` en la línea.

Los borradores, plantillas, propuestas en revisión y archivos de trabajo no se incluyen en la lista.
