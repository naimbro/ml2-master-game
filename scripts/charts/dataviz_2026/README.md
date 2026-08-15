# Gráficos de Visualización de Datos 2026

Un script por clase. Cada gráfico que aparece en un juego se genera acá y queda
commiteado en `public/media/dataviz/`, para que cambiar el defecto de un gráfico
el año que viene sea una edición de una línea y no un redibujo.

## Reglas

- **Un solo defecto deliberado por gráfico.** Si una ronda pregunta "qué está mal
  acá", tiene que haber una sola respuesta correcta. Dos defectos hacen la
  pregunta injusta.
- **Los datos se commitean bajo `data/`.** Nada se baja en tiempo de ejecución: el
  gráfico tiene que poder regenerarse sin internet, y la fuente puede cambiar su
  archivo sin avisar.
- **Solo licencias limpias.** Este repo es público y despliega a GitHub Pages. Lo
  que no se puede licenciar se recrea, no se copia.
- Las referencias de media en `scenarios.json` van **sin** slash inicial
  (`media/dataviz/x.png`), o el archivo 404ea solo en producción.
- **El texto va grande respecto del gráfico.** El PNG mide 1100px de ancho y en un
  teléfono se escala a ~35%: el tamaño por defecto de ggplot2 termina en ~6px en
  pantalla. Si el alumno no puede leer el eje, la ronda no existe.

## Fuentes

| Archivo | Fuente | Licencia |
|---|---|---|
| `data/owid-life-expectancy-chile.csv` | [Our World in Data — Life expectancy at birth](https://ourworldindata.org/grapher/life-expectancy), serie de Chile 1900-2023 | CC BY 4.0 |
| `data/cep-problemas-por-anio.csv` | [Encuesta CEP](https://www.cepchile.cl/opinion-publica/encuesta-cep/), base consolidada 1994-2026, agregada por año y problema. Es el mismo archivo que los alumnos reciben en el catálogo de fuentes de la clase 3 | Datos públicos del CEP |

## Toolchain

R + ggplot2, que es la herramienta que enseña el curso: el gráfico que un alumno
critica en octubre está hecho con el código que aprendió a leer en septiembre.

R 4.3.3 vive en el lado **Windows** de esta máquina, no en WSL, así que se invoca
su `Rscript.exe`. **El `cd` bajo `/mnt/c` no es opcional:** CMD rechaza un cwd que
sea una ruta UNC de WSL, avisa que "regresa de manera predeterminada al
directorio Windows", y el script termina corriendo en otra parte sin encontrar su
CSV. Por eso el script se ubica a sí mismo con `--file=` en vez de confiar en
`getwd()`.

```bash
cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-master-game
"/mnt/c/Program Files/R/R-4.3.3/bin/Rscript.exe" scripts/charts/dataviz_2026/clase_01_diagnostico.R
```

Otra trampa de la misma familia: `Rscript.exe` **no acepta saltos de línea en
`-e`** (falla con exit 5 y sin mensaje). Para una verificación rápida, escribe un
`.R` temporal en vez de encadenar líneas en `-e`.

## Los gráficos de la clase 1

Los tres salen de la misma serie. Los dos últimos son el mismo dato con el mismo
código y difieren solo en `coord_cartesian(ylim=)`:

| Archivo | Eje y | Para qué |
|---|---|---|
| `c01_esperanza_vida_siglo.png` | 0–90 | ronda 1, lectura del tamaño del cambio |
| `c01_esperanza_vida_reciente.png` | 0–90 | rondas 2 y 5, honesto: el cambio reciente se ve chico |
| `c01_esperanza_vida_eje_truncado.png` | 78–82 | ronda 3, el defecto: el mismo cambio parece un derrumbe |

Se usa `coord_cartesian(ylim=)` y no `scale_y_continuous(limits=)` a propósito: el
segundo **descarta** las observaciones fuera del rango, el primero solo hace zoom.
Es la distinción que se enseña en clase.

## El gráfico de la clase 3

| Archivo | Para qué |
|---|---|
| `c03_cep_empleo.png` | ronda 7, la serie de Empleo en la CEP contra el titular «a los chilenos dejó de importarles el trabajo» |

**El hueco de 2020 va visible y sin puente.** La CEP no se levantó ese año, y unir
la línea por encima afirmaría un dato que no existe — que es exactamente lo que la
clase enseña a no hacer. Se fuerza metiendo una fila con `NA`, que es como ggplot
corta una línea. El `stopifnot` avisa si el CSV algún día trae 2020 de verdad.

**Va Empleo solo, y es una decisión de contenido, no estética.** Se dibujó también
la versión con los otros cuatro problemas de la tabla del briefing en gris de
contexto, y se descartó: ahí la subida de Delincuencia queda a la vista, así que
«el empleo pudo bajar porque otro tema subió» —que es el mejor argumento que la
ronda persigue— se **lee** del gráfico en vez de razonarse. Y a 310 px de teléfono,
cinco líneas grises son puré. Para recuperarla: `geom_line` gris sobre
`filter(d, serie != "Empleo")`, Empleo encima, etiquetas directas en el extremo
derecho y `ylim` hasta 35.

Una sola serie, así que **no hay leyenda**: el título nombra la serie. Se etiquetan
sólo los dos hitos que el enunciado ya menciona (2001 y 2024), y el de 2024 va
corrido a la izquierda porque puesto arriba se sienta sobre la cola que vuelve a
subir en 2025-2026.

El eje y parte en 0. La clase 1 usa un eje truncado como defecto deliberado y su
ronda 3 pregunta por él; repetirlo acá, donde nadie pregunta, sería un segundo
defecto en un gráfico que ya tiene su pregunta.
