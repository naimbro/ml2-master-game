# Clase 1 — Diagnóstico y proyecto

<!-- section: _always -->

## El curso y el estándar de esta clase

Descripción y Visualización de Datos, doble título Sociología - Ingeniería
Comercial, Universidad Adolfo Ibáñez, segundo semestre 2026. 15 clases, los
lunes de 10:00 a 12:40.

El curso pide tres cosas: describir datos sin sobre-afirmar, elegir gráficos que
respondan la pregunta que se está haciendo, y comunicar el resultado a alguien
sin formación técnica. El proyecto del semestre termina en una plataforma web
que un lector cualquiera pueda usar.

**Esta es la primera clase y los estudiantes no han leído nada todavía.** No
manejan el vocabulario del curso, no han visto R, y muchos no han hecho un
gráfico nunca. El estándar de evaluación acá es el razonamiento, no el
vocabulario: no penalices que alguien no diga "escala", "sesgo" o "variable".
Penaliza que afirme cosas que el dato no sostiene.

<!-- section: lectura_de_graficos, nivel_vs_cambio -->

## Nivel y cambio son cosas distintas

El error más frecuente al leer una serie de tiempo es responder con el nivel
cuando la pregunta era por el cambio, o al revés. La esperanza de vida en Chile
llegó a 81 años en 2023 (nivel) después de subir 52 años desde 1900 (cambio).
Los dos números son correctos y responden preguntas distintas.

El dato de esta clase: esperanza de vida al nacer en Chile, de Our World in Data,
1900 a 2023. Valores de referencia: 29 años en 1900, 53 en 1950, 77 en 2000,
80,3 en 2019, 79,3 en 2020, 78,9 en 2021, 79,2 en 2022, 81,2 en 2023.

Entre 2010 y 2023 la serie se mueve dentro de un rango de dos años, o sea es
casi plana comparada con el siglo completo. Eso es una lectura correcta del
período reciente, no un descuido.

"Esperanza de vida al nacer" no es una predicción sobre las personas que nacieron
ese año: es una síntesis de la mortalidad observada en ese año, aplicada a una
cohorte hipotética. Un estudiante de primera clase no tiene por qué saber esto y
no se le puede exigir; si alguien lo menciona correctamente, es excelente.

<!-- section: causalidad_y_descripcion -->

## Qué puede y qué no puede mostrar un gráfico descriptivo

Un gráfico de una serie en el tiempo muestra **cuándo** cambió algo. No muestra
**por qué**. Que la esperanza de vida haya bajado en 2020 y que ese haya sido el
año de la pandemia es una coincidencia temporal que el gráfico registra; la
afirmación "la pandemia causó la baja" es una explicación que viene de fuera del
gráfico. Puede ser cierta —lo es— y seguir sin estar mostrada ahí.

Las cuatro cosas que hay que separar, y que el curso vuelve a pedir todo el
semestre:

1. **Lectura** — se lee directamente del gráfico. "En 2021 fue menor que en 2019."
2. **Explicación** — propone una causa. "Bajó por la pandemia."
3. **Inferencia sobre otra cosa** — usa el gráfico como evidencia de algo que no
   mide. "El sistema de salud mejoró."
4. **Proyección** — extiende la serie más allá de donde termina. "En 2025 va a
   superar los 82."

Solo la primera se sostiene con el gráfico solo. Las otras tres no están
prohibidas: hay que decir que son eso, y decir qué dato haría falta para
sostenerlas.

<!-- section: articulo_parrott -->

## El artículo de Katie Parrott, que los estudiantes tienen impreso

"How to Start a Career When AI Is Doing Your Entry-level Job", Katie Parrott,
*Every*, 18 de mayo de 2026. Bajada: "Cuatro consejos no pedidos de una
millennial entusiasmada con la IA". Los estudiantes lo leen y lo discuten en
clase, y lo tienen a la vista mientras juegan. **Esto es lo que el texto dice; úsalo
para verificar lo que el estudiante afirma, no para exigir que lo cite.**

**El punto de partida.** Su primer trabajo saliendo de la universidad fue de
redactora en Fundable.com, una web de crowdfunding en Columbus, Ohio. La empresa
no tenía plata, así que no le importó que ella no tuviera experiencia; ella no
tenía experiencia, así que no le importó que el trabajo no pagara al principio.
Su tarea era tomar lo que un fundador estaba construyendo, a medio formar, y
traducirlo al lenguaje de los inversionistas, en un formato tan repetido que
todavía se lo sabe de memoria: problema, solución, tracción, equipo, modelo de
negocio, proyecciones, competencia, términos del financiamiento.

**El giro central del texto.** Hoy la IA produce uno de esos perfiles en dos
minutos. A los 23 ella habría pensado "gracias a Dios"; a los 36 piensa "gracias
a Dios que no podía". Sin ese trabajo nunca habría aprendido a desarmar una
empresa y volver a armarla como relato, ni a ordenar información para una
audiencia que —a diferencia de sus profesores— no estaba obligada a leerla.
Cuenta que sus primeros 50 perfiles fueron tan malos que un cliente dijo que
había que sacarla y fusilarla. Ahí aprendió a distinguir el trabajo bueno del
malo. **Con la IA de por medio, los malos no habrían sido lo bastante malos como
para enseñarle nada.** Ese es el mecanismo del argumento, y es lo menos obvio del
artículo.

**Los datos que cita.** Investigadores del Digital Economy Lab de Stanford
encontraron que el empleo de los jóvenes de 22 a 25 años en los trabajos más
expuestos a la IA cayó **13% desde fines de 2022**, mientras los trabajadores
mayores en los mismos puestos se mantuvieron estables. Una encuesta de NACE
(N = 44, 2026 Job Outlook Spring Update) muestra qué habilidades de IA buscan los
empleadores en candidatos de entrada: identificar y usar la herramienta adecuada
a la tarea (75,0%), escribir prompts que produzcan buenos resultados (72,7%),
**analizar y revisar lo que la IA entrega (65,9%)** y desarrollar herramientas de
IA (52,3%). La demanda de estas habilidades se triplicó. Lo que buscan, dice
ella, es **juicio**, y el juicio solo se construye con experiencia.

**La paradoja de siempre, agravada.** Para conseguir trabajo hace falta
experiencia, y para tener experiencia hace falta trabajo. Además, las
herramientas agénticas cambian las funciones en meses y no en años: no hay un
canon que estudiar ni un colega con más años bajo el cual hacer de aprendiz.

**Los cuatro consejos:**

1. **Persigue problemas, no profesiones.** Los cargos ya no son un blanco fijo:
   el puesto que persigues hoy puede no existir en 18 meses. Elige un problema en
   el que te sorprendas pensando aunque nadie te pague. "Analista de datos" puede
   encogerse, partirse o desaparecer, pero el problema de fondo —cómo darle
   sentido a un montón de números desordenados— va a seguir ahí y alguien va a
   seguir pagando por resolverlo. Ella confiesa haber sido mala siguiendo su
   propio consejo: pasó una década persiguiendo el título de "copywriter" por
   industrias que no tenían nada que ver entre sí, sin preguntarse si alguna le
   importaba. Tu valor es lo que aportas *encima* de lo que hace el modelo, y eso
   suele ser entender el problema mejor que él — algo difícil de construir en un
   campo que no te interesa.

2. **Elige una disciplina y protégela.** Una vez elegido el problema, elige el
   oficio: escribir, construir, investigar, diseñar, planificar, operar. La idea
   detrás de las 10.000 horas es correcta aunque la versión popular sea una
   simplificación: uno no es bueno en nada hasta haberlo hecho muchas veces.
   **Protege ese oficio de la IA a toda costa.** La IA puede buscarte material,
   explicarte cosas, tomarte la lección y mostrarte dónde tu razonamiento tiene
   hoyos; pero si la dejas escribir tus frases o hacer tu investigación, no
   acumulas las horas de hacerlo mal que hacen falta para hacerlo bien.
   **Ojo, y esto es lo que más se malinterpreta: ella escribió el artículo con la
   IA abierta en otra pestaña, y dice que Claude escribió el primer borrador de
   la mitad de las frases de esa sección — y que ella las reescribió.** Reescribir
   es para lo que sirve la disciplina: notar cuándo algo no pasa el examen. Puede
   hacerlo porque lleva diez años escribiendo frases. El texto NO dice que haya
   que evitar la IA.

3. **Haz cosas antes de que alguien te las pida.** Un currículum flaco pesa menos
   que antes, porque la contratación se está moviendo hacia lo que sabes hacer y
   no hacia dónde estuviste. Haz algo: una herramienta chica que te habría
   gustado que existiera, un texto sobre una pregunta que nadie te paga por
   pensar. Cuando ese trabajo te abre la puerta, la conversación que sigue es
   sobre **cómo** lo hiciste: para qué usaste IA y dónde decidiste no usarla, los
   momentos en que miraste la primera respuesta del modelo y pensaste "no, esto
   no está bien". Poder explicar esas decisiones es la segunda habilidad que
   estás construyendo, junto con el trabajo mismo. Eso es el juicio.

4. **Constrúyete el coach de carrera que te habría gustado tener.** Ella se armó
   uno en ChatGPT y con eso consiguió el trabajo que tiene: un proyecto con su
   currículum, ejemplos de textos de los que estaba orgullosa y un prompt largo
   diciéndole al modelo cómo hablarle. Lo consultaba casi todos los días
   laborales durante un mes. Lo que más le sirvió fue tener dónde poner el
   pensamiento en vez de dar vueltas a la misma preocupación en la cabeza. Los
   pasos que sugiere: elegir herramienta, crear un proyecto y ponerle nombre,
   cargarlo con contexto (trabajos de los que estás orgulloso y otros que
   quisieras que fueran mejores, avisos de empleo que te gustarían aunque te
   queden grandes), y decirle cómo comportarse — advirtiendo que los modelos son
   famosos por la adulación, o sea por decirte lo que quieres oír.

**El cierre.** "La ventaja del principiante": no esperes. La IA está
reorganizando el trabajo en tiempo real y hacer como que no pasa no lo frena.
A ella le gustaría poder decir que los senior van a acordarse de que alguien los
formó a ellos, o que los empleadores van a caer en cuenta de que los de entrada
que no contratan hoy son los senior que no van a tener en diez años más — pero el
mercado no se reorganiza según lo que uno querría. Lo que la IA premia es
justamente lo que a los jóvenes les sobra: curiosidad, ganas de preguntar por qué
las cosas se hacen de cierta manera, y algo de idealismo sobre cómo podría ser el
trabajo.
