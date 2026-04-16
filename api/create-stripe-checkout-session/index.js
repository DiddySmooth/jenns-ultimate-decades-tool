const Stripe = require('stripe');

module.exports = async function (context, req) {
  const priceId = process.env.STRIPE_PRICE_ID;
  const secret = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.SITE_URL || 'https://wonderful-tree-03105d910.6.azurestaticapps.net';

  const jsonRes = (status, data) => ({
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!secret) {
    context.res = jsonRes(500, { error: 'Missing STRIPE_SECRET_KEY' });
    return;
  }
  if (!priceId) {
    context.res = jsonRes(500, { error: 'Missing STRIPE_PRICE_ID' });
    return;
  }

  // userId passed in body so we can store it in Stripe metadata
  const userId = (req.body && req.body.userId) ? req.body.userId : null;
  if (!userId) {
    context.res = jsonRes(400, { error: 'Missing userId in request body' });
    return;
  }

  try {
    const stripe = new Stripe(secret, { apiVersion: '2022-11-15' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // Store userId in metadata so webhook can map back to the user
      metadata: { userId },
      subscription_data: {
        metadata: { userId },
      },
      success_url: `${siteUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?checkout=cancel`,
    });

    context.res = jsonRes(200, { url: session.url });
  } catch (err) {
    context.log.error('create-checkout error:', err && err.message ? err.message : err);
    context.res = jsonRes(500, {
      error: 'Failed to create checkout session',
      details: err && err.message ? err.message : String(err),
    });
  }
};
