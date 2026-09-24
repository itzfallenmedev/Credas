const paypal = require('@paypal/checkout-server-sdk');
const config = require('../config.js');

const environment = config.DebugMode
  ? new paypal.core.SandboxEnvironment(
      config.Payments.PayPal.clientID,
      config.Payments.PayPal.clientSecret
    )
  : new paypal.core.LiveEnvironment(
      config.Payments.PayPal.clientID,
      config.Payments.PayPal.clientSecret
    );

const paypalClientInstance = new paypal.core.PayPalHttpClient(environment);

module.exports = paypalClientInstance;