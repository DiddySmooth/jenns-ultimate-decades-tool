const Stripe = require('stripe');

module.exports = async function (context, req) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    context.log.error('STRIPE_SECRET_KEY not configured');
    context.res = { status: 500, body: 'Stripe not configured' };
    return;
  }
  if (!webhookSecret) {
    context.log.error('STRIPE_WEBHOOK_SECRET not configured');
    context.res = { status: 500, body: 'Webhook secret not configured' };
    return;
  }

  const stripe = new Stripe(secret, { apiVersion: '2022-11-15' });

  // Azure Functions may provide raw body as req.rawBody or req.body; prefer raw
  const sig = req.headers['stripe-signature'] || req.headers['Stripe-Signature'];
  let payload = req.rawBody;
  if (!payload) {
    // Fall back to stringified body if rawBody isn't present
    try {
      payload = JSON.stringify(req.body || {});
    } catch (e) {
      payload = '';
    }
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err) {
    context.log.error('Webhook signature verification failed:', err.message);
    context.res = { status: 400, body: `Webhook Error: ${err.message}` };
    return;
  }

  context.log.info('Received Stripe event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // Optionally: use session.metadata.userId to map to your user
        context.log.info('Checkout session completed for', session.id, 'metadata:', session.metadata);
        // TODO: mark subscription active / store mapping in your DB or blob
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'invoice.paid': {
        const obj = event.data.object;
        context.log.info('Subscription/invoice event', event.type, obj.id);
        // TODO: update subscription record
        break;
      }
      case 'invoice.payment_failed':
      case 'customer.subscription.deleted': {
        const obj = event.data.object;
        context.log.info('Subscription cancelled/failed', event.type, obj.id);
        // TODO: mark subscription inactive
        break;
      }
      default:
        context.log.info(`Unhandled event type ${event.type}`);
    }
  } catch (err) {
    context.log.error('Error handling event:', err);
    // Respond 500 so Stripe will retry the webhook
    context.res = { status: 500, body: 'Handler error' };
    return;
  }

  context.res = { status: 200, body: 'OK' };
};