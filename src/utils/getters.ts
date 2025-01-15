import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { StakingToken, Token } from "../../generated/schema";
import { BIGINT_ZERO, TokenType } from "./constants";
import { fetchTokenDecimals, fetchTokenName, fetchTokenSymbol } from "./tokens";

export function getOrCreateToken(
  tokenAddress: Address,
  type: string = TokenType.ASSET
): Token {
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
    token.type = type;
    token.save();
  }

  return token as Token;
}

export function getOrCreateStakingToken(tokenAddress: Address): StakingToken {
  let stakingToken = StakingToken.load(tokenAddress.toHexString());

  if (!stakingToken) {
    stakingToken = new StakingToken(tokenAddress.toHexString());
    stakingToken.token = getOrCreateToken(tokenAddress, TokenType.VOTE).id;
    stakingToken.totalDelegates = BIGINT_ZERO;
    stakingToken.currentDelegates = BIGINT_ZERO;
    stakingToken.delegatedVotesRaw = BIGINT_ZERO;
    stakingToken.delegatedVotes = BigDecimal.fromString("0");
    stakingToken.save();
  }

  return stakingToken as StakingToken;
}
