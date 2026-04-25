const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER = 'decades-saves';
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

function getConn() {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING not set');
  return connStr;
}

function getAccountName(connStr) {
  const m = connStr.match(/AccountName=([^;]+)/i);
  return m ? m[1] : null;
}

function extFromMime(mime) {
  if (!mime) return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

module.exports = async function (context, req) {
  const userId = req.query.userId;
  const saveId = req.query.saveId || 'default';
  if (!userId) {
    context.res = { status: 400, body: 'Missing userId' };
    return;
  }

  try {
    const bodyStr = req.rawBody || JSON.stringify(req.body);
    const body = JSON.parse(bodyStr);

    const simId = body.simId;
    const mimeType = body.mimeType;
    const dataBase64 = body.dataBase64;
    const blobNameOverride = body.blobName; // optional — e.g. simId_lifeStageId

    if (!simId || !dataBase64) {
      context.res = { status: 400, body: 'Missing simId or dataBase64' };
      return;
    }

    const bytes = Buffer.from(dataBase64, 'base64');
    if (bytes.length > MAX_BYTES) {
      context.res = { status: 413, body: 'Image too large' };
      return;
    }

    const ext = extFromMime(mimeType);
    const blobBaseName = blobNameOverride || simId;
    const key = `${userId}/media/${saveId}/avatars/${blobBaseName}.${ext}`;

    const connStr = getConn();
    const blobService = BlobServiceClient.fromConnectionString(connStr);
    const container = blobService.getContainerClient(CONTAINER);
    const blobClient = container.getBlockBlobClient(key);

    await blobClient.upload(bytes, bytes.length, {
      blobHTTPHeaders: {
        blobContentType: mimeType || 'image/jpeg',
        blobCacheControl: 'public, max-age=31536000, immutable',
      },
      overwrite: true,
    });

    const account = getAccountName(connStr);
    const url = account ? `https://${account}.blob.core.windows.net/${CONTAINER}/${key}` : null;

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blobKey: key, url }),
    };
  } catch (err) {
    context.log.error('uploadAvatar error:', err);
    context.res = { status: 500, body: 'Internal error' };
  }
};
