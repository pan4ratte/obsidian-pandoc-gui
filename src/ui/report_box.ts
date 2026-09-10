import type { App } from 'obsidian';
import { MessageBox } from './message_box';

/** One line of the pair above the output: what was run, and on what. */
export interface ReportFact {
  label: string;
  value: string;
  /** What hovering shows, where the value is a name and the whole path is worth having. */
  title?: string;
}

export interface RunReport {
  title: string;
  facts: ReportFact[];
  /** The command line itself, where the template asks for it to be shown. */
  command?: string;
  /** The program's own words, kept as it wrote them. */
  output?: string;
  /** The one line saying what to do next. */
  hint?: string;
  /** Whether the run failed or merely had something to say about itself. */
  tone: 'error' | 'warning';
  /** What the run goes on to do once the box has been read. */
  onClose?: () => void;
}

/**
 * How a finished run reports itself: what it was, what pandoc said, and — where it failed — what to do about it.
 *
 * The same box for both outcomes, because the reader wants the same things of it either way.
 */
export const reportRun = (app: App, report: RunReport): void => {
  const box = new MessageBox(app, {
    title: report.title,
    buttons: 'Ok',
    render: contentEl => {
      const root = contentEl.createDiv({ cls: ['ex-export-error', `is-${report.tone}`] });
      for (const { label, value, title } of report.facts) {
        root.createDiv({ cls: 'ex-export-error-fact' }, el => {
          el.createSpan({ cls: 'ex-export-error-label', text: label });
          el.createSpan({ cls: 'ex-export-error-value', text: value, title: title ?? value });
        });
      }
      if (report.command) {
        root.createDiv({ cls: 'ex-export-error-command', text: report.command });
      }
      if (report.output) {
        root.createDiv({ cls: 'ex-export-error-detail', text: report.output });
      }
      if (report.hint) {
        root.createDiv({ cls: 'ex-export-error-hint', text: report.hint });
      }
    },
  });
  if (report.onClose) {
    // Added to the modal's own closing rather than put in its place, as `confirm` does it.
    const close = box.onClose.bind(box);
    box.onClose = () => {
      close();
      report.onClose?.();
    };
  }
  box.open();
};
