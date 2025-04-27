/* eslint-disable no-unused-vars */
const bs58 = require("bs58");
const axios = require("axios");
require("dotenv").config();
const {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
} = require("@solana/web3.js");
// === Настройки ===
const KEY = new PublicKey(process.env.PUBLIC); // адрес кошелька, с которого будем отправлять транзакции

const RPC_ENDPOINT = "https://api.mainnet-beta.solana.com"; // Можно подключить свой RPC для скорости
const connection = new Connection(RPC_ENDPOINT);
// const wallet = Keypair.fromSecretKey(KEY); // обязательно свой Keypair вставить сюда
const JUPITER_QUOTE_URL = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_URL = "https://quote-api.jup.ag/v6/swap";

const FIXED_SOL_AMOUNT = 0.2 * LAMPORTS_PER_SOL; // 0.2 SOL

const SOL_MINT = "So11111111111111111111111111111111111111112"; // SOL "токен"

const handleNewUserSwapEvent = async (obj) => {
  obj && console.log(obj);

  // try {
  //   if (change > 0) {
  //     console.log(`[+] Пользователь купил токен: ${mint}. Покупаю...`);
  //     await buyToken(mint);
  //   } else if (change < 0) {
  //     console.log(`[-] Пользователь продал токен: ${mint}. Продаю...`);
  //     await sellToken(mint);
  //   }
  // } catch (error) {
  //   console.error("Ошибка в обработчике события:", error);
  // }
};

// const buyToken = async (mintAddress) => {
//   try {
//     console.log("Ищу маршрут для покупки токена...");

//     const quoteResponse = await fetch(
//       `${JUPITER_QUOTE_URL}?inputMint=${SOL_MINT}&outputMint=${mintAddress}&amount=${FIXED_SOL_AMOUNT}&slippageBps=100`
//     );
//     const quoteData = await quoteResponse.json();

//     if (!quoteData.routes || quoteData.routes.length === 0) {
//       console.error("Маршрут не найден для покупки токена.");
//       return;
//     }

//     const bestRoute = quoteData.routes[0];

//     const swapResponse = await fetch(JUPITER_SWAP_URL, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         route: bestRoute,
//         userPublicKey: wallet.publicKey.toString(),
//         wrapUnwrapSOL: true,
//         feeAccount: null,
//         asLegacyTransaction: true,
//       }),
//     });

//     const swapData = await swapResponse.json();

//     const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
//     const transaction = Transaction.from(swapTransactionBuf);

//     transaction.sign(wallet);

//     const rawTransaction = transaction.serialize();
//     const txid = await connection.sendRawTransaction(rawTransaction, {
//       skipPreflight: true,
//     });

//     console.log("Свап успешный! Транзакция:", txid);
//   } catch (error) {
//     console.error("Ошибка при покупке токена:", error);
//   }
// };

// const sellToken = async (mintAddress) => {
//   try {
//     console.log("Проверяю баланс токена...");

//     const tokenAccount = await findTokenAccount(mintAddress);
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

//     const quoteResponse = await fetch(
//       `${JUPITER_QUOTE_URL}?inputMint=${mintAddress}&outputMint=${SOL_MINT}&amount=${tokenBalanceLamports}&slippageBps=100`
//     );
//     const quoteData = await quoteResponse.json();

//     if (!quoteData.routes || quoteData.routes.length === 0) {
//       console.error("Маршрут не найден для продажи токена.");
//       return;
//     }

//     const bestRoute = quoteData.routes[0];

//     const swapResponse = await fetch(JUPITER_SWAP_URL, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         route: bestRoute,
//         userPublicKey: wallet.publicKey.toString(),
//         wrapUnwrapSOL: true,
//         feeAccount: null,
//         asLegacyTransaction: true,
//       }),
//     });

//     const swapData = await swapResponse.json();

//     const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
//     const transaction = Transaction.from(swapTransactionBuf);

//     transaction.sign(wallet);

//     const rawTransaction = transaction.serialize();
//     const txid = await connection.sendRawTransaction(rawTransaction, {
//       skipPreflight: true,
//     });

//     console.log("Продажа успешная! Транзакция:", txid);
//   } catch (error) {
//     console.error("Ошибка при продаже токена:", error);
//   }
// };

// const findTokenAccount = async (mintAddress) => {
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

// const tokenMintAddress = new PublicKey(
//   "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
// ); // Адрес токена USDC

const a = async () => {
  const solBalanceLamports = await connection.getBalance(KEY);
  const solBalance = solBalanceLamports / LAMPORTS_PER_SOL;
  console.log(`Баланс SOL: ${solBalance} SOL`);
};

a();

module.exports = a;
module.exports = handleNewUserSwapEvent;
