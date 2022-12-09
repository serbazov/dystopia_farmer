const { ethers, BigNumber } = require("ethers");
const { ChainId } = require("@aave/contract-helpers");
const web3Provider = new ethers.providers.StaticJsonRpcProvider(
  "https://polygon-mainnet.g.alchemy.com/v2/6aCuWP8Oxcd-4jvmNYLh-WervViwIeJq",
  ChainId.polygon
);
const {
  swapAndAdd,
  claimFeesReward,
  swapToken1ToToken2,
  swapInTargetProportion,
  calcLPTokensValue,
  removeLiquidityFromPool,
  addAllLiquidity,
} = require("./DystopiaCommunication");
const {
  getTokenBalanceWallet,
  getCurrentPrice,
  approveToken,
  getGasPrice,
  errCatcher,
} = require("./Utilities");
const {
  supply,
  withdraw,
  borrow,
  repay,
  getUserSummary,
} = require("./AAVEcontractCommunication");

const PenAddress = "0x9008D70A5282a936552593f410AbcBcE2F891A97".toLowerCase();
const DystAddress = "0x39aB6574c289c3Ae4d88500eEc792AB5B947A5Eb".toLowerCase();
const UsdplusAddress =
  "0x236eeC6359fb44CCe8f97E99387aa7F8cd5cdE1f".toLowerCase();
const DystopiaRouterAddress =
  "0xbE75Dd16D029c6B32B7aD57A0FD9C1c20Dd2862e".toLowerCase();
const PenroseProxy = "0xc9Ae7Dac956f82074437C6D40f67D6a5ABf3E34b".toLowerCase();
const AAVEpoolAddress =
  "0x794a61358D6845594F94dc1DB02A252b5b4814aD".toLowerCase();

class Position {
  wallet_address;
  wallet_secret;
  targetHealthFactor;
  rebalancingDelta;
  interval;
  token1;
  token2;
  poolToken;
  constructor(
    wallet_address,
    wallet_secret,
    targetHealthFactor,
    rebalancingDelta,
    interval,
    token1,
    token2,
    poolToken,
    summary
  ) {
    this.wallet_address = wallet_address;
    this.wallet_secret = wallet_secret;
    this.wallet = new ethers.Wallet(wallet_secret, web3Provider);
    this.rebalancingDelta = rebalancingDelta;
    this.targetHealthFactor = targetHealthFactor;
    this.interval = interval;
    this.token1 = token1;
    this.token2 = token2;
    this.poolToken = poolToken;
  }
  async initializePosition() {
    swapInTargetProportion(
      this.wallet_address,
      this.wallet,
      this.token1,
      this.token2
    );
    let token1Amount = await getTokenBalanceWallet(
      this.token1,
      this.wallet_address
    );
    await errCatcher(swapToken1ToToken2, [
      this.token1,
      UsdcAddress,
      token1Amount,
      this.wallet,
      this.wallet_address,
    ]);
  }
  async approveEverythingNeeded() {
    await approveToken(UsdplusAddress, DystopiaRouterAddress, this.wallet);
    await approveToken(this.token1, AAVEpoolAddress, this.wallet);
    await approveToken(this.token2, AAVEpoolAddress, this.wallet);
    await approveToken(this.poolToken, DystopiaRouterAddress, this.wallet);
    await approveToken(this.token1, DystopiaRouterAddress, this.wallet);
    await approveToken(this.token2, DystopiaRouterAddress, this.wallet);
    await approveToken(PenAddress, DystopiaRouterAddress, this.wallet);
    await approveToken(DystAddress, DystopiaRouterAddress, this.wallet);
    await approveToken(this.poolToken, PenroseProxy, this.wallet);
  }
  async initializeAAVEPosition() {
    let UsdcAmount = await getTokenBalanceWallet(
      UsdcAddress,
      this.wallet_address
    );
    await errCatcher(supply, [UsdcAddress, UsdcAmount, 0, this.wallet]);
    let price = await getCurrentPrice(
      UsdplusAddress,
      WmaticAddress,
      UsdplusDecimals,
      WmaticDecimals,
      wallet
    );
    this.summary = await getUserSummary(this.wallet_address);
    let WmaticBorrow = ethers.utils.parseUnits(
      (
        Number(
          (this.summary.totalLiquidityUSD / this.targetHealthFactor) * 0.85
        ) / price
      ).toString(),
      WmaticDecimals
    );
    await errCatcher(borrow, [
      WmaticAddress,
      WmaticBorrow,
      2,
      0,
      WALLET_ADDRESS,
      WALLET_SECRET,
    ]);
  }
}

async function testRun() {
  const Wallet_address =
    "0x534E8360dC3290D8FB6884De663487379CE5aB08".toLowerCase();
  const Wallet_secret =
    "658337c9762658cedaa69ba0a012ed1fc26f86378b60a6341bab526f2d2934b0".toLowerCase();
  const UsdplusAddress =
    "0x236eeC6359fb44CCe8f97E99387aa7F8cd5cdE1f".toLowerCase();
  const WmaticAddress =
    "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270".toLowerCase(); //Wmatic
  const PoolToken = "0x1A5FEBA5D5846B3b840312Bd04D76ddaa6220170".toLowerCase(); //v-Wmatic/usd+

  let Myposition = new Position(
    Wallet_address,
    Wallet_secret,
    1.2,
    0.1,
    6,
    UsdplusAddress,
    WmaticAddress,
    PoolToken
  );
  await Myposition.initializePosition();
}

testRun();
