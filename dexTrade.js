require("dotenv").config();

const Web3 = require("web3");

const web3 = new Web3("https://mainnet.infura.io/v3/YOUR_INFURA_API");

const uniswapRouter = "0xRouterAddressUniswap";

const privateKey = "ВАШ_ПРИВАТНЫЙ_КЛЮЧ";

const wallet = "0xВашКошелек";

async function buyToken(tokenAddress, amount) {
  const contract = new web3.eth.Contract(
    [
      /* ABI контракта Uniswap */
    ],
    uniswapRouter
  );

  const tx = {
    from: wallet,

    to: uniswapRouter,

    gas: 200000,

    gasPrice: web3.utils.toWei("5", "gwei"),

    data: contract.methods
      .swapExactETHForTokens(
        0,

        [web3.utils.toChecksumAddress(tokenAddress)],

        wallet,

        Math.floor(Date.now() / 1000) + 60 * 10
      )
      .encodeABI(),
  };

  const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);

  const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

  console.log(`Куплен токен: ${tokenAddress}, TX: ${receipt.transactionHash}`);
}

// Пример: покупка токена

buyToken("0xTokenAddress", web3.utils.toWei("0.1", "ether"));
