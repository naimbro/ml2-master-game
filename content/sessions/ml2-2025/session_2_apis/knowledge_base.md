# Sesion 2: LLMs via API - Del Texto al Sistema - Base de Conocimiento

Este documento contiene el material de referencia que los jueces AI deben usar para evaluar las respuestas de los estudiantes. Los estudiantes han recibido este marco conceptual como parte de la segunda clase.

---

## Marco de la Sesion

### Objetivo
Pasar de "usar un LLM" a **disenar sistemas basados en LLM** para el sector publico. La clase cubre como interactuar con LLMs via API, disenar inputs y outputs estructurados, estimar costos, manejar riesgos de privacidad, y construir pipelines multi-paso.

### Principio fundamental
**Un LLM via API no es una solucion, es un componente.** La diferencia entre un prototipo y un sistema operacional esta en el diseno del pipeline completo: que datos entran, como se transforman, que sale, como se valida, y que pasa cuando falla.

### Conexion con la clase anterior
Los estudiantes ya conocen la guia de innovacion publica, que organiza un proyecto en fases: problema (que afecta a personas usuarias), equipo multidisciplinario, prefactibilidad PESTL, mapeo de actores y actividades, evaluacion de madurez de datos, y objetivos SMART con linea base. Esta sesion agrega la capa tecnica de LLMs/APIs, pero cada solucion debe seguir anclada a una **actividad institucional concreta**, un **actor/usuario**, y una **mejora medible**.

### Regla madre
Cada pregunta del juego evalua una capacidad tecnica de LLMs via API, pero obliga al estudiante a situarla dentro de una actividad institucional concreta, un actor/usuario, un riesgo de implementacion y una mejora esperada.

---

## 1. LLMs via API: Conceptos Clave

### Que es una API de LLM
Una API (Application Programming Interface) permite enviar texto a un modelo de lenguaje alojado en la nube y recibir una respuesta generada. Los principales proveedores son:
- **OpenAI** (GPT-4o, GPT-4o-mini): API REST con autenticacion por API key
- **Google** (Gemini): Similar, con integracion a Google Cloud
- **Anthropic** (Claude): Similar, enfocado en seguridad
- **Open source via hosting** (Llama, Mistral): Se despliegan en servidores propios o cloud

### Anatomia de una llamada API
```
Input: prompt (texto) + parametros (temperature, max_tokens, model)
   ↓
API del LLM (procesamiento en servidores del proveedor)
   ↓
Output: texto generado (completion)
```

### Parametros clave
- **model**: Que modelo usar (gpt-4o, gpt-4o-mini, etc.)
- **temperature**: Control de aleatoriedad (0 = determinista, 1 = creativo). Para tareas estructuradas, usar 0-0.3.
- **max_tokens**: Limite de longitud de respuesta
- **response_format**: JSON mode para outputs estructurados
- **system prompt**: Instrucciones de comportamiento persistentes

### Tokens y costos
- Los LLMs procesan texto en **tokens** (fragmentos de ~4 caracteres en ingles, ~3 en espanol)
- **Input tokens**: Lo que envias (prompt + contexto)
- **Output tokens**: Lo que el modelo genera
- Los output tokens son mas caros que los input tokens (tipicamente 2-4x)
- **Ejemplo de precios** (GPT-4o, 2025):
  - Input: ~$2.50 por millon de tokens
  - Output: ~$10.00 por millon de tokens
- **GPT-4o-mini** es ~20x mas barato que GPT-4o, suficiente para clasificacion y extraccion

### Estimacion de costos
Para estimar el costo de un proyecto:
1. Estimar numero de documentos/consultas por mes
2. Estimar tokens promedio por documento (input)
3. Estimar tokens de respuesta (output)
4. Multiplicar por precio por token del modelo elegido
5. Agregar margen (buffer de 30-50% por reintentos y errores)

**Ejemplo**: 50,000 consultas/mes * 500 tokens input * 200 tokens output
- Input: 25M tokens * $2.50/1M = $62.50
- Output: 10M tokens * $10/1M = $100.00
- Total: ~$162.50/mes con GPT-4o (~$8/mes con GPT-4o-mini)

---

## 2. API Comercial vs Modelo Local (Open Source)

### Cuando usar API comercial
- Volumen bajo-medio (< 100,000 consultas/mes)
- No hay datos sensibles o se pueden anonimizar
- Se necesita el mejor modelo disponible (GPT-4o, Claude)
- No hay equipo tecnico para mantener infraestructura
- Prototipado rapido

### Cuando usar modelo local/open source
- Datos altamente sensibles (salud, RUT, datos judiciales)
- Volumen muy alto (costo de API se vuelve prohibitivo)
- Se necesita control total sobre el modelo y los datos
- Regulacion prohibe enviar datos a servidores externos
- Latencia critica (API agrega ~0.5-2 segundos por llamada)

### Modelos open source relevantes
- **Llama 3** (Meta): Excelente rendimiento general, licencia permisiva
- **Mistral/Mixtral**: Buenos para tareas en espanol
- **Phi-3** (Microsoft): Pequenos pero capaces, corren en hardware modesto
- Despliegue: vLLM, Ollama, AWS SageMaker, Google Cloud Vertex AI

### Trade-offs clave

| Dimension | API Comercial | Modelo Local |
|-----------|--------------|-------------|
| Costo inicial | Bajo (pago por uso) | Alto (servidor GPU) |
| Costo a escala | Crece linealmente | Se aplana |
| Privacidad | Datos salen de la organizacion | Datos quedan internos |
| Mantenimiento | Proveedor actualiza | Equipo propio mantiene |
| Rendimiento | Estado del arte | Menor (pero mejorando) |
| Dependencia | Lock-in con proveedor | Autonomia total |
| Latencia | Variable (~1-5s) | Controlable |

---

## 3. Inputs y Outputs Estructurados

### El LLM como funcion
En vez de pensar en el LLM como "un chatbot", pensarlo como una **funcion** que transforma datos:
```
f(input_estructurado) → output_estructurado
```

### Diseno de prompts como ingenieria de sistemas
Un buen prompt para el sector publico incluye:
1. **Rol**: Quien es el LLM en este contexto
2. **Tarea**: Que debe hacer exactamente
3. **Input**: Que datos recibe (con formato)
4. **Output**: Que debe producir (con esquema JSON)
5. **Restricciones**: Que NO debe hacer
6. **Ejemplo**: Un caso resuelto correctamente

### JSON como formato de output
Para tareas de extraccion, clasificacion y scoring, el output debe ser JSON estructurado:
```json
{
  "categoria": "pension_vejez",
  "urgencia": "alta",
  "entidad_mencionada": "AFP Habitat",
  "accion_solicitada": "revision_de_monto",
  "confianza": 0.85
}
```

### Validacion de output
Siempre validar que el output del LLM:
- Tiene el formato esperado (JSON valido)
- Los campos obligatorios estan presentes
- Los valores estan dentro de rangos permitidos (ej: confianza entre 0 y 1)
- Las categorias son de una lista cerrada (allowlist)
- No contiene alucinaciones verificables

---

## 4. Embeddings y Representacion Semantica

### Que son los embeddings
Un embedding es un **vector numerico** (lista de numeros) que representa el significado de un texto. Textos con significado similar tendran vectores cercanos en el espacio vectorial.

### Para que sirven en el sector publico
- **Busqueda semantica**: Encontrar documentos por significado, no solo por palabras exactas
- **Clasificacion**: Agrupar documentos similares automaticamente
- **Deteccion de duplicados**: Encontrar reclamos o solicitudes repetidas
- **Recomendacion**: Sugerir documentos relevantes basados en similitud

### Metricas de similitud
- **Cosine similarity**: La mas usada. Mide angulo entre vectores. Rango: -1 a 1 (1 = identicos)
- **Distancia euclidiana**: Distancia geometrica directa
- Cosine similarity es preferible porque es independiente de la longitud del texto

### APIs de embeddings
- **OpenAI** text-embedding-3-small: Barato, rapido, buena calidad
- **OpenAI** text-embedding-3-large: Mejor calidad, mas caro
- Costo tipico: ~$0.02 por millon de tokens (muy barato comparado con generacion)

### Flujo tipico de busqueda semantica
1. **Indexacion**: Convertir todos los documentos a embeddings y guardarlos en una base vectorial
2. **Consulta**: Convertir la pregunta del usuario a embedding
3. **Busqueda**: Encontrar los K documentos mas cercanos (nearest neighbors)
4. **Presentacion**: Mostrar resultados ordenados por similitud

### Limitaciones de embeddings
- No capturan logica o razonamiento, solo similitud semantica
- Pueden dar falsos positivos con textos que usan las mismas palabras pero significan cosas distintas
- Pueden dar falsos negativos con textos que significan lo mismo pero usan palabras muy distintas
- Calidad depende del idioma (modelos entrenados principalmente en ingles)
- Necesitan actualizarse cuando cambia el corpus

---

## 5. Pipelines Multi-Paso con LLMs

### Que es un pipeline LLM
Un pipeline es una **cadena de pasos** donde el output de un paso alimenta el input del siguiente. Cada paso puede ser una llamada a un LLM, una consulta a base de datos, o una transformacion de datos.

### Patron tipico
```
Documento crudo → [Paso 1: Extraccion] → datos estructurados
                → [Paso 2: Enriquecimiento] → datos enriquecidos
                → [Paso 3: Generacion] → resumen/reporte
```

### Principios de diseno
1. **Cada paso hace una sola cosa**: No pedirle al LLM que haga todo en una sola llamada
2. **Outputs verificables**: Cada paso produce un output que se puede validar
3. **Fallback definido**: Que pasa si un paso falla (reintentar, escalar a humano, usar default)
4. **Costos controlados**: Usar modelos baratos para pasos simples (clasificacion), caros para pasos complejos (generacion)

### Manejo de errores en pipelines
- **Reintentos**: Reintentar con backoff exponencial si la API falla
- **Timeout**: Definir tiempo maximo por paso
- **Validacion intermedia**: Verificar output de cada paso antes de pasar al siguiente
- **Logging**: Registrar input/output de cada paso para debugging
- **Circuit breaker**: Si un paso falla N veces seguidas, detener el pipeline

---

## 6. Privacidad y Gobernanza de Datos con APIs

### Riesgos de enviar datos a APIs externas
- **Datos viajan fuera de la organizacion**: El proveedor puede almacenar o usar los datos
- **Ley de Proteccion de Datos Personales (Chile)**: Datos personales requieren consentimiento y medidas de seguridad
- **Datos sensibles**: Informacion de salud, datos judiciales, RUT, situacion economica
- **Riesgo de filtracion**: Si la API key se compromete, un atacante accede al servicio

### Mitigaciones tecnicas
- **Anonimizacion**: Reemplazar datos personales antes de enviar (RUT → [RUT_ANONIMO])
- **Pseudonimizacion**: Reemplazar identificadores con codigos reversibles
- **API con data residency**: Usar APIs que garanticen que los datos no salen de la region
- **On-premises**: Desplegar modelo localmente (elimina el riesgo)
- **Encriptacion en transito**: Siempre usar HTTPS (las APIs comerciales lo hacen por defecto)

### Gobernanza
- **Politica de uso de IA**: Documento que define que datos se pueden enviar a APIs externas
- **Registro de procesamiento**: Mantener log de que datos se enviaron, cuando, y a que proveedor
- **Evaluacion de impacto**: Antes de implementar, evaluar riesgos de privacidad
- **Acuerdos de procesamiento**: Contrato con el proveedor que especifique tratamiento de datos
- **Auditoria periodica**: Revisar que la politica se cumple

---

## 7. Evaluacion y Monitoreo de Sistemas LLM

### Por que evaluar
Un LLM puede funcionar bien en demos y mal en produccion. La evaluacion sistematica es la unica forma de saber si el sistema realmente sirve.

### Metricas de evaluacion
Para **clasificacion**:
- **Precision**: De los que clasifica como X, cuantos realmente son X
- **Recall**: De los que realmente son X, cuantos clasifica correctamente
- **F1**: Media armonica de precision y recall
- **Accuracy**: Porcentaje total de clasificaciones correctas

Para **extraccion**:
- **Tasa de campos correctos**: Porcentaje de campos extraidos correctamente
- **Tasa de JSON valido**: Porcentaje de respuestas que producen JSON parseable

Para **generacion** (resumenes, respuestas):
- **Fidelidad**: El resumen dice cosas que estan en la fuente original?
- **Cobertura**: El resumen incluye los puntos principales?
- **Coherencia**: El texto generado es legible y logico?

### Baseline
Para evaluar, se necesita un **baseline** (linea base):
- **Gold standard**: Conjunto de ejemplos etiquetados manualmente por expertos
- **Tamaño minimo**: 50-200 ejemplos para clasificacion, 20-50 para extraccion
- **Representatividad**: Los ejemplos deben cubrir la variedad real de casos

### Monitoreo continuo
- **Sampling aleatorio**: Revisar manualmente N% de los outputs semanalmente
- **Deteccion de drift**: Comparar distribucion de categorias actual vs historica
- **Alertas**: Si la tasa de errores sube de un umbral, notificar
- **Feedback loop**: Los usuarios finales (funcionarios) pueden marcar errores

### Que hacer cuando baja la calidad
1. Analizar los casos de error (que tipo de inputs fallan?)
2. Ajustar el prompt (agregar ejemplos, restricciones)
3. Cambiar el modelo (subir de gpt-4o-mini a gpt-4o)
4. Agregar paso de validacion (post-procesamiento)
5. Escalar a revision humana los casos de baja confianza

---

## 8. Analisis de Prefactibilidad PESTL

### Que es PESTL
Antes de implementar una solucion de IA, la guia de innovacion publica pide evaluar riesgos en 5 dimensiones:

- **Politico**: Cambio de autoridades, falta de prioridad politica, oposicion de actores internos o externos
- **Economico**: Presupuesto insuficiente, costo de operacion post-piloto, dependencia de financiamiento externo
- **Social**: Resistencia de funcionarios, impacto en empleo, aceptacion ciudadana, equidad en el acceso
- **Tecnologico**: Capacidad tecnica del equipo, infraestructura disponible, dependencia de proveedores, obsolescencia
- **Legal/Normativo**: Proteccion de datos personales, regulacion sectorial, responsabilidad legal por decisiones automatizadas

### Aplicacion a LLMs via API
Al elegir entre API comercial y modelo local, el analisis PESTL es clave:
- **Legal**: Datos sensibles (salud, RUT, judiciales) enviados a APIs externas pueden violar normativa
- **Economico**: Costo de API crece linealmente vs costo fijo de modelo local
- **Tecnologico**: API no requiere equipo tecnico; modelo local si
- **Social**: Transparencia sobre que datos se procesan y como

---

## 9. IA Responsable en el Sector Publico

### Principios
- **Transparencia**: Los ciudadanos y funcionarios deben saber cuando una decision fue apoyada por IA
- **Trazabilidad**: Cada decision del sistema debe ser auditable (input, output, modelo, fecha)
- **Evaluacion de impacto algoritmico**: Antes de implementar, evaluar posibles danos (sesgos, errores, exclusion)
- **Ficha de transparencia**: Documento publico que describe que hace el sistema, que datos usa, sus limitaciones conocidas, y quien es responsable

### Criterio de "freno" (no-go)
La guia de innovacion publica es clara: **no avanzar si faltan condiciones minimas**. Condiciones tipicas de no-go:
- No hay protocolo de anonimizacion para datos sensibles
- No hay gold standard para evaluar el sistema
- No hay responsable institucional designado
- Los datos disponibles no tienen calidad suficiente
- No hay presupuesto para operacion post-piloto

### Riesgos eticos mas alla de privacidad
- **Sesgo**: El sistema puede reproducir sesgos de datos historicos
- **Opacidad**: Decisiones automatizadas sin explicacion para el ciudadano
- **Dependencia cognitiva**: Funcionarios que dejan de pensar criticamente y solo siguen al sistema
- **Errores con consecuencias**: En salud, justicia o beneficios sociales, un error del LLM puede causar dano directo

---

## 10. Madurez de Datos

### Por que importa
Los embeddings, pipelines y clasificadores solo funcionan si los datos subyacentes tienen calidad suficiente. La guia de innovacion publica evalua madurez en varias dimensiones:

### Dimensiones de madurez
- **Accesibilidad**: Los datos estan en formato digital legible? O son PDFs escaneados, archivos fisicos?
- **Calidad**: Los registros estan completos? Hay campos vacios, duplicados, inconsistencias?
- **Granularidad**: Los datos tienen el nivel de detalle necesario? (ej: "reclamo" vs "tipo de reclamo + empresa + fecha + monto")
- **Integracion**: Los datos estan en un solo sistema o dispersos en multiples planillas/bases?
- **Historia**: Hay datos historicos suficientes para establecer linea base y evaluar mejora?
- **Documentacion**: Hay diccionario de datos, metadata, descripcion de campos?
- **Privacidad**: Los datos requieren anonimizacion? Hay consentimiento para su uso?

### Aplicacion a proyectos LLM
- Para embeddings: las descripciones deben ser texto accesible, con calidad consistente y metadatos asociados
- Para clasificacion: necesitas suficientes ejemplos de cada categoria (no solo las mas frecuentes)
- Para RAG: los documentos fuente deben estar en formato procesable, actualizados, y con autoria clara

---

## 11. Objetivos SMART y Linea Base

### Que es un objetivo SMART
- **Specific**: Que mejora concreta se busca
- **Measurable**: Con que metrica se mide
- **Achievable**: Es realista con los recursos disponibles
- **Relevant**: Esta alineado con la mision institucional
- **Time-bound**: En que plazo se espera ver resultados

### Ejemplo
- Malo: "Mejorar la atencion ciudadana con IA"
- Bueno: "Reducir el tiempo promedio de clasificacion de reclamos de 24h a 2h, manteniendo accuracy ≥85%, en 3 meses"

### Linea base
Antes de implementar, medir el estado actual:
- Tiempo promedio actual de la actividad manual
- Tasa de error actual (si se conoce)
- Volumen de casos procesados
- Satisfaccion de usuarios (si se mide)

Sin linea base, no se puede demostrar que el sistema mejoro algo.

### Metricas de modelo vs metricas de proceso vs metricas de impacto
- **Modelo**: Accuracy, F1, precision, recall (mide si el LLM clasifica bien)
- **Proceso**: Tiempo de procesamiento, tasa de reclasificacion manual, backlog (mide si el proceso mejoro)
- **Impacto**: Satisfaccion ciudadana, cobertura de atencion, tiempo de resolucion (mide si el servicio mejoro)

Un buen sistema debe mejorar las tres, pero al minimo las metricas de modelo y proceso.

---

## 12. Function Calling y Herramientas

### Que es function calling
Capacidad de los LLMs modernos de "llamar funciones" definidas por el desarrollador. El LLM no ejecuta la funcion — solo genera los argumentos correctos, y el sistema los ejecuta.

### Uso en sector publico
- Conectar el LLM a bases de datos internas (consultar estado de tramite)
- Ejecutar busquedas en sistemas existentes (buscar en ChileCompra)
- Invocar APIs de terceros (verificar RUT en SII)
- Calcular costos, fechas, plazos

### Patron
```
Usuario pregunta → LLM decide que funcion llamar → Sistema ejecuta funcion
→ Resultado vuelve al LLM → LLM genera respuesta final
```

---

## Nivel de Exigencia - Clase 2

Esta es la segunda clase. Se espera:
- Comprension de que un LLM via API es un componente de un sistema, no una solucion completa
- Capacidad de disenar inputs y outputs estructurados para tareas concretas
- Conciencia de costos y como estimarlos (orden de magnitud)
- Comprension de trade-offs API vs modelo local, especialmente por privacidad
- Nocion basica de embeddings y su uso para busqueda semantica
- Pensamiento sobre evaluacion y validacion de outputs de LLM
- Aplicacion de estos conceptos a problemas del sector publico chileno
- Capacidad de situar cada herramienta tecnica dentro de una actividad institucional con actor concreto
- Conciencia de riesgos PESTL y criterio de "freno" (cuando NO implementar)
- Nocion de IA responsable: transparencia, trazabilidad, evaluacion de impacto
- Comprension de madurez de datos como precondicion para cualquier solucion
- Formulacion de objetivos medibles con linea base

No se espera aun:
- Saber escribir codigo para llamar APIs
- Conocimiento profundo de arquitecturas de modelos
- Experiencia con despliegue de modelos
- Dominio de herramientas especificas (LangChain, DSPy, etc.)
- Conocimiento detallado de normativa chilena de datos personales (pero si conciencia de su existencia)
