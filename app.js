const express = require("express");
const logger = require("morgan");
const cors = require("cors");
require("dotenv").config();
const axios = require("axios");
let num = 0;
let lastSwapId = null;
const getUserSwaps = async () => {
  axios
    .get(process.env.MAINET_URL, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        "X-API-Key": process.env.MAINNET_API,
      },
    })
    .then((response) => {
      const swaps = response.data.result;

      if (swaps && swaps.length > 0) {
        const currentSwap = swaps[0];

        if (currentSwap.transactionHash !== lastSwapId) {
          console.log(currentSwap);
          console.log("Новая сделка", num++);
          lastSwapId = currentSwap.transactionHash;
        } else {
          console.log("Сделка не изменилась");
        }
      } else {
        console.log("Нет сделок");
      }
    })
    .catch((e) => console.error(e));
};

setInterval(getUserSwaps, 10000);

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
  res.status(err.status || 500).json({ message: err.message });
});

module.exports = app;
