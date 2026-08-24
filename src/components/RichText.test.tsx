import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RichText } from './RichText';

/**
 * Se renderiza a string con `react-dom/server` porque el repo no tiene jsdom ni
 * testing-library, y para esto no hacen falta: lo unico que hay que verificar es
 * que salga el HTML correcto.
 *
 * Los `<span>` de los tramos sin negrita son ruido de implementacion, asi que
 * las aserciones miran el texto y las etiquetas que importan, no la cadena
 * completa.
 */
const html = (t: string) => renderToStaticMarkup(<RichText text={t} />);

describe('RichText', () => {
  it('convierte **asi** en negrita', () => {
    expect(html('el **muro** de la base')).toContain('<strong class="font-bold">muro</strong>');
  });

  it('convierte *asi* en cursiva', () => {
    expect(html('la CEP pregunta *cuales son los tres problemas*')).toContain(
      '<em>cuales son los tres problemas</em>',
    );
  });

  it('NO parte una negrita en dos cursivas', () => {
    // El bug que justifica que la negrita se procese primero: buscando cursiva
    // antes, `**muro**` daria `<em>` con asteriscos sueltos a los lados.
    const out = html('el **muro**');
    expect(out).toContain('<strong class="font-bold">muro</strong>');
    expect(out).not.toContain('<em>');
    expect(out).not.toContain('*');
  });

  it('admite cursiva dentro de negrita', () => {
    expect(html('**la pregunta *textual* del CEP**')).toContain(
      '<strong class="font-bold">la pregunta <em>textual</em> del CEP</strong>',
    );
  });

  it('deja literales los asteriscos sin cerrar, sin comerse el resto', () => {
    const out = html('un *asterisco suelto y mas texto');
    expect(out).toContain('*asterisco suelto y mas texto');
    expect(out).not.toContain('<em>');
  });

  it('no une dos asteriscos de lineas distintas en una cursiva gigante', () => {
    // Sin la restriccion de `\n` en ITALIC_SPAN, esto se comeria el salto de
    // linea entero y dejaria en cursiva todo el parrafo del medio.
    const out = html('primera linea con *uno\nsegunda linea con *otro');
    expect(out).not.toContain('<em>');
  });

  it('el texto sin marcas sale intacto', () => {
    expect(html('sin ninguna marca')).toContain('sin ninguna marca');
  });

  it('no rompe con vacio ni con null', () => {
    expect(renderToStaticMarkup(<RichText text="" />)).toBe('');
    expect(renderToStaticMarkup(<RichText text={null} />)).toBe('');
  });

  /** El caso real que lo motivo: la ronda 5 de dataviz clase 3. */
  it('renderiza el contexto de la ronda que se jugo con los asteriscos a la vista', () => {
    const out = html(
      '**Tu grupo eligió cultura.**\n\nLa CEP lleva **32 años** haciendo la misma ' +
        'pregunta —*«¿cuáles son los tres problemas a los que el país debería dedicar ' +
        'mayor esfuerzo?»*— con una lista fija de 27 alternativas.',
    );
    expect(out).toContain('<strong class="font-bold">Tu grupo eligió cultura.</strong>');
    expect(out).toContain('<em>«¿cuáles son los tres problemas');
    expect(out).not.toContain('*');
  });
  describe('codigo', () => {
    it('convierte `asi` en codigo en linea', () => {
      expect(html('la columna `minutos_viaje` es texto')).toContain(
        '<code class="rt-code">minutos_viaje</code>',
      );
    });

    it('no deja backticks a la vista', () => {
      expect(html('escribe `filter(curso, transporte == "Metro")`')).not.toContain('`');
    });

    it('un backtick sin cerrar queda literal y no se come el resto', () => {
      const out = html('abre `filter( y sigue el texto hasta el final');
      expect(out).toContain('sigue el texto hasta el final');
      expect(out).not.toContain('<code');
    });

    it('convierte la cerca de tres backticks en un bloque', () => {
      const out = html('Escribiste esto:\n\n```r\ncurso %>%\n  count(transporte)\n```');
      expect(out).toContain('<code class="rt-code-block">');
      expect(out).toContain('curso %&gt;%\n  count(transporte)');
      expect(out).not.toContain('```');
      expect(out).not.toContain('rt-code-block">r');
    });

    it('sale <code> y nunca <pre>: el contenedor de la ronda es un <p>', () => {
      expect(html('```\nx <- 1\n```')).not.toContain('<pre');
    });

    it('adentro de un bloque los asteriscos no son marcas', () => {
      const out = html('```\nmutate(x = a * b)\n```');
      expect(out).toContain('a * b');
      expect(out).not.toContain('<em>');
    });

    it('una cerca sin cerrar queda literal', () => {
      const out = html('```r\ncurso %>% count(transporte)');
      expect(out).not.toContain('<code');
      expect(out).toContain('count(transporte)');
    });

    it('negrita y codigo conviven en la misma linea', () => {
      const out = html('**UNA sola cadena** con `%>%`');
      expect(out).toContain('<strong class="font-bold">UNA sola cadena</strong>');
      expect(out).toContain('<code class="rt-code">%&gt;%</code>');
    });
  });

  /** El caso real que lo motivo: la ronda 3 de dataviz clase 4. */
  it('renderiza las cuatro alternativas de codigo sin backticks a la vista', () => {
    for (const linea of [
      '`filter(curso, transporte = "Metro")`',
      '`filter(curso, transporte == "metro")`',
      '`filter(curso, transporte == "Metro")`',
      '`filter(curso, Transporte == "Metro")`',
    ]) {
      const out = html(linea);
      expect(out).toContain('class="rt-code"');
      expect(out).not.toContain('`');
    }
  });
  /** El bug que se descubrio escribiendo la ronda 2: negrita ALREDEDOR de codigo. */
  it('una negrita que envuelve codigo no deja asteriscos a la vista', () => {
    const out = html('Escribe **UNA sola cadena con `%>%`** que se quede con `"Deporte"`.');
    expect(out).toContain('<strong class="font-bold">');
    expect(out).toContain('<code class="rt-code">%&gt;%</code>');
    expect(out).not.toContain('*');
  });

  it('una cursiva que envuelve codigo tampoco', () => {
    const out = html('la regla es *mira `dominio` primero*');
    expect(out).toContain('<em>');
    expect(out).toContain('<code class="rt-code">dominio</code>');
    expect(out).not.toContain('*');
  });
});
