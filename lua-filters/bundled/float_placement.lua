-- float_placement.lua — a figure printed where it was written
--
-- In LaTeX a captioned image is a float: the page breaking carries it to
-- wherever it fits best, which in a note with two pictures and a paragraph
-- between them means both pictures at the top of a page and the writing that
-- explained them somewhere else. `H`, from the float package, is the placement
-- that means here and nowhere else.
--
-- Appended to `header-includes` rather than written with `-V`, so that a
-- template already carrying one of its own keeps it: pandoc reads every entry
-- of the list, and this is one more.

local PREAMBLE = [[\usepackage{float}
\floatplacement{figure}{H}]]

return {
  {
    Meta = function(meta)
      -- LaTeX is the only writer with floats to place. Elsewhere the raw block
      -- would simply be dropped, but there is no reason to write it at all.
      if not (FORMAT:match('latex') or FORMAT:match('beamer')) then
        return nil
      end
      local includes = meta['header-includes']
      if includes == nil then
        includes = pandoc.MetaList({})
      elseif includes.t ~= 'MetaList' then
        includes = pandoc.MetaList({ includes })
      end
      includes:insert(pandoc.MetaBlocks({ pandoc.RawBlock('latex', PREAMBLE) }))
      meta['header-includes'] = includes
      return meta
    end,
  },
}
