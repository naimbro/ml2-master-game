url <- "https://raw.githubusercontent.com/naimbro/naimbro.github.io/main/materiales/2026_descripcion_visualizacion_datos/encuesta_uai.csv"
encuesta <- read.csv(url)
so <- sort(table(encuesta[[8]]), decreasing = TRUE)
names(so) <- c("iOS", "Android", "HarmonyOS", "Otro")

# Se dibuja al DOBLE del ancho en que se ve (340 CSS px), para que quede nitido
# en pantalla retina. La letra se elige para que sobreviva a esa reduccion.
abrir <- function(f) png(f, width = 680, height = 560, res = 72)  # 2x de los 340 px en que se ve

# --- V1: barras verticales, como las del cuaderno ---------------------------
abrir("v1_vertical.png")
par(mar = c(4.5, 4.5, 4, 1.5), cex = 1.35)
bp <- barplot(so,
              main = "Sistema operativo del celular",
              ylab = "Estudiantes",
              col  = "steelblue",
              ylim = c(0, 420),
              las  = 1)
text(bp, as.numeric(so) + 26, labels = as.numeric(so), font = 2)
mtext("458 estudiantes UAI, 2022-2023", side = 1, line = 2.8, cex = 1.15)
dev.off()

# --- V2: barras horizontales ------------------------------------------------
abrir("v2_horizontal.png")
par(mar = c(4.2, 6.5, 4, 2.5), cex = 1.35)
so2 <- rev(so)
bp <- barplot(so2,
              horiz = TRUE,
              main  = "Sistema operativo del celular",
              xlab  = "Estudiantes",
              col   = "steelblue",
              xlim  = c(0, 430),
              las   = 1)
text(as.numeric(so2) + 24, bp, labels = as.numeric(so2), font = 2, adj = 0)
mtext("458 estudiantes UAI, 2022-2023", side = 1, line = 2.8, cex = 1.15)
dev.off()

cat("listo\n")
