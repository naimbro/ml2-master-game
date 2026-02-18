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

## 4. Los Tres Proyectos del Semestre

### Proyecto A: Chatbot Congreso
**Institucion:** Biblioteca del Congreso Nacional
**Problema:** Los ciudadanos quieren entender proyectos de ley pero el lenguaje legislativo es complejo.
**Solucion propuesta:** Chatbot que responde preguntas ciudadanas sobre leyes usando RAG sobre documentos legislativos.
**Desafios tecnicos:** Procesamiento de lenguaje legal, RAG sobre documentos extensos, evaluacion de fidelidad.
**Desafios institucionales:** Precision legal es critica, no puede "inventar" interpretaciones de leyes.

### Proyecto B: RAG IMFD
**Institucion:** Instituto Milenio Fundamento de los Datos
**Problema:** Investigadores necesitan sintetizar informacion de multiples publicaciones academicas.
**Solucion propuesta:** Sistema RAG que permite busqueda semantica y sintesis de papers academicos.
**Desafios tecnicos:** Embeddings para lenguaje academico, evaluacion de calidad de sintesis, manejo de citas.
**Desafios institucionales:** Precision academica, respeto por autoria, actualizacion continua del corpus.

### Proyecto C: RAG YouTube
**Institucion:** Aplicacion abierta
**Problema:** Hay mucho contenido en video sobre politica publica chilena pero no es buscable.
**Solucion propuesta:** Sistema que procesa transcripciones de YouTube y permite busqueda semantica y resumen.
**Desafios tecnicos:** Transcripcion automatica (ASR), chunking de transcripciones, presentacion de resultados con timestamps.
**Desafios institucionales:** Calidad variable de transcripciones, derechos de autor, verificacion de informacion.

---

## 5. Procesamiento de Fuentes de Datos

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
- Honestidad en la auto-evaluacion de preferencias y capacidades

No se espera aun:
- Conocimiento tecnico profundo de ML/NLP
- Experiencia con herramientas especificas
- Dominio de todos los proyectos (por eso se pregunta preferencia)
