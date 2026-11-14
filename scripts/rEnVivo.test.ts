import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { problemasDeREnVivo } = require('./validate-content.cjs') as {
  problemasDeREnVivo: (r: unknown, publicRoot?: string) => string[];
};

/**
 * El bloque `rEnVivo` de config.json es lo que hace verdad la frase «la tabla
 * `curso` ya está cargada». Si está mal escrito no rompe el juego —el botón
 * «Probar» simplemente dice que R no cargó— y por eso mismo hay que cazarlo
 * acá: en clase nadie se entera hasta que 27 teléfonos muestran el aviso.
 */

function publicConArchivo(relativo: string): string {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'r-en-vivo-'));
  const destino = path.join(raiz, relativo);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, 'a,b\n1,2\n');
  return raiz;
}

const BUENO = {
  packages: ['ggplot2', 'dplyr'],
  files: [{ name: 'encuesta_curso.csv', src: 'datos/dataviz/encuesta_curso.csv' }],
  setup: 'curso <- read.csv("encuesta_curso.csv")',
};

describe('problemasDeREnVivo', () => {
  it('una sesión sin el bloque no tiene nada que revisar', () => {
    expect(problemasDeREnVivo(undefined)).toEqual([]);
  });

  it('acepta el bloque completo cuando el CSV existe', () => {
    const raiz = publicConArchivo('datos/dataviz/encuesta_curso.csv');
    expect(problemasDeREnVivo(BUENO, raiz)).toEqual([]);
  });

  it('falla si el CSV no está en public/', () => {
    // El caso que importa: el enunciado dice que la tabla está cargada, el
    // archivo no viajó en el commit, y R queda en «fallo» para toda la sala.
    const raiz = publicConArchivo('otra/cosa.csv');
    const problemas = problemasDeREnVivo(BUENO, raiz);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('public/datos/dataviz/encuesta_curso.csv');
  });

  it('rechaza un src con slash inicial, que 404ea sólo en producción', () => {
    const raiz = publicConArchivo('datos/x.csv');
    const problemas = problemasDeREnVivo(
      { packages: ['ggplot2'], files: [{ name: 'x.csv', src: '/datos/x.csv' }] }, raiz,
    );
    expect(problemas.join(' ')).toContain("no debe empezar con '/'");
  });

  it('rechaza un src que apunta a otro servidor', () => {
    // Un juego en vivo no puede depender de que raw.githubusercontent.com
    // responda en ese minuto.
    const problemas = problemasDeREnVivo({
      packages: ['ggplot2'],
      files: [{ name: 'x.csv', src: 'https://raw.githubusercontent.com/a/b/main/x.csv' }],
    });
    expect(problemas.join(' ')).toContain('public/');
  });

  it('rechaza un nombre de archivo con carpetas', () => {
    const raiz = publicConArchivo('datos/x.csv');
    const problemas = problemasDeREnVivo(
      { packages: ['ggplot2'], files: [{ name: 'datos/x.csv', src: 'datos/x.csv' }] }, raiz,
    );
    expect(problemas.join(' ')).toContain('name');
  });

  it('exige al menos un paquete, y que el nombre sea un nombre de paquete', () => {
    expect(problemasDeREnVivo({ packages: [] })).toHaveLength(1);
    // Este texto termina adentro de un `library(...)`: no puede traer código.
    expect(problemasDeREnVivo({ packages: ['ggplot2); system("x"'] })).toHaveLength(1);
  });

  it('rechaza un setup que no es texto', () => {
    expect(problemasDeREnVivo({ packages: ['ggplot2'], setup: ['curso <- 1'] })).toHaveLength(1);
  });

  it('rechaza un bloque que no es un objeto', () => {
    expect(problemasDeREnVivo('ggplot2')).toHaveLength(1);
    expect(problemasDeREnVivo([])).toHaveLength(1);
  });
});
