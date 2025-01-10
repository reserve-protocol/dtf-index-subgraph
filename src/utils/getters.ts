import { Token } from "../../generated/schema";
import { fetchTokenDecimals } from "./tokens";
import { fetchTokenName } from "./tokens";
import { fetchTokenSymbol } from "./tokens";
import { Address, BigInt } from "@graphprotocol/graph-ts";

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
