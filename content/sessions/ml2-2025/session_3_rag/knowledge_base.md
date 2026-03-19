# Sesion 3: RAG — Primero Recuperar, Despues Generar - Base de Conocimiento para Jueces

Este documento contiene el material de referencia que los jueces AI deben usar para evaluar las respuestas de los estudiantes. Solo incluye conceptos efectivamente ensenados en clase.

---

## Marco de la Sesion

### Que se enseno hoy

1. **Preparacion de corpus**: Seleccionar, limpiar y organizar documentos antes de indexarlos. No todo se indexa — la curacion es una decision de diseno con consecuencias.

2. **Metadata documental**: Campos que acompanan cada fragmento (tipo de documento, vigencia, fecha, area emisora). Sin metadata, el sistema no puede filtrar ni dar contexto.

3. **Chunking**: Partir documentos en fragmentos para indexar. Trade-offs: chunks chicos pierden contexto, chunks grandes diluyen la relevancia. Overlap (superposicion entre chunks) ayuda a preservar contexto en los bordes. La estructura del documento original importa (articulos, secciones, capitulos).

4. **Embeddings como representacion semantica**: Convertir texto en vectores que capturan significado. Textos con significado similar quedan cerca en el espacio vectorial, aunque usen palabras distintas. Es lo que permite busqueda por significado en vez de por palabra exacta.

5. **Retrieval por similitud**: Dado un query (pregunta), convertirlo en embedding y buscar los fragmentos mas cercanos en la base vectorial. Esto es la "R" de RAG.

6. **Pipeline RAG clasico**: Dos etapas separadas — indexacion (offline, se hace una vez) y consulta (online, cada vez que alguien pregunta). La distincion es fundamental.

7. **Instrucciones al LLM en RAG**: El LLM recibe los fragmentos recuperados y debe responder usando solo esa informacion. La instruccion debe limitar al modelo y pedir citas.

8. **Keyword vs semantico**: La busqueda por keyword busca coincidencia exacta de palabras. La busqueda semantica busca por significado. Son complementarias, no rivales.

### Que NO se enseno (no premiar si aparece como si fuera obvio)

- Implementacion de bases vectoriales especificas (Pinecone, ChromaDB, FAISS, Weaviate, Milvus)
- Cosine similarity como formula matematica
- Fine-tuning de modelos de embeddings
- Reranking de resultados
- Query expansion, HyDE (Hypothetical Document Embeddings)
- Agentic RAG, GraphRAG, modular RAG
- Frameworks como LangChain, LlamaIndex, DSPy
- Metricas de evaluacion de RAG (faithfulness, answer relevancy, context precision)
- BM25, TF-IDF como algoritmos especificos

### Principio de evaluacion

**Una respuesta que conecta cada concepto RAG con una consecuencia concreta para el caso vale mas que una llena de terminologia correcta pero abstracta.** No premiar al alumno que enumera pasos del pipeline de memoria; premiar al que entiende que pasa cuando un paso falla y que consecuencia tiene para el usuario del sistema.

### Conexion con clases anteriores

**Clase 1**: Procesos de decision, TRL, limites y guardrails de LLMs.
**Clase 2**: Uso de Gemini via API (generate_content, loop, clasificacion simple), guia de innovacion publica (6 pasos), riesgos y etica de IA generativa, IA en seguridad.

La clase 3 construye sobre la clase 2: la API que usaron para clasificar texto ahora se usa dentro de un pipeline mas complejo donde el LLM no inventa — responde a partir de documentos recuperados. El concepto clave es que RAG separa la "memoria" (corpus indexado) del "razonamiento" (LLM).

---

## 1. Del Chat al Sistema (Puente con Clase 2)

### Chat vs API: la diferencia operativa

Copiar-pegar texto en ChatGPT:
- **No es repetible**: cada sesion es nueva, el prompt puede variar, no queda registro
- **No es auditable**: no hay log de que se proceso ni con que instruccion
- **No escala**: procesar 200 documentos requiere 200 copiar-pegar manuales
- **No se integra**: el resultado queda en la ventana del chat, no en un sistema

Usar LLM via API (como vieron con Gemini en clase 2):
- **Repetible**: el mismo prompt se aplica a todos los documentos
- **Auditable**: queda registro de que se envio y que se recibio
- **Escalable**: un loop procesa N documentos automaticamente
- **Integrable**: el resultado se guarda en tabla, base de datos o alimenta otro paso

### Relevancia para RAG

RAG requiere procesamiento sistematico (convertir documentos a embeddings, almacenarlos, buscar por similitud). Nada de esto es posible con copiar-pegar en un chat. La API es el paso previo necesario para construir un sistema RAG.

### Riesgo de API externa

Enviar documentos a una API externa implica que salen del perimetro institucional. Para documentos sensibles (contratos, normativa interna, datos personales), hay que evaluar: anonimizacion, acuerdos de confidencialidad con el proveedor, o uso de modelos locales.

---

## 2. Corpus y Metadata

### Seleccion del corpus

No todo se indexa. La decision de que incluir y que excluir es una de las mas importantes del diseno RAG:

- **Incluir**: documentos que los usuarios necesitan consultar y que estan vigentes/actualizados
- **Excluir o separar**: documentos derogados, borradores, material de referencia historica que podria confundirse con normativa vigente
- **Peligro de indexar todo**: si el sistema no distingue vigente de derogado, oficial de borrador, el usuario recibe respuestas que mezclan informacion valida con invalida — y no tiene forma de saber cual es cual

### Metadata: campos minimos

Cada fragmento indexado debe llevar metadata que permita filtrar y dar contexto:

1. **Estado de vigencia**: vigente / derogado / en revision
2. **Tipo de documento**: circular, resolucion, oficio, manual, guia
3. **Fecha de emision o publicacion**
4. Opcionales pero utiles: numero identificador, area emisora, tema/materia

### Por que la vigencia es critica

En contexto normativo, una respuesta basada en norma derogada puede tener consecuencias legales. El funcionario que actua basandose en ella comete un error que puede ser impugnado. La metadata de vigencia permite filtrar documentos derogados en la etapa de retrieval.

---

## 3. Chunking

### Que es y por que importa

Chunking es partir documentos largos en fragmentos mas pequenos para indexar. El tamano y la estrategia de chunking afectan directamente la calidad del retrieval.

### Trade-offs fundamentales

**Chunks chicos** (ej: un articulo aislado):
- Ventaja: precision — se recupera exactamente lo relevante
- Problema: pierde contexto — un articulo que referencia otro queda incompleto
- Ejemplo: "Las excepciones del articulo anterior no aplican cuando..." — sin el articulo anterior, no tiene sentido

**Chunks grandes** (ej: un capitulo completo):
- Ventaja: conserva contexto y relaciones entre partes
- Problema: diluye relevancia — se recupera un bloque enorme donde la parte relevante esta mezclada con temas no relacionados
- Problema adicional: puede exceder la ventana de contexto util del LLM

### Estrategias ensenadas

- **Chunking por estructura documental**: usar la organizacion natural del documento (articulos, secciones, capitulos)
- **Overlap (superposicion)**: incluir parte del chunk anterior y siguiente para preservar contexto en los bordes
- **Agregar contexto al chunk**: incluir el titulo de la seccion/capitulo en cada chunk para que no pierda referencia

### Lo que NO se enseno

- Recursive character splitting, sentence splitting
- Semantic chunking (agrupar por similitud de embeddings)
- Valores optimos de tokens por chunk
- Herramientas especificas de chunking (LangChain text splitters, etc.)

---

## 4. Embeddings y Retrieval Semantico

### Que son los embeddings

Un embedding es una representacion numerica (vector) del significado de un texto. Textos con significado similar producen vectores cercanos, aunque usen palabras completamente distintas.

### Keyword vs semantico

**Busqueda por keyword**:
- Busca coincidencia exacta de palabras
- "licencia postnatal" encuentra documentos con esas palabras exactas
- "permiso para madre despues del parto" NO encuentra "licencia postnatal"
- Util para: codigos, identificadores, numeros de circular, fechas exactas

**Busqueda semantica (por embeddings)**:
- Busca por significado, no por palabras
- "permiso para madre despues del parto" SI encuentra "licencia postnatal"
- Util para: preguntas en lenguaje natural, sinonimos, reformulaciones
- Limitacion: puede devolver documentos tematicamente similares pero con distinto numero/codigo

### Son complementarias, no rivales

Un sistema bien disenado combina ambos metodos:
- Semantico para consultas en lenguaje natural
- Keyword para busquedas exactas (codigos, identificadores, numeros)
- Busqueda hibrida: combinar puntajes de ambos metodos

### Pensamiento critico: no es binario

Si un estudiante dice que busqueda semantica es siempre mejor, no entiende el concepto. Cada metodo tiene fortalezas y debilidades. Reconocer cuando cada uno es apropiado demuestra comprension real.

---

## 5. Pipeline RAG Clasico

### La distincion fundamental: indexacion vs consulta

**Indexacion (offline — se hace una vez o cuando cambia el corpus)**:
1. Preparar documentos: seleccionar, limpiar, agregar metadata
2. Chunking: partir en fragmentos con la estrategia elegida
3. Generar embeddings de cada fragmento
4. Almacenar embeddings + texto original + metadata en base vectorial

**Consulta (online — cada vez que alguien pregunta)**:
1. El usuario escribe una pregunta en lenguaje natural
2. La pregunta se convierte en embedding (misma tecnica que los documentos)
3. Se buscan los fragmentos mas cercanos/similares (retrieval)
4. Los fragmentos recuperados se pasan al LLM junto con la pregunta
5. El LLM genera una respuesta basandose en los fragmentos

### Por que la distincion importa

La indexacion es costosa pero se hace una vez. La consulta es rapida y se hace miles de veces. Confundir las dos etapas (ej: pensar que se generan embeddings de los documentos cada vez que alguien pregunta) revela incomprension del pipeline.

### El LLM en RAG

El LLM NO busca informacion — recibe fragmentos ya recuperados y genera una respuesta a partir de ellos. Su rol es sintetizar y redactar, no buscar.

---

## 6. Instrucciones al LLM en RAG

### Por que importan

Sin instruccion adecuada, el LLM puede:
- Inventar informacion no contenida en los fragmentos (alucinacion)
- No citar fuentes
- Mezclar informacion de fragmentos no relacionados
- Dar respuestas que parecen autoritativas pero no tienen respaldo documental

### Elementos de una buena instruccion

1. **Limitar a fragmentos**: "Responde usando UNICAMENTE la informacion contenida en los fragmentos proporcionados"
2. **Manejar incertidumbre**: "Si los fragmentos no contienen la respuesta, di que no tienes informacion suficiente"
3. **Pedir citas**: "Cita el documento fuente (nombre, numero, seccion) de cada afirmacion"
4. **Vigencia** (si aplica): "Si un fragmento esta marcado como derogado, NO lo uses como fuente vigente"

### Ejemplo de instruccion vaga (mala)

"Responde la pregunta del usuario con la informacion disponible."
— No limita al modelo, no pide citas, no maneja el caso de no encontrar respuesta.

### Ejemplo de instruccion clara (buena)

"Responde la pregunta usando UNICAMENTE los fragmentos proporcionados. Cita el documento fuente de cada afirmacion. Si los fragmentos no contienen informacion suficiente, indica que no encontraste respuesta en la base documental."

---

## 7. Errores Comunes en RAG

### En la preparacion del corpus
- **Indexar todo sin curar**: mezclar documentos vigentes con derogados, borradores con oficiales
- **Sin metadata**: no poder filtrar por vigencia, tipo o fecha
- **Corpus desactualizado**: no re-indexar cuando cambian documentos

### En el chunking
- **Chunks muy chicos**: pierden contexto, fragmentos que no se entienden solos
- **Chunks muy grandes**: diluyen relevancia, mezclan temas no relacionados
- **Sin overlap**: pierden informacion en los bordes de los chunks

### En el retrieval
- **Solo keyword**: no encuentra sinonimos ni reformulaciones
- **Solo semantico**: no encuentra codigos ni identificadores exactos
- **Sin filtro por metadata**: recupera documentos derogados o irrelevantes

### En la instruccion al LLM
- **Instruccion vaga**: el modelo inventa o mezcla
- **No pedir citas**: imposible verificar de donde viene la respuesta
- **No manejar "no se"**: el modelo siempre responde algo, aunque no tenga base

### En la operacion
- **No actualizar el corpus**: nueva normativa no se indexa
- **No mantener vigencia**: normas derogadas siguen en el sistema sin marcarse
- **Sin verificacion humana**: el usuario toma la respuesta RAG como verdad absoluta

---

## 8. Nivel de Exigencia - Clase 3

### Lo que SI se espera

- Entender la diferencia operativa entre chat (copiar-pegar) y API (script)
- Saber por que no se indexa todo: curacion como decision de diseno
- Identificar metadata minima necesaria (vigencia, tipo, fecha)
- Entender trade-offs de chunking con ejemplo concreto
- Distinguir busqueda por keyword de busqueda semantica
- Saber cuando keyword es mejor (codigos, identificadores)
- Describir el pipeline RAG en dos etapas: indexacion (offline) y consulta (online)
- Escribir una instruccion al LLM que limite a fragmentos y pida citas
- Conectar decisiones tecnicas con consecuencias institucionales
- Diagnosticar problemas RAG conectando sintoma con causa
- Priorizar soluciones por riesgo institucional

### Lo que NO se espera

- Conocer bases vectoriales especificas (Pinecone, ChromaDB, FAISS)
- Saber cosine similarity como formula
- Conocer algoritmos de busqueda (BM25, TF-IDF)
- Fine-tuning de embeddings
- Reranking, query expansion, HyDE
- RAG agentico, GraphRAG, RAG modular
- Frameworks (LangChain, LlamaIndex, DSPy)
- Metricas de evaluacion de RAG (faithfulness, context precision)
- Implementar codigo funcional de RAG
- Conocer modelos de embeddings especificos (text-embedding-ada-002, etc.)

### Heuristica para jueces

Si un estudiante usa tecnicismos no ensenados (cosine similarity, FAISS, LangChain, BM25, reranking, HyDE) como si fueran evidentes, **no premiar** — puede ser humo. Una respuesta que dice "los embeddings capturan significado similar" y lo aplica al caso vale mas que una que dice "usamos cosine similarity sobre text-embedding-ada-002 en un indice FAISS" sin conectar con la consecuencia.

La pregunta clave para evaluar es: **el estudiante entiende que pasa cuando una decision de diseno RAG es incorrecta?** No basta saber los pasos — hay que entender las consecuencias.
