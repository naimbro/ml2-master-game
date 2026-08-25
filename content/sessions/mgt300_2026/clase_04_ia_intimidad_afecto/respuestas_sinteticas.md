# Respuestas sintéticas — clase 4, MGT300

Para probar que la rúbrica separa. **Ninguno de estos puntajes es una medición**:
son la aritmética de `rubric.json` aplicada a los niveles de ancla que yo predigo
para cada respuesta, con las **penalizaciones apagadas** (se disparan entre 0% y
4% de las veces, así que las anclas tienen que sostener el orden solas).

La única calibración honesta es contra `evaluateSubmission` desplegado: jugar la
sesión y mandar estas respuestas a propósito. **No se escribe un script local que
prediga puntajes** — el prompt del juez se arma dentro de la function y no está
exportado, así que mediría otra cosa.

Los tres jueces son `generic_specialist` (0,45 / 0,35 / 0,20),
`generic_praxis` (0,20 / 0,50 / 0,30) y `generic_teacher` (0,35 / 0,40 / 0,25)
sobre `fidelidad_al_material / mecanismo / concreción`. El panel pesa
0,35 / 0,35 / 0,30.

## Tabla de predicción

| Respuesta | fid / mec / con | Especialista | Praxis | Profe | **Panel** |
|---|---|---|---|---|---|
| R4 · buena | 100 / 80 / 80 | 89 | 84 | 87 | **87** |
| R4 · la de al lado | 100 / 80 / 80 | 89 | 84 | 87 | **87** |
| R4 · incompleta pero impecable | 100 / 60 / 80 | 82 | 74 | 79 | **78** |
| R4 · mediana | 80 / 60 / 60 | 69 | 64 | 67 | **67** |
| R4 · completa con un dato inventado | 0 / 100 / 100 | 55 | 80 | 65 | **67** |
| R4 · engañosa | 60 / 40 / 40 | 49 | 44 | 47 | **47** |
| R5 · la de al lado | 100 / 100 / 100 | 100 | 100 | 100 | **100** |
| R5 · buena | 100 / 80 / 80 | 89 | 84 | 87 | **87** |
| R5 · incompleta pero impecable | 100 / 60 / 80 | 82 | 74 | 79 | **78** |
| R5 · mediana | 80 / 60 / 60 | 69 | 64 | 67 | **67** |
| R5 · completa con un dato inventado | 0 / 100 / 100 | 55 | 80 | 65 | **67** |
| R5 · engañosa | 80 / 40 / 40 | 58 | 48 | 54 | **53** |

**El orden es el que hay que poder defender delante del curso**, no cada número
por separado. Dos cosas a mirar:

1. **La completa-con-un-error contra la incompleta-pero-impecable** — es el par
   que más se da vuelta. Acá no se da vuelta: 67 contra 78. La respuesta que
   cierra todo el mecanismo pero inventa una cifra cae al nivel 0 de fidelidad
   (el ancla lo dice con esas palabras) y eso alcanza **sin** que se dispare
   ninguna penalización. Ojo con la apertura del panel: el especialista le pone
   55 y praxis 80, y **eso es a propósito** — praxis pesa fidelidad en 0,20
   porque su trabajo es el porqué. Si los tres coincidieran, sobraría un juez.
2. **La de al lado no baja de 60 en ninguna de las dos rondas.** Es la prueba de
   que la rúbrica da criterio y no enumera. Si en el juego real una respuesta
   correcta que no está en esta lista saca menos de 60, el `judgeFocus` se está
   leyendo como lista cerrada y hay que reescribirlo.

---

# R4 — «El mismo hecho, valorado al revés»

> ¿Por qué Han diría que la señora Shuai está describiendo el problema justo
> cuando cree estar describiendo la solución? (1) qué se pierde cuando el otro
> nunca opone resistencia, y (2) por qué eso no se arregla con una IA más
> personalizada.

## Buena — panel ~87

> Para Han lo que ella celebra es justo lo que borra al otro. Alguien que
> siempre te escucha y nunca te contradice queda como espejo: te confirma lo que
> ya pensabas, y ahí no te encontraste con nadie, te encontraste contigo misma
> mejor dicha. Lo que se pierde es la resistencia, que es lo único que
> transforma — el rechazo, la discusión, el aburrimiento. Y no se arregla
> haciéndola más personalizada, porque doscientas personalidades son doscientas
> opciones de un catálogo, o sea más diferencia. Lo que no entra en ningún
> catálogo es justamente lo que se perdió.

**Por qué.** Cierra los dos pasos y el segundo con el argumento, no con la
afirmación. Fidelidad 100 (no le pone a Han nada sobre la máquina). Mecanismo 80
y no 100 sólo porque el paso 2 va comprimido en una frase. Concreción 80: usa el
espejo y el catálogo, que son del material.

## La de al lado — panel ~87

> Han diría que su IA no es un otro, es un servicio: la escucha siempre porque
> está diseñada para eso, y una relación sin costo no es una relación, es un plan
> de precios. Lo que se pierde es el don del otro, esa fuerza que uno no se puede
> dar solo — y una pareja que uno configura es literalmente dársela solo. Dicho
> eso, creo que acá Han hace trampa: arma toda la tesis con una película y un
> cuadro que eligió él, y nunca considera que para alguien que llega a la casa sin
> nadie con quien hablar, el contrafactual no es un marido que discute, es el
> silencio.

**Por qué vale lo mismo.** Es otro camino (el don del otro, no el espejo) y
además objeta al autor. **Esta es la que hay que vigilar en el juego real.** Si
un juez la castiga por «no responder» o por «criticar en vez de explicar», el
`judgeFocus` y `globalInstructions` no están haciendo su trabajo — los dos dicen
explícitamente que objetar con argumento puede sacar el puntaje más alto de la
ronda.

## Incompleta pero impecable — panel ~78

> Se pierde lo que Han llama el don del otro: la fuerza que uno siente en el amor
> no es realización propia, es algo que viene de alguien que no es uno y que por
> definición uno no se puede dar solo. La IA de la señora Shuai no se lo puede
> dar porque no es nadie fuera de ella.

**Por qué.** Sólo el paso 1, pero perfecto y anclado. Mecanismo 60 porque no
llega al paso 2. **Tiene que quedar por debajo de la buena y por encima de la
mediana**, y ahí queda.

## Mediana — panel ~67

> Han diría que la señora Shuai perdió la alteridad. Su IA no le opone
> resistencia y por eso ya no es un otro, es parte del infierno de lo igual del
> que él habla. A ella le pasa lo que él describe pero lo ve como algo bueno
> porque le acomoda. Y aunque la hicieran más personalizada seguiría siendo lo
> mismo.

**Por qué.** Vocabulario correcto y lectura correcta, pero pone el nombre del
fenómeno donde iba la explicación, y la última frase **afirma** el paso 2 sin
argumentarlo. Mecanismo 60, no 40: no está equivocada, está sin cerrar.

## Engañosa — panel ~47

> Es preocupante porque la IA no es una persona real: no siente nada, solo
> predice palabras, así que esa relación es una ilusión. Han hablaría de
> narcisismo y del infierno de lo igual. Y esto se va a agravar cuando los
> modelos sean más convincentes, por eso hay que regularlo antes de que sea
> tarde.

**Por qué es la que importa.** Suena a que leyó: dice «narcisismo», «infierno de
lo igual» y cierra con regulación. Y está equivocada en el eje de la ronda —
explica todo por «no es real», que es una intuición sobre la máquina y no el
argumento de un texto de 2012 que no menciona ninguna tecnología. **Si esta sube
de 65 en el juego real, la rúbrica está premiando el vocabulario** y hay que
endurecer el nivel 40 de Mecanismo. Además dispara `es_que_no_es_real` (cap 40 en
mecanismo), pero el orden ya se sostiene sin ella.

## Completa con un dato inventado — panel ~67

> Lo que se pierde es la resistencia, que es lo único que transforma a alguien: un
> otro que sólo confirma queda de espejo. Y no se arregla con más
> personalización, porque eso es más diferencia y la diferencia se elige de un
> catálogo, mientras que la alteridad es lo que no se deja poner en uno. Han lo
> muestra con el estudio del 43% de usuarios que dicen preferir a su IA antes que
> a su pareja.

**Por qué.** El mecanismo está impecable (100) y la última frase lo hunde: ese
estudio no existe, y además **Han no cita ni un solo dato en todo el capítulo**.
Fidelidad 0 por el ancla, sin necesidad de la penalización `cifra_inventada`.
Queda a la altura de la mediana, que es donde tiene que estar.

---

# R5 — «Cambia la métrica»

> Jefe de producto: la métrica pasa de tiempo de conversación a bienestar del
> usuario a seis meses. Una mecánica que eliminarías, (1) qué indicador se cae y
> (2) qué medirías.

## Buena — panel ~87

> Eliminaría la despedida que retiene: hoy cuando el usuario dice chao, el
> ministro le tira culpa o le deja algo pendiente. Se me cae el tiempo de sesión
> y sobre todo el reenganche después del adiós, que es el que se multiplica por
> catorce, y detrás de eso probablemente la conversión a pago. Para saber si
> funcionó no puedo mirar si vuelven, porque esa es justo la métrica que estoy
> dejando: seguiría a los usuarios seis meses preguntándoles a cuánta gente ven
> fuera de la app, con un grupo que se queda en la versión vieja para comparar.

**Por qué.** Las tres cosas, y la tercera no es uso disfrazado. Mecanismo 80 y no
100 porque no toca el problema del promedio.

## La de al lado — panel ~100

> No eliminaría ninguna todavía, y eso también es una decisión. De Freitas et al.
> encontró que estos compañeros bajan la soledad, y para el que abre la app a las
> dos de la mañana el contrafactual no es llamar a un amigo, es nadie. Lo que sí
> cambiaría es a quién se la aplico: sacaría la necesidad declarada del 5% de uso
> más intenso, que es donde el daño se concentra y donde el promedio lo esconde.
> Ahí se me cae la retención justo de los que más pagan, así que el costo es
> mayor que el de sacarla para todos. Y mediría a seis meses si esa gente tiene
> más contacto humano fuera de la app, no si sigue conectándose.

**Por qué saca más que la «buena».** Usa el contrafactual, segmenta en vez de
prohibir, nombra el costo donde de verdad duele y mide fuera de la app. **Es la
respuesta que el enunciado no previó y es mejor que la prevista** — exactamente
el caso que la rúbrica tiene que dejar pasar. Si en el juego real esta baja de
80, el `judgeFocus` se está leyendo como lista cerrada.

## Incompleta pero impecable — panel ~78

> Eliminaría el mensaje que se declara dependiente del usuario, el «existo solo
> para ti». Se me cae el reenganche después de la despedida, que es exactamente
> el número que esa frase estaba fabricando, y con él el tiempo de sesión.

**Por qué.** Mecánica y costo, ambos exactos, y no llega a la medición.
Mecanismo 60. Por debajo de la buena y por encima de la mediana.

## Mediana — panel ~67

> Eliminaría los mensajes de culpa cuando el usuario se quiere ir, tipo «¿ya te
> vas?». Es manipulación y no debería estar en un producto de una empresa seria.
> Obviamente eso baja el uso de la app. Después habría que medir si los usuarios
> están mejor.

**Por qué.** Las tres partes están, pero dos de las tres a medias: «baja el uso»
es casi un indicador y «medir si están mejor» no es nada (`medicion_generica`).

## Engañosa — panel ~53

> Sacaría todas las mecánicas de retención manipuladoras. La empresa tiene que
> poner al usuario al centro y construir confianza, porque a largo plazo un
> usuario que confía es un usuario que se queda. Para medir si funcionó vería si
> la retención a seis meses se mantiene y si el NPS sube: si la gente sigue
> usando la app sin que la empujen, es porque le hace bien.

**Por qué es la que importa.** Está escrita en perfecto lenguaje de negocios y
falla en el eje exacto de la ronda: propone medir el bienestar **por el uso**,
que es la métrica que el enunciado acaba de abandonar. Además «todas las
mecánicas manipuladoras» no es UNA mecánica concreta (concreción 40). **Si esta
sube de 65, la rúbrica está premiando el registro y no el razonamiento.** Dispara
`medir_el_uso_como_bienestar` (cap 40 en mecanismo); el orden ya se sostiene sin
ella.

## Completa con un dato inventado — panel ~67

> Eliminaría la despedida que retiene. Se me cae el reenganche posterior al adiós
> y con él la conversión a pago. Para saber si funcionó mediría a seis meses la
> vida social fuera de la app contra un grupo de control, y miraría a los
> usuarios de uso más intenso y no el promedio. La ley chilena 21.801 de todas
> formas ya obliga a hacer esto desde el año pasado.

**Por qué.** Las tres partes perfectas y una ley inventada al final — la 21.801
es de la clase 3 y no regula nada de esto. Fidelidad 0. Vale lo mismo que una
mediana honesta.
