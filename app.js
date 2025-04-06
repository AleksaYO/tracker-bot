// const moralis = require("moralis");
const express = require("express");
const logger = require("morgan");
const cors = require("cors");
require("dotenv").config();
// const { SolNetwork } = require("@moralisweb3/common-sol-utils");
const axios = require("axios");

// const getUserPortfolio = async () => {
//   try {
//     await moralis.default.start({
//       apiKey:
//         "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjQ2NDg5ZmY4LTZlNDQtNDFlNy04OWFhLTA4NGVhZTk4ZmRlZSIsIm9yZ0lkIjoiNDM5Mjc4IiwidXNlcklkIjoiNDUxOTI2IiwidHlwZSI6IlBST0pFQ1QiLCJ0eXBlSWQiOiIwYjIzZTI2MC05YzhjLTQ2YjYtOGFmNC1mMTRlZmRhMDRiNTMiLCJpYXQiOjE3NDM1OTY2NTksImV4cCI6NDg5OTM1NjY1OX0._wdi7pWiOpdXppmHN9kmU9cgbC-wnjl2xqKmgofg9S8",
//     });

//     const response = await moralis.default.SolApi.account.getSPL({
//       network: "mainnet",
//       address: "u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w",
//     });
//     console.log(response.jsonResponse);
//   } catch (e) {
//     console.error(e);
//   }
// };
// getUserPortfolio();

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
      console.log(swaps[0]);
    })
    .catch((e) => console.error(e));
};

getUserSwaps();

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
