// calibrate servo
//
// adjust servo potentiometer until it stops spinning

/* eslint-disable no-console, prefer-destructuring */
'use strict';

const five = require('johnny-five');

const LEFT = 'left';
const RIGHT = 'right';

const LEFT_PIN = 5;
const RIGHT_PIN = 6;

const READY = 'ready';

const args = process.argv.slice(2);
let pin;

if (args.length < 1) {
  console.info('please specify servo');
  process.exit(1);
}

if (args[0] === LEFT) {
  pin = LEFT_PIN;
} else if (args[0] === RIGHT) {
  pin = RIGHT_PIN;
} else {
  pin = args[0];
}

const board = new five.Board({
  repl: false
});

board.on(READY, () => {
  console.info('board ready');

  new five.Servo.Continuous(pin).stop();

  console.info('calibrate servo...');
});
