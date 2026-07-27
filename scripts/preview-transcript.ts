/**
 * Genera el PDF de transcripcion con contenido REAL del curso mundial_2026 y respuestas
 * de muestra, para poder MIRAR la maqueta sin jugar una partida ni levantar la app.
 *
 * Un PDF solo se verifica viendolo: los huerfanos de pagina, los desbordes y los
 * caracteres fuera de cp1252 (jsPDF usa las fuentes estandar) no los detecta ningun
 * test. Este script existe para eso.
 *
 * Los datos de muestra estan hechos a proposito para cubrir los casos feos: una
 * respuesta larga, una corta, alternativas correctas / incorrectas / sin responder,
 * y rondas con y sin jueces.
 *
 * Uso:  npx tsx scripts/preview-transcript.ts [salida.pdf]
 * Ver:  pdftoppm -png -r 100 salida.pdf page   (y abrir los page-*.png)
 */
import { writeFileSync } from 'node:fs';
import { buildTranscriptPdf, type TranscriptRound } from '../src/lib/transcriptPdf';
import scenarios from '../content/sessions/mundial_2026/final_2026/scenarios.json';

const RESPUESTA_LARGA = `Me distingo por el contexto: Vozinha no jugo solo, jugo detras de una linea de cinco que ` +
  `cedio el balon a proposito y lo obligo a intervenir en jugadas ya filtradas. Lo que el dato "dejo el arco en cero ` +
  `ante Espana" no dice es cuantos de esos remates venian de posiciones que un arquero promedio tambien ataja.\n\n` +
  `Lo que si me parece senal real es que a los 40 anos, sin club, sostuvo 90 minutos de presion contra el futuro ` +
  `campeon sin un error de posicionamiento visible. Eso habla de lectura de juego, que envejece mejor que los reflejos.\n\n` +
  `Mi recomendacion al directorio: contrato por una temporada con opcion, no por dos. El riesgo no es que no sepa ` +
  `atajar, es que la muestra son tres partidos y el costo de equivocarse en un arquero titular es un ano de campeonato.`;

const rounds: TranscriptRound[] = (scenarios as any[]).map((sc, i) => {
  const isMC = sc.type === 'multiple_choice';
  return {
    round: i + 1,
    scenario: sc.title,
    type: isMC ? 'multiple_choice' : 'open',
    context: sc.context || '',
    question: typeof sc.question === 'string' ? sc.question : '',
    response: isMC ? '' : (i === 3 ? RESPUESTA_LARGA : 'Respuesta corta de prueba, a proposito breve para ver como se ve una respuesta floja.'),
    mcQuestions: (sc.mcQuestions || []).map((q: any) => ({
      question: q.question,
      options: (q.options || []).map((o: any) => ({ id: o.id, text: o.text })),
      correctOptionIndex: q.correctOptionIndex,
      explanation: q.explanation || '',
    })),
    // Mezcla a proposito: una correcta, una incorrecta, una sin responder.
    mcResponses: (sc.mcQuestions || []).map((q: any, qi: number) => {
      if (qi % 3 === 2) return { questionIndex: qi, selectedOptionId: null, correct: false, pointsAwarded: 0 };
      const wrong = qi % 3 === 1;
      const idx = wrong ? (q.correctOptionIndex + 1) % (q.options || []).length : q.correctOptionIndex;
      return {
        questionIndex: qi,
        selectedOptionId: q.options?.[idx]?.id ?? null,
        correct: !wrong,
        pointsAwarded: wrong ? 20 : 88,
      };
    }),
    evaluation: {
      finalScore: isMC ? 64 : 72,
      evaluations: isMC ? [] : [
        {
          judgeName: 'Experto Tecnico',
          feedback: 'Distingues bien la senal del jugador de la senal del sistema que tenia delante, que es exactamente ' +
            'lo que la pregunta pedia. Te falto cuantificar: hablas de "jugadas ya filtradas" pero no aterrizas cuantas, ' +
            'y sin eso el argumento se queda en intuicion defendible en vez de evidencia.',
          strengths: ['Separa el desempeno individual del contexto tactico', 'Reconoce el tamano de muestra como limitacion real'],
          improvements: ['Cuantificar la afirmacion sobre los remates', 'Nombrar que dato pedirias antes de firmar'],
        },
        {
          judgeName: 'Sector Publico',
          feedback: 'La recomendacion de contrato por una temporada con opcion es una respuesta institucionalmente ' +
            'sensata: acota el riesgo sin cerrar la puerta. Es el tipo de decision que sobrevive a una auditoria.',
          strengths: ['Propone un mecanismo concreto, no una opinion'],
          improvements: ['No dice quien decide la opcion ni con que criterio'],
        },
      ],
    },
  };
});

const doc = buildTranscriptPdf({
  sessionTitle: 'La final del Mundial 2026',
  studentName: 'María José Fernández Ñuñez',
  gameCode: '4GRBDT',
  totalScore: 402,
  dateLabel: '27-07-2026',
  rounds,
});

const out = process.argv[2] || 'transcripcion-preview.pdf';
writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
console.log('escrito:', out, '·', doc.getNumberOfPages(), 'paginas');
