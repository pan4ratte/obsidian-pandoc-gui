import { createMemo } from 'solid-js';
import { t } from '../../lang/helpers';
import { hasLuaFilterArg, type InstalledLuaFilter } from '../../filters/lua_filters';
import { runsInFormat } from '../../pandoc/pandoc_format';
import CheckGrid from '../components/CheckGrid';

/** Which installed lua filters this template runs. */
export default (props: {
  installed: InstalledLuaFilter[];
  format?: string;
  /** The template's extra arguments, which is where the flags live. */
  args?: string;
  onAdd: (fileName: string) => void;
  onRemove: (fileName: string) => void;
}) => {
  const items = createMemo(() =>
    props.installed
      .filter(filter => runsInFormat(filter.formats, props.format) || hasLuaFilterArg(props.args, filter.fileName))
      .sort((a, b) => a.storeName.localeCompare(b.storeName))
      .map(filter => ({
        value: filter.fileName,
        label: filter.storeName,
        // The file name is what the flag carries; two filters can share a store name.
        tooltip: filter.fileName,
        checked: hasLuaFilterArg(props.args, filter.fileName),
      }))
  );

  return (
    <CheckGrid
      items={items()}
      single={true}
      empty={props.installed.length === 0 ? t.LUA_FILTERS_NONE_INSTALLED : t.LUA_FILTERS_NONE_FOR_FORMAT}
      onToggle={(fileName, running) => (running ? props.onAdd(fileName) : props.onRemove(fileName))}
    />
  );
};
