-- The document as the filters before this one left it, written out whatever the format, for a test to read.
function Pandoc(doc)
  return pandoc.Pandoc({ pandoc.RawBlock(FORMAT, pandoc.write(doc, 'native')) })
end
