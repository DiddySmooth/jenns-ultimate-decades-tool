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
  const userId = req.query.userId;
  if (!userId) {
    context.res = { status: 400, body: 'Missing userId' };
    return;
  }

  try {
    const bodyStr = req.rawBody || JSON.stringify(req.body);
    JSON.parse(bodyStr); // validate

    const blobClient = getBlobClient(userId);
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
