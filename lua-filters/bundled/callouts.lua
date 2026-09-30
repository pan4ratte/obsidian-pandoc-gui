-- callouts.lua — Obsidian's callouts as pandoc's alerts
--
-- The `alerts` reader takes only `> [!NOTE]`: no title or fold marker on the
-- marker line, and before 3.12 only in capitals. This turns the rest into the
-- same Div, and puts the type ahead of 3.12's `alert` class, since the
-- Markdown, DocBook, AsciiDoc, RST and Org writers read the first class.

local ALERTS = { note = true, tip = true, important = true, warning = true, caution = true }

local function is_break(inline)
  return inline.t == 'SoftBreak' or inline.t == 'LineBreak'
end

local function trim(inlines)
  while #inlines > 0 and inlines[1].t == 'Space' do
    inlines:remove(1)
  end
  while #inlines > 0 and inlines[#inlines].t == 'Space' do
    inlines:remove(#inlines)
  end
  return inlines
end

local function alert(kind, title, body)
  local heading = pandoc.Div({ pandoc.Para(title) }, pandoc.Attr('', { 'title' }))
  local blocks = pandoc.Blocks({ heading })
  blocks:extend(body)
  return pandoc.Div(blocks, pandoc.Attr('', { kind, 'alert' }))
end

function BlockQuote(quote)
  local first = quote.content[1]
  if not first or (first.t ~= 'Para' and first.t ~= 'Plain') or not first.content[1] or first.content[1].t ~= 'Str' then
    return nil
  end
  -- `[!type|metadata]±rest`
  local kind, rest = first.content[1].text:match('^%[!([^%]|%s]+)|?[^%]]*%][+-]?(.*)$')
  if not kind then
    return nil
  end
  kind = pandoc.text.lower(kind)

  local inlines = first.content
  local title = pandoc.Inlines({})
  if rest ~= '' then
    title:insert(pandoc.Str(rest))
  end
  local i = 2
  while i <= #inlines and not is_break(inlines[i]) do
    title:insert(inlines[i])
    i = i + 1
  end
  trim(title)
  if #title == 0 then
    title = pandoc.Inlines({ pandoc.Str(pandoc.text.upper(pandoc.text.sub(kind, 1, 1)) .. pandoc.text.sub(kind, 2)) })
  end

  local body = pandoc.Blocks({})
  local text = pandoc.Inlines({ table.unpack(inlines, i + 1) })
  if #text > 0 then
    body:insert(first.t == 'Para' and pandoc.Para(text) or pandoc.Plain(text))
  end
  body:extend({ table.unpack(quote.content, 2) })
  return alert(kind, title, body)
end

-- What the reader made itself: `alert` added before 3.12, moved behind the type from 3.12 on.
function Div(div)
  local classes = div.classes
  local heading = div.content[1]
  if not heading or heading.t ~= 'Div' or heading.classes[1] ~= 'title' then
    return nil
  end
  if classes[1] == 'alert' and ALERTS[classes[2]] then
    classes[1], classes[2] = classes[2], classes[1]
  elseif ALERTS[classes[1]] and not classes:includes('alert') then
    classes:insert(2, 'alert')
  else
    return nil
  end
  return div
end
