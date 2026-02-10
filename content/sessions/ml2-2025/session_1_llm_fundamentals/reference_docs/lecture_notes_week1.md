# Notas de Clase - Semana 1: Fundamentos de LLMs

*Profesor: Naim Bro*
*Machine Learning II: IA Generativa y Procesos Publicos*

---

## Objetivos de la Clase

1. Entender que son los LLMs y como funcionan a alto nivel
2. Conocer los componentes clave: transformers, tokenizacion, embeddings
3. Identificar riesgos: alucinaciones, dependencia cognitiva
4. Aplicar conceptos a casos del sector publico chileno

---

## 1. De RNNs a Transformers: Un Cambio de Paradigma

### El Problema con las RNNs

Las Redes Neuronales Recurrentes procesaban texto secuencialmente:
- Palabra por palabra, de izquierda a derecha
- Problema: se "olvidaban" de lo que venia antes
- Solucion parcial: LSTM, GRU (memoria a largo plazo)
- Pero seguian siendo lentas (no paralelizables)

### La Revolucion Transformer (2017)

Google introduce "Attention is All You Need":
- **Sin recurrencia**: procesa toda la secuencia en paralelo
- **Self-attention**: cada palabra "mira" a todas las otras
- **Resultado**: modelos mas rapidos y mas capaces

**Analogia**: Es como leer un parrafo completo de un vistazo vs. leer letra por letra.

---

## 2. Anatomia de un LLM

### Tokenizacion: De Texto a Numeros

Los computadores no entienden palabras. Necesitamos convertir texto a numeros.

**Ejemplo practico:**
```
Texto: "El Ministerio debe responder"
Tokens: ["El", " Ministerio", " debe", " responder"]
IDs: [412, 25678, 1234, 8901]
```

**OJO con el espanol:**
- "Constitucion" puede ser 2-3 tokens
- "Pronunciamiento" puede ser 3-4 tokens
- Esto afecta COSTOS cuando usamos APIs

**Ejercicio mental**: Si GPT-4 cobra $0.03 por 1000 tokens, y un documento de 5 paginas tiene ~2000 tokens, cuesta $0.06 procesarlo. 10,000 documentos = $600.

### Embeddings: Significado como Vectores

Una vez tokenizado, cada token se convierte en un vector de numeros que representa su "significado".

**Propiedad magica**: Palabras similares tienen vectores similares.
- vec("rey") - vec("hombre") + vec("mujer") ≈ vec("reina")

**Aplicacion practica**: Busqueda semantica
- Usuario busca: "bonos para adultos mayores"
- Sistema encuentra: "subsidios tercera edad" (misma intencion, diferentes palabras)

### El Mecanismo de Atencion

El "superpoder" de los transformers: cada palabra puede "prestar atencion" a cualquier otra palabra.

**Ejemplo:**
> "El ministro dijo que **el** presentaria el proyecto"

Para saber a que se refiere el segundo "el", el modelo "atiende" a "ministro".

---

## 3. Riesgos y Limitaciones

### Alucinaciones: El LLM Mentiroso

**Definicion**: Generar informacion que suena correcta pero es falsa.

**Ejemplo real de alucinacion:**
> Usuario: "Cual es el numero de la Ley de Transparencia?"
> LLM: "La Ley 20.285 de Transparencia..."
>
> (Correcto en este caso, pero podria inventar "Ley 21.456" si no lo sabe)

**Por que ocurre:**
1. El modelo predice "la siguiente palabra mas probable"
2. No tiene acceso a internet en tiempo real
3. No "sabe" que no sabe

### Estrategias de Mitigacion

1. **RAG (Retrieval-Augmented Generation)**
   - Antes de responder, buscar en documentos oficiales
   - Anclar la respuesta en fuentes verificables

2. **Temperature baja**
   - Temperature = 0: siempre la respuesta mas probable
   - Para informacion legal: usar 0.0 - 0.2

3. **System prompts restrictivos**
   ```
   "Si no estas seguro de la respuesta, di 'No tengo
   informacion verificada sobre esto' y sugiere contactar
   a un funcionario."
   ```

4. **Verificacion humana**
   - Para casos criticos: SIEMPRE revision antes de publicar

---

## 4. APIs vs Open Source: La Decision Estrategica

### Escenario Tipico en Gobierno

> "Queremos un chatbot para ChileAtiende. Tenemos 1 millon de usuarios.
> El presupuesto es limitado. Los datos son sensibles."

### Opcion A: API Comercial (OpenAI, Claude)

**Pros:**
- Funciona en 1 dia
- Mejores modelos disponibles
- Sin infraestructura propia

**Contras:**
- Costo variable (puede explotar con volumen)
- Datos salen de Chile
- Dependencia de empresa extranjera

### Opcion B: Open Source (Llama, Mistral)

**Pros:**
- Control total de datos
- Costo fijo (infraestructura)
- Independencia tecnologica

**Contras:**
- Requiere equipo tecnico
- Modelos menos capaces
- Tiempo de implementacion mayor

### Mi Recomendacion para Sector Publico

**Enfoque hibrido y escalonado:**
1. Prototipo con API comercial (validar caso de uso)
2. Medir volumen real y costos
3. Si volumen alto → evaluar migracion a open source
4. Siempre: datos sensibles en infra propia

---

## 5. Caso Practico: Chatbot del IPS

**Contexto**: Instituto de Prevision Social quiere automatizar consultas sobre pensiones.

**Desafios:**
- 500,000 consultas mensuales
- Informacion legal cambiante
- Usuarios de tercera edad (paciencia, claridad)
- Error = pensionado desinformado

**Solucion propuesta:**
1. **RAG** con base de documentos oficiales actualizada
2. **Claude API** (balance costo/calidad) con fallback a humano
3. **Temperature 0.1** para maxima consistencia
4. **System prompt** que obliga a citar fuente legal
5. **Escalamiento** a humano si confianza < 80%

**Leccion**: La tecnologia es solo parte de la solucion. El diseno del proceso es igual de importante.

---

## Para la Proxima Clase

**Lectura obligatoria:**
- Capitulo 2 del survey de LLMs (APIs y llamadas)

**Preparacion:**
- Crear cuenta en OpenAI o Anthropic
- Jugar con el playground (probar diferentes temperatures)

**Reflexion:**
- En tu institucion, donde podria aplicarse un LLM?
- Que riesgos tendria que considerar?

---

## Glosario Rapido

| Termino | Definicion Simple |
|---------|-------------------|
| Transformer | Arquitectura de red neuronal que procesa texto en paralelo |
| Token | Unidad minima de texto que procesa el modelo |
| Embedding | Vector numerico que representa el significado de un texto |
| Context Window | Cantidad maxima de tokens que el modelo puede "ver" |
| Alucinacion | Cuando el modelo inventa informacion falsa |
| Temperature | Parametro que controla cuan "creativo" es el modelo |
| RAG | Tecnica de buscar informacion antes de generar respuesta |
| Fine-tuning | Entrenar el modelo con datos propios |
