const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER = 'decades-saves';

function getBlobClient(userId) {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING not set');
  const blobService = BlobServiceClient.fromConnectionString(connStr);
  const container = blobService.getContainerClient(CONTAINER);
  return container.getBlockBlobClient(`${userId}/tracker.json`);
}

app.http('getSave', {
  methods: ['GET'],
  authLevel: 'anonymous', // auth handled by staticwebapp.config.json
  handler: async (request, context) => {
    const principal = request.headers.get('x-ms-client-principal');
    if (!principal) {
      return { status: 401, body: 'Unauthorized' };
    }

    const decoded = JSON.parse(Buffer.from(principal, 'base64').toString('utf8'));
    const userId = decoded.userId;

    try {
      const blobClient = getBlobClient(userId);
      const download = await blobClient.download();
      const body = await streamToString(download.readableStreamBody);
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body,
      };
    } catch (err) {
      if (err.statusCode === 404) {
        return { status: 404, body: 'No save found' };
      }
      context.error('getSave error:', err);
      return { status: 500, body: 'Internal error' };
    }
  },
});

async function streamToString(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
