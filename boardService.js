// arduino board service
'use strict';

const five = require('johnny-five');

const pubsub = require('./pubsub');
const logger = require('./logger');
const messages = require('./messages');

const UNCAUGHT_EXCEPTION = 'uncaughtException';
const ERROR_EXIT_DELAY = 1500;

process.on(UNCAUGHT_EXCEPTION, handleUncaughException);

// publish error messages and shut down
function handleUncaughException(e) {
  logger.error('board service uncaughtException occured!', e);

  pubsub.pub(messages.CRASHING);

  const timer = setTimeout(() => {
    process.exit(1);
  }, ERROR_EXIT_DELAY);

  timer.unref();
}

// board (arduino)
let board;

// board events
const READY = 'ready';

// arduino pins
const pins = Object.freeze({
  // digital
  PIN_0: 0,
  PIN_1: 1,
  PIN_2: 2,
  PIN_3: 3, // pwm
  PIN_4: 4,
  PIN_5: 5,
  PIN_6: 6, // pwm
  PIN_7: 7,
  PIN_8: 8,
  PIN_9: 9, // pwm
  PIN_10: 10, // pwm
  PIN_11: 11, // pwm
  PIN_12: 12,
  PIN_13: 13,
  // analog
  PIN_A0: 'A0',
  PIN_A1: 'A1',
  PIN_A2: 'A2',
  PIN_A3: 'A3',
  PIN_A4: 'A4',
  PIN_A5: 'A5'
});

exports.pins = pins;

// init johnny-five board, send message when board ready
exports.startup = function startup() {
  return new Promise((resolve, reject) => {
    try {
      board = new five.Board({
        repl: false,
        sigint: false // don't exit right away on sigint so that can send shut down messages
      });
    } catch (e) /* istanbul ignore next */ {
      logger.error('an error occured trying to init board!', e);
      reject(e);
    }

    board.on(READY, () => {
      logger.info('board ready');

      pubsub.pub(messages.BOARD_READY);
      resolve();
    });
  });
};

// register handler to be called whenever the board reports the value (0 or 1) of specified pin
exports.digitalRead = function digitalRead(pin, handler) {
  return board.digitalRead(pin, handler);
};

// write digital value (0 or 1) to pin
exports.digitalWrite = function digitalWrite(pin, value) {
  return board.digitalWrite(pin, value);
};

// register handler to be called whenever the board reports the voltage value (0-1023) of specified pin
exports.analogRead = function analogRead(pin, handler) {
  return board.analogRead(pin, handler);
};

// write an analog value (0-255) to (pwm) pin
exports.analogWrite = function analogWrite(pin, value) {
  return board.analogWrite(pin, value);
};
