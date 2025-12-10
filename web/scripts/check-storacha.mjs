import * as Client from '@storacha/client';
import * as Proof from '@storacha/client/proof';
import { StoreMemory } from '@storacha/client/stores/memory';
import { Signer } from '@storacha/client/principal/ed25519';
import dotenv from 'dotenv';

dotenv.config();

// Create Storacha client like in ucan-delegation.ts
const principal = Signer.parse(process.env.ALICE_STORACHA_KEY);
const store = new StoreMemory();

console.log('Creating client with Storacha principal:', principal.did());
const client = await Client.create({ principal, store });

const proof = await Proof.parse(process.env.ALICE_STORACHA_PROOF);
const space = await client.addSpace(proof);
await client.setCurrentSpace(space.did());

console.log('Client ready with space:', space.did());

// List using three methods like orbitdb-storacha-bridge
const opts = { size: 1000000 };

console.log('\n=== upload.list ===');
try {
  const uploadRes = await client.capability.upload.list(opts);
  console.log('count:', uploadRes.results?.length || 0);
  console.log(JSON.stringify(uploadRes.results || [], null, 2));
} catch (e) {
  console.error('upload.list failed:', e?.message || e);
}

console.log('\n=== store.list ===');
try {
  const storeRes = await client.capability.store.list(opts);
  const storeCIDs = (storeRes.results || []).map(s => s.link?.toString?.() || s.link);
  console.log('count:', storeCIDs.length);
  console.log(JSON.stringify(storeCIDs, null, 2));
} catch (e) {
  console.error('store.list failed:', e?.message || e);
}

console.log('\n=== blob.list ===');
try {
  const blobRes = await client.capability.blob.list(opts);
  const digests = (blobRes.results || []).map(b => Buffer.from(b.blob?.digest?.bytes || b.blob?.digest || []).toString('base64'));
  console.log('count:', digests.length);
  console.log(JSON.stringify(digests, null, 2));
} catch (e) {
  console.error('blob.list failed:', e?.message || e);
}
