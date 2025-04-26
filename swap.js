/* eslint-disable no-unused-vars */
const {
  Connection,
  sendAndConfirmRawTransaction,
  PublicKey,
  Keypair,
} = require("@solana/web3.js");
const bs58 = require("bs58");
const axios = require("axios");
const { LAMPORTS_PER_SOL } = require("@solana/web3.js");
const connection = new Connection(
  "https://api.mainnet-beta.solana.com",
  "confirmed"
);
require("dotenv").config();

const KEY = new PublicKey(process.env.PUBLIC);

const tokenMintAddress = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
); // Адрес токена USDC

const a = async () => {
  // const solBalanceLamports = await connection.getBalance(KEY);
  // const solBalance = solBalanceLamports / LAMPORTS_PER_SOL;
  // console.log(`Баланс SOL: ${solBalance} SOL`);
  // const tokenAccounts = await connection.getTokenAccountsByOwner(
  //   process.env.PUBLIC,
  //   { mint: tokenMintAddress }
  // );
  // if (tokenAccounts.value.length > 0) {
  //   const usdcAccount = tokenAccounts.value[0];
  //   const balance = usdcAccount.account.data.parsed.info.tokenAmount.uiAmount;
  //   console.log(`Баланс USDC: ${balance}`);
  // } else {
  //   console.log("Нет аккаунтов для USDC на кошельке.");
  // }
};

a();

// // RPC-подключение

// // // Адреса токенов (пример: USDC -> SOL)
// const inputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
// const outputMint = "So11111111111111111111111111111111111111112"; // SOL
// const amount = 1000000; // 1 USDC (в минимальных единицах)

// async function getQuote() {
//   const res = await axios.get("https://quote-api.jup.ag/v6/quote", {
//     params: {
//       inputMint,
//       outputMint,
//       amount,
//       slippageBps: 100, // 0.5% проскальзывание
//     },
//   });
//   return res.data;
// }

// async function getSwapTransaction(route) {
//   const res = await axios.post("https://quote-api.jup.ag/v6/swap", {
//     route,
//     userPublicKey: keypair.publicKey.toBase58(),
//     wrapUnwrapSOL: true,
//     feeAccount: null,
//   });
//   return res.data.swapTransaction;
// }

// async function main() {
//   console.log("🔍 Получаем quote...");
//   const { data: routes } = await getQuote();
//   if (!routes || routes.length === 0) {
//     console.error("Не удалось найти маршруты для обмена.");
//     return;
//   }
//   const bestRoute = routes[0];
//   console.log("✅ Лучший маршрут найден.");

//   console.log("📦 Получаем swap транзакцию...");
//   const txBase64 = await getSwapTransaction(bestRoute);
//   const txBuffer = Buffer.from(txBase64, "base64");
//   const transaction = await connection.deserializeTransaction(txBuffer);

//   transaction.partialSign(keypair); // подписываем

//   // //   console.log("🚀 Отправляем транзакцию...");
//   const rawTx = transaction.serialize();
//   const txid = await connection.sendRawTransaction(rawTx, {
//     skipPreflight: false,
//   });
//   console.log("✅ Транзакция отправлена:", txid);
// }

module.exports = a;
