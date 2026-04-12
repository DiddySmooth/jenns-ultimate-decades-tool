const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER = 'decades-saves';

function getContainer() {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING not set');
  const blobService = BlobServiceClient.fromConnectionString(connStr);
  return blobService.getContainerClient(CONTAINER);
}

module.exports = async function (context, req) {
  const userId = req.query.userId;
  if (!userId) {
    context.res = { status: 400, body: 'Missing userId' };
    return;
  }

  try {
    const container = getContainer();
    const prefix = `${userId}/`;

    const saves = [];
    for await (const blob of container.listBlobsFlat({ prefix })) {
      // Expect keys like {userId}/saves/{saveId}.json OR legacy {userId}/tracker.json
      const name = blob.name;
      saves.push({
        key: name,
        size: blob.properties.contentLength ?? null,
        lastModified: blob.properties.lastModified ?? null,
      });
    }

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saves }),
    };
  } catch (err) {
    context.log.error('listSaves error:', err);
    context.res = { status: 500, body: 'Internal error' };
  }
};
