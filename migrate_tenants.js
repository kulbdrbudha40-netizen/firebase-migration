// migrate_tenants.js
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const LEGACY_TENANT = 'dpp_internal';
const COLLECTIONS_TO_MIGRATE = [
  'items', 'categories', 'transactions', 'requests', 'notifications', 
  'checklistTemplates', 'checklistInstances', 'checklistAuditLogs', 'settingsAuditLogs'
];

async function migrate() {
  console.log(`Starting migration. Assigning existing data to tenant: ${LEGACY_TENANT}`);
  
  for (const collection of COLLECTIONS_TO_MIGRATE) {
    const snap = await db.collection(collection).get();
    const batch = db.batch();
    let count = 0;

    snap.forEach((doc) => {
      if (!doc.data().tenantId) {
        batch.update(doc.ref, { tenantId: LEGACY_TENANT });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Migrated ${count} documents in '${collection}'`);
    } else {
      console.log(`Collection '${collection}' is already up to date.`);
    }
  }
  
  // Update internal users with custom claims for the frontend
  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    await admin.auth().setCustomUserClaims(userDoc.id, { tenantId: LEGACY_TENANT });
    await userDoc.ref.update({ tenantId: LEGACY_TENANT });
  }
  
  console.log('Migration complete. Legacy data safely isolated.');
}

migrate().catch(console.error);