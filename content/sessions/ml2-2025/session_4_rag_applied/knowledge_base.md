<!-- section: _always -->
# Base de Conocimiento - Sesion 4: RAG Aplicado

## Marco de la Sesion

### Contexto pedagogico

Esta es la SEGUNDA sesion de RAG. En la sesion 3 se enseno RAG conceptual (chat vs API, corpus, chunking, keyword vs semantico, pipeline, diagnostico). Desde entonces, los alumnos **construyeron un pipeline RAG completo** en 3 notebooks:

- **NB1**: Parsearon 12 documentos del sector publico chileno, extrajeron metadata, vieron limitaciones de keyword search
- **NB2**: Implementaron chunking con overlap, generaron embeddings con Gemini, construyeron retrieval semantico
- **NB3**: Construyeron RAG completo con construccion de prompt, probaron prompts estrictos vs flexibles, experimentaron con top-k, evaluaron calidad de respuestas

### Que se evalua en esta sesion

Se evalua si los alumnos pueden **APLICAR** lo que construyeron: tomar decisiones de diseno, razonar sobre trade-offs, diagnosticar fallas, y evaluar calidad. NO se evalua si recuerdan definiciones — se evalua si entienden POR QUE tomaron cada decision en los notebooks.

### Calibracion para 180 segundos

Rondas de 3 minutos. Se espera respuestas concisas y densas:
- **Level 100** = nails the 3 most important things concisely
- **Level 60** = gets 1-2 right but misses critical trade-off
- **Level 0** = generic/irrelevant
- NO penalizar brevedad. SI penalizar vaguedad.
- NO esperar listas exhaustivas. SI esperar justificacion de cada punto mencionado.

### Que NO se enseno (no premiar si aparece como si fuera obvio)

- Bases vectoriales especificas (Pinecone, ChromaDB, FAISS, Weaviate, Milvus)
- Cosine similarity como formula matematica
- Fine-tuning de modelos de embeddings
- Reranking de resultados
- Query expansion, HyDE (Hypothetical Document Embeddings)
- Agentic RAG, GraphRAG, modular RAG
- Frameworks como LangChain, LlamaIndex, DSPy
- Metricas formales de evaluacion de RAG (faithfulness, answer relevancy, context precision)
- BM25, TF-IDF como algoritmos especificos

### Heuristica para jueces

Si un alumno usa tecnicismos no ensenados como si fueran evidentes, **no premiar**. Una respuesta que dice "chunks grandes diluyen la relevancia porque el LLM recibe temas mezclados" vale mas que "usamos recursive character splitting con chunk_size=512 y cosine similarity threshold de 0.8".

La pregunta clave: **el alumno razona como alguien que CONSTRUYO un RAG, o como alguien que leyo sobre RAG?**

### Conexion con clases anteriores

**Clase 1**: Procesos de decision, TRL, limites y guardrails de LLMs.
**Clase 2**: Gemini via API (generate_content, loop, clasificacion), guia de innovacion publica, riesgos etica IA.
**Clase 3**: RAG conceptual — chat vs API, corpus/metadata, chunking trade-offs, keyword vs semantico, pipeline indexacion/consulta, diagnostico.
**Notebooks 1-3**: Implementacion practica del pipeline RAG completo con documentos reales del sector publico chileno.

<!-- section: chunking, overlap, corpus_preparacion -->
## 1. Chunking: Decisiones de Diseno

### Lo que aprendieron en los notebooks

En NB2, los alumnos implementaron chunking con overlap. Vieron que:
- El tamano del chunk afecta directamente que se recupera
- Chunks muy chicos pierden contexto (un parrafo aislado que referencia otro)
- Chunks muy grandes diluyen la relevancia (el LLM recibe demasiada informacion no relevante)
- Overlap preserva contexto en los bordes entre chunks consecutivos

### Criterio de corte

- **Por estructura documental**: usar la organizacion natural del documento (articulos, secciones, capitulos) como punto de corte — produce chunks semanticamente coherentes
- **Por tamano fijo con overlap**: cuando el documento no tiene estructura clara (prosa continua) — necesita overlap para no perder contexto en los bordes
- **Combinado**: estructura documental cuando existe, tamano fijo para el resto

### Consecuencias de mala eleccion

- **Chunks muy chicos**: el fragmento recuperado no se entiende solo, pierde referencia cruzada entre articulos, el LLM no tiene suficiente contexto para responder
- **Chunks muy grandes**: se recupera un bloque con muchos temas mezclados, el LLM puede usar informacion irrelevante del mismo chunk, diluye precision del retrieval
- **Sin overlap**: informacion que esta en el borde entre dos chunks se pierde — un concepto que empieza al final de un chunk y termina al inicio del siguiente queda partido

### Enriquecimiento del chunk

En NB1-NB2 aprendieron que cada chunk puede llevar:
- **text_for_embedding**: el texto que se convierte en vector (puede enriquecerse con metadata)
- **Metadata**: titulo, seccion, tipo de documento, vigencia
- Enriquecer text_for_embedding con titulo/seccion mejora la calidad del retrieval

<!-- section: embeddings, retrieval_semantico, keyword_search -->
## 2. Embeddings y Retrieval: Limites Practicos

### Lo que aprendieron en los notebooks

En NB2, generaron embeddings con Gemini y construyeron retrieval semantico. En NB1, vieron que keyword search falla cuando el usuario usa sinonimos.

### Cuando falla retrieval semantico

- **Sinonimos lejanos**: "apoyo para jovenes sin empleo" y "intermediacion laboral" — estan en el mismo tema pero con vocabulario muy distinto. Los embeddings pueden no capturar esta conexion
- **Campo semantico compartido**: la query puede estar mas cerca de conceptos relacionados pero incorrectos (ej: "becas" y "subsidios" estan mas cerca de "apoyo" que "intermediacion laboral")
- **Codigos e identificadores**: busqueda semantica no sirve para buscar "Protocolo E-204" — necesita keyword exacto

### Mejoras operacionales (lo que SI pueden proponer)

- **Enriquecer text_for_embedding**: agregar keywords, nombre del programa, categoria al texto que se convierte en embedding
- **Complementar con keyword search**: usar busqueda hibrida (semantico + keyword)
- **Ajustar top-k**: recuperar mas chunks para aumentar probabilidad de incluir el correcto
- **Agregar metadata y filtrar**: filtrar por tipo de programa, area tematica, vigencia antes del retrieval semantico

### Lo que NO es una mejora operacional

- "Mejorar los embeddings" (sin decir como)
- "Usar un mejor modelo" (no es accionable)
- "Hacer fine-tuning" (no se enseno)

<!-- section: pipeline_rag, indexacion_offline, consulta_online -->
## 3. Pipeline RAG: Las 2 Fases

### Lo que confirmaron en los notebooks

En NB1-NB3, implementaron ambas fases:

**Indexacion (offline — se hace una vez o cuando cambia el corpus)**:
1. Preparar documentos: seleccionar, limpiar, extraer texto, agregar metadata
2. Chunking: partir en fragmentos con la estrategia elegida
3. Generar embeddings de cada fragmento (Gemini embedding en NB2)
4. Almacenar embeddings + texto original + metadata

**Consulta (online — cada vez que alguien pregunta)**:
1. El usuario escribe una pregunta
2. La pregunta se convierte en embedding (misma tecnica que los documentos)
3. Se buscan los fragmentos mas cercanos/similares (retrieval — NB2)
4. Los fragmentos recuperados se pasan al LLM junto con la pregunta (NB3)
5. El LLM genera una respuesta basandose en los fragmentos

### Confusion fatal

Pensar que se generan embeddings de los documentos cada vez que alguien pregunta. La indexacion es costosa pero se hace una vez. La consulta reutiliza los embeddings ya almacenados.

<!-- section: instruccion_llm_rag, trazabilidad -->
## 4. Instrucciones al LLM en RAG

### Lo que experimentaron en los notebooks

En NB3, probaron prompts estrictos vs flexibles y vieron la diferencia:

**Prompt vago (malo)**: "Responde la pregunta del usuario con la informacion disponible."
— No limita al modelo, no pide citas, no maneja "no se". El modelo inventa.

**Prompt estricto (bueno)**: "Responde usando UNICAMENTE los fragmentos proporcionados. Cita el documento fuente. Si los fragmentos no contienen la respuesta, indica que no encontraste informacion."
— Limita al modelo, exige citas, maneja incertidumbre.

### Elementos de una buena instruccion RAG

1. **Limitar a fragmentos**: "usa UNICAMENTE/SOLAMENTE la informacion de los fragmentos"
2. **Manejar incertidumbre**: "si no encuentras la respuesta en los fragmentos, di que no tienes informacion suficiente"
3. **Pedir citas**: "cita el documento/fuente/filename de cada afirmacion"
4. **Vigencia** (si aplica): "no uses informacion de documentos marcados como derogados"

### Consecuencias de mala instruccion

- Sin limitar a fragmentos: el LLM inventa requisitos, fechas, montos
- Sin manejar "no se": el LLM siempre responde algo, aunque no tenga base
- Sin citas: imposible verificar de donde viene la informacion — el usuario no puede auditar

<!-- section: diagnostico_rag -->
## 5. Diagnostico: Identificar Fallas

### Lo que practicaron en los notebooks

En NB3, evaluaron calidad de respuestas y vieron cuando el RAG falla.

### Distinguir problemas de retrieval vs generacion

- **Problema de retrieval**: los chunks recuperados no contienen la informacion relevante → el LLM no puede responder bien porque no tiene la materia prima
- **Problema de generacion**: los chunks SI contienen la informacion pero el LLM la ignora, la distorsiona, o agrega informacion inventada → el problema esta en las instrucciones al LLM

### Evaluacion de calidad de una respuesta RAG

Para evaluar si una respuesta es buena:
1. **Evidencia**: que partes de la respuesta estan respaldadas por los chunks recuperados?
2. **Alucinacion**: que partes de la respuesta NO estan en los chunks? (inventadas por el LLM)
3. **Omision**: que informacion importante de los chunks NO aparece en la respuesta?
4. **Alteracion**: que informacion de los chunks fue cambiada sutilmente? (ej: "vigente" → "actualizado")

### Alucinacion en contexto de sector publico

Cuando un RAG de gobierno inventa un requisito, un plazo, o un monto, las consecuencias son concretas:
- El ciudadano busca un documento/formulario que no existe
- El funcionario aplica un criterio incorrecto
- La institucion pierde credibilidad y confianza

### Top-k y calidad

El numero de chunks recuperados (top-k) afecta directamente la calidad:
- **k muy bajo** (ej: 1): puede faltar informacion clave si la respuesta requiere datos de multiples fragmentos
- **k muy alto** (ej: 10): chunks de baja relevancia confunden al LLM, que los toma como fuente valida y puede alucinar detalles combinando informacion de chunks no relacionados
- **Evaluacion practica**: revisar manualmente los chunks recuperados para queries de prueba, verificar que los scores de similitud sean razonables, comparar la respuesta con los chunks para detectar alucinaciones

<!-- section: _always -->
## 6. Nivel de Exigencia para Sesion 4

### Lo que SI se espera (alumno que ya CONSTRUYO un RAG)

- Tomar decisiones de chunking y justificar con consecuencias (no solo saber que existe)
- Diagnosticar por que un retrieval falla y proponer mejoras operacionales concretas
- Escribir instrucciones al LLM que sean concretas, no genericas
- Razonar sobre top-k como trade-off, no como parametro magico
- Distinguir alucinacion de evidencia linea por linea
- Disenar un pipeline coherente end-to-end donde las decisiones sean compatibles entre si
- Conectar decisiones tecnicas con consecuencias para el usuario final

### Lo que NO se espera

- Conocer bases vectoriales especificas (Pinecone, ChromaDB, FAISS)
- Cosine similarity como formula
- BM25, TF-IDF como algoritmos
- Fine-tuning de embeddings
- Reranking, query expansion, HyDE
- RAG agentico, GraphRAG, RAG modular
- Frameworks (LangChain, LlamaIndex)
- Metricas formales de evaluacion (faithfulness, context precision)
- Codigo funcional — se evalua razonamiento, no implementacion

### Heuristica para jueces

La diferencia entre sesion 3 y sesion 4: en sesion 3 bastaba entender conceptos. En sesion 4 se espera **razonamiento de practicante** — alguien que ya tuvo los datos en las manos y sabe que pasa cuando cambia un parametro. Si la respuesta suena a "lei sobre RAG" en vez de "construi un RAG", penalizar en applied_precision.
