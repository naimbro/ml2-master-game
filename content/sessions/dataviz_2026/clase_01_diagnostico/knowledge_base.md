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

<!-- section: eje_truncado -->

## Recortar el eje

Un eje vertical que no parte en cero amplifica visualmente cualquier variación.
En la serie chilena, la baja de 2019 a 2021 es de 1,4 años sobre un nivel de 80:
con el eje de 0 a 90 casi no se ve, y con el eje de 78 a 82 ocupa media figura.
Los datos son idénticos en los dos casos, y el gráfico se dibujó con el mismo
código: lo único que cambia es el rango del eje.

Recortar el eje **no es siempre un error**. Cuando el cambio relevante es chico
en relación al nivel —tasas de interés, temperaturas, participación electoral—
partir en cero esconde lo que importa. La regla honesta no es "siempre desde
cero", es: si recortas, dilo, y no combines el recorte con un lenguaje que
sugiera catástrofe.

Lo que hace engañoso al gráfico truncado de esta clase no es la escala en sí, es
que la escala no está declarada y el lector lee la altura antes de leer los
números.

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

<!-- section: interrogar_un_numero -->

## Qué exigirle a un número antes de creerle

Un número suelto —«subió 40%», «cayó a la mitad», «el doble que hace diez
años»— no se puede evaluar. No porque sea falso, sino porque le faltan las tres
cosas que lo harían verificable.

**Desde cuándo.** Un 40% acumulado en un año y un 40% acumulado en quince son
fenómenos distintos, y la frase es idéntica en los dos casos. Peor: cualquier
porcentaje de cambio depende por completo de qué dos momentos se comparan. Con
una serie larga a la vista casi siempre se pueden elegir dos puntos que den la
cifra que uno quiere. Por eso pedir la serie entera no es un capricho: es la
única forma de saber si los dos extremos elegidos son representativos.

**Qué se midió.** Un promedio y una mediana pueden ir en direcciones distintas
cuando hay valores extremos. Los arriendos publicados en un portal y los
efectivamente firmados no son la misma población: lo publicado es la aspiración
del arrendador. Y «Santiago» puede querer decir una comuna o treinta y siete.

**En qué unidades.** Si los precios están en pesos de cada año, parte de
cualquier alza es simplemente inflación. Descontar la inflación no es un
tecnicismo: es la diferencia entre «subió» y «subió más que todo lo demás».

Estas tres se resumen en un criterio que sirve para cualquier número: **una
pregunta útil es la que, contestada de dos maneras distintas, te deja creyendo
cosas distintas.** «¿Es confiable la fuente?» rara vez cumple eso. «¿Es promedio
o mediana?» casi siempre lo cumple.

Y sobre qué gráfico pedir: la pregunta que importa no es cuál se ve mejor, sino
**qué tendría que mostrar ese gráfico para que la afirmación quede en pie o se
caiga**. Un gráfico que no puede desmentir nada tampoco confirma nada.
