const { ethers, BigNumber } = require("ethers");
const { ChainId } = require("@aave/contract-helpers");
const fetch = require("node-fetch"); // node-fetch@1.7.3
const url = "https://gasstation-mainnet.matic.network/v2";
const web3Provider = new ethers.providers.StaticJsonRpcProvider(
  "https://polygon-mainnet.g.alchemy.com/v2/6aCuWP8Oxcd-4jvmNYLh-WervViwIeJq",
  ChainId.polygon
);
const DystopiaRouterABI = require("./abi/RouterABI.json");
const ERC20ABI = require("./abi/ERC20ABI.json");
const DystopiaRouterAddress =
  "0xbE75Dd16D029c6B32B7aD57A0FD9C1c20Dd2862e".toLowerCase();

async function getGasPrice() {
  return await fetch(url)
    .then((response) => response.json())
    .then((json) => BigNumber.from(Math.round(json.standard.maxFee * 10 ** 9)));
}
async function getCurrentPrice(
  // how much token2 cost in token1
  Token1,
  Token2,
  token1Decimals,
  token2Decimals,
  wallet
) {
  const dystopiarouter = new ethers.Contract(
    DystopiaRouterAddress,
    DystopiaRouterABI,
    web3Provider
  );
  const dystopiarouterContract = dystopiarouter.connect(wallet);

  const reserves = await dystopiarouterContract.getReserves(
    Token1,
    Token2,
    false
  );
  return (
    reserves[0] / 10 ** token1Decimals / (reserves[1] / 10 ** token2Decimals)
  );
}

async function getTokenBalanceWallet(TokenAddress, WALLET_ADDRESS) {
  const Token = new ethers.Contract(TokenAddress, ERC20ABI, web3Provider);
  tokenBalance = await Token.balanceOf(WALLET_ADDRESS);
  return tokenBalance;
}
async function getTotalTokenSupply(TokenAddress) {
  const Token = new ethers.Contract(TokenAddress, ERC20ABI, web3Provider);
  totalSupply = await Token.totalSupply();
  return totalSupply;
}

async function approveToken(TokenAddress, ContractAddress, ConnectedWallet) {
  const tokenContract = new ethers.Contract(
    TokenAddress,
    ERC20ABI,
    web3Provider
  );
  const gasPrice = await getGasPrice();
  await tokenContract
    .connect(ConnectedWallet)
    .approve(ContractAddress, ethers.constants.MaxUint256, {
      gasPrice: gasPrice,
      gasLimit: BigNumber.from("1000000"),
    })
    .then(function (transaction) {
      return transaction.wait();
    });
}
module.exports = {
  getGasPrice,
  getTokenBalanceWallet,
  getTotalTokenSupply,
  approveToken,
  getCurrentPrice,
};
