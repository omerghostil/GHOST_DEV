import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'ghost-prod-fc874';
const configPath = join(homedir(), '.config/configstore/firebase-tools.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const ACCESS_TOKEN = config.tokens.access_token;

async function listCollections(parentPath = '') {
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const url = parentPath ? `${baseUrl}/${parentPath}:listCollectionIds` : `${baseUrl}:listCollectionIds`;
  const res = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' }, body: '{}' });
  if (!res.ok) throw new Error(`listCollections ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.collectionIds || [];
}

function parseVal(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) { const r = {}; for (const [k, val] of Object.entries(v.mapValue.fields || {})) r[k] = parseVal(val); return r; }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseVal);
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('referenceValue' in v) return v.referenceValue;
  return v;
}

async function listDocs(path, pageToken) {
  const params = new URLSearchParams({ pageSize: '300' });
  if (pageToken) params.set('pageToken', pageToken);
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}?${params}`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } });
  if (!res.ok) throw new Error(`listDocs ${res.status}: ${await res.text()}`);
  return res.json();
}

async function exportCol(path, depth = 0) {
  if (depth > 4) return {};
  const docs = {};
  let pt = null;
  do {
    const r = await listDocs(path, pt);
    for (const doc of (r.documents || [])) {
      const id = doc.name.split('/').pop();
      const d = {};
      for (const [k, v] of Object.entries(doc.fields || {})) d[k] = parseVal(v);
      d.__meta = { createTime: doc.createTime, updateTime: doc.updateTime };
      try {
        const subs = await listCollections(`${path}/${id}`);
        if (subs.length) {
          d.__subcollections = {};
          for (const s of subs) d.__subcollections[s] = await exportCol(`${path}/${id}/${s}`, depth + 1);
        }
      } catch (e) {}
      docs[id] = d;
    }
    pt = r.nextPageToken;
  } while (pt);
  return docs;
}

async function main() {
  console.log('=== Firestore Export ===');
  console.log(`Project: ${PROJECT_ID}\n`);
  const cols = await listCollections();
  console.log(`Found ${cols.length} collections:`, cols, '\n');
  const exp = {};
  for (const c of cols) {
    process.stdout.write(`  ${c}...`);
    exp[c] = await exportCol(c);
    console.log(` ${Object.keys(exp[c]).length} docs`);
  }
  writeFileSync(join(__dirname, 'firestore_full_export.json'), JSON.stringify(exp, null, 2));
  console.log('\nDone!');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
