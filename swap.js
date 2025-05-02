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
const FIXED_SOL_AMOUNT = 0.01 * LAMPORTS_PER_SOL; // 0.01 SOL
const SOL_MINT = "So11111111111111111111111111111111111111112";
const MIN_USD_VOLUME = 10; // минимум $10 для фильтрации

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
    )
      return;

    const token = obj.mint;
    const now = Date.now();
    const key = `${token}-${obj.change > 0 ? "buy" : "sell"}`;
    if (recentEvents.has(key) && now - recentEvents.get(key) < 500) return;
    recentEvents.set(key, now);

    if (obj.change > 0) {
      console.log(`[+] Пользователь купил токен: ${token}`);
      await buyToken(token, wallet);
    } else if (obj.change < 0) {
      console.log(`[-] Пользователь продал токен: ${token}`);
      await sellToken(token, wallet);
    }
  } catch (error) {
    console.error("Ошибка в обработчике события:", error);
  }
};

const buyToken = async (mintAddress, wallet) => {
  try {
    const balance = await connection.getBalance(wallet.publicKey);
    if (balance < FIXED_SOL_AMOUNT) return;

    const quoteResponse = await axios.get(
      `${JUPITER_QUOTE_URL}?inputMint=${SOL_MINT}&outputMint=${mintAddress}&amount=${FIXED_SOL_AMOUNT}&slippageBps=1000`
    );
    const quoteData = quoteResponse.data;

    if (
      !quoteData.routePlan?.length ||
      quoteData.outAmount < MIN_USD_VOLUME * 1e6
    )
      return;

    const swapResponse = await axios.post(JUPITER_SWAP_URL, {
      quoteResponse: quoteData,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapUnwrapSOL: true,
      asLegacyTransaction: true,
    });

    const transaction = Transaction.from(
      Buffer.from(swapResponse.data.swapTransaction, "base64")
    );
    transaction.partialSign(wallet);
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
  } catch (error) {
    console.error("Ошибка при покупке токена:", error);
  }
};

const sellToken = async (mintAddress, wallet) => {
  try {
    const tokenAccount = await findTokenAccount(mintAddress, wallet);
    if (!tokenAccount) return;

    const tokenBalanceLamports = await getTokenBalance(tokenAccount);
    if (tokenBalanceLamports === 0) return;

    const quoteResponse = await axios.get(
      `${JUPITER_QUOTE_URL}?inputMint=${mintAddress}&outputMint=${SOL_MINT}&amount=${tokenBalanceLamports}&slippageBps=1000`
    );
    const quoteData = quoteResponse.data;

    if (!quoteData.routePlan?.length) return;

    const swapResponse = await axios.post(JUPITER_SWAP_URL, {
      quoteResponse: quoteData,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapUnwrapSOL: true,
      asLegacyTransaction: true,
    });

    const transaction = Transaction.from(
      Buffer.from(swapResponse.data.swapTransaction, "base64")
    );
    transaction.partialSign(wallet);
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
  } catch (error) {
    console.error("Ошибка при продаже токена:", error);
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

module.exports = handleNewUserSwapEvent;

// /* eslint-disable no-unused-vars */
// require("dotenv").config();
// const bs58 = require("bs58");
// const bip39 = require("bip39");
// const axios = require("axios");
// const {
//   Connection,
//   PublicKey,
//   Keypair,
//   LAMPORTS_PER_SOL,
//   Transaction,
//   SendTransactionError,
// } = require("@solana/web3.js");
// const recentEvents = new Map();
// const ed25519 = require("ed25519-hd-key");
// const _PHANTOM = new PublicKey(process.env.PHANTOM);
// const sendTelegramMessage = require("./telega");
// const RPC_ENDPOINT = `https://rpc.helius.xyz/?api-key=${process.env.HELIUS}`;
// const connection = new Connection(RPC_ENDPOINT);
// const JUPITER_QUOTE_URL = "https://quote-api.jup.ag/v6/quote";
// const JUPITER_SWAP_URL = "https://quote-api.jup.ag/v6/swap";
// const FIXED_SOL_AMOUNT = 0.01 * LAMPORTS_PER_SOL; // 0.2 SOL
// const SOL_MINT = "So11111111111111111111111111111111111111112";

// const getPhantomKeypairFromMnemonic = async (mnemonic) => {
//   if (!bip39.validateMnemonic(mnemonic)) {
//     throw new Error("Неверная сид-фраза");
//   }

//   const seed = await bip39.mnemonicToSeed(mnemonic);
//   const derivationPath = "m/44'/501'/0'/0'";
//   const derivedSeed = ed25519.derivePath(
//     derivationPath,
//     seed.toString("hex")
//   ).key;
//   const keypair = Keypair.fromSeed(derivedSeed);

//   return keypair;
// };

// const handleNewUserSwapEvent = async (obj) => {
//   const wallet = await getPhantomKeypairFromMnemonic(process.env.MNEMONIC);
//   try {
//     if (
//       !obj === "undefined" ||
//       typeof obj?.mint === "undefined" ||
//       typeof obj?.change === "undefined"
//     ) {
//       // console.error("Получен некорректный объект события:", obj);
//       return;
//     }
//     const token = obj?.mint;
//     const now = Date.now();
//     const key = `${token}-${obj?.change > 0 ? "buy" : "sell"}`;
//     if (recentEvents.has(key) && now - recentEvents.get(key) < 10000) {
//       console.log("⏳ Уже обработано недавно, пропускаем.");
//       return;
//     }
//     recentEvents.set(key, now);
//     if (obj?.change > 0) {
//       console.log(`[+] Пользователь купил токен: ${obj?.mint}. Покупаю...`);
//       await buyToken(obj?.mint, wallet);
//     } else if (obj?.change < 0) {
//       console.log(`[-] Пользователь продал токен: ${obj?.mint}. Продаю...`);
//       await sellToken(obj?.mint, wallet);
//     }
//   } catch (error) {
//     console.error("Ошибка в обработчике события:", error);
//   }
// };

// const buyToken = async (mintAddress, wallet) => {
//   try {
//     console.log("Проверяю баланс перед покупкой...");
//     const balance = await connection.getBalance(wallet.publicKey);
//     if (balance < FIXED_SOL_AMOUNT) {
//       console.error("Недостаточно SOL для выполнения свапа.");
//       return;
//     }
//     console.log("Ищу маршрут для покупки токена...");
//     const quoteResponse = await axios.get(
//       `${JUPITER_QUOTE_URL}?inputMint=${SOL_MINT}&outputMint=${mintAddress}&amount=${FIXED_SOL_AMOUNT}&slippageBps=6500`
//     );

//     const quoteData = quoteResponse.data;
//     if (!quoteData.routePlan || quoteData.routePlan.length === 0) {
//       console.error(
//         `[!] Невозможно купить токен ${mintAddress}: маршрут обмена не найден.`
//       );
//       return;
//     }
//     console.log("Маршрут найден. Отправляю запрос на свап...");
//     const swapResponse = await axios.post(JUPITER_SWAP_URL, {
//       quoteResponse: quoteData,
//       userPublicKey: wallet.publicKey.toBase58(),
//       wrapUnwrapSOL: true,
//       asLegacyTransaction: true,
//     });
//     const swapData = swapResponse.data;
//     const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
//     const transaction = Transaction.from(swapTransactionBuf);
//     transaction.partialSign(wallet);
//     const rawTransaction = transaction.serialize();
//     const latestBlockhash = await connection.getLatestBlockhash();
//     const txid = await connection.sendRawTransaction(rawTransaction);
//     await connection.confirmTransaction(
//       {
//         signature: txid,
//         blockhash: latestBlockhash.blockhash,
//         lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
//       },
//       "finalized"
//     );

//     // const quoteData = quoteResponse.data;
//     // if (!quoteData.routePlan || quoteData.routePlan.length === 0) {
//     //   console.error(
//     //     `[!] Невозможно купить токен ${mintAddress}: маршрут обмена не найден.`
//     //   );
//     //   return;
//     // }
//     // console.log("Маршрут найден. Отправляю запрос на свап...");
//     // const swapResponse = await axios.post(JUPITER_SWAP_URL, {
//     //   quoteResponse: quoteData,
//     //   userPublicKey: wallet.publicKey.toBase58(),
//     //   wrapUnwrapSOL: true,
//     //   asLegacyTransaction: true,
//     // });
//     // const swapData = swapResponse.data;
//     // const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
//     // const transaction = Transaction.from(swapTransactionBuf);
//     // transaction.partialSign(wallet);
//     // const rawTransaction = transaction.serialize();
//     // const latestBlockhash = await connection.getLatestBlockhash();
//     // const txid = await connection.sendRawTransaction(rawTransaction);
//     // console.log("📤 Отправляю транзакцию...");
//     // await connection.confirmTransaction(
//     //   {
//     //     signature: txid,
//     //     blockhash: latestBlockhash.blockhash,
//     //     lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
//     //   },
//     //   "finalized"
//     // );

//     // const quoteResponse = await axios.get(
//     //   `${JUPITER_QUOTE_URL}?inputMint=${SOL_MINT}&outputMint=${mintAddress}&amount=${FIXED_SOL_AMOUNT}&slippageBps=1000`
//     // );
//     // const quoteData = quoteResponse.data;
//     // if (!quoteData.routePlan || quoteData.routePlan.length === 0) {
//     //   console.error(
//     //     `[!] Невозможно купить токен ${mintAddress}: маршрут обмена не найден.`
//     //   );
//     //   return;
//     // }

//     // const swapResponse = await axios.post(JUPITER_SWAP_URL, {
//     //   quoteResponse: quoteData,
//     //   userPublicKey: wallet.publicKey.toBase58(),
//     //   wrapUnwrapSOL: true,
//     //   asLegacyTransaction: true,
//     // });

//     // const swapData = swapResponse.data;
//     // const transaction = Transaction.from(
//     //   Buffer.from(swapData.swapTransaction, "base64")
//     // );
//     // transaction.partialSign(wallet);

//     // const rawTransaction = transaction.serialize();
//     // console.log("📤 Отправляю транзакцию...");
//     // const txid = await connection.sendRawTransaction(rawTransaction);
//     await sendTelegramMessage("✅ Покупка успешна! Баланс:", wallet.publicKey);
//     console.log("✅ Покупка успешна! Транзакция:", txid);
//   } catch (error) {
//     console.error("Ошибка при покупке токена:", error);
//     if (error instanceof SendTransactionError) {
//       console.error("Детали ошибки:", error.message);
//       console.error("Логи транзакции:", error.logs);
//     }
//   }
// };

// const sellToken = async (mintAddress, wallet) => {
//   try {
//     console.log("Проверяю баланс токена...");
//     const tokenAccount = await findTokenAccount(mintAddress, wallet);
//     if (!tokenAccount) {
//       console.log("Нет токена на балансе. Пропускаем продажу.");
//       return;
//     }
//     const tokenBalanceLamports = await getTokenBalance(tokenAccount);
//     if (tokenBalanceLamports === 0) {
//       console.log("Баланс токена равен 0. Пропускаем продажу.");
//       return;
//     }
//     console.log("Ищу маршрут для продажи токена...");
//     const quoteResponse = await axios.get(
//       `${JUPITER_QUOTE_URL}?inputMint=${mintAddress}&outputMint=${SOL_MINT}&amount=${tokenBalanceLamports}&slippageBps=6500`
//     );

//     const quoteData = quoteResponse.data;

//     if (!quoteData.routePlan || quoteData.routePlan.length === 0) {
//       console.error("Маршрут не найден для продажи токена.");
//       return;
//     }

//     if (quoteData.error || !quoteData.routePlan?.length) {
//       const msg = `⚠️ Jupiter не может продать токен ${mintAddress}: ${
//         quoteData.error || "маршрут не найден"
//       }`;
//       console.warn(msg);
//       await sendTelegramMessage(msg);
//       return;
//     }

//     console.log("Маршрут найден. Отправляю запрос на свап...");
//     const swapResponse = await axios.post(JUPITER_SWAP_URL, {
//       quoteResponse: quoteData,
//       userPublicKey: wallet.publicKey.toBase58(),
//       wrapUnwrapSOL: true,
//       asLegacyTransaction: true,
//     });
//     const swapData = swapResponse.data;

//     if (swapData?.error || swapData?.errorCode) {
//       const msg = `⚠️ Jupiter отказал в продаже ${mintAddress}: ${
//         swapData.errorCode || swapData.error
//       }`;
//       console.warn(msg);
//       await sendTelegramMessage(msg);
//       return;
//     }

//     const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
//     const transaction = Transaction.from(swapTransactionBuf);
//     transaction.partialSign(wallet);
//     const rawTransaction = transaction.serialize();
//     const latestBlockhash = await connection.getLatestBlockhash();
//     const txid = await connection.sendRawTransaction(rawTransaction);
//     await connection.confirmTransaction(
//       {
//         signature: txid,
//         blockhash: latestBlockhash.blockhash,
//         lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
//       },
//       "finalized"
//     );
//     await sendTelegramMessage("❌ Продажа успешна! Баланс:", wallet.publicKey);
//     console.log("❌ Продажа успешна! Транзакция:", txid);
//   } catch (error) {
//     console.error("❌ Ошибка при продаже токена:", error);
//     if (error instanceof SendTransactionError) {
//       console.error("Детали ошибки:", error.message);
//       console.error("Логи транзакции:", error.logs);
//     }
//   }
// };

// const findTokenAccount = async (mintAddress, wallet) => {
//   const accounts = await connection.getParsedTokenAccountsByOwner(
//     wallet.publicKey,
//     {
//       mint: new PublicKey(mintAddress),
//     }
//   );
//   if (accounts.value.length === 0) return null;
//   return accounts.value[0].pubkey;
// };

// const getTokenBalance = async (tokenAccountPubkey) => {
//   const accountInfo = await connection.getParsedAccountInfo(tokenAccountPubkey);
//   const parsed = accountInfo.value?.data?.parsed;
//   if (!parsed) return 0;
//   return parsed.info.tokenAmount.amount;
// };

// const start = async () => {
//   if (!_PHANTOM) {
//     console.error("Публичный ключ (KEY) не загружен из .env.PHANTOM.");
//     return;
//   }
//   try {
//     const solBalanceLamports = await connection.getBalance(_PHANTOM);
//     const solBalance = solBalanceLamports / LAMPORTS_PER_SOL;
//     console.log(
//       `Баланс SOL кошелька ${_PHANTOM.toBase58()}: ${solBalance} SOL`
//     );
//   } catch (error) {
//     console.error("Ошибка при получении баланса SOL:", error);
//   }
// };

// module.exports = start;
// module.exports = handleNewUserSwapEvent;
