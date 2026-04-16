const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER = 'decades-saves';

module.exports = async function (context, req) {
  const userId = req.query.userId;
  if (!userId) {
    context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing userId' }) };
    return;
  }

  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) {
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Storage not configured' }) };
    return;
  }

  try {
    const blobService = BlobServiceClient.fromConnectionString(connStr);
    const container = blobService.getContainerClient(CONTAINER);
    const blob = container.getBlockBlobClient(`${userId}/subscription.json`);
    const download = await blob.download();
    const chunks = [];
    for await (const chunk of download.readableStreamBody) chunks.push(chunk);
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    if (err.statusCode === 404) {
      // No subscription blob = free user
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'free' }),
      };
      return;
    }
    context.log.error('getSubscription error:', err.message);
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
