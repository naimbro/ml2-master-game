# Sesion DEMO: IA y Democracia — Base de Conocimiento

Este es el material de referencia que los jueces AI usan para evaluar las
respuestas de la sesion demo. La base esta seccionada con marcadores
`<!-- section: tag1, tag2 -->` para que el motor solo entregue al juez
las secciones relevantes a los `conceptTags` del escenario en curso.
Las secciones marcadas `_always` se incluyen siempre.

---

<!-- section: _always -->
## Marco general del curso

Este es el curso **IA y Democracia** del Minor en IA de la Universidad
Adolfo Ibanez, edicion 2026. No es un curso tecnico ni un curso de
ciencia politica clasica. Es un curso operacional sobre como las
sociedades democraticas pueden gobernar — y ser gobernadas por —
sistemas de IA, sin que la respuesta sea trivial ni en favor ni en
contra de la tecnologia.

### Tesis del curso (sintesis del syllabus)

1. La IA puede ser tanto **amenaza** como **respuesta** para la
   democracia. El curso atraviesa primero las amenazas (unidades 2-4)
   y luego las respuestas posibles (unidades 5-6).
2. La pregunta operacional no es "es buena o mala la IA?", sino
   "**que diseno institucional permite gobernarla legitimamente?**".
3. Identificar la tension democratica concreta es mas valioso que
   "resolverla". Soluciones aparentemente limpias suelen esconder
   asimetrias de poder y supuestos no examinados.

### Postura evaluativa

El juez NO premia conformidad ideologica con el profesor. Premia:
- nombrar tensiones reales en lugar de evadirlas con tecnicismo;
- mapear actores con potestad y actores sin voz;
- distinguir legalidad de legitimidad;
- proponer mecanismos operacionales (no decorativos);
- ser honesto sobre supuestos y trade-offs.

---

<!-- section: dilema_democratico, deepfakes_electorales -->
## Deepfakes electorales: marco minimo

### Tension central
Hay una tension irreducible entre **libertad de expresion** y
**proteccion del proceso electoral**. Resolverla con un solo principio
("siempre prevalece la libertad de expresion" o "siempre prevalece la
integridad electoral") es ingenuo. La tension se administra, no se
resuelve.

### Asimetrias temporales
El dano de un deepfake viral en periodo de campana se acumula en
**horas**. Los procesos institucionales de revision (judicializacion,
revision por organismo electoral) operan en **dias o semanas**. Esta
asimetria temporal favorece quien produce el contenido y desfavorece
a quien debe responder. Cualquier diseno institucional debe abordar
esto explicitamente.

### El problema de "los votantes"
"Los votantes" no son un actor unitario. Quienes ven el contenido viral
no son los mismos que veran la rectificacion. Quienes deciden su voto
en base al contenido no son los mismos que confian en la institucionalidad
para resolver. Hablar de "informar a la ciudadania" sin distinguir
audiencias es un error operacional.

### Plataformas privadas como arbitros
Las plataformas (X, Meta, etc.) toman decisiones que afectan procesos
democraticos sin tener mandato democratico. Esto crea una tension entre
la **libertad de empresa privada** (terminos de servicio) y la
**legitimidad democratica** de quien arbitra el espacio publico digital.

### Marco regulatorio chileno (estado actual)
- El **Servicio Electoral (Servel)** tiene competencia limitada sobre
  contenido electoral en redes sociales.
- El **Tribunal Calificador de Elecciones (TCE)** resuelve reclamaciones
  pero su tiempo de respuesta no se adapta al ciclo de viralidad digital.
- No hay ley vigente equivalente a la **Digital Services Act (DSA)** de
  la UE que obligue a las plataformas a contar con procedimientos de
  remocion expedita en periodo electoral.

### Riesgos de regulacion mal disenada
- **Captura del regulador**: si la decision queda en una sola autoridad
  con discrecionalidad alta, hay riesgo de uso politico.
- **Censura preventiva**: bloqueos automatizados sin debido proceso
  generan dano colateral mayor que el del contenido original.
- **Asimetria entre candidatos**: candidatos con recursos legales
  pueden usar la regulacion ofensivamente para silenciar criticos.

---

<!-- section: accountability_algoritmica, actores_y_asimetrias, rendicion_de_cuentas -->
## Accountability algoritmica en servicios publicos: marco minimo

### Que es accountability "operacional" (no decorativa)
Un mecanismo de rendicion de cuentas operacional tiene cuatro
elementos identificables:

1. **Quien rinde cuentas**: el actor con potestad sobre la decision
   (no "el sistema" ni "el algoritmo" — alguien con responsabilidad
   institucional).
2. **Ante quien**: el organo o instancia que tiene la facultad de
   imponer consecuencias. No es el publico general en abstracto.
3. **Con que frecuencia y formato**: trimestral, semestral, anual;
   reporte estructurado con metricas verificables.
4. **Con que consecuencia**: si la rendicion muestra falla, que pasa.
   Sin consecuencia, la accountability es decorativa.

### Asimetrias estructurales en servicios publicos automatizados
- **Empresa proveedora vs. Estado**: la empresa controla el modelo,
  el Estado lo despliega. Si el Estado depende del sistema para sus
  metricas internas (eficiencia, productividad), la empresa adquiere
  poder asimetrico para imponer condiciones contractuales.
- **Servicio vs. ciudadanos rechazados**: cuando el sistema rechaza
  o filtra solicitudes, los rechazados no son una muestra aleatoria.
  Quienes insisten son selectivamente quienes tienen tiempo, redes o
  capital cultural. Quienes no insisten quedan invisibles para las
  metricas internas del servicio.
- **Jefatura del servicio vs. Estado central**: la jefatura puede
  capturar metricas internas (definir "exito" como "tiempo de respuesta"
  cuando el rechazo rapido es respuesta).

### Metricas capturables vs. metricas de mision
- **Tiempo de respuesta**: facilmente capturable. Un rechazo en 1
  segundo cuenta como respuesta. Bajar el tiempo no implica mejor
  servicio.
- **Tasa de derivacion correcta**: requiere muestra revisada por
  humano para ser verificable; mas dificil de capturar pero requiere
  inversion en revision.
- **Tasa de insistencia**: si la persona vuelve por canal alternativo,
  es senal de falla del primer canal. Pero si solo el 30% insiste,
  hay un sesgo de seleccion fuerte sobre quien insiste.

### Riesgos de captura institucional
- **Captura por el proveedor**: dependencia tecnica genera dependencia
  politica.
- **Captura interna por la metrica**: cuando la metrica de exito coincide
  con un comportamiento facil de generar (rechazo rapido = respuesta),
  el incentivo es generar la metrica, no la mision.
- **Captura por consultora/empresa**: cuando la rendicion de cuentas
  externa la hace una consultora pagada por el servicio que rinde
  cuentas.

### Que es un "supuesto critico"
Un supuesto critico es la afirmacion implicita que sostiene un argumento
y cuya falsedad lo invalida. En el caso del chatbot que rechaza:
- supuesto: "quien no insiste, lo hace porque la respuesta fue correcta"
- si el supuesto es falso (la persona no insiste por desconfianza,
  falta de tiempo, no entender el rechazo), entonces la metrica de
  "exito" mide otra cosa.

Hacer explicito el supuesto critico permite identificar que hay que
medir empiricamente para validar la inferencia.

---

<!-- section: perfil_estudiante -->
## Diagnostico de perfil del estudiante

Esta seccion guia al juez en la ronda diagnostica (no rankeada). El
objetivo es extraer senales del estudiante para que el profesor
entienda la cohorte, no evaluar correccion.

### Senales esperadas
- Preferencias entre las 6 unidades (3 en orden).
- Confianza autoreportada en 4 ejes: tecnico, normativo, empirico, publico.
- Rol preferido (builder, analyst, thinker, communicator).
- Postura inicial sobre IA y democracia (optimista / pesimista / ambivalente).
- Disponibilidad horaria semanal.

### Que se penaliza
- No respetar el formato `[SENALES]...[/SENALES]`.
- Valores indiferenciados (todo 3 o todo 5) — sugiere desinteres o
  evasion.
- Repetir numeros en `PREFERENCIAS_UNIDADES`.
- Justificacion que dice "me interesa todo" sin diferenciacion.

### Que se premia
- Diferenciacion real entre confianzas.
- Justificacion breve coherente con el patron de respuestas.
- Postura inicial declarada con un argumento minimo.
- Coherencia entre rol preferido y patron de confianzas.
