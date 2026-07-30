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
