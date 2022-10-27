const { ethers, BigNumber } = require("ethers");
const { ChainId } = require("@aave/contract-helpers");
const web3Provider = new ethers.providers.StaticJsonRpcProvider(
  "https://polygon-mainnet.g.alchemy.com/v2/6aCuWP8Oxcd-4jvmNYLh-WervViwIeJq",
  ChainId.polygon
);
const DystopiaRouterABI = require("./abi/RouterABI.json");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const {
  swapAndAdd,
  removeLiquidityFromPool,
  claimFeesReward,
  swapToken1ToToken2,
  swapInTargetProportion,
  calcLPTokensValue,
} = require("./DystopiaCommunication");
const {
  depositLpAndStake,
  unstakeLpWithdrawAndClaim,
} = require("./PenroseCommunication");
const {
  supply,
  withdraw,
  borrow,
  repay,
  getUserSummary,
} = require("./AAVEcontractCommunication");
const { getTokenBalanceWallet, getCurrentPrice } = require("./Utils");
const PenAddress = "0x9008D70A5282a936552593f410AbcBcE2F891A97".toLowerCase();
const DystAddress = "0x39aB6574c289c3Ae4d88500eEc792AB5B947A5Eb".toLowerCase();
const UsdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174".toLowerCase(); //Usdc
const UsdcDecimals = 6;
const WmaticAddress =
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270".toLowerCase(); //Wmatic
const DystopiaRouterAddress =
  "0xbE75Dd16D029c6B32B7aD57A0FD9C1c20Dd2862e".toLowerCase();
const WmaticDecimals = 18;
const PoolToken = "0x60c088234180b36edcec7aa8aa23912bb6bed114".toLowerCase(); //Usdc/Wmatic pool token
const doc = new GoogleSpreadsheet(
  "1MFJqjSj6DAdhLygLoxp39aFm8iVshRyWnPm9W9IWjdo"
);
const creds = require("./credentials.json");

var args = process.argv.slice(2);
const timer = (ms) => new Promise((res) => setTimeout(res, ms));

async function errCatcher(f, arguments) {
  doLoop = true;
  do {
    try {
      return await f.apply(this, arguments);
    } catch (err) {
      console.log(err);
      await timer(180000);
    }
  } while (doLoop);
}

async function getamountWithoutCollaterial(summary, tokensAmounts, price) {
  return (
    tokensAmounts[1] / 10 ** UsdcDecimals +
    (tokensAmounts[0] / 10 ** WmaticDecimals) * price -
    summary.totalBorrowsUSD
  );
}

async function runNoHedge(args) {
  // args : [days_interval,Wallet_Address, Wallet_Secret]
  const days = args[0];
  const WALLET_ADDRESS = args[1];
  const WALLET_SECRET = args[2];
  const wallet = new ethers.Wallet(WALLET_SECRET, web3Provider);
  while (true) {
    console.log("start");
    await swapAndAdd(WALLET_ADDRESS, WALLET_SECRET);
    console.log("tokensSwapped");
    await depositLpAndStake(wallet);
    console.log("LPtokensStaked");
    await timer(1000 * 60 * 60 * days);
    console.log("it's time to withdraw");
    await unstakeLpWithdrawAndClaim(wallet);
    console.log("LP unstaked");
    const amountDyst = await getTokenBalanceWallet(DystAddress, WALLET_ADDRESS);
    const amountPen = await getTokenBalanceWallet(PenAddress, WALLET_ADDRESS);
    await swapToken1ToToken2(
      DystAddress,
      UsdcAddress,
      amountDyst,
      wallet,
      WALLET_ADDRESS
    );
    await swapToken1ToToken2(
      PenAddress,
      UsdcAddress,
      amountPen,
      wallet,
      WALLET_ADDRESS
    );
    console.log("ShitCoinsSwapped");
  }
}
async function runWithHedge(args) {
  // args : [delta_rebalance, health_factor, time_interval, Wallet_Address, Wallet_Secret]
  console.log("start");
  const rebalancingDelta = args[0];
  const healthFactor = args[1];
  const interval = args[2];
  const WALLET_ADDRESS = args[3];
  const WALLET_SECRET = args[4];
  const wallet = new ethers.Wallet(WALLET_SECRET, web3Provider);
  let startTimestamp = Date.now();
  let UsdcAmount = await getTokenBalanceWallet(UsdcAddress, WALLET_ADDRESS);
  const WmaticAmount = await getTokenBalanceWallet(
    WmaticAddress,
    WALLET_ADDRESS
  );
  let price = await getCurrentPrice(
    UsdcAddress,
    WmaticAddress,
    UsdcDecimals,
    WmaticDecimals,
    wallet
  );
  await doc.useServiceAccountAuth(creds);
  const sheet = await doc.addSheet({
    headerValues: [
      "Time",
      "UnixTime",
      "AAVECollateral",
      "HealthFactor",
      "USDCAmount",
      "WMATICAmount",
      "CurrentPRICE",
      "Total",
    ],
  });
  const fullAmount =
    UsdcAmount / 10 ** UsdcDecimals +
    (price * WmaticAmount) / 10 ** WmaticDecimals;
  await swapInTargetProportion(WALLET_ADDRESS, WALLET_SECRET);
  UsdcAmount = await getTokenBalanceWallet(UsdcAddress, WALLET_ADDRESS);
  await supply(UsdcAddress, UsdcAmount, 0, WALLET_ADDRESS, WALLET_SECRET);
  let summary = await getUserSummary(WALLET_ADDRESS);
  let WmaticBorrow = ethers.utils.parseUnits(
    (Number(summary.availableBorrowsUSD) / healthFactor / price).toString(),
    WmaticDecimals
  );
  await borrow(
    WmaticAddress,
    WmaticBorrow,
    2,
    0,
    WALLET_ADDRESS,
    WALLET_SECRET
  );
  console.log("AAVE borrowed");
  await swapAndAdd(WALLET_ADDRESS, WALLET_SECRET);
  console.log("tokensSwapped");
  const dystopiarouter = new ethers.Contract(
    DystopiaRouterAddress,
    DystopiaRouterABI,
    web3Provider
  );
  const dystopiarouterContract = dystopiarouter.connect(wallet);
  let tokensAmounts = await calcLPTokensValue(
    PoolToken,
    dystopiarouterContract,
    WALLET_ADDRESS
  );
  //await errCatcher(depositLpAndStake, [wallet]);
  console.log("LPtokensStaked");

  summary = await getUserSummary(WALLET_ADDRESS);
  await sheet.addRow({
    Time: Date(Date.now),
    UnixTime: Date.now(),
    AAVECollateral: summary.totalLiquidityUSD,
    HealthFactor: summary.healthFactor,
    USDCAmount: tokensAmounts[1] / 10 ** UsdcDecimals,
    WMATICAmount: tokensAmounts[0] / 10 ** WmaticDecimals,
    CurrentPRICE: price,
    Total: UsdcAmount / 10 ** UsdcDecimals + Number(summary.totalLiquidityUSD),
  });
  while (true) {
    summary = await getUserSummary(WALLET_ADDRESS);
    if (Number(summary.healthFactor) - healthFactor > rebalancingDelta) {
      //надо взять еще с AAVE
      //await errCatcher(unstakeLpWithdrawAndClaim, [wallet]);
      let amountWithoutCollaterial = await getamountWithoutCollaterial(
        summary,
        tokensAmounts,
        price
      );
      if (summary.totalLiquidityUSD >= amountWithoutCollaterial) {
        let WmaticBorrow = ethers.utils.parseUnits(
          (
            (Number((summary.totalLiquidityUSD / healthFactor) * 0.85) -
              summary.totalBorrowsUSD) /
              price -
            Number(summary.totalBorrowsUSD)
          ).toString(),
          WmaticDecimals
        );
        await borrow(
          WmaticAddress,
          WmaticBorrow,
          2,
          0,
          WALLET_ADDRESS,
          WALLET_SECRET
        );
      } else {
        let UsdcWithdraw = ethers.utils.parseUnits(
          (
            Number(summary.totalCollateralUSD) -
            Number(summary.totalBorrowsUSD) * healthFactor * 0.85
          ).toString(),
          UsdcDecimals
        );
        await withdraw(
          UsdcAddress,
          UsdcWithdraw,
          WALLET_ADDRESS,
          WALLET_SECRET
        );
      }
    }
    if (healthFactor - Number(summary.healthFactor) >= rebalancingDelta) {
      // Надо докинуть на AAVE
      //await errCatcher(unstakeLpWithdrawAndClaim, [wallet]);
      let amountWithoutCollaterial = await getamountWithoutCollaterial(
        summary,
        tokensAmounts,
        price
      );
      if (summary.totalLiquidityUSD >= amountWithoutCollaterial) {
        let WmaticRepay = ethers.utils.parseUnits(
          (
            Number(summary.totalBorrowsUSD) -
            (summary.totalBorrowsUSD -
              Number((summary.totalLiquidityUSD / healthFactor) * 0.85)) /
              price
          ).toString(),
          WmaticDecimals
        );
        await repay(
          WmaticAddress,
          WmaticRepay,
          2,
          WALLET_ADDRESS,
          WALLET_SECRET
        );
      } else {
        let UsdcSupply = ethers.utils.parseUnits(
          (
            Number(summary.totalBorrowsUSD) * healthFactor * 0.8 -
            Number(summary.totalCollateralUSD)
          ).toString(),
          UsdcDecimals
        );
        await supply(UsdcAddress, UsdcSupply, 0, WALLET_ADDRESS, WALLET_SECRET);
      }
    }
    if (Date.now() >= startTimestamp + 1000 * 3600 * interval) {
      console.log("it's time to withdraw");
      // await errCatcher(unstakeLpWithdrawAndClaim, [wallet]);
      // console.log("LP unstaked");
      // let amountDyst = await getTokenBalanceWallet(DystAddress, WALLET_ADDRESS);
      // let amountPen = await getTokenBalanceWallet(PenAddress, WALLET_ADDRESS);
      // await swapToken1ToToken2(
      //   DystAddress,
      //   UsdcAddress,
      //   amountDyst,
      //   wallet,
      //   WALLET_ADDRESS
      // );
      // await swapToken1ToToken2(
      //   PenAddress,
      //   UsdcAddress,
      //   amountPen,
      //   wallet,
      //   WALLET_ADDRESS
      // );
      // console.log("ShitCoinsSwapped");
      //await claimFeesReward(wallet);
      startTimestamp = Date.now();
      //await swapAndAdd(WALLET_ADDRESS, WALLET_SECRET);
      console.log("tokensSwapped");
      tokensAmounts = await calcLPTokensValue(
        PoolToken,
        dystopiarouterContract,
        WALLET_ADDRESS
      );
      //await errCatcher(depositLpAndStake, [wallet]);
      console.log("LPtokensStaked");

      price = await getCurrentPrice(
        UsdcAddress,
        WmaticAddress,
        UsdcDecimals,
        WmaticDecimals,
        wallet
      );
      let LPValue =
        tokensAmounts[1] / 10 ** UsdcDecimals +
        (tokensAmounts[0] / 10 ** WmaticDecimals) * price;
      summary = await getUserSummary(WALLET_ADDRESS);
      await sheet.addRow({
        Time: Date(Date.now),
        UnixTime: Date.now(),
        AAVECollateral: summary.totalLiquidityUSD,
        HealthFactor: summary.healthFactor,
        USDCAmount: tokensAmounts[1] / 10 ** UsdcDecimals,
        WMATICAmount: tokensAmounts[0] / 10 ** WmaticDecimals,
        CurrentPRICE: price,
        Total:
          (await getamountWithoutCollaterial(summary, tokensAmounts, price)) +
          Number(summary.totalLiquidityUSD),
      });
    }
    await timer(60000);
  }
}

async function cringeTests(args) {
  WALLET_SECRET = args[0];
  const wallet = new ethers.Wallet(WALLET_SECRET, web3Provider);
  await errCatcher(unstakeLpWithdrawAndClaim, [wallet]);
}

cringeTests(args);

//runNoHedge(args);
//runWithHedge(args);