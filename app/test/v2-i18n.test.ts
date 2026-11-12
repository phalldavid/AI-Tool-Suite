import { test } from "node:test";
import assert from "node:assert/strict";
import { KM, translate } from "../src/lib/i18n";

test("Khmer: exact labels, patterns with numbers, unknown text untouched", () => {
  assert.equal(translate("Render"), KM.Render);
  assert.equal(translate("  Browse all "), `  ${KM["Browse all"]} `);
  assert.equal(translate("Render · 6 credits"), "រេនឌ័រ · 6 credits");
  assert.equal(translate("12 credits"), "12 ក្រេឌីត");
  assert.equal(translate("Quick actions for Zone B"), "សកម្មភាពរហ័សសម្រាប់តំបន់ B");
  assert.equal(translate("Nano Banana 2.1"), null);
});
