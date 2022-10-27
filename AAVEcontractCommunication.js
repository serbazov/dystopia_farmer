const { ethers, BigNumber } = require("ethers");
const JSBI = require("jsbi"); // jsbi@3.2.5
const { getGasPrice } = require("./utils.js");
const PoolABI = require("./abi/AAVEPoolABI.json");
const ERC20ABI = require("./abi/ERC20ABI.json");
const wethABI = require("./abi/WETHGatewayABI.json");
const {
  UiPoolDataProvider,
  UiIncentiveDataProvider,
  ChainId,
} = require("@aave/contract-helpers");
const {
  formatReserves,
  formatReservesAndIncentives,
  formatUserSummary,
} = require("@aave/math-utils");

const web3Provider = new ethers.providers.StaticJsonRpcProvider(
  "https://polygon-mainnet.g.alchemy.com/v2/6aCuWP8Oxcd-4jvmNYLh-WervViwIeJq",
  ChainId.polygon
);

const AAVEpoolAddress =
  "0x794a61358D6845594F94dc1DB02A252b5b4814aD".toLowerCase();
const uiPoolDataProviderV3 =
  "0x7006e5a16E449123a3F26920746d03337ff37340".toLowerCase();
const uiIncentiveDataProviderV3 =
  "0xF43EfC9789736BaF550DC016C7389210c43e7997".toLowerCase();
const lendingPoolAddressProvider =
  "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb".toLowerCase();
const WETHGatewayAddress =
  "0x1e4b7A6b903680eab0c5dAbcb8fD429cD2a9598c".toLowerCase();
const supplyTokenAddress =
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174".toLowerCase();
const gasPriceUrl = "https://gasstation-mainnet.matic.network/v2";
// const borrowingTokenContract = token0Contract
// const suppliedTokenContract = new ethers.Contract(supplyTokenAddress, ERC20ABI, web3Provider)

const poolDataProviderContract = new UiPoolDataProvider({
  uiPoolDataProviderAddress: uiPoolDataProviderV3,
  provider: web3Provider,
});

const incentiveDataProviderContract = new UiIncentiveDataProvider({
  uiIncentiveDataProviderAddress: uiIncentiveDataProviderV3,
  provider: web3Provider,
});

async function getUserSummary(WALLET_ADDRESS) {
  const reserves = await poolDataProviderContract.getReservesHumanized({
    lendingPoolAddressProvider,
  });

  const userReserves = await poolDataProviderContract.getUserReservesHumanized({
    lendingPoolAddressProvider: lendingPoolAddressProvider,
    user: WALLET_ADDRESS,
  });

  // Array of incentive tokens with price feed and emission APR
  // const reserveIncentives = await incentiveDataProviderContract.getReservesIncentivesDataHumanized({
  //     lendingPoolAddressProvider,
  // });

  // Dictionary of claimable user incentives
  // const userIncentives = await incentiveDataProviderContract.getUserReservesIncentivesDataHumanized({
  //     lendingPoolAddressProvider,
  //     WALLET_ADDRESS,
  // });

  // reserves input from Fetching Protocol Data section

  const reservesArray = reserves.reservesData;
  const baseCurrencyData = reserves.baseCurrencyData;

  const currentTimestamp = Math.floor(Date.now() / 1000);

  /*
    - @param `reserves` Input from [Fetching Protocol Data](#fetching-protocol-data), `reserves.reservesArray`
    - @param `currentTimestamp` Current UNIX timestamp in seconds
    - @param `marketReferencePriceInUsd` Input from [Fetching Protocol Data](#fetching-protocol-data), `reserves.baseCurrencyData.marketReferencePriceInUsd`
    - @param `marketReferenceCurrencyDecimals` Input from [Fetching Protocol Data](#fetching-protocol-data), `reserves.baseCurrencyData.marketReferenceCurrencyDecimals`
    */
  const formattedReserves = formatReserves({
    reserves: reservesArray,
    currentTimestamp,
    marketReferenceCurrencyDecimals:
      baseCurrencyData.marketReferenceCurrencyDecimals,
    marketReferencePriceInUsd:
      baseCurrencyData.marketReferenceCurrencyPriceInUsd,
  });

  // const formatReservesAndIncent = formatReservesAndIncentives({
  //   reserves: reservesArray,
  //   currentTimestamp,
  //   marketReferenceCurrencyDecimals: baseCurrencyData.marketReferenceCurrencyDecimals,
  //   marketReferencePriceInUsd: baseCurrencyData.marketReferenceCurrencyPriceInUsd,
  //   reserveIncentives,
  // });

  const userReservesArray = userReserves.userReserves;

  return formatUserSummary({
    currentTimestamp,
    marketReferencePriceInUsd:
      baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    marketReferenceCurrencyDecimals:
      baseCurrencyData.marketReferenceCurrencyDecimals,
    userReserves: userReservesArray,
    formattedReserves,
    userEmodeCategoryId: userReserves.userEmodeCategoryId,
  });
}

async function supply(
  assetAddress,
  amount,
  referralCode,
  WALLET_ADDRESS,
  WALLET_SECRET
) {
  const gasPrice = getGasPrice(gasPriceUrl);

  const wallet = new ethers.Wallet(WALLET_SECRET, web3Provider);

  const pool = new ethers.Contract(AAVEpoolAddress, PoolABI, web3Provider);
  const poolContract = pool.connect(wallet);

  return await poolContract
    .supply(assetAddress, amount, WALLET_ADDRESS, referralCode, {
      gasPrice: gasPrice,
      gasLimit: BigNumber.from("500000"),
    })
    .then(function (transaction) {
      return transaction.wait();
    });
}

async function withdraw(assetAddress, amount, WALLET_ADDRESS, WALLET_SECRET) {
  const gasPrice = getGasPrice(gasPriceUrl);

  const wallet = new ethers.Wallet(WALLET_SECRET, web3Provider);

  const pool = new ethers.Contract(AAVEpoolAddress, PoolABI, web3Provider);
  const poolContract = pool.connect(wallet);

  return await poolContract
    .withdraw(assetAddress, amount, WALLET_ADDRESS, {
      gasPrice: gasPrice,
      gasLimit: BigNumber.from("500000"),
    })
    .then(function (transaction) {
      return transaction.wait();
    });
}

async function borrow(
  assetAddress,
  amount,
  interestRateMode,
  referralCode,
  WALLET_ADDRESS,
  WALLET_SECRET
) {
  const gasPrice = getGasPrice(gasPriceUrl);

  const wallet = new ethers.Wallet(WALLET_SECRET, web3Provider);

  const pool = new ethers.Contract(AAVEpoolAddress, PoolABI, web3Provider);
  const poolContract = pool.connect(wallet);

  return await poolContract
    .borrow(
      assetAddress,
      amount,
      interestRateMode,
      referralCode,
      WALLET_ADDRESS,
      { gasPrice: gasPrice, gasLimit: BigNumber.from("500000") }
    )
    .then(function (transaction) {
      return transaction.wait();
    });
}

async function repay(
  assetAddress,
  amount,
  RateMode,
  WALLET_ADDRESS,
  WALLET_SECRET
) {
  const gasPrice = getGasPrice(gasPriceUrl);

  const wallet = new ethers.Wallet(WALLET_SECRET, web3Provider);

  const pool = new ethers.Contract(AAVEpoolAddress, PoolABI, web3Provider);
  const poolContract = pool.connect(wallet);

  return await poolContract
    .repay(assetAddress, amount, RateMode, WALLET_ADDRESS, {
      gasPrice: gasPrice,
      gasLimit: BigNumber.from("500000"),
    })
    .then(function (transaction) {
      return transaction.wait();
    });
}

module.exports = {
  AAVEpoolAddress,
  getUserSummary,
  supply,
  withdraw,
  borrow,
  repay,
};
