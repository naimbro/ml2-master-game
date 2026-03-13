# Sesion 2: LLMs via API - Base de Conocimiento para Jueces

Este documento contiene el material de referencia que los jueces AI deben usar para evaluar las respuestas de los estudiantes. Solo incluye conceptos efectivamente ensenados en clase.

---

## Marco de la Sesion

### Que se enseno hoy

1. **Uso basico de LLM via API**: Los estudiantes usaron Gemini (google.generativeai) en un notebook. Aprendieron a llamar model.generate_content() con un prompt, iterar sobre un dataset de noticias usando un loop, y obtener clasificaciones simples desde texto.

2. **Guia de innovacion publica**: Aplicacion de los 6 pasos de la guia a proyectos de IA en el sector publico (problema, prefactibilidad, actores/actividades, datos, objetivos).

3. **Riesgos y etica de IA generativa**: Privacidad, justicia, transparencia, evaluacion de impacto algoritmico, criterio de freno (cuando NO implementar).

4. **IA en seguridad**: Pipeline ingesta-procesamiento-accion, riesgos democraticos (opacidad, rezago legal, asimetria de poder, efecto inhibidor/autocensura).

### Que NO se enseno (no premiar si aparece como si fuera obvio)

- Embeddings, cosine similarity, busqueda vectorial
- Pipelines multi-paso complejos (cadenas de LLM)
- Estimacion detallada de costos por tokens
- Comparacion sistematica API vs modelo local/open-source
- Fine-tuning, RAG, function calling
- Despliegue de modelos en produccion
- Monitoreo post-despliegue avanzado (drift, sampling, F1)
- Frameworks como LangChain, DSPy, etc.

### Principio de evaluacion

**Una respuesta simple pero bien encuadrada puede puntuar mas alto que una sofisticada pero desconectada de la clase.** No premiar al alumno mas chamullento; premiar al que entendio donde entra la IA, donde no, y que riesgos trae cuando entra.

### Conexion con la clase anterior

Los estudiantes ya conocen la guia de innovacion publica, que organiza un proyecto en 6 pasos: conformar equipo, describir el problema (personas usuarias, contexto), analizar prefactibilidad (riesgos en multiples ambitos), identificar actores y actividades clave, mapear datos (evaluar madurez), y definir objetivos medibles con linea base. Tambien vieron: procesos de decision, TRL (Technology Readiness Level), limites y guardrails de los LLMs.

---

## 1. LLM via API: Lo Basico (Lo que Vieron en Clase)

### Que es una API de LLM

Una API permite enviar texto a un modelo de lenguaje alojado en la nube y recibir una respuesta generada. En clase usaron Gemini de Google.

### Patron basico del notebook

```python
import google.generativeai as genai

genai.configure(api_key="...")
model = genai.GenerativeModel("gemini-pro")

# Clasificar UNA noticia
response = model.generate_content(f"Clasifica esta noticia: {texto}")
print(response.text)

# Clasificar MUCHAS noticias (loop)
for noticia in noticias:
    response = model.generate_content(f"Clasifica: {noticia}")
    resultados.append(response.text)
```

### Conceptos clave que los estudiantes deben manejar

- **Prompt**: La instruccion que se le da al modelo. Debe ser clara y acotada.
- **Output estructurado**: El resultado util no es "una respuesta bonita", sino campos concretos y usables (tema, categoria, relevancia, etc.).
- **Loop sobre datos**: Aplicar el mismo prompt a muchos textos usando un ciclo. Es el patron basico para escalar de 1 ejemplo a N.
- **El LLM como clasificador/extractor**: En el ejercicio practico, el LLM actua como una funcion que toma texto y devuelve una clasificacion o extraccion.

### Lo que NO necesitan saber aun

- Parametros avanzados (temperature, max_tokens, JSON mode)
- Diferencias de costo entre modelos (GPT-4o vs GPT-4o-mini)
- Anatomia detallada de tokens
- Validacion programatica de outputs (JSON parsing, allowlists)

---

## 2. Guia de Innovacion Publica: Los 6 Pasos

### Paso 1: Conformar el equipo

Reunir personas con roles complementarios (tecnico, de negocio, de atencion).

### Paso 2: Describir el problema

- El problema debe formularse **desde la experiencia de la persona usuaria**, no desde la institucion.
- **No confundir problema con solucion**: "No tenemos chatbot" no es un problema. "Las personas no entienden los requisitos del subsidio" si lo es.
- Identificar: quienes son las personas usuarias, en que contexto estan, que friccion enfrentan.
- La guia da el ejemplo de que a veces no corresponde hacer un chatbot, sino arreglar el servicio o la informacion.

### Paso 3: Analizar la prefactibilidad

Antes de implementar, evaluar riesgos en multiples ambitos:
- **Politico**: Alineamiento con autoridades, prioridad institucional
- **Economico**: Recursos para desarrollo Y para operacion posterior
- **Social**: Aprobacion ciudadana, riesgos eticos (privacidad, justicia, transparencia)
- **Tecnologico**: Datos existentes, capacidad humana, infraestructura
- **Normativo**: Competencias legales, restricciones de datos

Cada ambito donde la respuesta sea "no" indica un tema que debe resolverse antes de seguir.

### Paso 4: Identificar actores y actividades clave

- **Actores**: Personas o roles que participan en el proceso (funcionario de atencion, ciudadano, jefe de area, equipo de contenidos, etc.)
- **Actividades**: Que hace cada actor concretamente (leer reclamos, derivar solicitudes, actualizar informacion, etc.)
- Situar la solucion en UNA actividad especifica de UN actor concreto.

### Paso 5: Mapear datos y evaluar madurez

Los datos son la materia prima. Su madurez debe ser suficiente para realizar el proyecto:
- **Accesibilidad**: Estan en formato digital legible? O son PDFs escaneados, archivos fisicos?
- **Calidad**: Registros completos? Campos vacios, duplicados, inconsistencias?
- **Privacidad**: Requieren anonimizacion? Hay consentimiento para su uso?
- **Documentacion**: Hay descripcion de campos, diccionario de datos?

Si los datos no tienen calidad suficiente, **no partir** — primero limpiar/estandarizar.

### Paso 6: Definir objetivos medibles

- **Objetivo SMART**: Especifico (que mejora concreta), Medible (con que indicador), Alcanzable (realista), Relevante (alineado con mision), Temporal (en que plazo).
- **Linea base**: Medir el estado actual ANTES de implementar. Sin linea base no se puede demostrar mejora.
- Ejemplo malo: "Mejorar la atencion ciudadana con IA"
- Ejemplo bueno: "Reducir el tiempo promedio de derivacion de reclamos de 5 dias a 2 dias en 6 meses"

---

## 3. IA Responsable en el Sector Publico

### Principios transversales (de la guia y la clase)

- **Privacidad**: Proteger datos personales. No enviar datos sensibles a APIs externas sin resguardo.
- **Justicia**: El sistema no debe tratar de forma desigual a personas en situaciones similares. Atencion a sesgos en datos historicos.
- **Transparencia**: Ciudadanos y funcionarios deben saber cuando una decision fue apoyada por IA.

### Ficha de transparencia algoritmica

Documento publico que explica de forma comprensible:
- **Que hace** el sistema (proposito, alcance)
- **Que NO hace** (limites, que no decide)
- **Que datos usa** (tipo de informacion, fuentes)
- **Quien revisa** la salida antes de que llegue al ciudadano
- **Quien es responsable** institucionalmente (no "la IA")
- **Que limitaciones tiene** (puede equivocarse, puede desactualizarse)

Transparencia NO es "publicar el codigo fuente". Es explicar en lenguaje claro para la ciudadania.

### Evaluacion de impacto algoritmico

Antes de pilotear un sistema de IA, preguntar:
- Que pasa si el sistema se equivoca? Que consecuencias tiene para las personas?
- Hay grupos que podrian ser afectados desproporcionadamente?
- Hay revision humana efectiva?
- Los borradores/sugerencias podrian afectar derechos o decisiones sobre beneficios?

### Criterio de "freno" (no-go)

La guia es clara: **no avanzar si faltan condiciones minimas**. Condiciones tipicas de no-go:
- No hay protocolo de resguardo para datos sensibles
- No hay revision humana antes de que la salida llegue al ciudadano
- Los datos disponibles no tienen calidad suficiente
- El sistema pasa a decidir sin supervision
- No hay responsable institucional designado

### Riesgos mas alla de privacidad

- **Sesgo**: El sistema puede reproducir sesgos de datos historicos
- **Opacidad**: Decisiones automatizadas sin explicacion
- **Dependencia cognitiva**: Funcionarios que dejan de pensar criticamente
- **Errores con consecuencias**: En beneficios sociales, salud o justicia, un error afecta directamente a personas

---

## 4. IA en el Aparato de Seguridad

### Pipeline de tres etapas

1. **Ingesta**: Recoleccion de datos (reportes, registros, comunicaciones, fuentes abiertas)
2. **Procesamiento**: Analisis, clasificacion, cruce de informacion — aqui entra el LLM como herramienta de apoyo, no como decisor
3. **Accion**: Decisiones basadas en el analisis — aqui es donde hay mayor riesgo

### El salto critico

La presentacion de clase subraya que la IA no solo permite almacenar mas datos, sino **comprender a escala**. Esto cambia cualitativamente la capacidad del aparato de seguridad: de revisar documentos uno a uno a analizar volumenes que antes eran inabarcables.

### Riesgos democraticos

- **Opacidad**: Criterios de clasificacion no transparentes, no auditables
- **Rezago legal**: La tecnologia avanza mas rapido que la regulacion
- **Asimetria de poder**: El Estado tiene capacidad de analisis que los ciudadanos no pueden verificar ni impugnar
- **Efecto inhibidor (autocensura)**: Si la ciudadania sabe que hay vigilancia con IA, se autocensura — dano a la libertad de expresion incluso sin accion directa

### Controles necesarios

- Revision humana obligatoria antes de cualquier accion sobre una persona
- Trazabilidad completa (que datos se analizaron, que criterios, quien decidio)
- Autorizacion formal antes de pasar de analisis a accion
- No automatizar la cadena completa ingesta-procesamiento-accion
- El LLM prioriza y sugiere; el humano decide y responde

---

## 5. Nivel de Exigencia - Clase 2

### Lo que SI se espera

- Entender que un LLM via API sirve como clasificador/extractor sobre texto
- Saber que el patron basico es: prompt + generate_content + loop para escalar
- Formular un problema desde la persona usuaria, no desde la institucion
- Distinguir problema de solucion (no confundir "no tenemos IA" con el problema)
- Identificar actores concretos y sus actividades en un proceso
- Evaluar si los datos disponibles son suficientes (madurez)
- Formular un objetivo medible con linea base
- Identificar riesgos concretos con grupo afectado
- Proponer revision humana como parte de la solucion
- Entender transparencia como explicacion comprensible, no como jerga tecnica
- Mostrar criterio de "freno" (cuando NO implementar)
- En seguridad: entender el pipeline ingesta-procesamiento-accion y sus riesgos democraticos

### Lo que NO se espera

- Conocimiento detallado de costos por tokens
- Saber comparar modelos (GPT-4o vs GPT-4o-mini vs Llama)
- Disenar pipelines multi-paso complejos
- Conocer embeddings, RAG, fine-tuning, function calling
- Saber desplegar modelos en produccion
- Dominar metricas de evaluacion (F1, precision, recall)
- Conocimiento detallado de normativa chilena de datos personales
- Escribir codigo funcional (solo entender el patron conceptual)

### Heuristica para jueces

Si un estudiante usa tecnicismos no ensenados (embeddings, cosine similarity, pipeline multi-paso, RAG, fine-tuning) como si fueran evidentes, **no premiar** — preguntar si realmente entiende el concepto o lo esta usando como humo. Una respuesta sobria y bien encuadrada en lo visto en clase vale mas que una llena de jargon impresionante pero desconectado.
