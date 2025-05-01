const axios = require("axios");
const { Connection, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const RPC_ENDPOINT = `https://rpc.helius.xyz/?api-key=${process.env.HELIUS}`;
const connection = new Connection(RPC_ENDPOINT);

const sendTelegramMessage = async (text, wallet) => {
  const preBalance = await connection.getBalance(wallet);
  const curBalance = preBalance / LAMPORTS_PER_SOL;
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: text + curBalance + " SOL",
    });
  } catch (err) {
    console.error("Ошибка при отправке Telegram-сообщения:", err.message);
  }
};

module.exports = sendTelegramMessage;
