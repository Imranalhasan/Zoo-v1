require("dotenv").config();
const { _isArray } = require("../utils.js");

const settings = {
  BASE_URL: process.env.BASE_URL ? process.env.BASE_URL : "https://aad.duckchain.io",
  TIME_SLEEP: process.env.TIME_SLEEP ? parseInt(process.env.TIME_SLEEP) : 8,
  MAX_THEADS: process.env.MAX_THEADS ? parseInt(process.env.MAX_THEADS) : 10,
  MAX_LEVEL_UPGRADE: process.env.MAX_LEVEL_UPGRADE ? parseInt(process.env.MAX_LEVEL_UPGRADE) : 10,
  SKIP_TASKS: process.env.SKIP_TASKS ? JSON.parse(process.env.SKIP_TASKS.replace(/'/g, '"')) : [],
  AUTO_TASK: process.env.AUTO_TASK ? process.env.AUTO_TASK.toLowerCase() === "true" : false,
  AUTO_QUACK: process.env.AUTO_QUACK ? process.env.AUTO_QUACK.toLowerCase() === "true" : false,
  ADVANCED_ANTI_DETECTION: process.env.ADVANCED_ANTI_DETECTION ? process.env.ADVANCED_ANTI_DETECTION.toLowerCase() === "true" : false,
  AUTO_UPGRADE: process.env.AUTO_UPGRADE ? process.env.AUTO_UPGRADE.toLowerCase() === "true" : false,
  CLAIM_FAUCET: process.env.CLAIM_FAUCET ? process.env.CLAIM_FAUCET.toLowerCase() === "true" : false,
  CONNECT_WALLET: process.env.CONNECT_WALLET ? process.env.CONNECT_WALLET.toLowerCase() === "true" : false,
  DELAY_BETWEEN_REQUESTS: process.env.DELAY_BETWEEN_REQUESTS && _isArray(process.env.DELAY_BETWEEN_REQUESTS) ? JSON.parse(process.env.DELAY_BETWEEN_REQUESTS) : [1, 5],
  DELAY_START_BOT: process.env.DELAY_START_BOT && _isArray(process.env.DELAY_START_BOT) ? JSON.parse(process.env.DELAY_START_BOT) : [1, 15],
  AMOUNT_TAP_QUACK: process.env.AMOUNT_TAP_QUACK && _isArray(process.env.AMOUNT_TAP_QUACK) ? JSON.parse(process.env.AMOUNT_TAP_QUACK) : [1, 15],
};

module.exports = settings;
