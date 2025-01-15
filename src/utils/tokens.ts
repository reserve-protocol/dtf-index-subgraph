import { ERC20 } from "./../../generated/GovernanceDeployer/ERC20";
import { Address } from "@graphprotocol/graph-ts";

export const INVALID_TOKEN_DECIMALS = 18;
export const UNKNOWN_TOKEN_VALUE = "unknown";

export function fetchTokenSymbol(tokenAddress: Address): string {
  let contract = ERC20.bind(tokenAddress);

  // try types string and bytes32 for symbol
  let symbolValue = UNKNOWN_TOKEN_VALUE;
  let symbolResult = contract.try_symbol();
  if (!symbolResult.reverted) {
    return symbolResult.value;
  }

  return symbolValue;
}

export function fetchTokenName(tokenAddress: Address): string {
  let contract = ERC20.bind(tokenAddress);

  // try types string and bytes32 for name
  let nameValue = UNKNOWN_TOKEN_VALUE;
  let nameResult = contract.try_name();
  if (!nameResult.reverted) {
    return nameResult.value;
  }
  return nameValue;
}

export function fetchTokenDecimals(tokenAddress: Address): i32 {
  let contract = ERC20.bind(tokenAddress);

  // try types uint8 for decimals
  let decimalResult = contract.try_decimals();
  if (!decimalResult.reverted) {
    let decimalValue = decimalResult.value;
    return decimalValue;
  }

  return INVALID_TOKEN_DECIMALS as i32;
}
