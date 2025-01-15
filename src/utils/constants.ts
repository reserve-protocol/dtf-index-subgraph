import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

export const DEFAULT_DECIMALS = 18;
export const GENESIS_ADDRESS = "0x0000000000000000000000000000000000000000";

export const SECONDS_PER_DAY = 60 * 60 * 24;
export const SECONDS_PER_HOUR = 60 * 60;

export const BIGINT_ZERO = BigInt.fromI32(0);
export const BIGINT_ONE = BigInt.fromI32(1);
export const BIGINT_TWO = BigInt.fromI32(2);
export const BIGDECIMAL_ZERO = new BigDecimal(BIGINT_ZERO);
export const BIGDECIMAL_ONE = new BigDecimal(BIGINT_ONE);

export namespace TradeState {
  export const APPROVED = "APPROVED";
  export const LAUNCHED = "LAUNCHED";
  export const CLOSED = "CLOSED";
}

export namespace ProposalState {
  export const PENDING = "PENDING";
  export const ACTIVE = "ACTIVE";
  export const CANCELED = "CANCELED";
  export const DEFEATED = "DEFEATED";
  export const SUCCEEDED = "SUCCEEDED";
  export const QUEUED = "QUEUED";
  export const EXPIRED = "EXPIRED";
  export const EXECUTED = "EXECUTED";
}

export namespace VoteChoice {
  export const AGAINST_VALUE = 0;
  export const FOR_VALUE = 1;
  export const ABSTAIN_VALUE = 2;
  export const AGAINST = "AGAINST";
  export const FOR = "FOR";
  export const ABSTAIN = "ABSTAIN";
}
