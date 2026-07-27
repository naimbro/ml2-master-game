// Import NOMBRADO a proposito: el default de jspdf no resuelve a constructor fuera del
// bundler (node/tsx lo entrega envuelto), y este modulo tiene que poder ejecutarse desde
// un script para poder mirar el PDF que produce.
import { jsPDF } from 'jspdf';

/**
 * Arma el PDF de transcripcion del alumno: cada pregunta, lo que respondio, su
 * puntaje y lo que dijeron los jueces de IA.
 *
 * Vive aparte de End.tsx por dos razones: la pagina ya era larga, y un PDF solo se
 * puede verificar mirandolo — tenerlo en un modulo puro permite generarlo desde un
 * script de node y abrir el resultado, sin levantar la app ni jugar una partida.
 */

export interface TranscriptJudge {
  judgeName: string;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface TranscriptRound {
  round: number;
  scenario: string;
  type: 'multiple_choice' | 'open';
  context: string;
  question: string;
  response: string;
  mcQuestions: Array<{
    question: string;
    options: Array<{ id: string; text: string }>;
    correctOptionIndex: number;
    explanation: string;
  }>;
  mcResponses: Array<{
    questionIndex: number;
    selectedOptionId: string | null;
    correct: boolean;
    pointsAwarded: number;
  }>;
  evaluation?: {
    finalScore: number;
    evaluations: TranscriptJudge[];
  };
}

export interface TranscriptInput {
  sessionTitle: string;
  studentName: string;
  gameCode: string;
  totalScore: number;
  /** Fecha ya formateada; se inyecta para que el PDF sea reproducible en los chequeos. */
  dateLabel: string;
  rounds: TranscriptRound[];
}

type RGB = [number, number, number];

const INK: RGB = [17, 24, 39];
const MUTED: RGB = [107, 114, 128];
const FAINT: RGB = [156, 163, 175];
const BODY: RGB = [55, 65, 81];
const OPTION: RGB = [75, 85, 99];
const GOOD: RGB = [21, 128, 61];
const BAD: RGB = [185, 28, 28];
const WARN: RGB = [180, 83, 9];
const ACCENT: RGB = [255, 90, 31]; // el naranjo de Cancha

export function buildTranscriptPdf(input: TranscriptInput): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const width = pageWidth - 2 * margin;
  const BOTTOM = 272;
  let y = 20;

  // jsPDF usa las fuentes estandar de PDF, que codifican en cp1252: los acentos, la
  // enie y los signos de apertura pasan bien, pero cualquier cosa fuera de cp1252
  // (flechas, checks, vinetas tipograficas) sale como basura. De ahi que los
  // marcadores de abajo sean ASCII puro.
  const write = (
    text: string,
    opts: { size?: number; color?: RGB; indent?: number; gap?: number; style?: 'normal' | 'bold' | 'italic' } = {},
  ) => {
    const { size = 10, color = INK, indent = 0, gap = 4.8, style = 'normal' } = opts;
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFont('helvetica', style);
    for (const line of doc.splitTextToSize(text, width - indent)) {
      if (y > BOTTOM) { doc.addPage(); y = 20; }
      doc.text(line, margin + indent, y);
      y += gap;
    }
  };
  const space = (n: number) => { y += n; };
  /** Evita que un titulo quede huerfano al pie de una pagina. */
  const keepTogether = (needed: number) => { if (y + needed > BOTTOM) { doc.addPage(); y = 20; } };

  // ---------- portada ----------
  write('Transcripcion de la sesion', { size: 19, color: INK, style: 'bold', gap: 8 });
  write(input.sessionTitle || 'Sesion', { size: 12, color: MUTED, gap: 7 });
  space(3);
  write(input.studentName, { size: 11, color: INK, style: 'bold', gap: 6 });
  write(`Codigo del juego: ${input.gameCode}   ·   Puntaje total: ${input.totalScore}   ·   ${input.dateLabel}`,
    { size: 9, color: MUTED, gap: 6 });

  const rounds = [...input.rounds].sort((a, b) => a.round - b.round);

  // La leyenda de marcas va UNA vez, aca. Repetirla por ronda la dejaba huerfana al
  // principio de una pagina, separada de la tabla que explica.
  if (rounds.some((r) => r.type === 'multiple_choice')) {
    space(2);
    write('En las rondas de alternativas:  >  lo que respondiste     *  la alternativa correcta',
      { size: 8.5, color: FAINT, gap: 5 });
  }
  space(6);
  if (rounds.length === 0) {
    write('No hay respuestas registradas para esta sesion.', { size: 10, color: MUTED });
  }

  for (const r of rounds) {
    // Reservamos el encabezado de la ronda MAS el primer bloque de contenido. Con solo
    // el encabezado (30) el titulo se quedaba solo al pie y la pregunta saltaba a la
    // pagina siguiente.
    keepTogether(56);
    space(4);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y - 3, pageWidth - margin, y - 3);
    space(3);

    const score = r.evaluation?.finalScore;
    write(`RONDA ${r.round}`, { size: 8, color: ACCENT, style: 'bold', gap: 5 });
    write(r.scenario, { size: 13, color: INK, style: 'bold', gap: 6.5 });
    if (typeof score === 'number') {
      write(`Puntaje de la ronda: ${Math.round(score)} / 100`, { size: 9, color: MUTED, gap: 6 });
    }
    space(2);

    if (r.type === 'multiple_choice') {
      // Defensivo a proposito: si un cliente cacheado le pega a una version vieja de
      // generateStudentReport, estos campos no vienen. Un PDF incompleto es molesto;
      // uno que revienta delante del curso, no.
      const mcQuestions = r.mcQuestions || [];
      const mcResponses = r.mcResponses || [];
      mcQuestions.forEach((q, qi) => {
        keepTogether(28);
        const mine = mcResponses.find((m) => m.questionIndex === qi);
        write(`${qi + 1}. ${q.question}`, { size: 10, color: INK, style: 'bold', gap: 5 });
        (q.options || []).forEach((o, oi) => {
          const isCorrect = oi === q.correctOptionIndex;
          const isMine = mine?.selectedOptionId === o.id;
          // Marcadores ASCII: ">" lo que marcaste, "*" la correcta.
          const mark = `${isMine ? '>' : ' '}${isCorrect ? '*' : ' '}`;
          write(`${mark} ${o.id}. ${o.text}`, {
            size: 9.5, indent: 4, gap: 4.6,
            color: isCorrect ? GOOD : isMine ? BAD : OPTION,
          });
        });
        if (!mine || mine.selectedOptionId === null) {
          write('No alcanzaste a responder.', { size: 9, indent: 4, color: MUTED, style: 'italic', gap: 5 });
        } else {
          write(`${mine.correct ? 'Correcta' : 'Incorrecta'} · ${Math.round(mine.pointsAwarded)} puntos`,
            { size: 9, indent: 4, color: mine.correct ? GOOD : BAD, gap: 5 });
        }
        if (q.explanation) {
          write(q.explanation, { size: 9, indent: 4, color: MUTED, style: 'italic', gap: 4.6 });
        }
        space(2);
      });
      write('Esta ronda se corrige automaticamente, sin jueces de IA.',
        { size: 8.5, color: FAINT, style: 'italic', gap: 5 });
    } else {
      if (r.context) {
        write('EL CASO', { size: 8, color: MUTED, style: 'bold', gap: 5 });
        write(r.context, { size: 9.5, color: OPTION, gap: 4.6 });
        space(3);
      }
      if (r.question) {
        keepTogether(20);
        write('LA PREGUNTA', { size: 8, color: MUTED, style: 'bold', gap: 5 });
        write(r.question, { size: 9.5, color: INK, gap: 4.6 });
        space(3);
      }

      keepTogether(20);
      const answered = Boolean(r.response?.trim());
      write('TU RESPUESTA', { size: 8, color: ACCENT, style: 'bold', gap: 5 });
      write(answered ? r.response.trim() : '(no respondiste esta ronda)',
        { size: 9.5, color: answered ? INK : FAINT, style: answered ? 'normal' : 'italic', gap: 4.6 });
      space(4);

      const judges = r.evaluation?.evaluations || [];
      if (judges.length === 0) {
        write('Esta ronda no alcanzo a ser evaluada por los jueces.', { size: 9, color: FAINT, style: 'italic', gap: 5 });
      } else {
        keepTogether(18);
        write('QUE DIJERON LOS JUECES', { size: 8, color: MUTED, style: 'bold', gap: 5.5 });
        judges.forEach((j) => {
          keepTogether(22);
          write(j.judgeName || 'Juez', { size: 10, color: INK, style: 'bold', gap: 5 });
          if (j.feedback) write(j.feedback, { size: 9.5, indent: 4, color: BODY, gap: 4.6 });
          (j.strengths || []).forEach((s) => write(`+ ${s}`, { size: 9, indent: 4, color: GOOD, gap: 4.4 }));
          (j.improvements || []).forEach((s) => write(`- ${s}`, { size: 9, indent: 4, color: WARN, gap: 4.4 }));
          space(2.5);
        });
      }
    }
    space(3);
  }

  // ---------- pie en todas las paginas ----------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(FAINT[0], FAINT[1], FAINT[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(`${input.sessionTitle || 'Sesion'} - ${input.studentName}`, margin, 287);
    doc.text(`${p} / ${pages}`, pageWidth - margin, 287, { align: 'right' });
  }

  return doc;
}
