const Stripe = require('stripe');
const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER = 'decades-saves';

async function setSubscription(userId, data) {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const blobService = BlobServiceClient.fromConnectionString(connStr);
  const container = blobService.getContainerClient(CONTAINER);
  const blob = container.getBlockBlobClient(`${userId}/subscription.json`);
  const body = JSON.stringify(data);
  await blob.upload(body, Buffer.byteLength(body), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
  });
}

async function deleteSubscription(userId) {
  try {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const blobService = BlobServiceClient.fromConnectionString(connStr);
    const container = blobService.getContainerClient(CONTAINER);
    const blob = container.getBlockBlobClient(`${userId}/subscription.json`);
    await blob.deleteIfExists();
  } catch (e) {
    // ignore
  }
}

module.exports = async function (context, req) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !webhookSecret) {
    context.log.error('Missing Stripe config');
    context.res = { status: 500, body: 'Stripe not configured' };
    return;
  }

  const stripe = new Stripe(secret, { apiVersion: '2022-11-15' });

  const sig = req.headers['stripe-signature'] || req.headers['Stripe-Signature'];
  let payload;
  if (Buffer.isBuffer(req.body)) {
    payload = req.body;
  } else if (req.rawBody) {
    payload = req.rawBody;
  } else if (typeof req.body === 'string') {
    payload = req.body;
  } else {
    try { payload = JSON.stringify(req.body || {}); } catch (e) { payload = ''; }
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err) {
    // Log the error details to help debug signature issues
    context.log.error('Webhook signature verification failed:', err.message);
    context.log.error('Payload type:', typeof payload, '| Is Buffer:', Buffer.isBuffer(payload), '| Length:', payload ? payload.length : 0);
    context.log.error('Sig header:', sig ? sig.substring(0, 30) + '...' : 'MISSING');
    const debugInfo = {
      error: err.message,
      payloadType: typeof payload,
      isBuffer: Buffer.isBuffer(payload),
      payloadLength: payload ? payload.length : 0,
      payloadPreview: payload ? payload.toString('utf8').substring(0, 100) : 'EMPTY',
      sigPresent: !!sig,
      sigPreview: sig ? sig.substring(0, 50) : 'MISSING',
      webhookSecretPreview: webhookSecret ? webhookSecret.substring(0, 12) + '...' : 'MISSING',
    };
    context.res = { status: 400, body: JSON.stringify(debugInfo) };
    return;
  }

  context.log.info('Stripe event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata && session.metadata.userId;
        if (!userId) { context.log.warn('checkout.session.completed: no userId in metadata'); break; }
        await setSubscription(userId, {
          status: 'active',
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          updatedAt: new Date().toISOString(),
        });
        context.log.info('Marked premium for user', userId);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata && sub.metadata.userId;
        if (!userId) { context.log.warn('subscription.updated: no userId in metadata'); break; }
        const isActive = ['active', 'trialing'].includes(sub.status);
        if (isActive) {
          await setSubscription(userId, {
            status: sub.status,
            stripeCustomerId: sub.customer,
            stripeSubscriptionId: sub.id,
            updatedAt: new Date().toISOString(),
          });
        } else {
          await deleteSubscription(userId);
          context.log.info('Revoked premium for user', userId, 'status:', sub.status);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata && sub.metadata.userId;
        if (!userId) { context.log.warn('subscription.deleted: no userId in metadata'); break; }
        await deleteSubscription(userId);
        context.log.info('Subscription deleted for user', userId);
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object;
        context.log.warn('Invoice payment failed for customer', inv.customer);
        // Stripe will retry automatically; subscription.updated will fire if it lapses
        break;
      }

      default:
        context.log.info('Unhandled event type', event.type);
    }
  } catch (err) {
    context.log.error('Webhook handler error:', err && err.stack ? err.stack : err);
    context.res = { status: 500, body: 'Handler error' };
    return;
  }

  context.res = { status: 200, body: 'OK' };
};
