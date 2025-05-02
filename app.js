const express = require("express");
const logger = require("morgan");
const cors = require("cors");
require("dotenv").config();
const { Connection, PublicKey } = require("@solana/web3.js");
const handleNewUserSwapEvent = require("./swap");

if (process.env.POWER !== "true") {
  console.log("⛔️ Бот отключён через ⛔️");
  process.exit(0);
}

const connection = new Connection(
  "https://rpc.helius.xyz/?api-key=9ebfc919-bdf9-432a-8aac-89f227c8874f",
  "confirmed"
);

const userPublicKey = new PublicKey(process.env.SCAN_WALLET);

let lastKnownSignature = null;

const pollTransactions = async () => {
  try {
    const signatures = await connection.getSignaturesForAddress(userPublicKey, {
      limit: 1,
    });

    if (signatures.length > 0) {
      const latestSignature = signatures[0].signature;

      if (latestSignature !== lastKnownSignature) {
        lastKnownSignature = latestSignature;
        getParsedTransaction(latestSignature);
      }
    }
  } catch (err) {
    console.error("Ошибка при опросе транзакций:", err);
  }

  // Опрос каждые 3 секунды вместо 1
  setTimeout(pollTransactions, 3000);
};

pollTransactions();

const getParsedTransaction = async (signature) => {
  const txDetails = await connection.getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  const res = await parseTokenBalances(txDetails.meta).then((data) => data);
  const userChanges = res.filter(
    (change) => change.owner === userPublicKey.toBase58()
  );
  if (userChanges && userChanges.length > 0) {
    await Promise.all(
      userChanges.map((change) => handleNewUserSwapEvent(change))
    );
  }
};

const parseTokenBalances = async (meta) => {
  const pre = meta.preTokenBalances || [];
  const post = meta.postTokenBalances || [];
  const result = [];

  const balanceMap = new Map();

  for (const entry of pre) {
    const key = `${entry.mint}-${entry.owner}`;
    const amount = Number(entry.uiTokenAmount.amount);
    const decimals = entry.uiTokenAmount.decimals || 0;
    balanceMap.set(key, {
      pre: amount / Math.pow(10, decimals),
      decimals,
    });
  }

  for (const entry of post) {
    const key = `${entry.mint}-${entry.owner}`;
    const postAmount = Number(entry.uiTokenAmount.amount);
    const decimals = entry.uiTokenAmount.decimals || 0;
    const preData = balanceMap.get(key);
    const preAmount = preData ? preData.pre : 0;

    const diff = postAmount / Math.pow(10, decimals) - preAmount;

    if (diff !== 0) {
      result.push({
        mint: entry.mint,
        owner: entry.owner,
        change: diff,
      });
    }
  }

  return result;
  // const pre = meta.preTokenBalances || [];
  // const post = meta.postTokenBalances || [];
  // const result = [];
  // for (let i = 0; i < post.length; i++) {
  //   const preBalance = pre[i]?.uiTokenAmount?.amount || "0";
  //   const postBalance = post[i]?.uiTokenAmount?.amount || "0";
  //   const mint = post[i]?.mint;
  //   const owner = post[i]?.owner;
  //   const decimals = post[i]?.uiTokenAmount?.decimals || 0;
  //   const preVal = Number(preBalance) / Math.pow(10, decimals);
  //   const postVal = Number(postBalance) / Math.pow(10, decimals);
  //   const diff = postVal - preVal;
  //   if (diff !== 0) {
  //     result.push({
  //       mint,
  //       owner,
  //       change: diff,
  //     });
  //   }
  // }
  // return result;
};

const app = express();

const formatsLogger = app.get("env") === "development" ? "dev" : "short";

app.use(logger(formatsLogger));
app.use(cors());
app.use(express.json());

// app.use("/api/", router);

// app.post("/helius-webhook", async (req, res) => {
//   try {
//     const webhookEvent = req.body;

//     if (webhookEvent.type !== "SWAP") {
//       return res.status(200).send("Пропускаем не-SWAP событие");
//     }

//     const userChanges = await parseTokenBalances(
//       webhookEvent?.data?.transaction?.meta
//     );

//     const userPublicKey = process.env.SCAN_WALLET;

//     const changes = userChanges.filter(
//       (change) => change.owner === userPublicKey
//     );
//     await Promise.all(changes.map((change) => handleNewUserSwapEvent(change)));

//     res.status(200).send("Событие обработано");
//   } catch (err) {
//     console.error("Ошибка обработки webhook:", err);
//     res.status(500).send("Ошибка");
//   }
// });

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ message: err.message });
});

module.exports = app;
