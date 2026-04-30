---Function with multiple returns
---@param a integer
---@param b integer
---@param c integer
local function testMultiple(a, b, c)
    return a, b, c
end

local t1, t2, t3 = testMultiple(1, 2, 3)
print(t1, t2, t3)
