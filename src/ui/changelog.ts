import { Component, MarkdownRenderer, Modal } from 'obsidian';
import { changelog } from '../lang/helpers';

/** What every release changed, rendered as the note it is written as. */
export class ChangelogModal extends Modal {
  // Scoped to the modal rather than the plugin, as the user guide's is — see `user_guide.ts`.
  private readonly renderComponent = new Component();

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('ex-changelog-modal');
    this.renderComponent.load();
    void MarkdownRenderer.render(this.app, changelog(), contentEl, '', this.renderComponent);
  }

  onClose(): void {
    this.renderComponent.unload();
    this.contentEl.empty();
  }
}
