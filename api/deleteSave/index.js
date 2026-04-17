const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER = 'decades-saves';

module.exports = async function (context, req) {
  const userId = req.query.userId;
  const saveId = (req.query.saveId || '').toString();

  if (!userId || !saveId) {
    context.res = { status: 400, body: 'Missing userId or saveId' };
    return;
  }

  // Prevent deleting internal blobs like subscription.json
  if (saveId.includes('/') || saveId.includes('..')) {
    context.res = { status: 400, body: 'Invalid saveId' };
    return;
  }

  try {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING not set');

    const blobService = BlobServiceClient.fromConnectionString(connStr);
    const container = blobService.getContainerClient(CONTAINER);
    const blob = container.getBlockBlobClient(`${userId}/saves/${saveId}.json`);

    const deleted = await blob.deleteIfExists();

    if (!deleted.succeeded) {
      context.res = { status: 404, body: 'Save not found' };
      return;
    }

    context.res = { status: 200, body: 'Deleted' };
  } catch (err) {
    context.log.error('deleteSave error:', err);
    context.res = { status: 500, body: 'Internal error' };
  }
};
