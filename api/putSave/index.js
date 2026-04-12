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
    const body = req.rawBody || await streamToString(req.body);
    // Validate JSON before storing
    JSON.parse(typeof body === 'string' ? body : JSON.stringify(body));
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

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

async function streamToString(body) {
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  const chunks = [];
  for await (const chunk of body) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}
