// navigation service
'use strict';

const five = require('johnny-five');
const _ = require('lodash');

const pubsub = require('./pubsub');
const logger = require('./logger');
const messages = require('./messages');
const { pins } = require('./boardService');

const NORMAL_SPEED = 0.04;
const REVERSE_SPEED = 0.025;
const TURNING_SPEED = 0.03;

const TURN_DURATION = 1000;
const BACK_UP_DURATION = 650;

const PROXIMITY_DATA_EVENT = 'data';
const PROXIMITY_DATA_EVENT_FREQUENCY = 100;
const PROXIMITY_SENSOR_CONTROLLER = 'GP2Y0A41SK0F'; // Sharp GP2Y0A41SK0F (short range)

const MAX_RECENT_TURNS = 3;
const MAX_RECENT_TURNS_TIMEFRAME = 15000;
const PROXIMITIES_RECODING_DURATION = 1500;

const MIN_PROXIMITY = 8; // cm
const MAX_PROXIMITY = 25;

const UNCAUGHT_EXCEPTION = 'uncaughtException';
const ERROR_EXIT_DELAY = 1500;

process.on(UNCAUGHT_EXCEPTION, handleUncaughException);

// publish error messages and shut down
function handleUncaughException(e) {
  logger.error('navigation service uncaughtException occured!', e);

  pubsub.pub(messages.CRASHING);

  const timer = setTimeout(() => {
    process.exit(1);
  }, ERROR_EXIT_DELAY);

  timer.unref();
}

let leftWheel;
let rightWheel;
let turning = false;
let dispalyTurnInProgress = false;
let recordingProximities = false;
const recentTurns = [];
const proximities = new Set();

// init navigation
function startup() {
  return new Promise((resolve, reject) => {
    // init servos (wheels)
    leftWheel = new five.Servo.Continuous({
      pin: pins.PIN_5
    });
    leftWheel.stop();

    rightWheel = new five.Servo.Continuous({
      pin: pins.PIN_6,
      invert: true
    });
    rightWheel.stop();

    // init ir sensor
    const proximitySensor = new five.Proximity({
      controller: PROXIMITY_SENSOR_CONTROLLER,
      freq: PROXIMITY_DATA_EVENT_FREQUENCY,
      pin: pins.PIN_A0
    });

    // listen for ir sensor data events
    proximitySensor.on(PROXIMITY_DATA_EVENT, handleProximityChange);

    // listen for turn messages or error/shutdown messages to stop wheels
    /* eslint-disable eqeqeq */
    pubsub
      .sub(message => {
        if (
          message == messages.SHUTTING_DOWN ||
          message == messages.CRASHING ||
          message == messages.ERROR_STATE
        ) {
          stop();
          return;
        }

        if (message == messages.TURN_LEFT) {
          turnLeft(false);
          return;
        }

        if (message == messages.TURN_RIGHT) {
          turnRight(false);
        }
      })
      .then(() => {
        resolve();
      })
      .catch(
        /* istanbul ignore next */ e => {
          logger.warn('an error occurred subscribing to shutdown/error messages: ', e);

          pubsub.pub(messages.ERROR_STATE);
          reject(e);
        }
      );
    /* eslint-enable eqeqeq */
  });
}

// move forward
function moveForward() {
  logger.info('moving forward...');

  if (dispalyTurnInProgress) {
    pubsub.pub(messages.TURN_COMPLETED);
    dispalyTurnInProgress = false;
  }

  leftWheel.cw(NORMAL_SPEED);
  rightWheel.cw(NORMAL_SPEED);
}

// move backward
function moveBackward() {
  logger.verbose('moving backward...');

  leftWheel.ccw(REVERSE_SPEED);
  rightWheel.ccw(REVERSE_SPEED);
}

// stop
function stop() {
  logger.verbose('stopping...');

  leftWheel.stop();
  rightWheel.stop();
}

// turn right
function turnRight(autoroaming) {
  return new Promise((resolve, reject) => {
    if (!autoroaming) {
      // (autoroaming mode will keep track of whether we're turning)
      if (turning) {
        logger.info('rejecting right turn request, already turning');

        dispalyTurnInProgress = true;
        pubsub.pub(messages.TURN_IN_PROGRESS);
        return;
      }

      turning = true;
      pubsub.pub(messages.TURNING_RIGHT);
      stop();
    }

    logger.info('turning right...');

    // turn right for TURN_DURATION ms
    leftWheel.cw(TURNING_SPEED);
    rightWheel.ccw(TURNING_SPEED);

    setTimeout(() => {
      if (!autoroaming) {
        moveForward();
        pubsub.pub(messages.TURN_COMPLETED);
        turning = false;
      }

      resolve();
    }, TURN_DURATION);
  });
}

// turn left
function turnLeft(autoroaming) {
  return new Promise((resolve, reject) => {
    if (!autoroaming) {
      if (turning) {
        logger.info('rejecting right turn request, already turning');

        dispalyTurnInProgress = true;
        pubsub.pub(messages.TURN_IN_PROGRESS);
        return;
      }

      turning = true;
      pubsub.pub(messages.TURNING_LEFT);
      stop();
    }

    logger.info('turning left...');

    // turn left for TURN_DURATION ms
    leftWheel.ccw(TURNING_SPEED);
    rightWheel.cw(TURNING_SPEED);

    setTimeout(() => {
      if (!autoroaming) {
        moveForward();
        pubsub.pub(messages.TURN_COMPLETED);
        turning = false;
      }

      resolve();
    }, TURN_DURATION);
  });
}

// back up
function backUp() {
  return new Promise((resolve, reject) => {
    logger.verbose('backing up...');

    stop();
    moveBackward();

    setTimeout(() => {
      stop();
      resolve();
    }, BACK_UP_DURATION);
  });
}

// check if robot has been making too many turns lately (might be stuck in a corner)
function needToLookAround() {
  if (recentTurns.length < MAX_RECENT_TURNS) {
    return false;
  }

  return _.now() - _.first(recentTurns) < MAX_RECENT_TURNS_TIMEFRAME;
}

// record proximities and avoid obstacles
function handleProximityChange() {
  const proximity = this.cm;
  // logger.silly(`proximity: ${proximity} cm`);

  // if recording proximities, add them to the set
  if (recordingProximities) {
    // (ouf of range proximities are sometimes negative)
    proximities.add(proximity > 0 ? proximity : MAX_PROXIMITY);
    return;
  }

  // if closer than minimum proximity and not currently turning
  if (proximity < MIN_PROXIMITY && proximity > 0 && !turning) {
    turning = true;
    // logger.info('obstacle detected...');
    logger.info(`obstacle detected... (proximity: ${proximity})`);

    // keep track of the times of the last MAX_RECENT_TURNS turns
    recentTurns.push(_.now());
    if (recentTurns.length > MAX_RECENT_TURNS) {
      recentTurns.shift();
    }

    // back up a bit
    backUp()
      .then(() => {
        // if robot has been making a lot of turns lately
        if (needToLookAround()) {
          // look around to pick a direction
          logger.info('possibly in a corner, looking around...');
          return decideDirection();
        }

        // otherwise just pick left or right
        return _.random(1) ? turnLeft(true) : turnRight(true);
      })

      .then(() => {
        // keep going
        moveForward();
        turning = false;
      })

      .catch(
        /* istanbul ignore next */ e => {
          logger.error(
            'an error occurred during movement reacting to proximity event!',
            e
          );
          pubsub.pub(messages.ERROR_STATE);
        }
      );
  }
}

// look both directions and choose the one where obstacles are further away
function decideDirection() {
  return new Promise((resolve, reject) => {
    // randomly pick a direction to look first
    const lookLeftFirst = _.random(1);
    const lookInitialDirection = lookLeftFirst ? turnLeft : turnRight;
    const lookOtherDirection = lookLeftFirst ? turnRight : turnLeft;

    let initialDirectionAverageProximity = 0;
    let otherDirectionAverageProximity = 0;

    // look in that direction
    lookInitialDirection(true)
      .then(() => {
        // eslint-disable-next-line no-shadow
        return new Promise((resolve, reject) => {
          stop();
          // start recoding proximities
          recordingProximities = true;

          setTimeout(() => {
            // stop recording proximities, note the average, clear proximities set
            recordingProximities = false;
            initialDirectionAverageProximity = averageProximity(proximities);
            proximities.clear();

            logger.info(`average proximity: ${initialDirectionAverageProximity}`);
            resolve();
          }, PROXIMITIES_RECODING_DURATION);
        });
      })

      // look in the other direction
      .then(() => {
        return lookOtherDirection(true);
      })
      .then(() => {
        // (turn again because we're only back to the center)
        return lookOtherDirection(true);
      })

      .then(() => {
        // eslint-disable-next-line no-shadow
        return new Promise((resolve, reject) => {
          stop();
          // start recoding proximities
          recordingProximities = true;

          setTimeout(() => {
            // stop recording proximities, note the average, clear proximities set
            recordingProximities = false;
            otherDirectionAverageProximity = averageProximity(proximities);
            proximities.clear();

            logger.info(`average proximity: ${otherDirectionAverageProximity}`);
            resolve();
          }, PROXIMITIES_RECODING_DURATION);
        });
      })

      .then(() => {
        // if this direction has further proximities, we're all set
        if (otherDirectionAverageProximity > initialDirectionAverageProximity) {
          logger.info(`choosing ${lookLeftFirst ? 'right' : 'left'}`);

          resolve();
          return;
        }

        // otherwise, turn back to to the initial direction
        logger.info(`choosing ${lookLeftFirst ? 'left' : 'right'}`);

        lookInitialDirection(true)
          .then(() => {
            return lookInitialDirection(true);
          })
          .then(() => {
            resolve();
          })
          .catch(
            /* istanbul ignore next */ e => {
              logger.warn('an error occurred turning back to intial direction!', e);
              pubsub.pub(messages.ERROR_STATE);
            }
          );
      })
      .catch(
        /* istanbul ignore next */ e => {
          logger.warn('an error occurred deciding turning direction!', e);
          pubsub.pub(messages.ERROR_STATE);
        }
      );
  });
}

// get average of the set of proximities
/* eslint-disable no-shadow */
function averageProximity(proximities) {
  /* istanbul ignore if */
  if (proximities == null || proximities.size === 0) {
    return 0;
  }

  let sum = 0;
  for (const proximity of proximities) {
    sum += proximity;
  }

  return sum / proximities.size;
}
/* eslint-enable no-shadow */

exports.startup = startup;
exports.moveForward = moveForward;
exports.moveBackward = moveBackward;
exports.stop = stop;
exports.turnRight = turnRight;
exports.turnLeft = turnLeft;

exports.turnDuration = TURN_DURATION;
exports.backupDuration = BACK_UP_DURATION;
exports.maxRecentTurns = MAX_RECENT_TURNS;
exports.maxRecentTurnsTimeframe = MAX_RECENT_TURNS_TIMEFRAME;
exports.proximitiesRecordingDuration = PROXIMITIES_RECODING_DURATION;
exports.minProximity = MIN_PROXIMITY;
