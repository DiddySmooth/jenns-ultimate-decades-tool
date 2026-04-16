const Stripe = require('stripe');

module.exports = async function (context, req) {
  const priceId = process.env.STRIPE_PRICE_ID;
  const secret = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.SITE_URL || 'https://wonderful-tree-03105d910.6.azurestaticapps.net';

  if (!secret) {
    context.log.error('STRIPE_SECRET_KEY not configured');
    context.res = { status: 500, body: 'Stripe not configured' };
    return;
  }
  if (!priceId) {
    context.log.error('STRIPE_PRICE_ID not configured');
    context.res = { status: 500, body: 'Price not configured' };
    return;
  }

  const stripe = new Stripe(secret, { apiVersion: '2022-11-15' });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        { price: priceId, quantity: 1 },
      ],
      success_url: `${siteUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?checkout=cancel`,
    });

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { url: session.url },
    };
  } catch (err) {
    context.log.error('create-checkout error', err);
    context.res = { status: 500, body: 'Failed to create checkout session' };
  }
};