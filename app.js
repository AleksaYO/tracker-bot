const express = require("express");
const logger = require("morgan");
const cors = require("cors");
require("dotenv").config();
const axios = require("axios");

// const getUserSwaps = async () => {
//   axios
//     .get(process.env.MAINET_URL, {
//       method: "GET",
//       headers: {
//         "content-type": "application/json",
//         "X-API-Key": process.env.MAINNET_API,
//       },
//     })
//     .then((response) => {
//       const swaps = response.data.result;
//       console.log(swaps[0]);
//     })
//     .catch((e) => console.error(e));
// };

// getUserSwaps();

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
