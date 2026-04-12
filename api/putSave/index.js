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

app.http('putSave', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = request.headers.get('x-ms-client-principal');
    if (!principal) {
      return { status: 401, body: 'Unauthorized' };
    }

    const decoded = JSON.parse(Buffer.from(principal, 'base64').toString('utf8'));
    const userId = decoded.userId;

    try {
      const body = await request.text();
      // Validate it's parseable JSON before storing
      JSON.parse(body);

      const blobClient = getBlobClient(userId);
      await blobClient.upload(body, Buffer.byteLength(body), {
        blobHTTPHeaders: { blobContentType: 'application/json' },
        overwrite: true,
      });

      return { status: 200, body: 'OK' };
    } catch (err) {
      context.error('putSave error:', err);
      return { status: 500, body: 'Internal error' };
    }
  },
});
