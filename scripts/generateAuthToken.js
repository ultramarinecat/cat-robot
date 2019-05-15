// generate pubnub auth token with specified ttl in minutes
//
// add as AUTHORIZATION_TOKEN to robot .env file
/* eslint-disable no-console */
'use strict';

const { generateToken } = require('../utils/authToken');

const DEFAULT_TTL = 20160;

const args = process.argv.slice(2);

const ttl = args.length > 0 ? args[0] : DEFAULT_TTL;

generateToken(ttl)
  .then(token => {
    console.info(`auth token: ${token} (ttl: ${ttl} minutes)`);
  })
  .catch(e => {
    console.error('error ocurred generating auth token', e);
  });
