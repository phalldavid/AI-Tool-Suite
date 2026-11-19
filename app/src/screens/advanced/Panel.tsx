// The right-hand panel of the Advanced tab: the run (what will be rendered, what
// it costs, progress, Stop all) and the selected node's settings in a bigger view.
// It can be closed; the canvas then takes the full width.

import { NODE_DEFS } from "../../core/graph";
import type { EvalCache, RunCost, RunPlan } from "../../core/graph";
import { Icon } from "../../ui/Icon";
import { Body } from "./NodeCard";
import type { PortHandlers } from "./NodeCard";
import { setPanel, useCanvas } from "./session";
import { answerError, stopAll } from "./runner";
import { choosePictureFor } from "./Canvas";
import { S } from "./strings";

const PANEL_UI: PortHandlers = {
  headerDown: () => undefined,
  outDown: () => undefined,
  portClick: () => undefined,
  portKey: () => undefined,
  remove: () => undefined,
  choosePicture: (id, file) => choosePictureFor(id, file),
};

const STATUS: Record<string, string> = {
  waiting: S.waiting,
  rendering: S.rendering,
  done: S.done,
  failed: S.failed,
  skipped: S.skipped,
  stopped: S.stopped,
};

export function Panel({ outputs, plan, cost, blocker, where, again, setAgain }: {
  outputs: EvalCache;
  plan: RunPlan;
  cost: RunCost;
  blocker: string | null;
  where: string;
  again: boolean;
  setAgain: (v: boolean) => void;
}) {
  const open = useCanvas((s) => s.panel);
  const run = useCanvas((s) => s.run);
  const selected = useCanvas((s) => s.selected);
  const node = useCanvas((s) => (s.selected.length === 1 ? s.undo.present.nodes.find((n) => n.id === s.selected[0]) : undefined));
  const pictures = useCanvas((s) => s.pictures);
  if (!open) return null;
  const busy = run && (run.status === "running" || run.status === "paused");
  const failed = run?.status === "paused" ? run.jobs.find((j) => j.status === "failed") : undefined;
  return (
    <aside className="gpanel thin" aria-label={S.panel}>
      <div className="gpanel-head">
        <b>{S.panel}</b>
        <button type="button" className="icon-btn gclose" aria-label={S.closePanel} title={S.closePanel} onClick={() => setPanel(false)}>
          <Icon name="close" size={14} />
        </button>
      </div>

      <section className="gpanel-sec">
        <h3>{S.runTitle}</h3>
        <dl className="gfacts">
          <dt>{S.renders}</dt>
          <dd className="num">{plan.jobs.length}</dd>
          <dt>{S.cost}</dt>
          <dd>{cost.label}</dd>
          <dt>{S.renderer}</dt>
          <dd data-no-translate>{where}</dd>
        </dl>
        {plan.done.length ? <p className="gmuted num">{`${plan.done.length} already rendered, skipped`}</p> : null}
        {plan.noPicture.length ? <p className="gmuted num">{`${plan.noPicture.length} with no picture, skipped`}</p> : null}
        {plan.noSource.length ? <p className="gmuted num">{`${plan.noSource.length} waiting for the step before, skipped`}</p> : null}
        {plan.done.length || again ? (
          <label className="gcheck">
            <input type="checkbox" checked={again} disabled={Boolean(busy)} onChange={(e) => setAgain(e.target.checked)} />
            <span>{S.renderAgainHint}</span>
          </label>
        ) : null}
        {blocker && !busy ? <p className="gnote-warn">{blocker}</p> : null}
        {failed ? (
          <div className="gnote-bad" role="alert">
            <b data-no-translate>{failed.name}</b>
            <span>{failed.error}</span>
            <span>{S.failedAsk}</span>
            <div className="grow">
              <button type="button" className="btn gsmall" onClick={() => answerError(true)}>{S.goOn}</button>
              <button type="button" className="btn gsmall danger" onClick={() => answerError(false)}>{S.stopHere}</button>
            </div>
          </div>
        ) : null}
        {busy ? (
          <button type="button" className="btn danger" onClick={stopAll}>
            <Icon name="stop" size={16} />
            {S.stopAll}
          </button>
        ) : null}
        {run ? (
          <ol className="gjobs list" aria-live="polite">
            {run.jobs.map((j) => (
              <li key={j.key} className={`gjob t-${j.status}`}>
                <span className="gjob-dot" aria-hidden="true" />
                <span className="gjob-text" data-no-translate title={`${j.name} · ${j.lookName}`}>
                  <b>{j.name || "—"}</b>
                  <small>{j.lookName}</small>
                </span>
                <span>{STATUS[j.status]}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="gmuted">{S.noResults}</p>
        )}
      </section>

      <section className="gpanel-sec">
        <h3>{S.selectedTitle}</h3>
        {node && selected.length === 1 ? (
          <div className={`gpanel-node k-${node.kind}`}>
            <b className="gpanel-kind">{NODE_DEFS[node.kind].label}</b>
            <div className="gnode-body">
              <Body node={node} output={outputs.get(node.id)} picture={node.kind === "image" ? pictures[node.id] : undefined} ui={PANEL_UI} />
            </div>
          </div>
        ) : (
          <p className="gmuted">{S.nothingSelected}</p>
        )}
      </section>
    </aside>
  );
}
