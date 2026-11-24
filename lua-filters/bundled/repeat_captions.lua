-- repeat_captions.lua — a table's caption on every page the table runs over
--
-- LaTeX sets a long table across pages with its caption on the first one only.
-- Pandoc 3.14 repeats it on each page for a table with the `repeat-caption`
-- class, which a Markdown table has no way to write, so this gives it one.
-- Older Pandoc ignores the class.

function Table(tbl)
  if not FORMAT:match('latex') or #tbl.caption.long == 0 then
    return nil
  end
  if not tbl.classes:includes('repeat-caption') then
    tbl.classes:insert('repeat-caption')
  end
  return tbl
end
