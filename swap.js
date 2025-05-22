/* eslint-disable no-unused-vars */
require("dotenv").config();
const bs58 = require("bs58");
const bip39 = require("bip39");
const axios = require("axios");
const {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  SendTransactionError,
} = require("@solana/web3.js");
const recentEvents = new Map();
const tradeHistory = new Map();
const ed25519 = require("ed25519-hd-key");
const _PHANTOM = new PublicKey(process.env.PHANTOM);
const sendTelegramMessage = require("./telega");
const RPC_ENDPOINT = `https://rpc.helius.xyz/?api-key=${process.env.HELIUS}`;
const connection = new Connection(RPC_ENDPOINT);
const JUPITER_QUOTE_URL = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_URL = "https://quote-api.jup.ag/v6/swap";
const FIXED_SOL_AMOUNT = 0.05 * LAMPORTS_PER_SOL;
const SOL_MINT = "So11111111111111111111111111111111111111112";

// Список безопасных DEX'ов и их контрактов
const SAFE_DEXES = {
  JUPITER: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
  RAYDIUM: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  ORCA: "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",
  SERUM: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
  OKX: "okx1nVXb2Kt9MG1tJz11J5iUYZp4EHK9uF7YqH3UqF",
  PUMP_FUN: "PumpFun1111111111111111111111111111111111111",
};

// Проверка безопасности маршрута
const isSafeRoute = (route, dexSource) => {
  // Проверяем, что используется безопасный DEX
  if (!SAFE_DEXES[dexSource]) {
    console.log(`Пропускаем - неизвестный DEX: ${dexSource}`);
    return false;
  }

  // Для OKX используем специальную проверку
  if (dexSource === "OKX") {
    // Проверяем, что транзакция содержит инструкции OKX
    const hasOkxInstructions = route.instructions?.some(
      (ix) => ix.programId === SAFE_DEXES.OKX
    );
    if (!hasOkxInstructions) {
      console.log("Пропускаем - небезопасный контракт OKX");
      return false;
    }
    return true;
  }

  // Для Pump.fun используем специальную проверку
  if (dexSource === "PUMP_FUN") {
    // Проверяем, что это действительно свап, а не просто перевод
    const isSwap = route.instructions?.some(
      (ix) => ix.programId === SAFE_DEXES.PUMP_FUN && ix.data?.includes("swap") // Проверяем, что инструкция содержит swap
    );

    if (!isSwap) {
      console.log("Пропускаем - небезопасная транзакция Pump.fun (не свап)");
      return false;
    }

    // Проверяем, что в транзакции есть обмен токенов
    const hasTokenExchange = route.tokenTransfers?.some(
      (transfer) =>
        transfer.mint === SOL_MINT || // Проверяем, что есть обмен на SOL
        transfer.amount > 0 // Проверяем, что есть положительное количество
    );

    if (!hasTokenExchange) {
      console.log(
        "Пропускаем - небезопасная транзакция Pump.fun (нет обмена токенов)"
      );
      return false;
    }

    return true;
  }

  // Для остальных DEX'ов проверяем ammKey
  if (route.swapInfo?.ammKey !== SAFE_DEXES[dexSource]) {
    console.log(`Пропускаем - небезопасный контракт для ${dexSource}`);
    return false;
  }

  return true;
};

// Проверка безопасности транзакции
const isSafeTransaction = (transaction) => {
  const allowedPrograms = [
    ...Object.values(SAFE_DEXES),
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "11111111111111111111111111111111",
  ];

  for (const ix of transaction.instructions) {
    if (!allowedPrograms.includes(ix.programId.toString())) {
      console.log("Пропускаем - подозрительные инструкции в транзакции");
      return false;
    }
  }
  return true;
};

const getPhantomKeypairFromMnemonic = async (mnemonic) => {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error("Неверная сид-фраза");
  }
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const derivationPath = "m/44'/501'/0'/0'";
  const derivedSeed = ed25519.derivePath(
    derivationPath,
    seed.toString("hex")
  ).key;
  return Keypair.fromSeed(derivedSeed);
};

const handleNewUserSwapEvent = async (obj) => {
  const wallet = await getPhantomKeypairFromMnemonic(process.env.MNEMONIC);
  try {
    if (
      !obj ||
      typeof obj?.mint === "undefined" ||
      typeof obj?.change === "undefined"
    ) {
      console.log("Пропускаем - некорректные данные");
      return;
    }

    // Проверяем, что изменение баланса действительно значимое
    if (Math.abs(obj.change) < 0.000001) {
      console.log("Пропускаем - изменение баланса слишком мало");
      return;
    }

    const token = obj.mint;
    const now = Date.now();
    const key = `${token}-${obj.change > 0 ? "buy" : "sell"}`;

    // Проверяем, не было ли недавно такого же события
    if (recentEvents.has(key) && now - recentEvents.get(key) < 10000) {
      console.log("Пропускаем - событие уже обработано недавно");
      return;
    }

    // Для продажи проверяем баланс токена
    if (obj.change < 0) {
      const tokenAccount = await findTokenAccount(token, wallet);
      if (!tokenAccount) {
        console.log("Пропускаем - нет токена на балансе");
        return;
      }

      const tokenBalance = await getTokenBalance(tokenAccount);
      if (tokenBalance <= 0) {
        console.log("Пропускаем - нет токенов для продажи");
        return;
      }

      if (Math.abs(obj.change) > tokenBalance) {
        console.log("Пропускаем - изменение баланса превышает текущий баланс");
        return;
      }

      console.log(`[-] Пользователь продал токен: ${token}. Продаю...`);
      // Определяем DEX из транзакции
      const dexSource = obj.source || "JUPITER";
      await sellToken(token, wallet, dexSource);
    } else if (obj.change > 0) {
      console.log(`[+] Пользователь купил токен: ${token}. Покупаю...`);
      await buyToken(token, wallet);
    }

    recentEvents.set(key, now);
  } catch (error) {
    console.error("Ошибка в обработчике события:", error);
  }
};

const buyToken = async (mintAddress, wallet) => {
  try {
    console.log("Проверяю баланс перед покупкой...");
    const balance = await connection.getBalance(wallet.publicKey);
    if (balance < FIXED_SOL_AMOUNT) {
      console.log("Пропускаем - недостаточно SOL");
      return;
    }

    console.log("Ищу маршрут для покупки токена...");
    const quoteResponse = await axios.get(
      `${JUPITER_QUOTE_URL}?inputMint=${SOL_MINT}&outputMint=${mintAddress}&amount=${FIXED_SOL_AMOUNT}&slippageBps=500`
    );

    const quoteData = quoteResponse.data;
    if (!quoteData.routePlan?.length) {
      console.log("Пропускаем - маршрут не найден");
      return;
    }

    console.log("Маршрут найден. Отправляю запрос на свап...");
    const swapResponse = await axios.post(JUPITER_SWAP_URL, {
      quoteResponse: quoteData,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapUnwrapSOL: true,
      asLegacyTransaction: true,
      skipPreflight: true,
    });

    const swapData = swapResponse.data;
    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
    const transaction = Transaction.from(swapTransactionBuf);
    transaction.partialSign(wallet);

    transaction.feePayer = wallet.publicKey;
    if (!transaction.feePayer) {
      throw new Error("Fee payer not set!");
    }
    transaction.gasPrice = 300;
    transaction.gasLimit = 100000;

    const rawTransaction = transaction.serialize();
    const latestBlockhash = await connection.getLatestBlockhash();
    const txid = await connection.sendRawTransaction(rawTransaction);

    await connection.confirmTransaction(
      {
        signature: txid,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      "finalized"
    );

    tradeHistory.set(mintAddress, quoteData.outAmount);
    await sendTelegramMessage(
      `✅ Куплен токен ${mintAddress}. Баланс:`,
      wallet.publicKey
    );
    console.log("✅ Покупка успешна! Транзакция:", txid);
  } catch (error) {
    console.error("Ошибка при покупке токена:", error);
    if (error instanceof SendTransactionError) {
      console.error("Детали ошибки:", error.message);
      console.error("Логи транзакции:", error.logs);
    }
  }
};

const sellToken = async (mintAddress, wallet, dexSource = "JUPITER") => {
  try {
    console.log("Проверяю баланс токена...");
    const tokenAccount = await findTokenAccount(mintAddress, wallet);
    if (!tokenAccount) {
      console.log("Пропускаем - нет токена на балансе");
      return;
    }

    const tokenBalanceLamports = await getTokenBalance(tokenAccount);
    if (tokenBalanceLamports === 0) {
      console.log("Пропускаем - баланс токена равен 0");
      return;
    }

    // Специальная обработка для OKX
    if (dexSource === "OKX") {
      console.log("Использую OKX для продажи...");
      // TODO: Добавить прямую интеграцию с OKX API
      console.log("Пропускаем - прямая интеграция с OKX пока не реализована");
      return;
    }

    // Специальная обработка для PUMP_FUN
    if (dexSource === "PUMP_FUN") {
      console.log("Использую Pump.fun для продажи...");
      // TODO: Добавить прямую интеграцию с Pump.fun API
      console.log(
        "Пропускаем - прямая интеграция с Pump.fun пока не реализована"
      );
      return;
    }

    console.log(`Ищу маршрут для продажи токена через ${dexSource}...`);
    const quoteResponse = await axios.get(
      `${JUPITER_QUOTE_URL}?inputMint=${mintAddress}&outputMint=${SOL_MINT}&amount=${tokenBalanceLamports}&slippageBps=500&onlyDirectRoutes=true`
    );

    const quoteData = quoteResponse.data;
    if (!quoteData.routePlan?.length) {
      console.log("Пропускаем - маршрут не найден");
      return;
    }

    // Проверяем маршрут на безопасность
    if (!isSafeRoute(quoteData.routePlan[0], dexSource)) {
      return;
    }

    console.log("Маршрут найден. Отправляю запрос на свап...");
    const swapResponse = await axios.post(JUPITER_SWAP_URL, {
      quoteResponse: quoteData,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapUnwrapSOL: true,
      asLegacyTransaction: true,
      skipPreflight: true,
      destinationTokenAccount: wallet.publicKey.toBase58(),
    });

    const swapData = swapResponse.data;
    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
    const transaction = Transaction.from(swapTransactionBuf);

    // Проверяем безопасность транзакции
    if (!isSafeTransaction(transaction)) {
      return;
    }

    transaction.partialSign(wallet);

    transaction.feePayer = wallet.publicKey;
    if (!transaction.feePayer) {
      throw new Error("Fee payer not set!");
    }
    transaction.gasPrice = 300;
    transaction.gasLimit = 100000;

    const rawTransaction = transaction.serialize();
    const latestBlockhash = await connection.getLatestBlockhash();
    const txid = await connection.sendRawTransaction(rawTransaction);

    await connection.confirmTransaction(
      {
        signature: txid,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      "finalized"
    );

    const buyAmount = tradeHistory.get(mintAddress) || 0;
    const sellAmount = quoteData.outAmount;
    const profit = (sellAmount - buyAmount) / 1e6;

    await sendTelegramMessage(
      `❌ Продан ${mintAddress}. Прибыль: ${profit.toFixed(4)} SOL`,
      wallet.publicKey
    );
    console.log("❌ Продажа успешна! Транзакция:", txid);
  } catch (error) {
    console.error("Ошибка при продаже токена:", error);
    if (error instanceof SendTransactionError) {
      console.error("Детали ошибки:", error.message);
      console.error("Логи транзакции:", error.logs);
    }
  }
};

const findTokenAccount = async (mintAddress, wallet) => {
  const accounts = await connection.getParsedTokenAccountsByOwner(
    wallet.publicKey,
    { mint: new PublicKey(mintAddress) }
  );
  if (accounts.value.length === 0) return null;
  return accounts.value[0].pubkey;
};

const getTokenBalance = async (tokenAccountPubkey) => {
  const accountInfo = await connection.getParsedAccountInfo(tokenAccountPubkey);
  const parsed = accountInfo.value?.data?.parsed;
  if (!parsed) return 0;
  return parsed.info.tokenAmount.amount;
};

const start = async () => {
  if (!_PHANTOM) {
    console.error("Публичный ключ (KEY) не загружен из .env.PHANTOM.");
    return;
  }
  try {
    const solBalanceLamports = await connection.getBalance(_PHANTOM);
    const solBalance = solBalanceLamports / LAMPORTS_PER_SOL;
    console.log(
      `Баланс SOL кошелька ${_PHANTOM.toBase58()}: ${solBalance} SOL`
    );
  } catch (error) {
    console.error("Ошибка при получении баланса SOL:", error);
  }
};

module.exports = { handleNewUserSwapEvent, start };
