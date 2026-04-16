const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER = 'decades-saves';
const FREE_SAVE_LIMIT = 2;

function getContainerClient() {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING not set');
  const blobService = BlobServiceClient.fromConnectionString(connStr);
  return blobService.getContainerClient(CONTAINER);
}

function getBlobClient(container, userId, saveId) {
  const sid = (saveId || 'default').toString();
  return container.getBlockBlobClient(`${userId}/saves/${sid}.json`);
}

async function isPremiumUser(container, userId) {
  try {
    const blob = container.getBlockBlobClient(`${userId}/subscription.json`);
    const download = await blob.download();
    const chunks = [];
    for await (const chunk of download.readableStreamBody) chunks.push(chunk);
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return data?.status === 'active' || data?.status === 'trialing';
  } catch {
    return false; // 404 or any error = free user
  }
}

async function countExistingSaves(container, userId, currentSaveId) {
  const prefix = `${userId}/saves/`;
  const saves = new Set();
  for await (const blob of container.listBlobsFlat({ prefix })) {
    // Extract saveId from path like userId/saves/<id>.json
    const match = blob.name.match(/\/saves\/(.+)\.json$/);
    if (match) saves.add(match[1]);
  }
  return saves;
}

module.exports = async function (context, req) {
  const userId = req.query.userId;
  const saveId = (req.query.saveId || 'default').toString();

  if (!userId) {
    context.res = { status: 400, body: 'Missing userId' };
    return;
  }

  try {
    const bodyStr = req.rawBody || JSON.stringify(req.body);
    JSON.parse(bodyStr); // validate JSON

    const container = getContainerClient();
    const blobClient = getBlobClient(container, userId, saveId);

    // Check if this save already exists (update is always allowed)
    const alreadyExists = await blobClient.exists();

    if (!alreadyExists) {
      // New save — enforce the limit for free users
      const premium = await isPremiumUser(container, userId);
      if (!premium) {
        const existingSaves = await countExistingSaves(container, userId);
        if (existingSaves.size >= FREE_SAVE_LIMIT) {
          context.res = {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              error: 'Save limit reached',
              message: `Free accounts are limited to ${FREE_SAVE_LIMIT} trackers. Upgrade to premium for unlimited saves.`,
              limit: FREE_SAVE_LIMIT,
              current: existingSaves.size,
            }),
          };
          return;
        }
      }
    }

    await blobClient.upload(bodyStr, Buffer.byteLength(bodyStr), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
      overwrite: true,
    });

    context.res = { status: 200, body: 'OK' };
  } catch (err) {
    context.log.error('putSave error:', err);
    context.res = { status: 500, body: 'Internal error' };
  }
};
