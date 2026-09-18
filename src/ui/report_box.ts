import { setIcon, setTooltip } from 'obsidian';
import type PandocGuiPlugin from '../main';
import { t } from '../lang/helpers';
import { copyText, environmentLines, formatReport } from '../system/diagnostics';
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
  /** The command line itself: always in the copied report, on screen only where the template asks for it. */
  command?: string;
  showCommand?: boolean;
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
export const reportRun = (plugin: PandocGuiPlugin, report: RunReport): void => {
  const copy = async () => {
    const text = formatReport(
      report.title,
      [...report.facts.map(({ label, value, title }) => ({ label, value: title ?? value })), ...(await environmentLines(plugin))],
      [
        { label: t.REPORT_COMMAND, text: report.command, lang: 'sh' },
        { label: t.REPORT_OUTPUT, text: report.output },
      ]
    );
    await copyText(text, t.REPORT_COPIED);
  };
  const box = new MessageBox(plugin.app, {
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
      if (report.command && report.showCommand) {
        root.createDiv({ cls: 'ex-export-error-command', text: t.EXPORT_COMMAND_OUTPUT(report.command) });
      }
      if (report.output) {
        // A wrapper, so the button stays in the corner while the output scrolls.
        root.createDiv({ cls: 'ex-export-error-output' }, el => {
          el.createDiv({ cls: 'ex-export-error-detail', text: report.output });
          el.createDiv({ cls: ['clickable-icon', 'ex-export-error-copy'] }, button => {
            setIcon(button, 'copy');
            setTooltip(button, t.REPORT_COPY);
            button.onclick = () => void copy();
          });
        });
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
