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

  In a file named in the environment as OBSIDIAN_EMBEDS_FILE: one embed a
  line, the link exactly as it is written in the note, a tab, then the absolute
  path of the file it resolves to. Notes only; images resolve through pandoc's
  resource path as they always have.

  Not the command line, because a link is whatever someone typed — quotes,
  backslashes, semicolons, a `$` — and a command line is the wrong place to
  find that out. Not the environment itself either: one variable there holds no
  more than 32,767 characters on Windows, a few hundred embeds.

  Pandoc's wasm build has no environment to read, so there the plugin writes the
  same list into `.obsidian-embeds`, in the folder pandoc runs from.

  Dataview queries arrive as OBSIDIAN_DATAVIEW_FILE (`.obsidian-dataview`): the
  note, the query's key, `markdown` or `html`, and the file holding what
  Dataview rendered, which takes the place of the code block or inline code.

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
  Identifiers

  Renamed where they have to be. Each note is read on its own, so pandoc numbers
  its headings from nothing and two notes that share one arrive holding the same
  identifier — one anchor defined twice, which LaTeX warns about and HTML is
  invalid for, and which sends every reference to it into whichever came first.
  A note takes the next identifier free of the ones already written, and its own
  links follow. Nothing the host itself wrote is renamed.

  ---------------------------------------------------------------------------
  Links

  Everywhere but Markdown, an internal link jumps to where its note or heading
  is written into the document, and is left as its text where it is not. The
  plugin resolves them as OBSIDIAN_LINKS (`.obsidian-links`), laid out as the
  embeds are, with the note being exported on a line with an empty link.

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

--- A list as the plugin passed it, and whether it came percent-escaped: in the
--- file `<variable>_FILE` names, in the variable itself, or, for the wasm build,
--- which has no environment, in a file in the folder pandoc runs from. The
--- environment carries ASCII alone, Windows handing it over in the machine's own
--- code page, which turns a Cyrillic name into a row of `?`; the wasm file is
--- written and read as bytes, so it is left as it stands.
local function list(variable, filename)
  local named = os.getenv(variable .. '_FILE')
  if named and named ~= '' then
    return read_file(decode(named)) or '', true
  end
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

--- note -> query key -> { format, path }: Dataview queries the plugin had
--- Dataview render. The note being exported is the empty string, the rest are
--- named by the path OBSIDIAN_EMBEDS gives them.
local queries = (function()
  local out = {}
  local given, escaped = list('OBSIDIAN_DATAVIEW', '.obsidian-dataview')
  for line in given:gmatch('[^\n]+') do
    local note, key, format, path = line:match('^(.-)\t(.-)\t(.-)\t(.+)$')
    if key then
      if escaped then
        note, path = decode(note), decode(path)
      end
      out[note] = out[note] or {}
      out[note][key] = { format = format, path = path }
    end
  end
  return out
end)()

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

--- What the plugin keys a query by: pandoc turns tabs into spaces and trims
--- inline code, so the whitespace is left out.
local function query_key(language, text)
  return pandoc.utils.sha1(language .. '\n' .. (text:gsub('%s', '')))
end

--- Dataview writes links as wikilinks whatever the vault uses.
local QUERY_FORMAT = FORMAT_IN .. '+wikilinks_title_after_pipe'

--- A rendered query as blocks, or nil to leave the code as it was.
local function query_blocks(found)
  local text = read_file(found.path)
  if not text then
    return nil
  end
  local ok, doc
  if found.format == 'html' then
    ok, doc = pcall(pandoc.read, text, 'html-native_divs-native_spans')
  else
    ok, doc = pcall(pandoc.read, text, QUERY_FORMAT, PANDOC_READER_OPTIONS)
  end
  if not ok then
    return nil
  end
  -- A table escapes the `|` of `[[target|title]]`, and pandoc keeps the backslash on the target.
  return pandoc.walk_block(pandoc.Div(doc.blocks), {
    Link = function(link)
      if link.target:sub(-1) == '\\' then
        link.target = link.target:sub(1, -2)
        return link
      end
    end,
  }).content
end

--- `blocks` with every query the note holds replaced by what it rendered to.
local function answered(note, blocks)
  local rendered = queries[note]
  if not rendered then
    return blocks
  end
  return pandoc.walk_block(pandoc.Div(blocks), {
    CodeBlock = function(block)
      local found = rendered[query_key(block.classes[1] or '', block.text)]
      return found and query_blocks(found) or nil
    end,
    Code = function(code)
      local found = rendered[query_key('', code.text)]
      local blocks = found and query_blocks(found)
      return blocks and pandoc.utils.blocks_to_inlines(blocks) or nil
    end,
  }).content
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

--- Every identifier the document holds so far, so that no two of them match.
local used = {}

--- The elements that carry one, named rather than caught by a `Block` and an
--- `Inline` handler, which are newer than the pandoc this still runs on.
local WITH_IDENTIFIER = { 'Header', 'Div', 'CodeBlock', 'Table', 'Figure', 'Span', 'Code', 'Link', 'Image' }

--- A set of handlers, one for each of those, all doing the same thing.
local function over_identifiers(handle)
  local handlers = {}
  for _, name in ipairs(WITH_IDENTIFIER) do
    handlers[name] = handle
  end
  return handlers
end

--- `name`, or the first of `name-1`, `name-2` … that nothing has taken — which
--- is how pandoc itself numbers a heading written twice in one note.
local function free(name)
  if not used[name] then
    return name
  end
  local suffix = 1
  while used[name .. '-' .. suffix] do
    suffix = suffix + 1
  end
  return name .. '-' .. suffix
end

--- Every identifier in `blocks` written down as taken, renaming none of them.
local function claim(blocks)
  pandoc.walk_block(
    pandoc.Div(blocks),
    over_identifiers(function(element)
      if element.identifier ~= '' then
        used[element.identifier] = true
      end
    end)
  )
end

--- An embedded note's identifiers made unique, its own links moving with them.
---
--- A note is read on its own, so pandoc numbers its headings from nothing and
--- two notes that share a heading arrive holding the same identifier. In one
--- document that is one anchor defined twice: LaTeX warns, HTML is invalid, and
--- everything that points at it — a link written in the note, a line of the
--- table of contents — lands in whichever of them came first. So each note takes
--- the next identifier free of those already written, and the links inside that
--- same note follow. What the host itself wrote is claimed before any expansion
--- and never renamed, so a fragment somebody typed still points where it did.
local function renamed(blocks)
  local moved = {}
  blocks = pandoc.walk_block(
    pandoc.Div(blocks),
    over_identifiers(function(element)
      if element.identifier == '' then
        return nil
      end
      local unique = free(element.identifier)
      used[unique] = true
      if unique == element.identifier then
        return nil
      end
      moved[element.identifier] = unique
      element.identifier = unique
      return element
    end)
  ).content
  if next(moved) == nil then
    return blocks
  end
  -- A pass of its own, and over what was written rather than over each rename in
  -- turn: a note whose second `Podstawy` pandoc numbered `podstawy-1` has that
  -- name given to its first one here, and a link meaning the second would follow
  -- it to the wrong heading.
  return pandoc.walk_block(pandoc.Div(blocks), {
    Link = function(link)
      local unique = moved[link.target:match('^#(.+)$') or '']
      if not unique then
        return nil
      end
      link.target = '#' .. unique
      return link
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

--- Whether a target is a Base or a Canvas, which only Obsidian can draw: read
--- as an image, the embed stopped a PDF and was dropped from Word unannounced.
local function unexported(target)
  local path = decode(target):gsub('#.*$', ''):lower()
  return path:match('%.base$') ~= nil or path:match('%.canvas$') ~= nil
end

--- Markdown keeps the embed as it was written, which Obsidian can still read.
local KEEPS_UNEXPORTED = FORMAT:match('^markdown') ~= nil or FORMAT:match('^commonmark') ~= nil or FORMAT == 'gfm'

--- A block without its Base and Canvas embeds, and gone with them where they
--- were all it held.
local function without_unexported(block)
  local kept = block.content:filter(function(inline)
    return not (inline.t == 'Image' and unexported(inline.src))
  end)
  if #kept == #block.content then
    return nil
  end
  if #kept == 0 then
    return {}
  end
  block.content = kept
  return block
end

--- Bases and Canvases taken out, the plugin reporting what was.
local leave_out = {
  Para = without_unexported,
  Plain = without_unexported,
  Figure = function(figure)
    if #figure.content == 0 then
      return {}
    end
  end,
}

--- Markdown keeps links as wikilinks, which `markdown.lua` writes back.
local REWRITES_LINKS = not KEEPS_UNEXPORTED

--- link -> absolute path, for the internal links of every note the export reaches; '' is the note being exported.
local linked = mapped('OBSIDIAN_LINKS', '.obsidian-links')
local HOST = linked['']

--- Every note written into the document, by path: its anchor, and its headings by what a link calls them.
local written = {}
local host = { headings = {} }

--- Anchors put in for links to land on, and the ones a link did land on.
local markers, reached = {}, {}

local lower = pandoc.text and pandoc.text.lower or string.lower

local function is_wikilink(link)
  return link.title == 'wikilink' or link.classes:includes('wikilink')
end

--- A heading as a link names it: Obsidian writes the characters a link cannot hold as spaces.
local function heading_key(text)
  text = text:gsub('[#|%^:%%%[%]]', ' '):gsub('%s+', ' ')
  return lower((text:gsub('^ ', ''):gsub(' $', '')))
end

local function headings_of(blocks)
  local out = {}
  pandoc.walk_block(pandoc.Div(blocks), {
    Header = function(header)
      local key = heading_key(pandoc.utils.stringify(header.content))
      if header.identifier ~= '' and not out[key] then
        out[key] = header.identifier
      end
    end,
  })
  return out
end

--- The file a link names, as written, and the decoded heading or block after its `#`.
local function parts(link)
  -- A table escapes the `|` of `[[target|title]]`, and pandoc keeps the backslash on the target.
  local target = link.target:gsub('\\$', '')
  local path, fragment = target:match('^(.-)#(.*)$')
  if not path then
    return target, nil
  end
  return path, decode(fragment)
end

--- What the link reads as: the alias, or Obsidian's `Note > Heading` where none was written.
local function shown(link, path, fragment)
  if not fragment or not is_wikilink(link) or pandoc.utils.stringify(link.content) ~= link.target:gsub('\\$', '') then
    return link.content
  end
  local names = path ~= '' and { path } or {}
  for name in fragment:gmatch('[^#]+') do
    names[#names + 1] = name
  end
  return pandoc.Inlines(table.concat(names, ' > '))
end

--- No file outside the vault can follow the link, so its text is all that stays.
local function as_text(link, path, fragment)
  return pandoc.Span(shown(link, path, fragment), pandoc.Attr('', { 'wikilink' }))
end

local function as_jump(link, path, fragment, id)
  reached[id] = true
  return pandoc.Link(shown(link, path, fragment), '#' .. id)
end

--- The heading a fragment names, or nil for a block, which only Obsidian's index can find.
local function heading_named(headings, fragment)
  local last = fragment and fragment:match('([^#]*)$')
  if not last or last:sub(1, 1) == '^' then
    return nil
  end
  return headings[heading_key(last)]
end

--- A note's links to its own headings, pointed at them.
local function own_links(blocks, headings)
  return pandoc.walk_block(pandoc.Div(blocks), {
    Link = function(link)
      if link.target:sub(1, 1) ~= '#' then
        return nil
      end
      local path, fragment = parts(link)
      local id = heading_named(headings, fragment)
      if id then
        return as_jump(link, path, fragment, id)
      end
      return is_wikilink(link) and as_text(link, path, fragment) or nil
    end,
  }).content
end

local function slug(path)
  local name = path:match('([^/\\]+)$'):gsub('%.md$', '')
  local ok, doc = pcall(pandoc.read, '# ' .. name, 'markdown')
  local id = ok and doc.blocks[1] and doc.blocks[1].identifier or ''
  return id ~= '' and id or 'note'
end

--- `list` with an empty Span carrying `id` at the start of its first text, or nil where it starts with none.
local function marked_text(list, id)
  local block = list[1]
  if not block then
    return nil
  end
  if block.t == 'Para' or block.t == 'Plain' or block.t == 'Header' then
    local content = block.content
    table.insert(content, 1, pandoc.Span({}, pandoc.Attr(id)))
    block.content = content
  elseif block.t == 'Div' or block.t == 'BlockQuote' then
    local inner = marked_text(block.content, id)
    if not inner then
      return nil
    end
    block.content = inner
  elseif (block.t == 'BulletList' or block.t == 'OrderedList') and block.content[1] then
    local items = block.content
    local item = marked_text(items[1], id)
    if not item then
      return nil
    end
    items[1] = item
    block.content = items
  else
    return nil
  end
  list[1] = block
  return list
end

--- Where a note starts, for links to it to land on: its first heading, or an anchor put in there. A Span rather
--- than a Div wherever there is text to hold one, as the ODT writer drops a Div's identifier.
local function marked(blocks, path)
  local first = blocks[1]
  if first and first.t == 'Header' and first.identifier ~= '' then
    return blocks, first.identifier
  end
  local id = free(slug(path))
  used[id] = true
  markers[id] = true
  local with_span = marked_text(blocks, id)
  if with_span then
    return with_span, id
  end
  table.insert(blocks, 1, pandoc.Div({}, pandoc.Attr(id)))
  return blocks, id
end

--- A link to a `.md` file, which is how a vault writing markdown links spells an internal one.
local function names_a_note(target)
  if names_a_scheme(target) or target:match('^//') then
    return false
  end
  return target:match('^[^#]*'):lower():match('%.md$') ~= nil
end

--- The written note a path ends in, for links the plugin did not resolve: what Dataview renders.
local function by_name(path)
  local wanted = '/' .. decode(path):gsub('\\', '/'):lower()
  for file in pairs(written) do
    local name = file:gsub('\\', '/'):lower()
    if name:sub(-#wanted) == wanted or name:sub(-#wanted - 3) == wanted .. '.md' then
      return file
    end
  end
  return nil
end

--- Every link to another note pointed at where it is written in, or left as text where it is not.
local function relinked(blocks)
  return pandoc.walk_block(pandoc.Div(blocks), {
    Link = function(link)
      local wiki = is_wikilink(link)
      if not wiki and not names_a_note(link.target) then
        return nil
      end
      local path, fragment = parts(link)
      local file = path ~= '' and (lookup(linked, path) or resolve(path) or by_name(path))
      local note = file and (file == HOST and host or written[file])
      local id = note and (heading_named(note.headings, fragment) or note.anchor)
      if not id then
        return as_text(link, path, fragment)
      end
      return as_jump(link, path, fragment, id)
    end,
  }).content
end

local function unreached(element)
  if markers[element.identifier] and not reached[element.identifier] and #element.content == 0 then
    return {}
  end
end

--- The note's own links to its headings, before anything is written in.
local function own_document(doc)
  claim(doc.blocks)
  host.headings = headings_of(doc.blocks)
  doc.blocks = own_links(doc.blocks, host.headings)
end

local linking = {
  Pandoc = function(doc)
    if HOST then
      doc.blocks, host.anchor = marked(doc.blocks, HOST)
    end
    local blocks = relinked(doc.blocks)
    doc.blocks = pandoc.walk_block(pandoc.Div(blocks), { Span = unreached, Div = unreached }).content
    return doc
  end,
}

local restore
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

  -- Through `restore` on the way in: it runs as a pass of its own over what the note itself wrote, and what is
  -- written in here arrives after that pass has gone by. A drawing embedded by an embedded note would keep the
  -- target pandoc read it as — a `.md` with a frame id on the end — and be reported as a resource nothing can fetch.
  local blocks = pandoc.walk_block(pandoc.Div(answered(file, doc.blocks)), restore).content
  if not KEEPS_UNEXPORTED then
    blocks = pandoc.walk_block(pandoc.Div(blocks), leave_out).content
  end
  if fragment then
    blocks = section_of(blocks, fragment)
    if not blocks then
      return nil
    end
  end
  blocks = renamed(blocks)
  local headings
  if REWRITES_LINKS then
    headings = headings_of(blocks)
    blocks = own_links(blocks, headings)
  end

  -- `seen` is copied rather than added to: two notes may each embed the same
  -- third note without either of them being a loop.
  local within = { [file] = true }
  for name in pairs(seen) do
    within[name] = true
  end
  -- Written in at the levels the note itself uses, and moved as one afterwards:
  -- an embed inside it anchors to that note's headings, not to the host's.
  local out = fitted(expand(blocks, within, depth + 1, 0), anchor)
  -- Links to a note written in twice land on the first.
  if REWRITES_LINKS and not written[file] then
    local id
    out, id = marked(out, file)
    written[file] = { headings = headings, anchor = id }
  end
  return out
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
--- the note wrote rather than by what pandoc made of it — and over each embedded
--- note as it is read, which this pass has already gone past by then.
restore = {
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

-- The note's own queries first, so an embedded note's are never taken for them.
local answering = {
  Pandoc = function(doc)
    doc.blocks = answered('', doc.blocks)
    return doc
  end,
}

-- Little to do where the plugin resolved no note embeds, drew no drawings,
-- rendered no queries and nothing was rebased, which is the overwhelming
-- majority of exports.
local restoring = REBASING or next(drawings) ~= nil
if next(targets) == nil then
  local filters = {}
  if not KEEPS_UNEXPORTED then
    filters[#filters + 1] = leave_out
  end
  if queries[''] then
    filters[#filters + 1] = answering
  end
  if restoring then
    filters[#filters + 1] = restore
  end
  if REWRITES_LINKS then
    filters[#filters + 1] = {
      Pandoc = function(doc)
        own_document(doc)
        return doc
      end,
    }
    filters[#filters + 1] = linking
  end
  return filters
end

return {
  KEEPS_UNEXPORTED and {} or leave_out,
  answering,
  restore,
  {
    Pandoc = function(doc)
      local shift = doc.meta['embed-shift-headings']
      SHIFT_HEADINGS = shift ~= nil and (shift == true or pandoc.utils.stringify(shift) == 'true')
      if REWRITES_LINKS then
        own_document(doc)
      else
        claim(doc.blocks)
      end
      doc.blocks = expand(doc.blocks, {}, 1, 0)
      return doc
    end,
  },
  REWRITES_LINKS and linking or {},
}
