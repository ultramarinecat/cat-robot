// sends message to rebot to get the latest and redeploy
//
// call from git commit hook or after successfully running tests

/* eslint-disable no-console */
'use strict';

const path = require('path');
const PubNub = require('pubnub');
const dotenv = require('dotenv');

const DEPLOY_CHANNEL = 'DEPLOY';
// const LOG_CHANNEL      = 'LOG';
const UPDATE_MESSAGE = 'UPDATE';

const ENV = '.env';

dotenv.config({
  path: path.resolve(process.cwd(), ENV)
});

const { PUBLISH_KEY, SUBSCRIBE_KEY, AUTHORIZATION_TOKEN } = process.env;

// init pubnub
const pubnub = new PubNub({
  publishKey: PUBLISH_KEY,
  subscribeKey: SUBSCRIBE_KEY,
  authKey: AUTHORIZATION_TOKEN,
  ssl: true
});

sendRedeployMessage();

// uncomment if running manually to see reploy logs
// subscribeToLogChannel();

// send message to redeploy
function sendRedeployMessage() {
  console.info('sending redeploy message...');

  return pubnub.publish(
    {
      channel: DEPLOY_CHANNEL,
      message: UPDATE_MESSAGE
    },
    ({ error }) => {
      if (error) {
        console.error('error occured sending redeploy message!');
        process.exit(1);
      }

      console.info('sent redeploy message');
      process.exit(0); // (comment out if running manually to see redeploy logs)
    }
  );
}

// // subscribe to log channel
// function subscribeToLogChannel() {
//   pubnub.addListener({
//     message: ({ message }) => {
//       console.info(message);
//     }
//   });

//   pubnub.subscribe({
//     channels: [LOG_CHANNEL]
//   });
// }
