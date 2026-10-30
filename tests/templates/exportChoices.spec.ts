import { applyExportChoices, type CustomExportSetting, type PandocExportSetting } from '../../src/settings';
import { tocDepth } from '../../src/args/toc_args';

const pandoc: PandocExportSetting = {
  name: 'Word',
  type: 'pandoc',
  arguments: '-o "${outputPath}"',
  customArguments: '--toc',
  extension: '.docx',
};
const apply = (choices: Parameters<typeof applyExportChoices>[1]) => applyExportChoices(pandoc, choices) as PandocExportSetting;

describe('applyExportChoices', () => {
  test('no choices keep the template', () => {
    expect(applyExportChoices(pandoc)).toBe(pandoc);
  });

  test('a chosen depth replaces the template one', () => {
    expect(tocDepth(apply({ toc: 2 }).customArguments)).toBe(2);
  });

  test('an unset depth keeps the template one', () => {
    expect(apply({ join: { after: [] } }).customArguments).toBe('--toc');
  });

  test('chosen documents are carried over', () => {
    const join = { before: ['Cover.docx'] };
    expect(apply({ join }).joinChosen).toEqual(join);
  });

  test('a custom template is left alone', () => {
    const custom: CustomExportSetting = { name: 'Custom', type: 'custom', command: 'echo' };
    expect(applyExportChoices(custom, { toc: 2 })).toBe(custom);
  });
});
