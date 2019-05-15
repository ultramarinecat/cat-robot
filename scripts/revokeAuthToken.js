// revoke pubnub auth token
/* eslint-disable no-console */
'use strict';

const { revokeToken } = require('../utils/authToken');

const args = process.argv.slice(2);

if (args.length < 1) {
  console.info('please specify token');
  process.exit(1);
}

const token = args[0];

revokeToken(token)
  .then(() => {
    console.info(`revoked auth token: ${token}`);
  })
  .catch(e => {
    console.error('error ocurred revoking auth token', e);
  });
