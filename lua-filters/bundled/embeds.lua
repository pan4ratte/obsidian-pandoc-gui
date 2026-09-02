--[==[
  embeds.lua — Obsidian's embedded notes, written into the document

  (Long-bracket level 1 throughout this comment: every `]]` an example writes
  would otherwise close it.)

  `![[Another note]]` is a transclusion: Obsidian shows that note's text in
  place. Pandoc has no idea. With wikilinks switched on it reads the line as an
  *image* whose target happens to be a note — so the export gets a broken image
  or a bare caption where a page of writing should be, and nobody notices until
  the document is read.

  This filter puts the writing back. It is handed the map of what each embed
  resolves to by the plugin, which is the only party that can resolve one:
  Obsidian's own link resolution — shortest unique path, aliases, the vault's
  attachment settings — lives in the app, not in the vault's folder layout.

  ---------------------------------------------------------------------------
  How the map arrives

  In the environment, as OBSIDIAN_EMBEDS: one embed a line, the link exactly as
  it is written in the note, a tab, then the absolute path of the file it
  resolves to. Notes only; images resolve through pandoc's resource path as
  they always have.

  The environment rather than the command line because a link is whatever
  someone typed — quotes, backslashes, semicolons, a `$` — and a command line
  is the wrong place to find that out.

  Pandoc's wasm build has no environment to read, so there the plugin writes the
  same list into `.obsidian-embeds`, in the folder pandoc runs from.

  ---------------------------------------------------------------------------
  What is embedded

  - `![[Note]]`            the whole note, minus its frontmatter
  - `![[Note#Heading]]`    that heading and everything under it, down to the
                           next heading of the same level or higher
  - `![[Note#^block]]`     left alone: a block id is not in the file's text in
                           any form this can find without Obsidian's index
  - `![[image.png]]`       left alone, being an image and pandoc's business

  A note embedded by an embedded note is embedded too. A note that embeds
  itself, however long the way round, is written in once and then left as it
  stands — which is the only way to keep a document finite.

  ---------------------------------------------------------------------------
  Why the blocks are rewritten by hand rather than by `walk`

  Both of the obvious ways to write this are wrong. Bottom-up, the `Plain` a
  figure holds is replaced before the figure is ever seen, leaving the note's
  text inside a `<figure>` with the link as its caption. Topdown, the blocks
  written in are walked again, and a note that embeds itself never stops.
  Rewriting each list of blocks explicitly settles both: what is written in has
  already been expanded, with the loop guard held, and is never looked at twice.
]==]

--- How deep one embed may reach before the document is simply too far in.
local MAX_DEPTH = 8

--- link -> absolute path, as the plugin resolved them.
local targets = {}

--- Percent-decoding: for the escaping the environment is written with, and for
--- the vault that writes markdown links rather than wikilinks.
local function decode(text)
  return (text:gsub('%%(%x%x)', function(hex)
    return string.char(tonumber(hex, 16))
  end))
end

--- The list as the plugin passed it, and whether it came percent-escaped.
---
--- In the environment, or in a file in the folder pandoc runs from where there
--- is no environment to pass it in. The environment carries plain ASCII and
--- nothing else: Windows hands a program its environment in the machine's own
--- code page, and a note named in anything that code page cannot write arrived
--- here as a row of `?`, matched nothing, and was left in the document as the
--- broken image pandoc had read it to be. The file is written and read as bytes,
--- so it needs none of that and is left as it stands.
local function embeds()
  local given = os.getenv('OBSIDIAN_EMBEDS')
  if given and given ~= '' then
    return given, true
  end
  local file = io.open('.obsidian-embeds', 'r')
  if not file then
    return '', false
  end
  local text = file:read('a')
  file:close()
  return text, false
end

local given, escaped = embeds()
for line in given:gmatch('[^\n]+') do
  local link, path = line:match('^(.-)\t(.+)$')
  if link and path then
    if escaped then
      link, path = decode(link), decode(path)
    end
    targets[link] = path
  end
end

--- The file an embed's target names, or nil where it names none of ours.
local function resolve(target)
  return targets[target] or targets[decode(target)]
end

--- The reader spec the note itself was read with, rebuilt.
---
--- An embedded note has to be read exactly as it would have been had it been
--- typed into the note embedding it — the vault's wikilinks above all, since
--- without them an embed inside an embed is left as the literal text it was.
--- The reader options a filter is handed carry the extensions that ended up
--- switched on but not the format spelling, so the spelling is rebuilt from
--- them: every extension that differs from what `markdown` does on its own,
--- named in the direction it differs.
local function reader_spec()
  local on = {}
  for _, extension in ipairs(PANDOC_READER_OPTIONS.extensions) do
    on[tostring(extension)] = true
  end
  local ok, all = pcall(pandoc.format.all_extensions, 'markdown')
  local ok_default, by_default = pcall(pandoc.format.default_extensions, 'markdown')
  if not (ok and ok_default) then
    -- Older pandoc: name what is on, and accept the defaults underneath.
    local spec = 'markdown'
    for name in pairs(on) do
      spec = spec .. '+' .. name
    end
    return spec
  end
  local default = {}
  for _, extension in ipairs(by_default) do
    default[tostring(extension)] = true
  end
  local spec = 'markdown'
  for _, extension in ipairs(all) do
    local name = tostring(extension)
    if on[name] and not default[name] then
      spec = spec .. '+' .. name
    elseif default[name] and not on[name] then
      spec = spec .. '-' .. name
    end
  end
  return spec
end

local FORMAT_IN = reader_spec()

--- A note's text, read through pandoc where pandoc can read it.
---
--- `io.open` goes through the C runtime, which on Windows takes a path in the
--- machine's own code page: a vault whose notes are named in anything but ASCII
--- — Cyrillic, Greek, an accented word — hands it a name it cannot find, and the
--- embed is left in the document as the broken image it was read as. Pandoc
--- reads a path as the text it is, on every platform, so the file is asked of it
--- first; `io.open` stays underneath for whatever pandoc will not fetch.
local function read_file(path)
  local ok, _, fetched = pcall(pandoc.mediabag.fetch, path)
  if ok and fetched then
    return fetched
  end
  local file = io.open(path, 'r')
  if not file then
    return nil
  end
  local text = file:read('a')
  file:close()
  return text
end

--- The heading a `#fragment` names, compared the way a reader would read it.
local function same_heading(block, wanted)
  return block.t == 'Header' and pandoc.utils.stringify(block.content):lower() == wanted:lower()
end

--- One section: the heading, and everything under it until the next of its rank.
local function section_of(blocks, wanted)
  local out, level = {}, nil
  for _, block in ipairs(blocks) do
    if level then
      if block.t == 'Header' and block.level <= level then
        break
      end
      out[#out + 1] = block
    elseif same_heading(block, wanted) then
      level = block.level
      out[#out + 1] = block
    end
  end
  return #out > 0 and out or nil
end

--- The one image a list of inlines holds, where that is all it holds.
local function lone_image(inlines)
  if #inlines == 1 and inlines[1].t == 'Image' then
    return inlines[1]
  end
  return nil
end

--- The embed a block *is*, as a target, or nil where the block is not one.
---
--- An embed on a line of its own is read as a Figure holding the image, or as
--- a bare Para or Plain where implicit figures are switched off. An embed with
--- text around it is left alone: what it means to write a page of prose into
--- the middle of a sentence is not a question this should answer.
local function embed_target(block)
  if block.t == 'Figure' then
    local content = block.content
    if #content == 1 and (content[1].t == 'Plain' or content[1].t == 'Para') then
      local image = lone_image(content[1].content)
      return image and image.src or nil
    end
    return nil
  end
  if block.t == 'Para' or block.t == 'Plain' then
    local image = lone_image(block.content)
    return image and image.src or nil
  end
  return nil
end

local expand

--- The blocks an embed stands for, or nil to leave the block as it was.
local function blocks_of(target, seen, depth)
  -- A block reference is a lookup in Obsidian's index, not a piece of the text.
  if depth > MAX_DEPTH or target:find('#%^') then
    return nil
  end
  local path, fragment = target:match('^(.-)#(.+)$')
  local file = resolve(target) or (path and resolve(path))
  if not file or seen[file] then
    return nil
  end

  local text = read_file(file)
  if not text then
    return nil
  end
  local ok, doc = pcall(pandoc.read, text, FORMAT_IN, PANDOC_READER_OPTIONS)
  if not ok then
    return nil
  end

  local blocks = doc.blocks
  if fragment then
    blocks = section_of(blocks, fragment)
    if not blocks then
      return nil
    end
  end

  -- `seen` is copied rather than added to: two notes may each embed the same
  -- third note without either of them being a loop.
  local within = { [file] = true }
  for name in pairs(seen) do
    within[name] = true
  end
  return expand(blocks, within, depth + 1)
end

--- Every list of blocks a block holds, rewritten in place.
local function descend(block, seen, depth)
  if block.t == 'Div' or block.t == 'BlockQuote' then
    block.content = expand(block.content, seen, depth)
  elseif block.t == 'BulletList' or block.t == 'OrderedList' then
    for index, item in ipairs(block.content) do
      block.content[index] = expand(item, seen, depth)
    end
  end
  return block
end

--- A list of blocks with every embed in it written out.
expand = function(blocks, seen, depth)
  local out = {}
  for _, block in ipairs(blocks) do
    local target = embed_target(block)
    local embedded = target and blocks_of(target, seen, depth)
    if embedded then
      for _, embedded_block in ipairs(embedded) do
        out[#out + 1] = embedded_block
      end
    else
      out[#out + 1] = descend(block, seen, depth)
    end
  end
  return pandoc.Blocks(out)
end

-- Nothing to do at all where the plugin resolved no note embeds, which is the
-- overwhelming majority of exports.
if next(targets) == nil then
  return {}
end

return {
  {
    Pandoc = function(doc)
      doc.blocks = expand(doc.blocks, {}, 1)
      return doc
    end,
  },
}
