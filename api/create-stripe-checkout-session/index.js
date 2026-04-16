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
    context.log.error('STRIPE_SECRET_KEY not configured');
    context.res = jsonRes(500, { error: 'Stripe not configured: missing STRIPE_SECRET_KEY' });
    return;
  }
  if (!priceId) {
    context.log.error('STRIPE_PRICE_ID not configured');
    context.res = jsonRes(500, { error: 'Stripe not configured: missing STRIPE_PRICE_ID' });
    return;
  }

  try {
    const stripe = new Stripe(secret, { apiVersion: '2022-11-15' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
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
