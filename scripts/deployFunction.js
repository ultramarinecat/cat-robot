// pubnub function to send deploy messages

/* eslint-disable no-unused-vars, global-require */
'use strict';

export default (request, response) => {
  const pubnub = require('pubnub');

  const DEPLOY_CHANNEL = 'DEPLOY';

  const UPDATE_MESSAGE = 'UPDATE';
  const RESTART_MESSAGE = 'RESTART';
  const REBOOT_MESSAGE = 'REBOOT';
  const SHUTDOWN_MESSAGE = 'SHUTDOWN';

  const { restart, reboot, shutdown } = request.params;

  let message;

  if (shutdown) {
    message = SHUTDOWN_MESSAGE;
  } else if (reboot) {
    message = REBOOT_MESSAGE;
  } else if (restart) {
    message = RESTART_MESSAGE;
  } else {
    message = UPDATE_MESSAGE;
  }

  return pubnub.publish({
    channel: DEPLOY_CHANNEL,
    message
  });
};
