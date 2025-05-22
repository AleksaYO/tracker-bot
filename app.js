const express = require("express");
const logger = require("morgan");
const cors = require("cors");
require("dotenv").config();
const { Connection, PublicKey } = require("@solana/web3.js");
const { handleNewUserSwapEvent } = require("./swap");
const axios = require("axios");

if (process.env.POWER !== "true") {
  console.log("⛔️ Бот отключён через ⛔️");
  process.exit(0);
}

const connection = new Connection(
  `https://rpc.helius.xyz/?api-key=${process.env.HELIUS}`,
  "confirmed"
);

const userPublicKey = new PublicKey(process.env.SCAN_WALLET);
let lastKnownSignature = null;

const pollTransactions = async () => {
  try {
    // Используем Enhanced Transactions API для получения последних транзакций
    const response = await axios.get(
      `https://api.helius.xyz/v0/addresses/${userPublicKey.toBase58()}/transactions?api-key=${
        process.env.HELIUS
      }&commitment=confirmed&limit=1`
    );

    if (response.data && response.data.length > 0) {
      const latestTx = response.data[0];
      const latestSignature = latestTx.signature;

      if (latestSignature !== lastKnownSignature) {
        lastKnownSignature = latestSignature;
        await processTransaction(latestTx);
      }
    }
  } catch (err) {
    console.error("Ошибка при опросе транзакций:", err);
  }

  setTimeout(pollTransactions, 3000);
};

const processTransaction = async (tx) => {
  try {
    console.log("Полная транзакция:", JSON.stringify(tx, null, 2));

    // Список известных DEX'ов и агрегаторов
    const knownDexes = [
      "JUPITER",
      "OKX",
      "PUMP_FUN",
      "PUMP_AMM",
      "RAYDIUM",
      "ORCA",
      "SERUM",
    ];

    // Проверяем, что это SWAP транзакция от известного DEX'а
    if (!tx.type || tx.type !== "SWAP" || !knownDexes.includes(tx.source)) {
      console.log(
        `Пропускаем транзакцию - не является свапом (тип: ${tx.type}, источник: ${tx.source})`
      );
      return;
    }

    // Добавляем специальное логирование для PUMP транзакций
    if (tx.source === "PUMP_FUN" || tx.source === "PUMP_AMM") {
      console.log(`Обнаружена транзакция ${tx.source}:`, {
        signature: tx.signature,
        type: tx.type,
        success: tx.success,
        tokenTransfers: tx.tokenTransfers?.length || 0,
      });
    }

    // Проверяем, что транзакция успешна
    if (tx.success === false) {
      console.log("Пропускаем транзакцию - содержит ошибку");
      return;
    }

    // Получаем информацию о токенах из транзакции
    const tokenTransfers = tx.tokenTransfers || [];

    // Фильтруем только изменения баланса для отслеживаемого кошелька
    const userChanges = tokenTransfers.filter(
      (transfer) =>
        transfer.fromUserAccount === userPublicKey.toBase58() ||
        transfer.toUserAccount === userPublicKey.toBase58()
    );

    if (userChanges.length === 0) {
      console.log(
        "Пропускаем транзакцию - нет изменений баланса у отслеживаемого кошелька"
      );
      return;
    }

    // Преобразуем данные в формат, ожидаемый handleNewUserSwapEvent
    const changes = userChanges.map((transfer) => ({
      mint: transfer?.mint,
      owner: userPublicKey.toBase58(),
      change:
        transfer.fromUserAccount === userPublicKey.toBase58()
          ? -Number(transfer.tokenAmount)
          : Number(transfer.tokenAmount),
    }));

    // Обрабатываем каждое изменение
    for (const change of changes) {
      await handleNewUserSwapEvent(change);
    }
  } catch (error) {
    console.error("Ошибка при обработке транзакции:", error);
  }
};

pollTransactions();

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
