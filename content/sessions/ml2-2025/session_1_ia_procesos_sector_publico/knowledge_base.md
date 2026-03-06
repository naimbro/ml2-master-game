# Sesion 1: IA, Procesos y Sector Publico - Base de Conocimiento

Este documento contiene el material de referencia que los jueces AI deben usar para evaluar las respuestas de los estudiantes. Los estudiantes han recibido este marco conceptual como parte de la primera clase.

---

## Marco del Curso

### Objetivo
Machine Learning II es un curso de postgrado para profesionales del sector publico chileno. El foco no es aprender ML como ciencia, sino como herramienta para mejorar procesos de decision en instituciones publicas. Cada proyecto del curso involucra un problema real de una institucion real.

### Principio fundamental
**Antes de pensar en la tecnologia, estructura el problema.** La mayoria de los proyectos de IA en sector publico fracasan no por la tecnologia, sino porque el problema no estaba bien definido, el proceso no estaba mapeado, o no se consideraron las restricciones institucionales.

---

## 1. Procesos de Decision en el Sector Publico

### Que es un "proceso" en este contexto
Un proceso es una secuencia de actividades con inicio y fin identificables que transforma insumos en productos o decisiones. En el sector publico, los procesos relevantes para IA son aquellos donde:
- Hay un volumen alto de casos similares
- Se toman decisiones repetitivas
- Hay informacion estructurable como insumo
- El resultado de la decision es observable y medible

### La "unidad de decision"
Es el actor humano (persona o equipo) que toma la decision operacional que se quiere apoyar con IA. No es "el ministerio" ni "el gobierno" — es una persona con cargo y funcion especifica. Ejemplos:
- El analista de OIRS que clasifica reclamos por urgencia
- El coordinador de cuadrillas que decide a que reclamos responder primero
- El asesor legislativo que busca precedentes para un proyecto de ley

### Resultado medible
Toda intervencion con IA debe tener un resultado medible **antes** de implementar. Si no puedes medir el estado actual (baseline), no puedes saber si la IA mejoro algo. Ejemplos:
- Tiempo promedio de respuesta a reclamos (dias)
- Porcentaje de reclamos clasificados correctamente
- Numero de documentos relevantes encontrados por consulta
- Tasa de escalamiento a revision humana

---

## 2. Technology Readiness Level (TRL)

### Marco TRL adaptado para IA en sector publico
Basado en Lavin et al. (2021) "Technology Readiness Levels for AI", adaptado:

| TRL | Descripcion | Ejemplo en sector publico |
|-----|-------------|--------------------------|
| 1 | Principios basicos observados | "La NLP podria servir para clasificar reclamos" |
| 2 | Concepto formulado | Diseno conceptual del sistema con datos de ejemplo |
| 3 | Prueba de concepto experimental | Prototipo en notebook con datos simulados |
| 4 | Validacion en laboratorio | Piloto con datos reales pero en ambiente controlado |
| 5 | Validacion en ambiente relevante | Prueba con funcionarios reales en un servicio |
| 6 | Demostracion en ambiente relevante | Piloto en produccion en una oficina |
| 7 | Demostracion en ambiente operacional | Operando en produccion con usuarios reales |
| 8 | Sistema completo y calificado | Operando establemente, documentado, con soporte |
| 9 | Operacion probada en produccion | Funcionando >1 ano con mejora continua |

### Error comun con TRL
**No confundir el TRL de la tecnologia generica con el TRL de tu solucion especifica.** GPT-4 tiene TRL 9 como producto. Pero "un chatbot que responde preguntas sobre legislacion chilena usando GPT-4" puede tener TRL 2-3 si solo tienes la idea y un prototipo basico.

### Requisitos para subir de TRL
Para pasar de TRL 4 a TRL 7+, tipicamente se necesita:
- Dataset representativo del dominio real (no datos de ejemplo)
- Integracion con sistemas existentes de la institucion
- Protocolo de evaluacion con metricas definidas
- Plan de manejo de errores y escalamiento humano
- Aceptacion de usuarios finales (funcionarios)

---

## 3. Riesgos No Tecnicos de Implementacion

Los proyectos de IA en sector publico fracasan mas frecuentemente por razones no tecnicas:

### Resistencia organizacional
- Funcionarios que perciben la IA como amenaza a su empleo
- Jefaturas que no entienden la tecnologia y no la priorizan
- Falta de incentivos para adoptar nuevas herramientas

### Riesgos institucionales
- Cambio de gobierno o autoridades que cancela proyectos
- Presupuesto insuficiente para mantenimiento post-piloto
- Incompatibilidad con normativa existente (ej: datos personales)
- Dependencia de un proveedor externo sin transferencia de conocimiento

### Riesgos de datos
- Datos historicos de baja calidad o inconsistentes
- Sesgos en datos historicos que se perpetuan
- Falta de etiquetado o gold standard para evaluar
- Datos sensibles que requieren anonimizacion

---

## 4. Limites de Sistemas de IA en el Sector Publico

### Por que definir limites es parte del diseno
Un sistema de IA bien disenado no solo define que HACE, sino que explicitamente define que NO debe hacer. En el sector publico esto es critico porque:
- Las decisiones afectan derechos ciudadanos
- Hay responsabilidad legal institucional
- La confianza publica es un activo fragil
- Los errores pueden tener consecuencias desproporcionadas

### Tipos de limites
- **Limites duros**: cosas que el sistema NUNCA debe hacer (ej: tomar decisiones legales vinculantes sin revision humana)
- **Limites blandos**: cosas que el sistema debe escalar a un humano (ej: casos ambiguos, outliers)
- **Limites de alcance**: dominios o preguntas fuera del ambito del sistema

### Mecanismos de prevencion (guardrails)
- Human-in-the-loop para decisiones criticas
- Filtros de salida que bloquean respuestas fuera de rango
- Umbrales de confianza: si el sistema no esta seguro, escalar a humano
- Listas permitidas (allowlists) de respuestas validas
- Pedir aclaracion al usuario cuando la consulta es ambigua
- Citar fuente: siempre mostrar de donde viene la informacion
- Fallback a humano cuando la consulta esta fuera del dominio
- Logging obligatorio de todas las decisiones para trazabilidad
- Auditorias periodicas de decisiones automatizadas
- Botones de panico / kill switch

### Anti-alucinacion
Los sistemas RAG/chat en sector publico tienen un riesgo critico: **fabricar informacion que parece correcta pero no lo es**. Estrategias concretas:
- Solo responder con datos que existan en la base de conocimiento
- Si la consulta no matchea ninguna fuente, responder "no encontre esa informacion" en vez de inventar
- Citar texto literal de la fuente, con link al documento original
- Verificar respuestas contra base de datos oficial antes de mostrar al usuario
- Disclaimer visible: "esta informacion es orientativa, consulte en oficina"

---

## 5. Las Seis Familias de Problemas del Semestre

### Familia 1: Monitoreo de entorno publico
**Que hace:** Vigilancia automatizada de fuentes legislativas, medios de comunicacion y redes sociales para detectar temas relevantes para una institucion.
**Ejemplo:** Sistema que alerta a un ministerio cuando un proyecto de ley relevante avanza en el Congreso, o cuando un tema institucional se vuelve trending en redes.
**Desafios clave:** Volumen de datos, filtrado de ruido, definicion de "relevante", actualizacion en tiempo real.
**Tecnologias involucradas:** Web scraping, NLP para clasificacion y resumen, alertas automatizadas.

### Familia 2: Voz ciudadana & OIRS
**Que hace:** Procesamiento masivo de reclamos, consultas y sugerencias ciudadanas para generar sintesis accionables.
**Ejemplo:** Sistema que lee miles de reclamos OIRS, los agrupa por tema, detecta tendencias y genera un reporte semanal para el director del servicio.
**Desafios clave:** Lenguaje coloquial, multiples canales, categorizacion consistente, privacidad.
**Tecnologias involucradas:** NLP para clasificacion, clustering, generacion de resumenes.

### Familia 3: Atencion al ciudadano (chat/RAG)
**Que hace:** Chatbots que responden preguntas ciudadanas sobre tramites, leyes o servicios publicos usando documentos oficiales como fuente.
**Ejemplo:** Chatbot para la Biblioteca del Congreso Nacional que responde preguntas sobre proyectos de ley en lenguaje ciudadano.
**Desafios clave:** Precision legal es critica (no puede inventar), lenguaje accesible, cobertura de preguntas, escalamiento a humano.
**Tecnologias involucradas:** RAG, embeddings, diseno conversacional, evaluacion de fidelidad.

### Familia 4: Gestion de conocimiento institucional
**Que hace:** Sistemas RAG internos para buscar y sintetizar documentos institucionales (informes, normativa, investigaciones).
**Ejemplo:** Sistema para un instituto de investigacion que permite buscar y sintetizar hallazgos de multiples papers y reportes internos.
**Desafios clave:** Heterogeneidad de formatos, precision academica/tecnica, actualizacion del corpus, respeto por autoria.
**Tecnologias involucradas:** RAG, embeddings, procesamiento de PDFs, evaluacion de calidad de sintesis.

### Familia 5: Compliance & procesos internos
**Que hace:** Automatizacion de revision de compras publicas, transparencia, contratos o procesos juridicos internos.
**Ejemplo:** Sistema que revisa automaticamente ordenes de compra para detectar irregularidades o incumplimientos de normativa.
**Desafios clave:** Precision legal, auditabilidad, integracion con sistemas existentes (ChileCompra, etc.), false positives.
**Tecnologias involucradas:** NLP para documentos legales, clasificacion, deteccion de anomalias.

### Familia 6: Priorizacion / triage de casos
**Que hace:** Sistemas que ayudan a priorizar fiscalizaciones, inspecciones o asignacion de recursos segun riesgo.
**Ejemplo:** Sistema para una superintendencia que prioriza que empresas fiscalizar primero basandose en indicadores de riesgo.
**Desafios clave:** Sesgo en datos historicos, explicabilidad de priorizacion, consecuencias de falsos negativos, equidad.
**Tecnologias involucradas:** ML para scoring de riesgo, feature engineering, dashboards de decision.

### Mapeo de proyectos anteriores
- **Chatbot Congreso** → Familia 3 (Atencion al ciudadano)
- **RAG IMFD** → Familia 4 (Gestion de conocimiento institucional)
- **RAG YouTube** → Componentes absorbidos en Familias 1 y 2 (monitoreo + voz ciudadana)

---

## 6. Caso INE: Chatbot de Datos Estadisticos

El Instituto Nacional de Estadisticas (INE) es la fuente oficial de datos estadisticos de Chile. Un chatbot del INE que responde consultas en lenguaje natural tiene un riesgo critico: **si entrega un dato incorrecto, puede afectar decisiones de politica publica, reportajes periodisticos, o investigacion academica**. La credibilidad del INE como fuente oficial es un activo institucional que un error publico puede erosionar.

### TRL del chatbot INE
Un prototipo que funciona con algunos indicadores pero falla con preguntas ambiguas esta en TRL 3-4 (prueba de concepto con datos reales, pero no validado en ambiente operacional). Para llegar a TRL 7+:
- Necesita benchmark de consultas reales con respuestas validadas por el equipo del INE
- Integracion con la API oficial de datos del INE
- Monitoreo de queries fallidas y mecanismo de feedback
- Protocolo de gobernanza: quien aprueba cambios al modelo

### Anti-alucinacion en el caso INE
- Solo responder con series que existan en la base de datos oficial
- Si la consulta no matchea, responder "no encontre esa serie" (no inventar)
- Mostrar fuente, fecha de actualizacion y metodologia de cada dato
- Nunca interpolar ni extrapolar datos sin advertirlo explicitamente

---

## 7. Procesamiento de Fuentes de Datos

### Tipos de fuentes comunes en sector publico
- **PDFs:** Requieren extraccion de texto (PyPDF, pdfplumber), posiblemente OCR si son escaneados. Chunking por secciones o capitulos.
- **Emails/circulares:** Parseo de metadata (fecha, remitente, asunto), limpieza de headers/firmas, chunking por documento.
- **Excel/CSV:** Conversion a formato estructurado, posible enriquecimiento con contexto, mapeo campo-por-campo.
- **Documentos legales:** Estructura jerarquica (articulos, incisos), referencias cruzadas, versionado temporal.

### Tipos de retrieval
- **Keyword search:** Busca coincidencias exactas de palabras. Bueno para codigos, numeros de circular, nombres propios.
- **Semantic search:** Usa embeddings para encontrar documentos conceptualmente similares. Bueno para preguntas abiertas.
- **Hibrido:** Combina ambos. Generalmente la mejor opcion cuando hay mezcla de consultas exactas y abiertas.

### Metricas de evaluacion (mas alla de precision)
- Tiempo promedio hasta encontrar respuesta
- Tasa de escalamiento a revision humana
- Satisfaccion de usuario (encuesta)
- Cobertura: porcentaje de preguntas que el sistema puede responder
- Coherencia entre fuentes cuando hay informacion contradictoria

---

## Nivel de Exigencia - Clase 1

Esta es la primera clase. Se espera:
- Capacidad de estructurar un problema antes de proponer tecnologia
- Identificacion de actores y decisiones concretas
- Comprension basica de TRL y su aplicacion
- Pensamiento sobre riesgos no tecnicos
- Capacidad de definir limites de un sistema de IA
- Honestidad en la auto-evaluacion de preferencias y capacidades

No se espera aun:
- Conocimiento tecnico profundo de ML/NLP
- Experiencia con herramientas especificas
- Dominio de todas las familias (por eso se preguntan preferencias)
