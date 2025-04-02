// СЮДА Я СЛИЛ ФУНКЦИИ КОТОРЫЕ ПОКА НЕ НУЖНЫ, ЧТО БЫ НЕ ЗАСОРЯТЬ MAIN

// const wallets = require("./wallets.json").wallets;

// const ETHERSCAN_API = process.env.ETHERSCAN_API;

// async function getTransactions(wallet) {
//   const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${wallet}&apikey=${ETHERSCAN_API}`;

//   const response = await axios.get(url);

//   return response.data.result;
// }

// async function monitorWallets() {
//   let a;
//   for (const wallet of wallets) {
//     const transactions = await getTransactions(wallet);

//     for (const tx of transactions) {
//       a = analyzeTransaction(tx);
//       console.log(a);
//     }
//   }
// }

// monitorWallets();

// async function analyzeTransaction(tx) {
//   if (
//     tx.to.toLowerCase() ===
//     "0xE592427A0AEce92De3Edee1F18E0157C05861564".toLowerCase()
//   ) {
//     console.log(`Кит купил токен через Uniswap: ${tx.hash}`);

//     return tx;
//   }

//   return 123;
// }

// setInterval(monitorWallets, 3000);

// const router = require("./routes/api/");
