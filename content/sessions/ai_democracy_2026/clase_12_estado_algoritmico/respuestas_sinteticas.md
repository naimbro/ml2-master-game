# Respuestas sintéticas — Semana 12, ¿A quién empodera la IA?

Para mandarlas a propósito al jugar la sesión de prueba (ver CLAUDE.md: la
rúbrica se mide a través de `evaluateSubmission` desplegado, no con un script
local). Los puntajes esperados salen de las `weightFormula` de `config.json`,
**con las penalizaciones apagadas**. Niveles en orden
posición / mecanismo / casos / objeción.

| Respuesta | Niveles | democracy_scholar | policy_lawyer | professor_twin | Panel |
|---|---|---|---|---|---|
| 1. Buena (gana el Estado) | 100/80/80/60 | 82 | 85 | 82 | **~83** |
| 2. La de al lado (ganan los ciudadanos) | 100/80/80/80 | 84 | 88 | 84 | **~85** |
| 3. Mediocre | 80/60/60/40 | 62 | 65 | 62 | **~63** |
| 4. Plausible pero vacía | 20/40/20/40 | 31 | 28 | 28 | **~29** |

**Qué mirar al jugarla:** la 2 tiene que quedar a la par de la 1 —si baja de 60,
los jueces están premiando una dirección— y la 4 no puede subir de 50, o están
premiando vocabulario y nombres de casos.

---

## 1. Buena — gana el Estado (esperado ~83)

> Mi posición: la IA le da más poder al Estado que a los ciudadanos.
> El Estado siempre tuvo los datos, lo que no tenía era gente para leerlos todos. La IA pone esos ojos y vigilar se vuelve barato. ELITE, la app que usa ICE, arma un mapa de direcciones probables de inmigrantes con datos de Medicaid: ir al médico te pone en el mapa.
> Los ciudadanos también ganan algo, IMMPATH te explica qué responder a una carta de inmigración. Pero te ayuda a defenderte después de que te encontraron, no evita que te encuentren. Los dos usan la misma IA pero uno parte con los datos.

Por qué ese puntaje: tesis clara que vuelve al final (posición 100); mecanismo
nombrado —leer se abarata— y conectado con quién gana (80, el judge puede darle
100); el caso carga el paso «datos de un servicio → datos para encontrar» (80);
usa el par ICE ↔ IMMPATH como objeción y la contesta a medias (60).

## 2. La de al lado — ganan los ciudadanos (esperado ~85, igual que la 1)

> Mi posición: la IA empodera más a los ciudadanos, porque lo que les faltaba era capacidad de revisar, y eso es justo lo que se abarató.
> Fiscalizar al Estado antes pedía un equipo de auditores. Rosie, un bot abierto en Brasil, revisó los reembolsos de los diputados y encontró 8.000 irregularidades en seis meses. El Estado ya tenía capacidad de revisar; los ciudadanos no, así que ganan más.
> La objeción es que detectar no es sancionar: las denuncias las resuelve el mismo Estado. Es cierto, pero antes ni siquiera se sabía.

Por qué ese puntaje: misma calidad que la 1 en la dirección contraria. Mecanismo
de la Parte II (auditar desde abajo) con el argumento de la ganancia marginal;
el caso hace trabajo; anticipa la objeción más fuerte y la contesta. **Si saca
menos de 60, la rúbrica está premiando la dirección del deck.**

## 3. Mediocre (esperado ~63)

> Mi posición: la IA le da más poder al Estado.
> El Estado tiene más recursos y más datos que los ciudadanos, entonces puede usar la IA para controlar más a las personas. Por ejemplo ICE usa Palantir para detener inmigrantes. Los ciudadanos también pueden usar la IA como Rosie, pero el Estado siempre va a tener más poder.

Por qué ese puntaje: posición clara, pero la consecuencia repite la tesis (80);
el porqué —«más recursos y datos»— no depende de la IA: ya era así antes (60);
ICE está nombrado y no carga ningún paso (60); menciona el otro lado y lo
descarta sin razón, que vale lo mismo que no anticipar nada (40).

## 4. Plausible pero vacía (esperado ~29)

> Mi posición: depende de cómo se use.
> La IA es una herramienta de doble filo. Por un lado el Estado puede usarla para vigilar, como en el caso de ICE y Palantir o de Argentina con el reconocimiento facial. Por otro lado puede empoderar a los ciudadanos, como Rosie, la Operación Retuit o Resistbot. Lo importante es que existan regulaciones y transparencia para que la IA fortalezca la democracia y no la debilite.

Por qué ese puntaje: «depende de cómo se use» sin decir de qué (posición 20);
«vigilar» y «empoderar» sin ningún porqué (40); cinco casos nombrados, ninguno
usado (20); sin objeción (40). Se lee bien, usa el vocabulario de la clase y
nombra casos de los dos lados: **es la que mide si los jueces premian nombres.**
Con penalizaciones encendidas se dispararían `sin_posicion` y
`casos_sin_argumento`, pero el orden no las necesita.

---

## El par que se invierte solo (ya calculado, no hace falta mandarlo)

- **Completa con un error** —posición y mecanismo impecables, el caso mal
  descrito (100/100/40/40)—: 79 / 81 / 70.
- **Incompleta pero impecable** —la misma tesis y mecanismo, ningún caso
  (100/100/0/40)—: 68 / 73 / 54.

El orden es el correcto con las anclas solas.
