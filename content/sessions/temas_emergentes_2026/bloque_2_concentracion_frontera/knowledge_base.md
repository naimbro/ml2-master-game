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

1. **The Economist, "Five men control AI. Who should control them?" (abril 2026).** Cinco personas (Altman, Amodei, Hassabis, Musk, Zuckerberg) toman decisiones que afectan a miles de millones, sin mandato democrático.

2. **The Economist, "Could AI's leading men become as powerful as Ford or Rockefeller?" (18 abr 2026, sección Business — "Tycoon capitalism").** Ranking compuesto de 11 olas tecnológicas en EE.UU. en 150 años, evaluando 5 magnates por ola según revenue, employment, market cap, control corporativo y riqueza personal. Resultados:
   - **#1: Henry Ford** — el magnate más poderoso que ha visto EE.UU. Riqueza >1% del GDP, Ford Motor empleaba 0,15% de la población americana en 1925, control corporativo casi total (compró a minoritarios en 1919, familia dueña entera), 40% de los autos en EE.UU. eran Model T en 1917. "$5-a-day wage" para que sus trabajadores compraran sus autos.
   - **#2: John D. Rockefeller** — Standard Oil, riqueza ~1,5% del GDP estadounidense en su peak.
   - **#4: Jeff Bezos** (Amazon, $2,7T market cap, >1M empleados americanos).
   - **#8: Elon Musk** — pero mayoritariamente por Tesla/SpaceX, no por xAI.
   - **#11: Mark Zuckerberg** — mayoritariamente por Meta/redes sociales, no por IA.
   - **Altman, Amodei, Hassabis: mitad BAJA del ranking** porque (a) model-making requiere pocos clever people + cómputo, los labs tienen pocos workers; (b) ninguno tiene el control corporativo de Ford o Vanderbilt: Altman corre OpenAI "at the pleasure of his board" (lo echaron en nov 2023), Amodei tiene una participación pequeña en el lab que cofundó, Hassabis no es ni el empleado más senior de Google.
   - **Tres patrones históricos**:
     1. Muchos magnates fueron deeply strange (Ford con su Dearborn Independent antisemita; Vanderbilt hablaba con espíritus; Morgan consultaba astrólogos; Edison fanáticamente opuesto al sueño; Jobs con dietas extremas). → Musk con conspiraciones y Zuckerberg con su demeanor robótico "no son tan fuera de lo común".
     2. Las tecnologías introdujeron nuevos peligros: railways crashes financieros; aviación insegura; cars matando peatones; Edison vs Westinghouse (los hombres de Edison hicieron electrocuciones públicas de animales para asustar al público); banking magnificó crisis financieras; railways y cars **automatizaron empleo** (locomoción a caballo desaparece).
     3. Relación magnate-Estado: en el s. XIX magnates tuvieron más latitud (Carnegie reprimió violentamente disturbios laborales; J.P. Morgan funcionó como banco central de facto en el crash de 1907; Andrew Mellon fue Secretario del Tesoro mientras dirigía un imperio industrial).
   - **Tres momentos en que el Estado de EE.UU. frenó a magnates tecnológicos**:
     - **1911**: Corte Suprema disuelve Standard Oil por monopolización (antitrust estructural).
     - **1913**: Congreso crea Federal Reserve para que ningún Morgan vuelva a funcionar de hecho como banco central.
     - **2000**: juez ordena breakup de Microsoft; escapó en apelación pero "chastened" (efecto disciplinante sin breakup).
   - Cierre del artículo: "as AI transforms the economy and society, the people behind it may likewise encounter governments that wish to curb their power... if history is any guide, a Rockefeller or Ford is likely to emerge soon enough".

3. **Contextualización chilena**: Chile NO está en la frontera. Es tomador. Esto cambia el menú de respuesta: las opciones realistas son governance de la dependencia, no liderazgo de la frontera. Y la traducción de los precedentes antitrust de EE.UU. a Chile NO es directa — Chile no tiene la FNE con capacidad para abrir investigaciones de esa escala ni jurisdicción sobre comportamiento global de OpenAI/Anthropic. El camino realista es coalición multilateral (Brasil, México, UE) para que el efecto disciplinante venga de mercados con peso institucional; Chile aporta vocería ética y casos concretos.
