const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER = 'decades-saves';

function getBlobClient(userId, saveId) {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING not set');
  const blobService = BlobServiceClient.fromConnectionString(connStr);
  const container = blobService.getContainerClient(CONTAINER);

  const sid = (saveId || 'default').toString();
  // New layout
  const key = `${userId}/saves/${sid}.json`;
  return container.getBlockBlobClient(key);
}

module.exports = async function (context, req) {
  const userId = req.query.userId;
  const saveId = req.query.saveId;
  if (!userId) {
    context.res = { status: 400, body: 'Missing userId' };
    return;
  }

  try {
    // Try new save key first
    try {
      const blobClient = getBlobClient(userId, saveId);
      const download = await blobClient.download();
      const body = await streamToString(download.readableStreamBody);
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body,
      };
      return;
    } catch (err) {
      if (err.statusCode !== 404) throw err;

      // Legacy fallback ONLY for the default save
      const sid = (saveId || 'default').toString();
      if (sid !== 'default') {
        context.res = { status: 404, body: 'No save found' };
        return;
      }

      const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
      const blobService = BlobServiceClient.fromConnectionString(connStr);
      const container = blobService.getContainerClient(CONTAINER);
      const legacyClient = container.getBlockBlobClient(`${userId}/tracker.json`);
      const download = await legacyClient.download();
      const body = await streamToString(download.readableStreamBody);
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body,
      };
      return;
    }
  } catch (err) {
    if (err.statusCode === 404) {
      context.res = { status: 404, body: 'No save found' };
      return;
    }
    context.log.error('getSave error:', err);
    context.res = { status: 500, body: 'Internal error' };
  }
};

async function streamToString(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
