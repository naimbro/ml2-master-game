# Bloque 2: Concentración — ¿Quién controla la frontera de la IA? — Base de Conocimiento

<!-- section: _always -->
## Marco general del curso

Curso **Temas Emergentes: IA y Democracia**, Magíster en Economía y Políticas Públicas (MEPP), Universidad Adolfo Ibañez, edición 2026. La pregunta operacional no es "¿es buena o mala la IA?" sino "¿qué diseño institucional permite gobernarla legítimamente?".

El juez NO premia conformidad ideológica. Premia: identificar tensiones reales, mapear actores con potestad y actores sin voz, distinguir legalidad de legitimidad, proponer mecanismos operacionales (no decorativos), ser honesto sobre supuestos.

<!-- section: concentracion_de_poder, soberania_tecnologica, actores_y_asimetrias, captura_estatal -->
## Bloque 2 — Concentración en la frontera

### Pregunta orientadora

Cinco actores (Altman/OpenAI, Amodei/Anthropic, Hassabis/Google DeepMind, Musk/xAI, Zuckerberg/Meta) controlan los modelos frontera. ¿Qué implica esa concentración para la soberanía democrática de un Estado periférico como Chile? ¿Cuál es el mecanismo institucional proporcional a la capacidad real del Estado para gobernar la dependencia?

### Tensión central

**Soberanía nominal vs soberanía efectiva**. Chile puede decidir contratualmente a quién contratar y bajo qué términos. Pero no puede:

- Inspeccionar los pesos del modelo.
- Modificar el modelo para necesidades locales.
- Dejar de depender sin pagar un costo de cambio sustancial.
- Influir en la dirección de desarrollo del modelo siguiente.
- Asegurar continuidad: el proveedor puede discontinuar el modelo unilateralmente.

La soberanía nominal es real (Chile firma o no firma contratos). La soberanía efectiva es ilusoria (las condiciones de fondo las fija el oligopolio).

### Los cinco actores frontera (cf. The Economist, "Five men control AI", abril 2026)

1. **Sam Altman — OpenAI** (con Microsoft Azure como cómputo). ChatGPT >900M usuarios semanales.
2. **Dario Amodei — Anthropic** (con AWS y Google Cloud como cómputo). Claude. Modelo "Mythos" recientemente flagged por capacidad de hacking.
3. **Demis Hassabis — Google DeepMind**. Gemini. Hassabis tiene Premio Nobel.
4. **Elon Musk — xAI**. Grok.
5. **Mark Zuckerberg — Meta**. Llama (modelos abiertos, pero dependientes de infraestructura Meta).

Notas estructurales:
- 3 capas de cómputo concentradas: Microsoft Azure, AWS, Google Cloud.
- Los cinco se conocen entre sí, comparten ex-colaboradores, han fundado y dejado las firmas mutuamente.
- El gobierno de EE.UU. tradicionalmente los dejó autorregularse; eso está cambiando (2026).

### Distinción clave: dependencia de software tradicional vs dependencia de modelo frontera

- **Tradicional (SAP, Oracle)**: un sistema hace UNA función específica. Caro cambiar, pero el sistema reemplazante existe en mercado competitivo. La función no cambia bajo el pie.
- **Modelo frontera (LLM)**: el sistema hace MUCHAS funciones de propósito general (clasificar, redactar, decidir, resumir, traducir). El "mercado competitivo" se reduce a 3-5 firmas. El sistema cambia bajo el pie (versiones, alineamiento, censura, capacidad).

La asimetría no es de grado, es de tipo. Es la diferencia entre depender de una herramienta y depender de un órgano cognitivo de propósito general controlado por otro.

### Capa de modelo vs capa de cómputo

El cuello de botella estructural NO es el modelo (hay varios proveedores), es la **capa de cómputo**: GPUs, data centers, networking. Tres firmas (Microsoft, Amazon, Google) controlan la mayoría del cómputo cloud disponible para entrenar y servir modelos grandes. Una política de "multi-proveedor a nivel API" puede ser ilusoria si los 3 proveedores corren en el mismo cloud.

Un buen mecanismo institucional debe distinguir las dos capas y exigir diversificación en ambas, o reconocer que sin diversificación de cómputo, la diversificación de API es decorativa.

### Tipos de captura en el caso chileno

- **Captura por el proveedor dominante**: si Azure tiene la mayoría de los servicios, OpenAI/Microsoft puede imponer términos.
- **Captura nacional**: un Plan Nacional de Soberanía Algorítmica (USD 280M) captura presupuesto científico que podría tener mayor retorno en otros usos. El "consorcio universidades + CORFO" puede capturar el discurso de soberanía para fines de financiamiento institucional.
- **Captura del bloque dominante**: una alianza latinoamericana liderada por Brasil termina siendo Brasil decidiendo.
- **Captura de la metafora**: discurso de "soberanía algorítmica" usado como cobertura para subsidio doméstico sin auditoría de resultados.

### Actores afectados (no obvios)

- **Funcionarios públicos** que dependen del LLM para procesar volumen: sin voz respecto a la decisión arquitectónica.
- **Beneficiarios atomizados**: la persona que esperó 3 semanas en SENADIS no tiene canal para reclamar al proveedor extranjero.
- **Investigadores chilenos en IA**: pierden capacidad acumulativa cada vez que un modelo se discontinúa; pérdida ilegible para el debate político.
- **Contribuyentes**: pagan los costos de cambio sin tener voz directa (subió 35% el API, la cuenta es del Tesoro).
- **Generaciones futuras**: la dependencia se cristaliza institucionalmente y cuesta más revertir cuanto más se posterga.

### Conceptos clave

- **Oligopolio estructural (vs contractual)**: no es solo concentración de market share, es que las barreras de entrada (cómputo, dato, talento) hacen la concentración auto-sostenible.
- **Asimetría temporal**: el proveedor puede discontinuar modelos en plazos que no permiten ajuste institucional. La asimetría no es solo de poder, es de horizonte.
- **Diversificación contractual ≠ diversificación de poder**: tener contratos con 3 proveedores que dependen del mismo cómputo es una diversificación nominal.
- **Soberanía algorítmica**: concepto útil pero peligroso si se invoca sin asumir costos. Una soberanía aspiracional que no se sostiene financieramente es captura del discurso.

### Errores típicos a penalizar

- "Hagamos un LLM chileno" sin asumir USD 280M y 4 años llegando tarde a una frontera que se mueve cada 6 meses.
- "Cláusula multi-proveedor" sin notar que la capa cloud es cuello de botella.
- Tratar la dependencia como caso de SAP/Oracle (subestima la naturaleza propósito-general).
- "Crear una agencia" sin nombrar a qué organismo existente reemplaza ni a quién rinde cuentas.
- Listar las 3 opciones (A, B, C) sin elegir — el ministro pide un memo, no un seminario.
- Accountability decorativa: transparencia, supervisión, gobernanza sin operacionalizar quién-ante-quién-cuándo-consecuencia.
- Equidistancia: "depende de los costos" sin nombrar qué costo es asumible.

### Lecturas y fuentes ancla del bloque

1. **The Economist (Leader), "Prepare for an AI jobs apocalypse" (14 mayo 2026).** Editorial-ancla del R2 (argumento de los caballos) y R3 (Chile shock). Argumentos clave:

   - **El argumento de los caballos** (R2): incluso si el empleo agregado se mantiene, los humanos podrían volverse "uneconómicos como los caballos en la era del auto". Mecanismo: las firmas de IA suben el precio de la tierra y la energía → los salarios pierden poder de compra → el ingreso fluye eventualmente a los dueños del capital → quienes lo gastan en bienes producidos por IA sobre recursos naturales que ellos monopolizan. El argumento es sobre RENTAS, no empleo agregado — la rebuttal histórica estándar ("siempre se crearon empleos nuevos") no responde esto.
   - **Dato concreto**: Goldman Sachs proyecta que los data centers pasarán de **4,1% del peak power demand estadounidense en 2025 a 8,5% en 2027** — más del doble en dos años.
   - **El argumento del Chile shock / China shock** (R3): "Perhaps 2m Americans lost their jobs between 1999 and 2011 owing to China's entry into the global trading system. That is no worse than a typical month's lay-offs in America's churning labour market. Yet the 'China shock' helped propel Donald Trump to office and led to the highest tariffs since the 1930s." Es decir: el shock económico puede ser modesto pero el shock político enorme — la magnitud económica NO predice la magnitud política.
   - **Asimetría white-collar vs blue-collar**: "The white-collar employees threatened by AI have more political and social clout than factory workers hurt by Chinese competition. Even a small number of lay-offs could provoke a backlash against the technology; furious opposition to new data centres is a hint of what may be to come."
   - **Polling**: 7 de cada 10 americanos creen que la IA hará más difícil encontrar trabajo; casi 1 de cada 3 teme por su propio empleo.
   - **Tres familias de política** (cubiertas en R3 del Bloque 3, NO en este bloque): frenar / compensar / redistribuir vía propiedad. Sentencia central para países como Chile: "countries without AI giants will have to rely on taxes rather than seizing shares in foreign companies."
   - **Cierre operacional**: "Concentrations of rent must be confronted early, before the power of rentiers is too great... If governments wait for conclusive evidence before creating a safety-net, it will be too late. Better to start now."

   **Implicaciones para R2 (argumento de los caballos aplicado a Chile)**:
   - El editorial asume implícitamente que las rentas que se acumulan permanecen en la economía doméstica y son capturables por impuestos nacionales. En EE.UU. esto es cierto: AI firms están constituidas allá, el Tesoro EE.UU. puede gravar profits, land taxes, natural resources.
   - Para Chile las rentas son EXTRANJERAS: el royalty de API a OpenAI/Anthropic sale del país; el peso fiscal chileno captura, a lo más, IVA sobre el servicio. El argumento de los caballos para Chile NO es "los humanos chilenos se vuelven uneconómicos" sino "Chile entero se vuelve uneconómico relativo a la frontera, porque exporta valor sin contraparte".
   - Las externalidades locales (energía, agua, suelo en clusters de data centers chilenos) sí se pagan acá. Las rentas no se capturan acá. Esa es la asimetría país-adoptante.

   **Implicaciones para R3 (Chile shock)**:
   - El editorial sugiere que el estamento más amplificador políticamente NO es el más expuesto técnicamente — los white-collar tienen MÁS clout que los factory workers aun con menos masa.
   - En Chile, el voto profesional urbano (Las Condes, Providencia, Ñuñoa) es decisivo en elecciones presidenciales. Año electoral 2026 (presidencial nov).
   - Los gremios profesionales tradicionales (Colegios) tienen acceso institucional al Congreso. Los medios formadores de opinión están manejados por periodistas que son parte del mismo estamento expuesto.
   - El frame se instala antes que las cifras — pelea por la narrativa es más temprana que pelea por estímulo.

2. **The Economist, "Five men control AI. Who should control them?" (abril 2026).** Referencia de contexto para R1: cinco personas (Altman, Amodei, Hassabis, Musk, Zuckerberg) toman decisiones que afectan a miles de millones, sin mandato democrático. Los modelos frontera dependen de tres capas de cómputo concentradas (Microsoft Azure, AWS, Google Cloud). NOTA: la lectura completa de este artículo es para sesiones posteriores; en R1 los estudiantes solo necesitan el headline factual de la concentración.

3. **Contextualización chilena**: Chile NO está en la frontera. Es tomador. Esto cambia el menú de respuesta: las opciones realistas son governance de la dependencia (R1), análisis honesto de qué rentas se pueden capturar y qué supuestos del debate global no aplican (R2), y anticipación política del shock antes de que se materialice (R3). Año electoral 2026 (presidencial noviembre).
