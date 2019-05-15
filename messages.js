// messages
'use strict';

const keymirror = require('keymirror');

const messages = keymirror({
  // internal
  UPDATE: null,
  RESTART: null,
  REBOOT: null,
  SHUTDOWN: null,
  RESTARTING: null,
  BOARD_READY: null,
  SHUTTING_DOWN: null,
  CRASHING: null,
  ERROR_STATE: null,
  START_RECORDING_PROXIMITIES: null,
  STOP_RECORDING_PROXIMITIES: null,
  TURN_RIGHT: null,
  TURN_LEFT: null,
  // for communicating with connected clients
  CONNECTION_REQUEST: null,
  CONNECTED: null,
  CONFLICT: null,
  INVALID: null,
  ERROR: null,
  CONNECTION_TEST: null,
  CONNECTION_OK: null,
  RIGHT_TURN_REQUEST: null,
  LEFT_TURN_REQUEST: null,
  TURN_IN_PROGRESS: null,
  TURNING_RIGHT: null,
  TURNING_LEFT: null,
  TURN_COMPLETED: null,
  CAT_DETECTED: null
});

module.exports = messages;
