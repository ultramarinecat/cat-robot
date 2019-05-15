// send message to robot

/* eslint-disable no-console */
'use strict';

const path = require('path');
const PubNub = require('pubnub');
const dotenv = require('dotenv');

const MESSAGE_CHANNEL = 'MESSAGE';

const ENV = '../.env';

dotenv.config({
  path: path.resolve(process.cwd(), ENV)
});

const { PUBLISH_KEY, SUBSCRIBE_KEY, AUTHORIZATION_TOKEN } = process.env;

const args = process.argv.slice(2);
if (args.length < 1) {
  console.info('please specify message');
  process.exit(1);
}

// init pubnub
const pubnub = new PubNub({
  publishKey: PUBLISH_KEY,
  subscribeKey: SUBSCRIBE_KEY,
  authKey: AUTHORIZATION_TOKEN,
  ssl: true
});

const message = args[0];
const channel = args[1] || MESSAGE_CHANNEL;

console.info(`sending message: ${message}`);

pubnub.publish(
  {
    channel,
    message
  },
  ({ error }) => {
    if (error) {
      console.error('error occured sending message!');
      process.exit(1);
    }

    console.info('sent message');
    process.exit(0);
  }
);
