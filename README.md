# cat-robot
An awesome arduino and raspberry pi-powered robot for interacting with your cat!

- It is very cat! 🐈

- Such simple design! 🐈 🐈 🐈

- It uses tensorflow for detecting cat! (input => input === 🐈)

- It autodeploys the latest code 🚀

- Works with dogs too! 🐶 (coming soon in 2.0)

## Ingredients

- Arduino Uno Rev 3

  - https://store.arduino.cc/usa/arduino-uno-rev3

- Raspberry Pi 3 Model B+

  - https://www.raspberrypi.org/products/raspberry-pi-3-model-b-plus/
  - https://www.raspberrypi.org/products/camera-module-v2/

- Cat

  - https://www.arlboston.org/
  - http://blackcatrescue.com/
  - https://www.mspca.org/adoption-centers/boston-adoption-center/
  - https://thecatconnection.org/community-resources/local-no-kill-shelters/

## Instructions

- assemble robot
  - https://www.adafruit.com/
  - https://www.sparkfun.com/
  // TODO: add photos, assembly instructions

- setup arduino
  - https://www.arduino.cc/en/Guide/ArduinoUno
  - https://github.com/rwaldron/johnny-five/wiki/Getting-Started
  - https://github.com/rwaldron/johnny-five#setup-and-assemble-arduino

- setup raspberry pi
  - https://www.raspberrypi.org/documentation/setup/
  - https://www.raspberrypi.org/documentation/configuration/security.md
  - https://www.raspberrypi.org/documentation/remote-access/
  - https://www.raspberrypi.org/documentation/usage/camera/

- set up autodeploy
  - setup pubnub [keys](https://dashboard.pubnub.com/signup)
  - install [nvm](https://github.com/creationix/nvm#installation) on raspberry pi
  - install Node.js (`nvm install node`)
  - install [pm2](https://github.com/Unitech/pm2) (`npm install -g pm2`)
  - `cp .env_sample .env` and add your pubnub keys
  - run `scripts/generateAuthToken.js` and add token to `.env`
  - copy `.env`, `.gitconfig`, and `autoredeploy` to raspberry pi home directory and run `(cd autoredeploy && npm install)`
  - run `pm2 start autoredeploy/autoredeploy.js --update-env`
  - set up pubnub [autoredeploy](./scripts/deployFunction) [function](https://www.pubnub.com/tutorials/pubnub-functions/)
  - run function to install and start robot
  - create pm2 [startup hook](https://pm2.io/doc/en/runtime/guide/startup-hook/) for robot and autoredeploy script
  - call pubnub function from [ci/cd](https://codeship.com/) when the build succeeds to update cat-robot to the latest 🐈 🐈 🐈

### [Satisfied customers](./cats)
