// The confirm step before the canvas spends anything, like Review on the Render
// tab: how many renders, what they cost, which renderer, where the images go.
// Esc or Cancel goes back. An unknown cost needs a second press.

import { useState } from "react";
import { Sheet } from "../../ui/Sheet";
import { Icon } from "../../ui/Icon";
import { usd } from "../../lib/cost";
import type { RunCost } from "../../core/graph";
import type { Settings } from "../../core/settings";
import { S } from "./strings";

export function ConfirmRun({ n, cost, where, backend, testMode, balance, skipped, onCancel, onGo }: {
  n: number;
  cost: RunCost;
  where: string;
  backend: Settings["backend"];
  testMode: boolean;
  balance: number | null;
  skipped: number;
  onCancel: () => void;
  onGo: () => void;
}) {
  const [sure, setSure] = useState(false);
  const sent = testMode ? S.sentTest : backend === "kie" ? S.sentKie : backend === "gemini" ? S.sentGemini : S.sentComfy;
  const go = () => {
    if (cost.unknown && !sure) return setSure(true);
    onGo();
  };
  return (
    <Sheet
      open
      small
      onClose={onCancel}
      title={S.confirmTitle}
      foot={
        <div className="end">
          {/* Focus starts on Cancel, so Enter never spends by accident. */}
          <button type="button" className="btn ghost" autoFocus onClick={onCancel}>{S.cancel}</button>
          <button type="button" className="btn primary" onClick={go}>
            <Icon name="aperture" size={16} />
            {cost.unknown && sure ? (
              S.confirmAgain
            ) : (
              <>
                <span className="num">{`Render ${n}`}</span>
                <span aria-hidden="true">·</span>
                <span className="num">{cost.label}</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="sheet-body thin">
        <dl className="gfacts big">
          <dt>{S.renders}</dt>
          <dd className="num">{n}</dd>
          <dt>{S.cost}</dt>
          <dd className="num">
            {cost.label}
            {cost.credits !== null ? ` · ${usd(cost.credits)}` : ""}
          </dd>
          <dt>{S.renderer}</dt>
          <dd data-no-translate>{where}</dd>
          {backend === "kie" && !testMode ? (
            <>
              <dt>{S.balance}</dt>
              <dd className="num">{balance === null ? S.balanceUnknown : `${Math.round(balance * 100) / 100} credits`}</dd>
            </>
          ) : null}
          <dt>{S.where}</dt>
          <dd>{S.whereText}</dd>
        </dl>
        <p className="note">{sent}</p>
        <p className="note">{S.oneByOne}</p>
        {skipped ? <p className="gmuted num">{`${skipped} skipped: already made, or nothing to work on`}</p> : null}
        {cost.unknown ? (
          <div className="check warn">
            <Icon name="warn" size={18} style={{ color: "var(--warn)", marginTop: 1 }} />
            <div>
              <b>{S.costUnknownTitle}</b>
              <small>{S.costUnknownBody}</small>
            </div>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
