// takes photo with camera and identifies if it contains a cat
/* eslint-disable no-console */
'use strict';

// eslint-disable-next-line import/no-unresolved
const { parentPort } = require('worker_threads');

const tf = require('@tensorflow/tfjs'); // eslint-disable-line import/no-extraneous-dependencies
const mobilenet = require('@tensorflow-models/mobilenet');
require('@tensorflow/tfjs-node');

const winston = require('winston');
const jpeg = require('jpeg-js');
const { Raspistill } = require('node-raspistill');

const MOBILE_NET_VERSION = 1;
const MOBILE_NET_ALPHA = 1.0;

const NUM_RGB_CHANNELS = 3;
const NUM_RGBA_CHANNELS = 4;

const CAT_DETECTION_DELAY = 12000;
const MAX_PREDICTIONS = 3;
const INT_32 = 'int32';

const CONFIGURATION_FILE = 'file://robot/mobilenet/model.json';

const LOG_FILE = 'detectCat.log';
const LOG_LEVEL = 'verbose';

const MESSAGE = 'message';
const INITIALIZE = 'initialize';

const INITIALIZED = 'initialized';
const PREDICTIONS = 'predictions';

const JPG = 'jpg';
const WB_AUTO = 'auto';
const WIDTH = 1280;
const HEIGHT = 960;

const DELAY = 10;

let model;
let camera;
let interval;

// init logger
const logger = initLogger();

parentPort.on(MESSAGE, ({ message }) => {
  if (message === INITIALIZE) {
    // initialize
    init();
  }
});

async function init() {
  try {
    // init camera
    logger.info('initializing camera...');
    initCamera();

    // load mobilenet model
    logger.info('loading model...');
    console.time('loading');

    await loadModel();
    console.timeEnd('loading');

    // detect cats
    detectCat();
    interval = setInterval(detectCat, CAT_DETECTION_DELAY);

    // post that initialized
    postInitialized();
  } catch (e) {
    logger.error('an error occured initializing cat detection!', e);
    clearInterval(interval);
    process.exit();
  }
}

async function detectCat() {
  try {
    // take picture
    logger.info('taking photo...');
    const photo = await camera.takePhoto();

    // classify image
    logger.info('classifying image...');
    console.time('classifying');

    const predictions = await model.classify(convertToTensor3D(photo));
    console.timeEnd('classifying');

    // post prediction
    logger.info('classifying completed');
    postPredictions(predictions);
  } catch (e) {
    logger.error('an error occured attempting to identify cat!', e);
    clearInterval(interval);
    process.exit();
  }
}

// init camera
function initCamera() {
  camera = new Raspistill({
    encoding: JPG,
    width: WIDTH,
    height: HEIGHT,
    awb: WB_AUTO,
    time: DELAY
  });
}

// load mobilenet model
async function loadModel() {
  model = new mobilenet.MobileNet(MOBILE_NET_VERSION, MOBILE_NET_ALPHA);
  model.path = CONFIGURATION_FILE;

  await model.load();
}

// post initialized
function postInitialized() {
  parentPort.postMessage({ message: INITIALIZED });
}

// post predictions
function postPredictions(predictions) {
  // post class name and probability of first prediction
  parentPort.postMessage({
    message: PREDICTIONS,
    predictions: predictions == null ? null : predictions.slice(0, MAX_PREDICTIONS)
  });
}

// decode image, convert into tf.tensor3D
function convertToTensor3D(image) {
  const data = jpeg.decode(image);
  const values = convertTo3Channels(data);
  const shape = [data.height, data.width, NUM_RGB_CHANNELS];
  const type = INT_32;

  return tf.tensor3d(values, shape, type);
}

// mobilenet only uses three color channels for classification, ignoring the alpha channel
function convertTo3Channels(image) {
  const pixels = image.data;
  const numPixels = image.width * image.height;
  const values = new Int32Array(numPixels * NUM_RGB_CHANNELS);

  for (let i = 0; i < numPixels; i++) {
    for (let channel = 1; channel <= NUM_RGB_CHANNELS; channel++) {
      values[i * NUM_RGB_CHANNELS + channel] = pixels[i * NUM_RGBA_CHANNELS + channel];
    }
  }

  return values;
}

// logger
function initLogger() {
  return new winston.Logger({
    transports: [
      new winston.transports.Console({
        level: LOG_LEVEL,
        handleExceptions: false
      }),
      new winston.transports.File({
        filename: LOG_FILE,
        level: LOG_LEVEL,
        handleExceptions: false,
        json: false
      })
    ],
    exitOnError: false
  });
}

exports.init = init;
exports.detectCat = detectCat;
