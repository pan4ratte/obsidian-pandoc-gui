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
  Heading levels

  Left alone unless the template asks with `-M embed-shift-headings=true`. Asked
  for, an embedded note is fitted under the heading it stands under: its
  shallowest heading becomes that heading's child, and the rest of the note
  moves with it, so a chapter written as `# Title` reads as `##` under
  `# Part one`. Only headings typed in the host count, so two embeds under one
  heading are siblings rather than a staircase; an embed with no heading above
  it is left as it stands.

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

--- The deepest a heading can be written: past it there is no heading left for
--- a writer to give, so what would go deeper is written at the bottom instead.
local MAX_LEVEL = 6

--- Whether an embedded note is fitted under the heading it stands under. Set
--- from the template editor, which writes `-M embed-shift-headings=true`.
local SHIFT_HEADINGS = false

--- Percent-decoding: for the escaping the environment is written with, and for
--- the vault that writes markdown links rather than wikilinks.
local function decode(text)
  return (text:gsub('%%(%x%x)', function(hex)
    return string.char(tonumber(hex, 16))
  end))
end

--- A list as the plugin passed it, and whether it came percent-escaped.
---
--- In the environment, or in a file in the folder pandoc runs from where there
--- is no environment to pass it in. The environment carries plain ASCII and
--- nothing else: Windows hands a program its environment in the machine's own
--- code page, and a note named in anything that code page cannot write arrived
--- here as a row of `?`, matched nothing, and was left in the document as the
--- broken image pandoc had read it to be. The file is written and read as bytes,
--- so it needs none of that and is left as it stands.
local function list(variable, filename)
  local given = os.getenv(variable)
  if given and given ~= '' then
    return given, true
  end
  local file = io.open(filename, 'r')
  if not file then
    return '', false
  end
  local text = file:read('a')
  file:close()
  return text, false
end

--- One list read out: the link exactly as a note wrote it, against the file it means.
local function mapped(variable, filename)
  local out = {}
  local given, escaped = list(variable, filename)
  for line in given:gmatch('[^\n]+') do
    local link, path = line:match('^(.-)\t(.+)$')
    if link and path then
      if escaped then
        link, path = decode(link), decode(path)
      end
      out[link] = path
    end
  end
  return out
end

--- link -> absolute path, as the plugin resolved them.
local targets = mapped('OBSIDIAN_EMBEDS', '.obsidian-embeds')

--- link -> the image file the plugin drew that Excalidraw drawing into.
---
--- A drawing is markdown and resolves like a note, so without this it would be
--- written into the document as one — the whole of the JSON it keeps its scene
--- in. Only the plugin can draw it, Excalidraw's own API being the one thing
--- that can resolve what a scene names, so the drawing arrives here already
--- drawn and all that is left is to point the image at it.
local drawings = mapped('OBSIDIAN_DRAWINGS', '.obsidian-drawings')

--- Whether `rebase_relative_paths` was switched on for this run.
local REBASING = (function()
  for _, extension in ipairs(PANDOC_READER_OPTIONS.extensions) do
    if tostring(extension) == 'rebase_relative_paths' then
      return true
    end
  end
  return false
end)()

--- The folder the note sits in, which is what a rebased path was rebased onto.
local SOURCE_DIR = REBASING and PANDOC_STATE.input_files[1] and PANDOC_STATE.input_files[1]:match('^(.*)[/\\][^/\\]*$')

--- A target with the rebasing taken back off it, or nil where there was none.
---
--- `rebase_relative_paths` writes the note's own folder in front of every path
--- it takes for a relative one, which is how this filter's own embeds arrive
--- named by something no vault ever wrote. The folder is known, so what was
--- written is recoverable.
local function unrebased(target)
  if not SOURCE_DIR or target:sub(1, #SOURCE_DIR) ~= SOURCE_DIR then
    return nil
  end
  return target:sub(#SOURCE_DIR + 1):match('^[/\\](.+)$')
end

--- What `map` holds for a target: as it stands, decoded, and un-rebased.
local function lookup(map, target)
  local found = map[target] or map[decode(target)]
  if found then
    return found
  end
  local written = unrebased(target)
  return written and (map[written] or map[decode(written)]) or nil
end

--- The file an embed's target names, or nil where it names none of ours.
local function resolve(target)
  return lookup(targets, target)
end

--- Whether a path names a scheme — a link to an app rather than to a file.
---
--- Pandoc leaves a URI alone when rebasing, but only where it knows the scheme:
--- one it has never heard of — `zotero:`, `obsidian:` — it reads as a relative
--- path and writes the note's folder in front of, leaving a link that opens
--- nothing. Anything that was written with a scheme is put back as it was.
local function names_a_scheme(path)
  return path:match('^%a[%a%d+.-]+:') ~= nil
end

--- A link or image target with a mistaken rebasing undone, or nil to leave it.
local function unmangled(target)
  local written = unrebased(target)
  if written and names_a_scheme(written) then
    return written
  end
  return nil
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

--- An embedded note's headings, moved to sit under the heading it stands under.
---
--- The note keeps its own shape: the shallowest heading in it becomes a child
--- of `anchor` and everything else moves by the same amount. A note standing
--- where no heading has been written yet has nothing to be a child of, and is
--- left as it is.
local function fitted(blocks, anchor)
  if not SHIFT_HEADINGS or anchor == 0 then
    return blocks
  end
  local top
  pandoc.walk_block(pandoc.Div(blocks), {
    Header = function(header)
      if not top or header.level < top then
        top = header.level
      end
    end,
  })
  local by = top and anchor + 1 - top or 0
  if by == 0 then
    return blocks
  end
  return pandoc.walk_block(pandoc.Div(blocks), {
    Header = function(header)
      header.level = math.max(1, math.min(MAX_LEVEL, header.level + by))
      return header
    end,
  }).content
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
local function blocks_of(target, seen, depth, anchor)
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
  -- Written in at the levels the note itself uses, and moved as one afterwards:
  -- an embed inside it anchors to that note's headings, not to the host's.
  return fitted(expand(blocks, within, depth + 1, 0), anchor)
end

--- Every list of blocks a block holds, rewritten in place.
local function descend(block, seen, depth, anchor)
  if block.t == 'Div' or block.t == 'BlockQuote' then
    block.content = expand(block.content, seen, depth, anchor)
  elseif block.t == 'BulletList' or block.t == 'OrderedList' then
    for index, item in ipairs(block.content) do
      block.content[index] = expand(item, seen, depth, anchor)
    end
  end
  return block
end

--- A list of blocks with every embed in it written out.
expand = function(blocks, seen, depth, anchor)
  local out = {}
  for _, block in ipairs(blocks) do
    local target = embed_target(block)
    local embedded = target and blocks_of(target, seen, depth, anchor)
    if embedded then
      for _, embedded_block in ipairs(embedded) do
        out[#out + 1] = embedded_block
      end
    else
      -- Only what the host itself says: headings written in by an embed would
      -- make the next embed that note's child rather than its sibling.
      if block.t == 'Header' then
        anchor = block.level
      end
      out[#out + 1] = descend(block, seen, depth, anchor)
    end
  end
  return pandoc.Blocks(out)
end

--- What an image is really pointing at: a drawing, drawn, or a mistaken rebasing
--- put back. Runs ahead of the rest, so what is written in is looked up by what
--- the note wrote rather than by what pandoc made of it.
local restore = {
  Link = function(link)
    local target = unmangled(link.target)
    if not target then
      return nil
    end
    link.target = target
    return link
  end,

  Image = function(image)
    local drawn = lookup(drawings, image.src)
    if drawn then
      -- Where the embed described nothing, pandoc captioned it with the target's
      -- own name — and the target is about to stop being that name.
      -- `wikilink_images.lua` takes such a caption off, but it runs after this and
      -- would no longer recognise one.
      if #image.caption > 0 and pandoc.utils.stringify(image.caption) == image.src then
        image.caption = pandoc.Inlines({})
      end
      image.src = drawn
      return image
    end
    local src = unmangled(image.src)
    if not src then
      return nil
    end
    image.src = src
    return image
  end,

  -- An embed on a line of its own is read as a Figure, and pandoc built that
  -- figure's caption out of the alt text before any filter saw it — its own
  -- copy, which changing the image no longer reaches. A drawing named and not
  -- described would be captioned with its file name; a drawing described keeps
  -- what was written, the caption then being something no link ever was.
  Figure = function(figure)
    if #figure.content ~= 1 then
      return nil
    end
    local body = figure.content[1]
    if (body.t ~= 'Plain' and body.t ~= 'Para') or #body.content ~= 1 then
      return nil
    end
    local image = body.content[1]
    if image.t ~= 'Image' or not lookup(drawings, pandoc.utils.stringify(figure.caption)) then
      return nil
    end
    -- A Para rather than a Plain, as `wikilink_images.lua` has it: the writers
    -- treat a lone Plain as compact body text.
    return pandoc.Para({ image })
  end,
}

-- Nothing to do at all where the plugin resolved no note embeds, drew no
-- drawings and nothing was rebased, which is the overwhelming majority of
-- exports.
local restoring = REBASING or next(drawings) ~= nil
if next(targets) == nil then
  return restoring and { restore } or {}
end

return {
  restore,
  {
    Pandoc = function(doc)
      local shift = doc.meta['embed-shift-headings']
      SHIFT_HEADINGS = shift ~= nil and (shift == true or pandoc.utils.stringify(shift) == 'true')
      doc.blocks = expand(doc.blocks, {}, 1, 0)
      return doc
    end,
  },
}
