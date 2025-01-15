import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { StakingToken, Token, Trade } from "../../generated/schema";
import { DTF } from "../../generated/templates/DTF/DTF";
import { BIGINT_ZERO, TradeState } from "./constants";
import { fetchTokenDecimals, fetchTokenName, fetchTokenSymbol } from "./tokens";

export function getOrCreateToken(tokenAddress: Address): Token {
  let token = Token.load(tokenAddress.toHexString());

  if (!token) {
    token = new Token(tokenAddress.toHexString());
    token.address = tokenAddress;
    token.name = fetchTokenName(tokenAddress);
    token.symbol = fetchTokenSymbol(tokenAddress);
    token.decimals = fetchTokenDecimals(tokenAddress);
    token.currentHolderCount = BigInt.fromI32(0);
    token.cumulativeHolderCount = BigInt.fromI32(0);
    token.transferCount = BigInt.fromI32(0);
    token.mintCount = BigInt.fromI32(0);
    token.burnCount = BigInt.fromI32(0);
    token.totalSupply = BigInt.fromI32(0);
    token.totalBurned = BigInt.fromI32(0);
    token.totalMinted = BigInt.fromI32(0);
    token.save();
  }

  return token as Token;
}

export function getOrCreateStakingToken(tokenAddress: Address): StakingToken {
  let stakingToken = StakingToken.load(tokenAddress.toHexString());

  if (!stakingToken) {
    stakingToken = new StakingToken(tokenAddress.toHexString());
    stakingToken.token = getOrCreateToken(tokenAddress).id;
    stakingToken.totalDelegates = BIGINT_ZERO;
    stakingToken.currentDelegates = BIGINT_ZERO;
    stakingToken.delegatedVotesRaw = BIGINT_ZERO;
    stakingToken.delegatedVotes = BigDecimal.fromString("0");
    stakingToken.save();
  }

  return stakingToken as StakingToken;
}

export function getOrCreateTrade(
  dtfAddress: Address,
  tradeId: BigInt,
  event: ethereum.Event
): Trade {
  const id = getId(dtfAddress.toHexString(), tradeId.toString());
  let trade = Trade.load(id);

  if (!trade) {
    let dtfContract = DTF.bind(dtfAddress);

    // If it fails, throw
    let tradeData = dtfContract.trades(tradeId);

    trade = new Trade(id);
    trade.dtf = dtfAddress.toHexString();
    trade.sell = getOrCreateToken(tradeData.getSell()).id;
    trade.buy = getOrCreateToken(tradeData.getBuy()).id;
    trade.selledAmount = BIGINT_ZERO;
    trade.boughtAmount = BIGINT_ZERO;
    trade.startPrice = tradeData.getStartPrice();
    trade.endPrice = tradeData.getEndPrice();
    // TODO: Wait for updated ABI and get this from chain
    trade.sellLimitSpot = BIGINT_ZERO;
    trade.sellLimitHigh = BIGINT_ZERO;
    trade.sellLimitLow = BIGINT_ZERO;
    trade.buyLimitSpot = BIGINT_ZERO;
    trade.buyLimitHigh = BIGINT_ZERO;
    trade.buyLimitLow = BIGINT_ZERO;
    trade.approvedSellLimitSpot = BIGINT_ZERO;
    trade.approvedBuyLimitSpot = BIGINT_ZERO;
    trade.approvedStartPrice = BIGINT_ZERO;
    trade.approvedEndPrice = BIGINT_ZERO;
    trade.availableAt = tradeData.getAvailableAt();
    trade.launchTimeout = tradeData.getLaunchTimeout();
    trade.start = BIGINT_ZERO;
    trade.end = BIGINT_ZERO;
    trade.approvedTimestamp = event.block.timestamp;
    trade.approvedBlockNumber = event.block.number;
    trade.approvedTransactionHash = event.transaction.hash.toHexString();
    trade.launchedTimestamp = BIGINT_ZERO;
    trade.launchedBlockNumber = BIGINT_ZERO;
    trade.launchedTransactionHash = "";
    trade.closedTimestamp = BIGINT_ZERO;
    trade.closedBlockNumber = BIGINT_ZERO;
    trade.closedTransactionHash = "";
    trade.isKilled = false;
    trade.state = TradeState.APPROVED;
    trade.save();
  }

  return trade as Trade;
}

function getId(a: string, b: string): string {
  return a.concat("-").concat(b);
}
