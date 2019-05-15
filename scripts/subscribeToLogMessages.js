// listen to log messages from robot and autoredeploy script

/* eslint-disable no-console */
'use strict';

const path = require('path');

const PubNub = require('pubnub');
const dotenv = require('dotenv');

const LOG_CHANNEL = 'LOG';
const DEPLOY_CHANNEL = 'DEPLOY';

const ENV = '../.env';

dotenv.config({
  path: path.resolve(process.cwd(), ENV)
});

const { PUBLISH_KEY, SUBSCRIBE_KEY, AUTHORIZATION_TOKEN } = process.env;

const pubnub = new PubNub({
  publishKey: PUBLISH_KEY,
  subscribeKey: SUBSCRIBE_KEY,
  authKey: AUTHORIZATION_TOKEN,
  ssl: true
});

function subscribeToLogChannel() {
  pubnub.addListener({
    message: ({ message }) => {
      console.info(message);
    }
  });

  pubnub.subscribe({
    channels: [LOG_CHANNEL, DEPLOY_CHANNEL]
  });
}

subscribeToLogChannel();
