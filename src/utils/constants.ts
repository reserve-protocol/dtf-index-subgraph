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

export namespace TokenType {
  export const DTF = "DTF";
  export const VOTE = "VOTE";
  export const ASSET = "ASSET";
}

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

export namespace GovernanceType {
  export const OWNER = "OWNER";
  export const TRADING = "TRADING";
  export const VOTE_LOCKING = "VOTE_LOCKING";
}

export namespace PriceControl {
  export const NONE = 0;
  export const PARTIAL = 1;
  export const ATOMIC_SWAP = 2;
}

export namespace Role {
  export const DEFAULT_ADMIN =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  export const BRAND_MANAGER =
    "0x2d8e650da9bd8c373ab2450d770f2ed39549bfc28d3630025cecc51511bcd374";
  export const REBALANCE_MANAGER =
    "4ff6ae4d6a29e79ca45c6441bdc89b93878ac6118485b33c8baa3749fc3cb130";
  export const AUCTION_LAUNCHER =
    "0x13ff1b2625181b311f257c723b5e6d366eb318b212d9dd694c48fcf227659df5";
  // @deprecated role (v4.0)
  export const AUCTION_APPROVER =
    "0x2be23b023f3eee571adc019cdcf3f0bcf041151e6ff405a4bf0c4bfc6faea8c9";
}
