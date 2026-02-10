import * as functions from 'firebase-functions';

export const testFunction = functions
  .region('us-central1')
  .https.onRequest((req, res) => {
    res.send('Hello from Firebase!');
  });
