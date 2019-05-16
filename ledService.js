// LED service
'use strict';

const five = require('johnny-five');
const _ = require('lodash');

const pubsub = require('./pubsub');
const logger = require('./logger');
const messages = require('./messages');
const { pins } = require('./boardService');

const STARTUP_LED_BLINK_RATE = 75;
const STARTUP_LED_ON_DELAY = 20000;
const ERROR_LED_BLINK_RATE = 750;

const CAT_DETECTED_LED_BLINK_RATE = 60;
const CAT_DETECTED_LED_BLICK_DELAY = 2250;

const UNCAUGHT_EXCEPTION = 'uncaughtException';
const ERROR_EXIT_DELAY = 1500;

process.on(UNCAUGHT_EXCEPTION, handleUncaughException);

// publish error messages and shut down
function handleUncaughException(e) {
  logger.error('led service uncaughtException occured!', e);

  pubsub.pub(messages.CRASHING);

  const timer = setTimeout(() => {
    process.exit(1);
  }, ERROR_EXIT_DELAY);

  timer.unref();
}

let leds;
let successLed;
let errorLed;

// init LEDs, subscribe to error/shutdown events
function startup() {
  return new Promise((resolve, reject) => {
    leds = Object.freeze({
      RED_LED: new five.Led(pins.PIN_3),
      GREEN_LED: new five.Led(pins.PIN_2)
    });

    successLed = leds.GREEN_LED;
    errorLed = leds.RED_LED;

    // listen to cat detected or error/shutdown messages and set LEDs
    /* eslint-disable eqeqeq */
    pubsub
      .sub(message => {
        if (message == messages.CAT_DETECTED) {
          // blink green led
          indicateCatDetected();
          return;
        }

        if (message == messages.ERROR_STATE) {
          // blink red led
          indicateError();
          return;
        }

        if (message == messages.CRASHING) {
          // leave on red led
          indicateError(true);
          return;
        }

        /* istanbul ignore else */
        if (message == messages.SHUTTING_DOWN) {
          // turn off all leds
          turnOffAllLeds();
        }
      })
      .then(() => {
        resolve();
      })
      .catch(
        /* istanbul ignore next */ e => {
          logger.info('an error occurred subscribing to error messages: ', e);

          pubsub.pub(messages.ERROR_STATE);
          reject(e);
        }
      );
    /* eslint-enable eqeqeq */
  });
}

// blink and then turn on green led
function indicateStartupSuccess() {
  return new Promise((resolve, reject) => {
    successLed.blink(STARTUP_LED_BLINK_RATE);

    setTimeout(() => {
      successLed.stop().on();
      resolve();
    }, STARTUP_LED_ON_DELAY);
  });
}

// blink green led
function indicateCatDetected() {
  successLed.blink(CAT_DETECTED_LED_BLINK_RATE);

  setTimeout(() => {
    successLed.stop().on();
  }, CAT_DETECTED_LED_BLICK_DELAY);
}

// blink or leave on red led, indicating error state or crash
function indicateError(crashing) {
  successLed.stop().off();

  if (crashing) {
    errorLed.on();
    return;
  }

  errorLed.blink(ERROR_LED_BLINK_RATE);
}

// turn off all leds
function turnOffAllLeds() {
  _.forOwn(leds, led => {
    led.stop().off();
  });
}

exports.startup = startup;

exports.indicateStartupSuccess = indicateStartupSuccess;
exports.startupLedDelay = STARTUP_LED_ON_DELAY;
exports.catDetectedLedDelay = CAT_DETECTED_LED_BLICK_DELAY;
