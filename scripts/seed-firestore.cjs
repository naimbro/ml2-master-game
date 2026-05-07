/**
 * Seed script for Firestore.
 *
 * Walks content/courses/<courseId>/judges.json (one file per course) and merges
 * them into the single config/judges Firestore doc. Global evaluation settings
 * come from content/judges/global_settings.json.
 *
 * Run with: node scripts/seed-firestore.cjs
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp({
  projectId: 'ml2-master-game'
});

const db = admin.firestore();

function loadCourseJudges() {
  const coursesDir = path.join(__dirname, '../content/courses');
  const courses = fs.readdirSync(coursesDir).filter((entry) => {
    const full = path.join(coursesDir, entry);
    return fs.statSync(full).isDirectory();
  });

  const allJudges = [];
  const allWeights = {};
  const seenIds = new Set();

  for (const courseId of courses) {
    const judgesPath = path.join(coursesDir, courseId, 'judges.json');
    if (!fs.existsSync(judgesPath)) continue;

    const data = JSON.parse(fs.readFileSync(judgesPath, 'utf8'));
    for (const judge of data.judges || []) {
      if (seenIds.has(judge.judgeId)) {
        throw new Error(
          `Duplicate judgeId '${judge.judgeId}' in course '${courseId}'. Judge IDs must be globally unique.`
        );
      }
      seenIds.add(judge.judgeId);
      allJudges.push(judge);
    }
    Object.assign(allWeights, data.defaultWeights || {});
    console.log(`  loaded ${data.judges?.length || 0} judges from ${courseId}`);
  }

  return { judges: allJudges, defaultWeights: allWeights };
}

async function seedJudges() {
  console.log('Reading per-course judges configurations...');
  const merged = loadCourseJudges();

  const settingsPath = path.join(__dirname, '../content/judges/global_settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

  const payload = { ...merged, ...settings };
  console.log(`Total: ${payload.judges.length} judges across all courses`);

  await db.collection('config').doc('judges').set(payload);
  console.log('Judges configuration uploaded to Firestore!');
}

async function main() {
  try {
    await seedJudges();
    console.log('\nSeed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

main();
