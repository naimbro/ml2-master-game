import admin from 'firebase-admin';
import { writeFileSync } from 'node:fs';
import { fitBradleyTerry, type PlayerResponse, type JudgeWeights } from './lib/bradley-terry';
import {
  spearmanRho,
  kendallTau,
  judgeDisagreementRate,
  ranksDescending,
  linearMatchMoments,
} from './lib/stats';
import {
  renderHtml,
  renderConsole,
  type GameReport,
  type RoundAnalysis,
  type RoundRow,
  type OverallRow,
} from './lib/report';

const PROJECT_ID = 'ml2-master-game';

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

async function listGames(): Promise<void> {
  const snap = await db.collection('games').limit(50).get();
  if (snap.empty) {
    console.log('No games found.');
    return;
  }
  console.log('Available games (pass a code as the argument):\n');
  for (const doc of snap.docs) {
    const d = doc.data();
    const players = d.players ? Object.keys(d.players).length : 0;
    const title = d.sessionConfig?.title || d.sessionId || '';
    console.log(`  ${doc.id.padEnd(10)} players=${String(players).padStart(2)}  ${title}`);
  }
}

interface Submission {
  playerId: string;
  playerName: string;
  round: number;
  evaluated?: boolean;
  evaluation?: {
    finalScore: number;
    evaluations: { judgeId: string; judgeName?: string; score: number }[];
  };
}

function toPlayerResponses(subs: Submission[]): PlayerResponse[] {
  return subs
    .filter((s) => s.evaluation && Array.isArray(s.evaluation.evaluations))
    .map((s) => ({
      playerId: s.playerId,
      playerName: s.playerName,
      llmScore: s.evaluation!.finalScore,
      judgeScores: s.evaluation!.evaluations.map((e) => ({ judgeId: e.judgeId, score: e.score })),
    }));
}

function analyzeRound(
  round: number,
  scenarioTitle: string,
  players: PlayerResponse[],
  weights: JudgeWeights,
): RoundAnalysis | null {
  if (players.length < 2) return null;

  const bt = fitBradleyTerry(players, weights);
  const llmScoreMap: Record<string, number> = {};
  for (const p of players) llmScoreMap[p.playerId] = p.llmScore;

  const llmRank = ranksDescending(llmScoreMap);
  const btRank = ranksDescending(bt.strength);

  const rows: RoundRow[] = players
    .map((p) => ({
      playerName: p.playerName,
      llmScore: p.llmScore,
      llmRank: llmRank[p.playerId],
      theta: bt.logStrength[p.playerId],
      btRank: btRank[p.playerId],
      deltaRank: llmRank[p.playerId] - btRank[p.playerId],
    }))
    .sort((a, b) => a.llmRank - b.llmRank);

  return {
    round,
    scenarioTitle,
    rows,
    spearman: spearmanRho(llmScoreMap, bt.strength),
    kendall: kendallTau(llmScoreMap, bt.strength),
    disagreement: judgeDisagreementRate(players),
  };
}

async function run(gameCode: string): Promise<void> {
  const gameDoc = await db.collection('games').doc(gameCode).get();
  if (!gameDoc.exists) {
    console.error(`Game "${gameCode}" not found.`);
    process.exitCode = 1;
    return;
  }
  const game = gameDoc.data()!;
  const scenarios: any[] = game.scenarios || [];

  const weights: JudgeWeights = {};
  const judgeList: { judgeId: string; weight: number }[] = game.sessionConfig?.judges || [];
  for (const j of judgeList) weights[j.judgeId] = j.weight;

  const subsSnap = await db.collection('games').doc(gameCode).collection('submissions').get();
  const allSubs = subsSnap.docs.map((d) => d.data() as Submission);

  // Accumulators for the overall (cumulative) comparison.
  const llmTotal: Record<string, number> = {};
  const btPointsTotal: Record<string, number> = {};
  const nameById: Record<string, string> = {};

  const rounds: RoundAnalysis[] = [];

  for (let idx = 0; idx < scenarios.length; idx++) {
    const scenario = scenarios[idx];
    const round = idx + 1;
    if (scenario?.ranked === false) continue;
    if (scenario?.type === 'multiple_choice') continue;

    const players = toPlayerResponses(allSubs.filter((s) => s.round === round));
    const analysis = analyzeRound(
      round,
      scenario?.title || scenario?.id || `Round ${round}`,
      players,
      weights,
    );
    if (!analysis) continue;
    rounds.push(analysis);

    // Cumulative: LLM total = sum of finalScore; BT points = log-strengths
    // rescaled to this round's LLM score moments so they aggregate on the same scale.
    const bt = fitBradleyTerry(players, weights);
    const thetas = players.map((p) => bt.logStrength[p.playerId]);
    const llmScores = players.map((p) => p.llmScore);
    const btPoints = linearMatchMoments(thetas, llmScores);
    players.forEach((p, i) => {
      nameById[p.playerId] = p.playerName;
      llmTotal[p.playerId] = (llmTotal[p.playerId] || 0) + p.llmScore;
      btPointsTotal[p.playerId] = (btPointsTotal[p.playerId] || 0) + btPoints[i];
    });
  }

  const llmOverallRank = ranksDescending(llmTotal);
  const btOverallRank = ranksDescending(btPointsTotal);
  const overallRows: OverallRow[] = Object.keys(llmTotal)
    .map((id) => ({
      playerName: nameById[id],
      llmTotal: llmTotal[id],
      llmRank: llmOverallRank[id],
      btPoints: btPointsTotal[id],
      btRank: btOverallRank[id],
      deltaRank: llmOverallRank[id] - btOverallRank[id],
    }))
    .sort((a, b) => a.llmRank - b.llmRank);

  const report: GameReport = {
    gameCode,
    rounds,
    overall: {
      rows: overallRows,
      spearman: spearmanRho(llmTotal, btPointsTotal),
      kendall: kendallTau(llmTotal, btPointsTotal),
    },
  };

  const outPath = `bt-report-${gameCode}.html`;
  writeFileSync(outPath, renderHtml(report));
  console.log(renderConsole(report));
  console.log(`\nHTML report written to ${outPath}`);
}

const arg = process.argv[2];
(arg ? run(arg) : listGames())
  .then(() => process.exit(process.exitCode || 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
