import { describe, it, expect } from 'vitest';
import {
  MAX_COLABORADORES,
  agregarColaborador,
  esMailValido,
  leerColaboradores,
  normalizarMail,
  puedeEditarCurso,
  quitarColaborador,
} from './colaboradores';

const DUENO = 'felipe@uc.cl';

describe('normalizarMail', () => {
  it('baja a minusculas y saca los espacios', () => {
    expect(normalizarMail('  Francisco.Flores@Gmail.COM ')).toBe('francisco.flores@gmail.com');
  });
});

describe('esMailValido', () => {
  it('acepta un correo normal', () => {
    expect(esMailValido('franciscoflorescaillet@gmail.com')).toBe(true);
  });

  it('rechaza los dedazos que se ven a simple vista', () => {
    for (const malo of ['', 'franciscoflorescaillet', 'francisco@gmail', 'a b@gmail.com', '@gmail.com']) {
      expect(esMailValido(malo)).toBe(false);
    }
  });
});

describe('leerColaboradores', () => {
  it('sin campo devuelve lista vacia', () => {
    expect(leerColaboradores(undefined)).toEqual([]);
    expect(leerColaboradores(null)).toEqual([]);
  });

  it('ignora lo que no sea un string, en vez de romper la pantalla', () => {
    expect(leerColaboradores(['a@b.cl', 42, null, { mail: 'x' }, 'c@d.cl'])).toEqual(['a@b.cl', 'c@d.cl']);
  });

  it('normaliza lo que ya estaba guardado', () => {
    expect(leerColaboradores([' A@B.CL '])).toEqual(['a@b.cl']);
  });

  it('un campo que no es lista no pasa', () => {
    expect(leerColaboradores('a@b.cl')).toEqual([]);
  });
});

describe('agregarColaborador', () => {
  it('agrega normalizado al final', () => {
    const r = agregarColaborador([], '  Francisco@Gmail.com ', DUENO);
    expect(r).toEqual({ ok: true, lista: ['francisco@gmail.com'] });
  });

  it('no muta la lista que recibe', () => {
    const lista = ['a@b.cl'];
    agregarColaborador(lista, 'c@d.cl', DUENO);
    expect(lista).toEqual(['a@b.cl']);
  });

  it('rechaza vacio, invalido y repetido', () => {
    expect(agregarColaborador([], '   ', DUENO)).toEqual({ ok: false, error: 'vacio' });
    expect(agregarColaborador([], 'no-es-mail', DUENO)).toEqual({ ok: false, error: 'invalido' });
    expect(agregarColaborador(['a@b.cl'], 'A@B.CL', DUENO)).toEqual({ ok: false, error: 'repetido' });
  });

  it('rechaza que el dueno se agregue a si mismo', () => {
    expect(agregarColaborador([], 'FELIPE@uc.cl', DUENO)).toEqual({ ok: false, error: 'es-el-dueno' });
  });

  it('sin mail del dueno conocido igual agrega', () => {
    // El admin puede estar mirando un curso ajeno: no hay con que comparar.
    expect(agregarColaborador([], 'x@y.cl', null)).toEqual({ ok: true, lista: ['x@y.cl'] });
  });

  it('corta en el tope', () => {
    const llena = Array.from({ length: MAX_COLABORADORES }, (_, i) => `a${i}@b.cl`);
    expect(agregarColaborador(llena, 'uno-mas@b.cl', DUENO)).toEqual({ ok: false, error: 'demasiados' });
  });
});

describe('quitarColaborador', () => {
  it('quita sin importar mayusculas', () => {
    expect(quitarColaborador(['a@b.cl', 'c@d.cl'], 'A@B.CL')).toEqual(['c@d.cl']);
  });

  it('quitar uno que no esta deja la lista igual', () => {
    expect(quitarColaborador(['a@b.cl'], 'z@z.cl')).toEqual(['a@b.cl']);
  });
});

describe('puedeEditarCurso', () => {
  const curso = { professorId: 'uid-felipe', colaboradores: ['franciscoflorescaillet@gmail.com'] };

  it('el dueno entra por uid', () => {
    expect(puedeEditarCurso(curso, { uid: 'uid-felipe', email: 'felipe@uc.cl' })).toBe(true);
  });

  it('el colaborador entra por mail, aunque su sesion lo traiga con mayusculas', () => {
    expect(puedeEditarCurso(curso, { uid: 'uid-fran', email: 'FranciscoFloresCaillet@gmail.com' })).toBe(true);
  });

  it('un tercero no entra', () => {
    expect(puedeEditarCurso(curso, { uid: 'uid-otro', email: 'otro@gmail.com' })).toBe(false);
  });

  it('sin sesion no entra nadie', () => {
    expect(puedeEditarCurso(curso, null)).toBe(false);
  });

  it('una sesion sin mail no puede calzar contra la lista', () => {
    expect(puedeEditarCurso(curso, { uid: 'uid-fran', email: null })).toBe(false);
  });

  it('un curso sin colaboradores solo lo edita su dueno', () => {
    expect(puedeEditarCurso({ professorId: 'uid-felipe' }, { uid: 'uid-fran', email: 'x@y.cl' })).toBe(false);
  });
});
