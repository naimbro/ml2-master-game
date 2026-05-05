/**
 * Seed script for Firestore
 * Uploads judges configuration from content/judges/default_judges.json
 *
 * Run with: node scripts/seed-firestore.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'ml2-master-game'
});

const db = admin.firestore();

async function seedJudges() {
  console.log('Reading judges configuration...');

  const judgesPath = path.join(__dirname, '../content/judges/default_judges.json');
  const judgesData = JSON.parse(fs.readFileSync(judgesPath, 'utf8'));

  console.log(`Found ${judgesData.judges.length} judges`);

  await db.collection('config').doc('judges').set(judgesData);

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
