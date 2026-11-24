-- Pandoc 3.8+ writes math environments as is, but only when \begin is the first thing in the math
if PANDOC_VERSION >= pandoc.types.Version('3.8.0') then
    return {
        {
            Math = function(elem)
                if elem.text:find("^%s*\\begin{") then
                    local text = elem.text:gsub("^%s*\\begin{", "\\begin{"):gsub("\\end{(.-)}%s*$", "\\end{%1}")
                    return pandoc.Math(elem.mathtype, text)
                end
            end,
        }
    }
end

-- Older Pandoc wraps these in \[ \], which LaTeX rejects
local math_environments = {
    displaymath = true,
    math = true,
    equation = true,
    ["equation*"] = true,
    gather = true,
    ["gather*"] = true,
    multline = true,
    ["multline*"] = true,
    eqnarray = true,
    ["eqnarray*"] = true,
    align = true,
    ["align*"] = true,
    alignat = true,
    ["alignat*"] = true,
    flalign = true,
    ["flalign*"] = true,
}

return {
    {
        Math = function(elem)
            local env = elem.text:match("^%s*\\begin{(%a+%*?)}")
            if env and math_environments[env] then
                return pandoc.RawInline('tex', elem.text)
            end
        end,
    }
}
