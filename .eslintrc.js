module.exports = {
  "root": true,
  "extends": ["airbnb-base", "prettier"],
  "plugins": ["prettier"],
  "env": {
    "node": true
  },
  "rules": {
    "no-use-before-define": [2, {
      "functions": false
    }],
    "no-shadow": [2, {
      "allow": ["e", "err", "done"]
    }],
    "strict": 0,
    "lines-around-directive": 0,
    "max-len": [2, {
      "code": 90,
      "tabWidth": 2,
      "ignoreComments": true,
      "ignoreUrls": true,
      "ignoreStrings": true,
      "ignoreTemplateLiterals": true,
      "ignoreRegExpLiterals": true
    }],
    "arrow-body-style": 0,
    "no-unused-vars": [2, {
      "argsIgnorePattern": "^reject$"
    }],
    "no-restricted-syntax": 0,
    "no-plusplus": 0,
    "prettier/prettier": 2
  }
};
