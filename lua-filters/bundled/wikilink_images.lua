--[==[
  wikilink_images.lua — `![[image.png|описание|500]]`, read the way Obsidian reads it

  (Long-bracket level 1: the examples below are full of `]]`.)

  Pandoc's wikilink extension takes everything after the first `|` as the
  image's description, and where the embed names none it takes the target. That
  is not what the line says in Obsidian, where a trailing number is the width
  the image is drawn at, in pixels, and an embed naming nothing is simply an
  image:

  - `![[image.png|описание|500]]`  described, and 500 pixels wide
  - `![[image.png|500]]`           500 pixels wide, and nothing to caption it
  - `![[image.png|500x300]]`       both, where a height is given too
  - `![[image.png]]`               an image, not an image captioned "image.png"

  Left as pandoc read them, the first prints the width as part of the caption,
  and the last prints the file's own name under every image in the document.

  Only images the wikilink extension itself made are touched — a vault writing
  markdown links means `![описание](image.png)` as pandoc means it, and a size
  written there is a description that happens to be a number.
]==]

--- `alt` without the size Obsidian writes at the end of it, and that size.
---
--- Nothing where the embed names no size at all: a description ending in a
--- number is a description, and only a `|` — or an alt that is the size and
--- nothing else — makes it a width.
local function take_size(alt)
  local last = alt[#alt]
  if not last or last.t ~= 'Str' then
    return nil
  end
  local rest, width, height = last.text:match('^(.*)|(%d+)x(%d+)$')
  if not width then
    rest, width = last.text:match('^(.*)|(%d+)$')
  end
  if not width and #alt == 1 then
    width, height = last.text:match('^(%d+)x(%d+)$')
    if not width then
      width = last.text:match('^(%d+)$')
    end
    rest = width and '' or nil
  end
  if not width then
    return nil
  end
  local out = {}
  for index = 1, #alt - 1 do
    out[index] = alt[index]
  end
  if rest ~= '' then
    out[#out + 1] = pandoc.Str(rest)
  else
    -- The space that stood before the size would otherwise end the caption.
    while #out > 0 and out[#out].t == 'Space' do
      out[#out] = nil
    end
  end
  return pandoc.Inlines(out), width, height
end

--- What the wikilink reader wrote where the embed described nothing: the
--- target itself, which is a file name rather than a caption.
local function names_itself(image)
  return #image.caption > 0 and pandoc.utils.stringify(image.caption) == image.src
end

local function is_wikilink(image)
  return image.classes:includes('wikilink')
end

return {
  {
    Image = function(image)
      if not is_wikilink(image) then
        return nil
      end
      local alt, width, height = take_size(image.caption)
      if width then
        image.caption = alt
        image.attributes.width = width .. 'px'
        if height then
          image.attributes.height = height .. 'px'
        end
      end
      if names_itself(image) then
        image.caption = pandoc.Inlines({})
      end
      return image
    end,

    -- The caption pandoc built for an implicit figure is its own copy of the
    -- alt text, made before any of this, so it is written again from what the
    -- image now says. A figure with nothing left to say is not a figure.
    Figure = function(figure)
      if #figure.content ~= 1 then
        return nil
      end
      local body = figure.content[1]
      if (body.t ~= 'Plain' and body.t ~= 'Para') or #body.content ~= 1 then
        return nil
      end
      local image = body.content[1]
      if image.t ~= 'Image' or not is_wikilink(image) then
        return nil
      end
      if #image.caption == 0 then
        -- A Para rather than a Plain: `figures.lua` styles one for Word, and
        -- the writers treat a lone Plain as compact body text.
        return pandoc.Para({ image })
      end
      figure.caption.long = pandoc.Blocks({ pandoc.Plain(image.caption) })
      return figure
    end,
  },
}
