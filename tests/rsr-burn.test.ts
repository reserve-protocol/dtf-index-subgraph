import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  clearStore,
  describe,
  test,
  assert,
  beforeEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import { _handleRSRBurn } from "../src/dtf/handlers";
import { SECONDS_PER_DAY, SECONDS_PER_MONTH } from "../src/utils/constants";

const BURNER = Address.fromString(
  "0x1111111111111111111111111111111111111111"
);
const BURNER_2 = Address.fromString(
  "0x2222222222222222222222222222222222222222"
);

function createBurnEvent(
  blockNumber: BigInt,
  timestamp: BigInt,
  logIndex: BigInt
): ethereum.Event {
  let event = newMockEvent();
  event.block.number = blockNumber;
  event.block.timestamp = timestamp;
  event.logIndex = logIndex;
  return event;
}

describe("_handleRSRBurn", () => {
  beforeEach(() => {
    clearStore();
  });

  test("creates RSRBurn entity with correct fields", () => {
    let amount = BigInt.fromString("1000000000000000000");
    let event = createBurnEvent(
      BigInt.fromI32(100),
      BigInt.fromI32(1000),
      BigInt.fromI32(0)
    );

    _handleRSRBurn(amount, BURNER, event);

    let id = event.transaction.hash.toHex() + "-0";
    assert.fieldEquals("RSRBurn", id, "amount", amount.toString());
    assert.fieldEquals("RSRBurn", id, "burner", BURNER.toHexString());
    assert.fieldEquals("RSRBurn", id, "blockNumber", "100");
    assert.fieldEquals("RSRBurn", id, "timestamp", "1000");
  });

  test("creates RSRBurnGlobal on first burn", () => {
    let amount = BigInt.fromString("500");
    let event = createBurnEvent(
      BigInt.fromI32(100),
      BigInt.fromI32(1000),
      BigInt.fromI32(0)
    );

    _handleRSRBurn(amount, BURNER, event);

    assert.fieldEquals("RSRBurnGlobal", "1", "totalBurned", "500");
    assert.fieldEquals("RSRBurnGlobal", "1", "totalBurnCount", "1");
  });

  test("accumulates in RSRBurnGlobal across burns", () => {
    let event1 = createBurnEvent(
      BigInt.fromI32(100),
      BigInt.fromI32(1000),
      BigInt.fromI32(0)
    );
    let event2 = createBurnEvent(
      BigInt.fromI32(101),
      BigInt.fromI32(1001),
      BigInt.fromI32(1)
    );

    _handleRSRBurn(BigInt.fromI32(100), BURNER, event1);
    _handleRSRBurn(BigInt.fromI32(200), BURNER_2, event2);

    assert.fieldEquals("RSRBurnGlobal", "1", "totalBurned", "300");
    assert.fieldEquals("RSRBurnGlobal", "1", "totalBurnCount", "2");
  });

  test("creates daily snapshot", () => {
    let timestamp = BigInt.fromI32(86400); // exactly day 1
    let event = createBurnEvent(
      BigInt.fromI32(100),
      timestamp,
      BigInt.fromI32(0)
    );

    _handleRSRBurn(BigInt.fromI32(750), BURNER, event);

    let dayId = (timestamp.toI64() / SECONDS_PER_DAY).toString();
    assert.fieldEquals("RSRBurnDailySnapshot", dayId, "dailyBurnAmount", "750");
    assert.fieldEquals("RSRBurnDailySnapshot", dayId, "dailyBurnCount", "1");
    assert.fieldEquals(
      "RSRBurnDailySnapshot",
      dayId,
      "cumulativeBurned",
      "750"
    );
  });

  test("same-day burns accumulate in daily snapshot", () => {
    // Two burns on the same day (both at timestamp 90000, day 1)
    let timestamp = BigInt.fromI32(90000);
    let event1 = createBurnEvent(
      BigInt.fromI32(100),
      timestamp,
      BigInt.fromI32(0)
    );
    let event2 = createBurnEvent(
      BigInt.fromI32(101),
      timestamp,
      BigInt.fromI32(1)
    );

    _handleRSRBurn(BigInt.fromI32(300), BURNER, event1);
    _handleRSRBurn(BigInt.fromI32(400), BURNER_2, event2);

    let dayId = (timestamp.toI64() / SECONDS_PER_DAY).toString();
    assert.fieldEquals("RSRBurnDailySnapshot", dayId, "dailyBurnAmount", "700");
    assert.fieldEquals("RSRBurnDailySnapshot", dayId, "dailyBurnCount", "2");
  });

  test("creates monthly snapshot", () => {
    let timestamp = BigInt.fromI32(2592000); // exactly month 1
    let event = createBurnEvent(
      BigInt.fromI32(100),
      timestamp,
      BigInt.fromI32(0)
    );

    _handleRSRBurn(BigInt.fromI32(500), BURNER, event);

    let monthId = (timestamp.toI64() / SECONDS_PER_MONTH).toString();
    assert.fieldEquals(
      "RSRBurnMonthlySnapshot",
      monthId,
      "monthlyBurnAmount",
      "500"
    );
    assert.fieldEquals(
      "RSRBurnMonthlySnapshot",
      monthId,
      "monthlyBurnCount",
      "1"
    );
  });
});
