// cat detection service
'use strict';

const { Worker } = require('worker_threads'); // eslint-disable-line import/no-unresolved

const pubsub = require('./pubsub');
const logger = require('./logger');
const messages = require('./messages');

const UNCAUGHT_EXCEPTION = 'uncaughtException';
const ERROR_EXIT_DELAY = 1500;

const MESSAGE = 'message';
const INITIALIZE = 'initialize';

const INITIALIZED = 'initialized';
const PREDICTIONS = 'predictions';

const MIN_PROBABILIY = 0.25;
const HAS_CAT = /\bcat\b/i;

const ERROR = 'error';
const EXIT = 'exit';

let detectCat;

process.on(UNCAUGHT_EXCEPTION, handleUncaughException);

// publish error messages and shut down
function handleUncaughException(e) {
  logger.error('cat detection service uncaughtException occured!', e);

  pubsub.pub(messages.CRASHING);

  const timer = setTimeout(() => {
    process.exit(1);
  }, ERROR_EXIT_DELAY);
  timer.unref();
}

function startup() {
  return new Promise((resolve, reject) => {
    // start cat detection worker thread
    detectCat = new Worker('./robot/detectCat.js');

    // handle messages
    detectCat.on(MESSAGE, ({ message, predictions }) => {
      /* istanbul ignore if */
      if (message === INITIALIZED) {
        logger.info('cat detection initialized...');
        return;
      }

      if (message === PREDICTIONS) {
        handlePredictions(predictions);
      }
    });

    // handle worker uncaught exception
    detectCat.on(ERROR, err => {
      logger.warn('an error occurred attempting to detect cat!', err);
    });

    // handle worker exit
    // eslint-disable-next-line no-unused-vars
    detectCat.on(EXIT, exitCode => {
      logger.warn('an error occurred attempting to detect cat!');
    });

    // initialize cat detection
    detectCat.postMessage({ message: INITIALIZE });

    resolve();
  });
}

function handlePredictions(predictions) {
  logger.silly('predictions', predictions);

  for (const { className, probability } of predictions) {
    if (HAS_CAT.test(className)) {
      logger.info(`cat probability ${probability * 100}%`);

      if (probability >= MIN_PROBABILIY) {
        logger.info('cat detected!');

        pubsub.pub(messages.CAT_DETECTED);
        return;
      }
    }
  }

  // logger.verbose('no cat detected');
  logger.info('no cat detected');
}

exports.startup = startup;

exports.initializeMessage = INITIALIZE;
exports.predictionsMessage = PREDICTIONS;
exports.minProbability = MIN_PROBABILIY;
