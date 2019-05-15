// cat-robot!
'use strict';

const logger = require('./logger');
const pubsub = require('./pubsub');
const messages = require('./messages');
const boardService = require('./boardService');
const connectionService = require('./connectionService');
const ledService = require('./ledService');
const navigationService = require('./navigationService');
const catDetectionService = require('./catDetectionService');

const UNCAUGHT_EXCEPTION = 'uncaughtException';
const TERMINATION_SIGNAL = 'SIGINT';

const SIGTERM_EXIT_DELAY = 1500;
const ERROR_EXIT_DELAY = 1500;

process.on(UNCAUGHT_EXCEPTION, handleUncaughException);

// publish error messages and shut down
function handleUncaughException(e) {
  logger.error('robot uncaughtException occured!', e);

  pubsub.pub(messages.CRASHING);

  const timer = setTimeout(() => {
    process.exit(1);
  }, ERROR_EXIT_DELAY);

  timer.unref();
}

// send shutting down message on termination signal
function listenForTerminationSignal() {
  process.on(TERMINATION_SIGNAL, () => {
    logger.info('received termination signal, stopping...');
    pubsub.pub(messages.SHUTTING_DOWN);

    const timer = setTimeout(() => {
      process.exit(0);
    }, SIGTERM_EXIT_DELAY);

    timer.unref();
  });
}

// start robot
function start() {
  logger.info('starting up...');

  // listen for sigterm
  listenForTerminationSignal();

  // start up services and begin moving forward
  boardService
    .startup()
    .then(() => {
      return ledService.startup();
    })
    .then(() => {
      return navigationService.startup();
    })
    .then(() => {
      return connectionService.startup();
    })
    .then(() => {
      return catDetectionService.startup();
    })
    .then(() => {
      return ledService.indicateStartupSuccess();
    })
    .then(() => {
      logger.info('robot started!');
      navigationService.moveForward();
    })
    .catch(
      /* istanbul ignore next */ e => {
        logger.error('an error occured starting up services!', e);
        pubsub.pub(messages.ERROR_STATE);
      }
    );
}

exports.start = start;
