const express = require("express");
const logger = require("morgan");
const cors = require("cors");
require("dotenv").config();

const axios = require("axios");

const wallets = require("./wallets.json").wallets;

const ETHERSCAN_API = process.env.ETHERSCAN_API;

async function getTransactions(wallet) {
  const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${wallet}&apikey=${ETHERSCAN_API}`;

  const response = await axios.get(url);

  return response.data.result;
}

async function monitorWallets() {
  let a;
  for (const wallet of wallets) {
    const transactions = await getTransactions(wallet);

    for (const tx of transactions) {
      a = analyzeTransaction(tx);
      console.log(a);
    }
  }
}

monitorWallets();

async function analyzeTransaction(tx) {
  if (
    tx.to.toLowerCase() ===
    "0xE592427A0AEce92De3Edee1F18E0157C05861564".toLowerCase()
  ) {
    console.log(`Кит купил токен через Uniswap: ${tx.hash}`);

    return tx;
  }

  return 123;
}

// setInterval(monitorWallets, 3000);

// const router = require("./routes/api/");

const app = express();

const formatsLogger = app.get("env") === "development" ? "dev" : "short";

app.use(logger(formatsLogger));
app.use(cors());
app.use(express.json());

// app.use("/api/", router);

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

module.exports = app;
