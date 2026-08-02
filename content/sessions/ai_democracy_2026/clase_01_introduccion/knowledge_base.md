# Material de referencia — Clase 1, IA y Democracia 2026

Este material existe para que los jueces puedan **verificar** lo que un estudiante afirma, no
para exigir que lo cite. Nadie ha leído nada del curso todavía: es la primera clase.

---

## 1. Qué se presentó en clase antes del juego

La clase 1 es la introducción del curso, co-impartida por Naim Bro (módulo de IA) y Roberto
Velázquez (módulo de Democracia). La presentación recorre, en este orden:

- **El gran salto**: crecimiento per cápita del año 0 al 2000 (Galor). Casi plano hasta 1800.
- **Tres revoluciones tecnológicas**: vapor (1712, 1776), electricidad (1879), microprocesador (1969).
- **Qué hace revolucionaria a una tecnología**: es de propósito general, genera tecnologías
  secundarias y penetra todos los sectores.
- **Las revoluciones tardan**: el vapor se inventa en 1712 y su efecto sobre el PIB británico
  aparece en 1830; la dínamo es de 1866 y la ampolleta de 1879, pero el despegue llega con la
  línea de ensamblaje de Ford en 1913; el microprocesador es de 1969 y la productividad se
  vuelve medible recién en los noventa. Es el **dilema de Solow**.
- **Tecnologías de la información y productividad**: el período 1995-2005 tuvo un aumento de
  productividad de 15% atribuido a las TI.
- **Los temores son viejos**: Keynes acuña "desempleo tecnológico" en 1930; los luditas rompen
  telares en el siglo XIX.
- **La evidencia sobre empleo es ambigua**: Acemoglu y Restrepo (2020) estiman que cada robot
  industrial adicional por cada 1.000 trabajadores destruye unos 6 empleos en EE.UU.; Aghion et
  al. (2020) encuentran que a nivel de firma en Francia la automatización *aumenta* el empleo
  (+0,4% en diez años). El efecto neto depende del nivel de análisis, del sector y de las
  instituciones laborales.
- **El impacto económico potencial de la IA**: ~80% de la fuerza laboral de EE.UU. tendría al
  menos 10% de sus tareas afectadas por LLMs; 15% de las tareas se completan significativamente
  más rápido solo con un LLM, y sube a 47-56% con software construido encima; Goldman Sachs
  proyecta hasta 7% adicional del PIB global en diez años.
- **Quiénes están más expuestos** (Goldman Sachs, 2023): ciencia y pensamiento crítico reducen
  la exposición; programación y escritura la aumentan.
- **Cierre**: ¿hay algo que te dé miedo de la IA? ¿Y algo que te dé esperanza?

El juego entra justo después de la última slide de contenido.

---

## 2. El gráfico de la ronda 1 — el gradiente de complejidad

Fuente: **Anthropic Economic Index: Economic Primitives**, publicado el 15 de enero de 2026
(Appel, Massenkoff, McCrory y otros). Mide conversaciones reales con Claude en noviembre de 2025,
clasificadas al nivel de tarea de O\*NET.

Valores que el informe reporta en el texto de la figura 4.1:

| Escolaridad que exige la tarea | Aceleración | Tasa de éxito |
|---|---|---|
| Menos que secundaria | — | 70% |
| 12 años (secundaria completa) | 9x | — |
| 16 años (título universitario) | 12x | 66% |

"Aceleración" es el tiempo que le tomaría a un humano solo, dividido por el tiempo que le toma
al humano trabajando con la IA. Reducir una tarea de una hora a diez minutos es 6x.

**Lo que el gráfico NO dice, y es el error que la ronda 1 castiga:** el eje horizontal mide la
escolaridad que **exige la tarea**, no la que **tiene la persona** que la pide. El estudio no
midió a los usuarios. La glosa "mientras más sabes, más te sirve la IA" es una inferencia
plausible, y el propio informe la sugiere al citar que los trabajadores de cuello y corbata
adoptan la IA mucho más (Bick et al. 2025), pero no es lo que el gráfico mide.

**Otro error que la ronda castiga:** el informe reporta explícitamente que la proporción de
tareas **automatizadas** no tiene relación con el nivel educativo requerido. Acelerar no es
reemplazar.

---

## 3. El gráfico de la ronda 2 — exposición ocupacional

Fuente: **Eloundou, Manning, Mishkin y Rock (2023), "GPTs are GPTs: An Early Look at the Labor
Market Impact Potential of Large Language Models"**, arXiv:2303.10130. "Exposición" significa
que la IA reduce en al menos 50% el tiempo de completar la tarea. No significa automatizar.

Las cinco ocupaciones más expuestas (medida Human β, tabla 4), en porcentaje de sus tareas:

| Ocupación | % de tareas expuestas |
|---|---|
| Investigadores de encuestas | 84,4 |
| Escritores y autores | 82,5 |
| Intérpretes y traductores | 82,4 |
| Relacionadores públicos | 80,6 |
| Científicos pecuarios | 77,8 |

La tabla 11 lista **34 ocupaciones sin ninguna tarea expuesta**. Todas manuales: operadores de
maquinaria agrícola, mecánicos de motos, lavaplatos, ayudantes de techadores, albañiles de
piedra, cortadores de carne, instaladores de líneas eléctricas, atletas profesionales,
mecánicos de camiones, estucadores, cambiadores de neumáticos, entre otras.

El gradiente también aparece agregado por nivel educativo de entrada a la ocupación (tabla 10):

| Educación requerida | Ingreso mediano (USD) | Exposición media (Hβ) |
|---|---|---|
| Sin credencial formal | 31.900 | 0,10 |
| Licencia de enseñanza media | 45.470 | 0,20 |
| Título universitario | 78.375 | 0,47 |
| Magíster | 79.605 | 0,46 |
| Doctorado | 82.420 | 0,41 |

La exposición sube junto con el ingreso hasta el nivel universitario y ahí se aplana. El propio
abstract del paper lo dice: los efectos abarcan todos los niveles salariales, pero **los empleos
de mayores ingresos enfrentan potencialmente mayor exposición**.

Esa es la inversión del patrón histórico que la ronda 2 pregunta: los luditas rompieron telares
porque la máquina venía por el trabajo manual; esta vez el trabajo manual es lo único que queda
en cero.

---

## 4. Para las rondas abiertas

### Ronda 3 — por qué el backlash suena tanto

El hecho de partida: los expuestos son quienes trabajan con palabras. Periodistas, escritores,
traductores, publicistas, abogados, investigadores, académicos. Es decir, **el mismo grupo que
escribe los diarios, produce los podcasts, redacta las columnas y decide qué es noticia**.

La automatización industrial del siglo XX destruyó mucho más empleo. Los afectados —obreros
textiles, operarios de línea, mineros— tenían sindicatos, pero no tribuna: no eran ellos quienes
escribían la prensa que cubría su propia desgracia.

Ambas posiciones que ofrece el enunciado son defendibles:

- **Capacidad de protesta mayor**: el ruido es desproporcionado al daño porque los afectados
  controlan los canales donde se mide el ruido.
- **Daño mayor**: la velocidad y la amplitud son distintas: 80% de la fuerza laboral con al
  menos 10% de sus tareas afectadas es una cobertura que ninguna ola anterior tuvo, y la
  transición es de años, no de generaciones.

Lo que se evalúa es que elija una y nombre una vía. No que acierte.

Este es además el puente explícito que el syllabus declara hacia la clase de Roberto: leer el
backlash contra la IA como una expresión política y no solo tecnológica.

### Ronda 4 — qué se redistribuye

El salto que la ronda pide: las tareas que la IA más acelera —argumentar, redactar, leer una ley
y responderla, ordenar información para una audiencia— no son solo tareas laborales. Son las que
determinan quién pesa en una discusión pública: quién puede escribir una carta al director,
responder una consulta ciudadana, preparar una intervención en una audiencia, entender un
reglamento y objetarlo.

Si el rendimiento de la herramienta crece con lo que uno ya sabe, entonces una herramienta
disponible para todos produce resultados desiguales, y lo que se ensancha no es la brecha de
ingresos sino la de **voz**.

La posición contraria es genuinamente sostenible y vale lo mismo: la IA le presta capacidad de
redacción y de análisis a quien nunca la tuvo, y por esa vía amplía quién puede participar. Es,
de hecho, la tesis que el curso examinará en noviembre con la propuesta de César Hidalgo de
avatares ciudadanos.

Lo que no se acepta es volver al empleo, ni afirmar que "aumenta la desigualdad" sin decir
desigualdad de qué.

---

## 5. Contexto del curso, para calibrar exigencia

Curso "Inteligencia Artificial y Democracia", Minor en Inteligencia Artificial, Escuela de
Gobierno UAI, segundo semestre 2026. Dos módulos intercalados: Roberto Velázquez cubre teoría
democrática (modelos de democracia, poder y élites, esfera pública, autoritarismo, soberanía,
deliberación, gobernanza) y Naim Bro cubre fenómenos de IA (backlash, populismo de IA, redes de
bots, vigilancia, geopolítica, democracia aumentada, regulación).

Ninguno de esos contenidos se ha visto todavía. Un estudiante que llegue a la respuesta correcta
sin usar una sola palabra técnica merece 100.
