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
} = require("@solana/web3.js");
// === Настройки ===
const _PHANTOM = new PublicKey(process.env.PHANTOM); // адрес кошелька, с которого будем отправлять транзакции
const RPC_ENDPOINT = "https://api.mainnet-beta.solana.com"; // Можно подключить свой RPC для скорости
const connection = new Connection(RPC_ENDPOINT);
const secretKeyJson = process.env.SECRET; // Секретный ключ кошелька в формате base58
let wallet = null;
const JUPITER_QUOTE_URL = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_URL = "https://quote-api.jup.ag/v6/swap";

const FIXED_SOL_AMOUNT = 0.2 * LAMPORTS_PER_SOL; // 0.2 SOL

const SOL_MINT = "So11111111111111111111111111111111111111112"; // SOL "токен"

// async function getKeypairFromSeed(seedPhrase) {
//   try {
//     // Проверяем валидность сид-фразы
//     if (!bip39.validateMnemonic(seedPhrase)) {
//       throw new Error("Неверная сид-фраза.");
//     }

//     // Генерируем сид из сид-фразы
//     const seed = await bip39.mnemonicToSeed(seedPhrase);

//     // Создаем Keypair из сида
//     // Для Solana обычно используется путь деривации m/44'/501'/0'/0'
//     const keypair = Keypair.fromSeed(seed.slice(0, 32)); // Используем первые 32 байта сида

//     console.log("Keypair успешно создан.");
//     console.log("Публичный ключ:", keypair.publicKey.toBase58());
//     // console.log("Секретный ключ (ОСТОРОЖНО! Не выводите в консоль в реальных приложениях!):", keypair.secretKey);

//     return keypair;
//   } catch (error) {
//     console.error("Ошибка при создании Keypair из сид-фразы:", error);
//     return null;
//   }
// }

const secretKeyUint8Array = JSON.parse(secretKeyJson);
// Преобразуем массив чисел в Uint8Array и создаем Keypair
wallet = Keypair.fromSecretKey(Uint8Array.from(secretKeyUint8Array));

const handleNewUserSwapEvent = async (obj) => {
  // const { secretKey } = await getKeypairFromSeed(process.env.MNEMONIC);
  try {
    if (
      !obj ||
      typeof obj.mint === "undefined" ||
      typeof obj.change === "undefined"
    ) {
      console.error("Получен некорректный объект события:", obj);
      return;
    }
    if (obj?.change > 0) {
      console.log(`[+] Пользователь купил токен: ${obj?.mint}. Покупаю...`);
      await buyToken(obj?.mint);
    } else if (obj?.change < 0) {
      console.log(`[-] Пользователь продал токен: ${obj?.mintmint}. Продаю...`);
      await sellToken(obj?.mint);
    }
  } catch (error) {
    console.error("Ошибка в обработчике события:", error);
  }
};

const buyToken = async (mintAddress) => {
  try {
    console.log("Ищу маршрут для покупки токена...");

    const quoteResponse = await axios.get(
      `${JUPITER_QUOTE_URL}?inputMint=${SOL_MINT}&outputMint=${mintAddress}&amount=${FIXED_SOL_AMOUNT}&slippageBps=1000`
    );
    const quoteData = await quoteResponse.data;

    if (!quoteData.routes || quoteData.routes.length === 0) {
      console.error("Маршрут не найден для покупки токена.");
      return;
    }

    const bestRoute = quoteData.routes[0];

    const swapResponse = await axios.post(JUPITER_SWAP_URL, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route: bestRoute,
        userPublicKey: wallet.publicKey.toString(),
        wrapUnwrapSOL: true,
        feeAccount: null,
        asLegacyTransaction: true,
      }),
    });

    const swapData = await swapResponse.json();

    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
    const transaction = Transaction.from(swapTransactionBuf);

    transaction.sign(wallet);

    const rawTransaction = transaction.serialize();
    const txid = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,
    });

    console.log("Свап успешный! Транзакция:", txid);
  } catch (error) {
    console.error("Ошибка при покупке токена:", error);
  }
};

const sellToken = async (mintAddress) => {
  try {
    console.log("Проверяю баланс токена...");

    const tokenAccount = await findTokenAccount(mintAddress);
    if (!tokenAccount) {
      console.log("Нет токена на балансе. Пропускаем продажу.");
      return;
    }

    const tokenBalanceLamports = await getTokenBalance(tokenAccount);
    if (tokenBalanceLamports === 0) {
      console.log("Баланс токена равен 0. Пропускаем продажу.");
      return;
    }

    console.log("Ищу маршрут для продажи токена...");

    const quoteResponse = await axios.get(
      `${JUPITER_QUOTE_URL}?inputMint=${mintAddress}&outputMint=${SOL_MINT}&amount=${tokenBalanceLamports}&slippageBps=100`
    );
    const quoteData = await quoteResponse.data;

    if (!quoteData.routes || quoteData.routes.length === 0) {
      console.error("Маршрут не найден для продажи токена.");
      return;
    }

    const bestRoute = quoteData.routes[0];

    const swapResponse = await axios.post(JUPITER_SWAP_URL, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route: bestRoute,
        userPublicKey: wallet.publicKey.toString(),
        wrapUnwrapSOL: true,
        feeAccount: null,
        asLegacyTransaction: true,
      }),
    });

    const swapData = await swapResponse.json();

    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
    const transaction = Transaction.from(swapTransactionBuf);

    transaction.sign(wallet);

    const rawTransaction = transaction.serialize();
    const txid = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,
    });

    console.log("Продажа успешная! Транзакция:", txid);
  } catch (error) {
    console.error("Ошибка при продаже токена:", error);
  }
};

const findTokenAccount = async (mintAddress) => {
  const accounts = await connection.getParsedTokenAccountsByOwner(
    wallet.publicKey,
    {
      mint: new PublicKey(mintAddress),
    }
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

// const tokenMintAddress = new PublicKey(
//   "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
// ); // Адрес токена USDC

const a = async () => {
  // Проверяем, что KEY (публичный ключ из .env.PHANTOM) инициализирован
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

module.exports = a;
module.exports = handleNewUserSwapEvent;
