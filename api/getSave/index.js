const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER = 'decades-saves';

function getBlobClient(userId) {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING not set');
  const blobService = BlobServiceClient.fromConnectionString(connStr);
  const container = blobService.getContainerClient(CONTAINER);
  return container.getBlockBlobClient(`${userId}/tracker.json`);
}

module.exports = async function (context, req) {
  const principal = req.headers['x-ms-client-principal'];
  if (!principal) {
    context.res = { status: 401, body: 'Unauthorized' };
    return;
  }

  let userId;
  try {
    const decoded = JSON.parse(Buffer.from(principal, 'base64').toString('utf8'));
    userId = decoded.userId;
  } catch {
    context.res = { status: 400, body: 'Invalid principal' };
    return;
  }

  try {
    const blobClient = getBlobClient(userId);
    const download = await blobClient.download();
    const body = await streamToString(download.readableStreamBody);
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body,
    };
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
