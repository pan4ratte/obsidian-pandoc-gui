--[==[
  strip-wikilinks.lua — internal links out of the export, text and all.

  `[[Note]]`, `[[Note|alias]]`, `[[Note#Heading]]` and the `[Note](Note.md)` a
  vault with wikilinks switched off writes are removed whole. Embeds, images,
  attachments and external links are left as they are, and the note itself is
  never touched: this runs on the document pandoc has already read.

  (Long-bracket level 1, since the examples above write `]]` themselves.)
]==]

--- Newer pandoc marks a wikilink with the class, older pandoc with the title, and both are still in use.
local function is_wikilink(link)
  if link.title == 'wikilink' then
    return true
  end
  for _, class in ipairs(link.classes) do
    if class == 'wikilink' then
      return true
    end
  end
  return false
end

--- A vault writing markdown links spells an internal one as a relative `.md` path, or as a bare fragment.
local function is_internal(target)
  if target:match('^%a[%w+.%-]*:') or target:match('^//') then
    return false
  end
  return target:sub(1, 1) == '#' or target:match('^[^#]*'):lower():match('%.md$') ~= nil
end

local function strips(inline)
  -- `embeds.lua` leaves a link to a note outside the export as a Span of its text.
  if inline.t == 'Span' then
    return inline.classes:includes('wikilink')
  end
  return inline.t == 'Link' and (is_wikilink(inline) or is_internal(inline.target))
end

local function is_space(inline)
  return inline ~= nil and (inline.t == 'Space' or inline.t == 'SoftBreak')
end

function Inlines(inlines)
  local out, removed = {}, false
  for _, inline in ipairs(inlines) do
    if strips(inline) then
      removed = true
      -- The gap the link leaves closes up: the words either side keep one space between them, not two.
      if is_space(out[#out]) then
        table.remove(out)
      end
    else
      out[#out + 1] = inline
    end
  end
  if not removed then
    return nil
  end
  while is_space(out[1]) do
    table.remove(out, 1)
  end
  while is_space(out[#out]) do
    table.remove(out)
  end
  return pandoc.Inlines(out)
end

-- A paragraph that was nothing but a link is a paragraph no longer.
function Para(para)
  if #para.content == 0 then
    return {}
  end
end

function Plain(plain)
  if #plain.content == 0 then
    return {}
  end
end
