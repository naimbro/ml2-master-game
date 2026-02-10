# Session 1: Fundamentos de LLMs - Base de Conocimiento

Este documento contiene el material de referencia que los jueces AI deben usar para evaluar las respuestas de los estudiantes. Los estudiantes han leido este material como parte de su preparacion para la clase.

---

## Conceptos Clave del Curso

### 1. Arquitectura Transformer

Los transformers son la arquitectura fundamental detras de los LLMs modernos. Introducidos en el paper "Attention is All You Need" (2017), reemplazaron las arquitecturas recurrentes (RNN, LSTM) con un mecanismo de atencion que permite procesar secuencias en paralelo.

**Componentes principales:**
- **Self-Attention**: Permite que cada token "atienda" a todos los otros tokens en la secuencia, capturando dependencias de largo alcance
- **Multi-Head Attention**: Multiples "cabezas" de atencion que capturan diferentes tipos de relaciones
- **Feed-Forward Networks**: Capas densas que procesan la informacion despues de la atencion
- **Positional Encoding**: Inyecta informacion sobre la posicion de cada token en la secuencia

**Tipos de arquitecturas:**
- **Encoder-only** (BERT): Bueno para clasificacion, embeddings
- **Decoder-only** (GPT): Bueno para generacion de texto
- **Encoder-Decoder** (T5, BART): Bueno para traduccion, summarization

### 2. Tokenizacion

Los LLMs no procesan texto directamente - lo convierten en tokens (unidades numericas).

**Metodos de tokenizacion:**
- **BPE (Byte-Pair Encoding)**: Usado por GPT. Combina caracteres frecuentes en subpalabras
- **WordPiece**: Usado por BERT. Similar a BPE pero con criterio diferente
- **SentencePiece**: Trata el texto como secuencia de bytes, agnóstico al idioma

**Implicaciones practicas:**
- Las palabras largas o raras se dividen en multiples tokens
- El espanol puede requerir mas tokens que el ingles para el mismo contenido
- El costo de APIs se calcula por token, no por palabra
- Ejemplo: "Constitución" podria tokenizarse como ["Const", "itu", "ción"] = 3 tokens

### 3. Embeddings

Los embeddings son representaciones vectoriales densas que capturan el significado semantico del texto.

**Caracteristicas:**
- Vectores de alta dimension (768, 1536, etc.)
- Textos con significado similar tienen embeddings cercanos en el espacio vectorial
- Permiten busqueda semantica (no solo por palabras clave)
- Se generan usando la capa encoder de un transformer

**Aplicaciones:**
- Busqueda semantica en documentos
- Clasificacion de texto
- Deteccion de similitud
- Clustering de contenido

**Bases de datos vectoriales:**
- Pinecone, Weaviate, Milvus, pgvector
- Permiten busqueda eficiente de vectores similares (ANN - Approximate Nearest Neighbor)

### 4. Context Window

El context window es la cantidad maxima de tokens que un LLM puede procesar en una sola llamada.

**Limites tipicos:**
- GPT-3.5: 4,096 tokens (~3,000 palabras)
- GPT-4: 8,192 - 128,000 tokens
- Claude 3: 200,000 tokens
- Llama 2: 4,096 tokens (base)

**Estrategias para documentos largos:**
- **Chunking**: Dividir documentos en fragmentos mas pequenos
- **Chunking con overlap**: Fragmentos que se superponen para mantener contexto
- **Summarization**: Resumir secciones antes de procesar
- **Hierarchical processing**: Procesar por niveles (parrafo → seccion → documento)

### 5. Alucinaciones (Hallucinations)

Las alucinaciones ocurren cuando un LLM genera informacion que parece plausible pero es factualmente incorrecta.

**Tipos:**
- **Factuales**: Datos incorrectos (fechas, numeros, nombres)
- **De conocimiento**: Inventar hechos que no existen
- **De referencia**: Citar fuentes que no existen

**Causas:**
- El modelo optimiza para generar texto "probable", no necesariamente verdadero
- Falta de grounding en fuentes verificables
- Presion por dar respuestas completas

**Estrategias de mitigacion:**
- **RAG (Retrieval-Augmented Generation)**: Anclar respuestas en documentos recuperados
- **Temperature baja**: Reducir creatividad/aleatoriedad
- **System prompts restrictivos**: Instruir al modelo a admitir cuando no sabe
- **Verificacion humana**: Revision obligatoria antes de publicar
- **Constrained generation**: Limitar outputs a formatos/valores conocidos

### 6. Temperature y Parametros de Generacion

**Temperature (0.0 - 2.0):**
- Controla la aleatoriedad en la seleccion del siguiente token
- Temperature = 0: Siempre elige el token mas probable (deterministico)
- Temperature = 1: Distribucion normal de probabilidades
- Temperature > 1: Aumenta aleatoriedad, respuestas mas creativas pero menos predecibles
- **Para casos criticos: usar 0.0 - 0.3**

**Top-p (nucleus sampling):**
- Limita la seleccion a tokens cuya probabilidad acumulada suma p
- Top-p = 0.1: Solo considera el 10% superior de tokens probables
- Complementario a temperature

**Max tokens:**
- Limita la longitud de la respuesta generada
- Importante para controlar costos y evitar respuestas excesivamente largas

### 7. API Comercial vs Open Source

**APIs Comerciales (OpenAI, Anthropic, Google):**

Ventajas:
- Modelos de ultima generacion
- Sin necesidad de infraestructura
- Facil de implementar
- Actualizaciones automaticas

Desventajas:
- Costo por token (puede escalar rapidamente)
- Dependencia del proveedor
- Datos salen de tu infraestructura
- Menos control sobre el modelo

**Open Source (Llama, Mistral, Falcon):**

Ventajas:
- Control total sobre datos y modelo
- Costo fijo (infraestructura)
- Posibilidad de fine-tuning
- Sin dependencia externa

Desventajas:
- Requiere expertise tecnico
- Costos de infraestructura (GPUs)
- Mantenimiento y actualizaciones manuales
- Modelos generalmente menos capaces que comerciales top

**Consideraciones para sector publico:**
- Privacidad de datos ciudadanos
- Soberania de datos
- Presupuesto y escalabilidad
- Capacidad tecnica del equipo
- Auditabilidad y transparencia

---

## Respuestas Esperadas por Escenario

### Escenario 1: Chatbot del Servicio Publico

**Una buena respuesta debe:**
- Elegir entre API comercial u open source con justificacion clara
- Proponer RAG como solucion principal para evitar alucinaciones
- Mencionar temperature baja (0.1-0.3) para respuestas consistentes
- Considerar system prompts restrictivos ("si no estas seguro, deriva a un agente")
- Abordar escalabilidad para 10,000 consultas diarias
- Considerar privacidad de datos ciudadanos

**Errores comunes a penalizar:**
- Proponer GPT-4 sin analizar costos (10k consultas/dia = ~$300-1000/dia)
- No mencionar RAG o grounding
- Ignorar la necesidad de fallback humano
- Proponer fine-tuning sin justificar (overkill para este caso)

### Escenario 2: Asistente Legislativo

**Una buena respuesta debe:**
- Explicar que son embeddings en terminos comprensibles
- Describir como los transformers generan embeddings
- Explicar ventaja sobre keyword search (sinonimos, conceptos, intencion)
- Proponer estrategia de chunking para documentos largos
- Mencionar bases de datos vectoriales

**Errores comunes a penalizar:**
- No explicar embeddings de forma clara
- Ignorar el problema del context window con 500k documentos
- Confundir embeddings con el output generado por el LLM
- No mencionar donde se almacenan los embeddings

### Escenario 3: Clasificador de Denuncias

**Una buena respuesta debe:**
- Comparar fine-tuning vs prompting con trade-offs claros
- Calcular costos aproximados (50k denuncias/ano)
- Considerar privacidad de datos sensibles en denuncias
- Evaluar esfuerzo de crear dataset etiquetado para fine-tuning
- Hacer recomendacion justificada

**Errores comunes a penalizar:**
- No hacer analisis de costos
- Ignorar sensibilidad de las denuncias
- Recomendar sin justificar la decision
- No considerar el esfuerzo de crear datos de entrenamiento

### Escenario 4: Sistema de Alerta Temprana

**Una buena respuesta debe:**
- Configurar temperature muy baja (0.0-0.2)
- Explicar que hace cada parametro
- Proponer max_tokens limitado
- Incluir validacion humana obligatoria
- Considerar templates pre-aprobados

**Errores comunes a penalizar:**
- Proponer temperature alta
- No explicar los parametros
- Olvidar revision humana para alertas criticas
- No considerar templates estructurados

---

## Conceptos que los Estudiantes Deben Dominar

1. **Transformers**: Arquitectura, self-attention, tipos (encoder/decoder)
2. **Tokenizacion**: BPE, implicaciones para costos y procesamiento
3. **Embeddings**: Que son, como se usan, bases de datos vectoriales
4. **Context Window**: Limites, estrategias para documentos largos
5. **Alucinaciones**: Causas, tipos, estrategias de mitigacion (especialmente RAG)
6. **Parametros de generacion**: Temperature, top-p, max_tokens
7. **API vs Open Source**: Trade-offs para el sector publico

---

## Nivel de Exigencia

Esta es una clase de postgrado para profesionales del sector publico. Se espera:
- Comprension conceptual solida (no memorización de formulas)
- Capacidad de aplicar conceptos a problemas reales
- Pensamiento critico sobre limitaciones y riesgos
- Consideracion de contexto chileno (presupuesto, capacidades, regulacion)
